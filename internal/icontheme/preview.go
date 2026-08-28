package icontheme

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"math"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	xdraw "golang.org/x/image/draw"
)

const (
	MaxInheritanceDepth             = 32
	MaxVisitedInheritedThemes       = 128
	MaxCandidatesPerConcept         = 512
	MaxSourceIconBytes        int64 = 8 << 20
	MaxRasterDimension              = 2048
	MaxPreviewSamples               = 3
	MaxPreviewCacheEntries          = 256
	MaxXPMColors                    = 4096
)

type previewConcept struct {
	kind     string
	names    []string
	contexts []string
}

var previewConcepts = []previewConcept{
	{
		kind:     "folder",
		names:    []string{"folder", "folder-open", "inode-directory"},
		contexts: []string{"places"},
	},
	{
		kind:     "utility",
		names:    []string{"utilities-terminal", "terminal", "system-run"},
		contexts: []string{"applications", "devices"},
	},
	{
		kind:     "application",
		names:    []string{"web-browser", "internet-web-browser", "application-x-executable"},
		contexts: []string{"applications"},
	},
}

// Preview returns safe raster samples for an installed theme ID.
func (c *Catalog) Preview(ctx context.Context, themeID string) (ThemePreview, error) {
	if err := ValidateID(themeID); err != nil {
		return ThemePreview{}, fmt.Errorf("invalid icon theme ID: %w", err)
	}
	if _, err := c.List(ctx); err != nil {
		return ThemePreview{}, err
	}

	c.mu.RLock()
	generation := c.generation
	c.mu.RUnlock()
	cacheKey := fmt.Sprintf("%d:%s", generation, themeID)
	c.previewMu.Lock()
	if cached, ok := c.previewCache[cacheKey]; ok {
		result := clonePreview(cached)
		c.previewMu.Unlock()
		return result, nil
	}
	c.previewMu.Unlock()
	select {
	case c.previewSem <- struct{}{}:
		defer func() { <-c.previewSem }()
	case <-ctx.Done():
		return ThemePreview{}, ctx.Err()
	}

	c.mu.RLock()
	record, ok := c.themes[themeID]
	themes := c.themes
	roots := append([]Root(nil), c.roots...)
	c.mu.RUnlock()
	if !ok {
		return ThemePreview{}, fmt.Errorf("icon theme %q is not installed", themeID)
	}
	canonicalRoots := canonicalizeRoots(roots)
	if len(canonicalRoots) == 0 {
		return ThemePreview{}, errors.New("no readable icon roots")
	}

	result := ThemePreview{ThemeID: themeID, Samples: make([]PreviewSample, 0, MaxPreviewSamples)}
	for _, concept := range previewConcepts {
		if err := ctx.Err(); err != nil {
			return ThemePreview{}, err
		}
		imageValue, found := findConceptImage(ctx, record, themes, canonicalRoots, concept)
		if !found {
			continue
		}
		encoded, err := rasterizePNG(imageValue)
		if err != nil {
			continue
		}
		result.Samples = append(result.Samples, PreviewSample{
			Kind:    concept.kind,
			PNGData: encodePNGDataURL(encoded),
		})
	}

	c.previewMu.Lock()
	if len(c.previewOrder) >= MaxPreviewCacheEntries {
		oldest := c.previewOrder[0]
		c.previewOrder = c.previewOrder[1:]
		delete(c.previewCache, oldest)
	}
	c.previewCache[cacheKey] = clonePreview(result)
	c.previewOrder = append(c.previewOrder, cacheKey)
	c.previewMu.Unlock()
	return clonePreview(result), nil
}

func findConceptImage(
	ctx context.Context,
	root *themeRecord,
	themes map[string]*themeRecord,
	approvedRoots []canonicalRoot,
	concept previewConcept,
) (image.Image, bool) {
	visited := make(map[string]bool)
	examined := 0
	var visit func(*themeRecord, int) (image.Image, bool)
	visit = func(record *themeRecord, depth int) (image.Image, bool) {
		if record == nil || depth > MaxInheritanceDepth || len(visited) >= MaxVisitedInheritedThemes || visited[record.id] {
			return nil, false
		}
		visited[record.id] = true
		if img, ok := findImageInRecord(ctx, record, approvedRoots, concept, &examined); ok {
			return img, true
		}
		for _, inheritedID := range record.metadata.inherits {
			if img, ok := visit(themes[inheritedID], depth+1); ok {
				return img, true
			}
		}
		return nil, false
	}
	return visit(root, 0)
}

func findImageInRecord(
	ctx context.Context,
	record *themeRecord,
	approvedRoots []canonicalRoot,
	concept previewConcept,
	examined *int,
) (image.Image, bool) {
	for _, fragment := range record.fragments {
		directories := append([]directoryMetadata(nil), record.metadata.directories...)
		if fragment.metadata != nil {
			directories = append(directories[:0], fragment.metadata.directories...)
		}
		sort.SliceStable(directories, func(i, j int) bool {
			return directoryScore(directories[i], concept) < directoryScore(directories[j], concept)
		})
		for _, directory := range directories {
			for _, name := range concept.names {
				for _, extension := range []string{".png", ".xpm", ".svg", ".svgz"} {
					if *examined >= MaxCandidatesPerConcept || ctx.Err() != nil {
						return nil, false
					}
					*examined++
					candidate := filepath.Join(fragment.path, filepath.FromSlash(directory.name), name+extension)
					resolved, err := resolveContained(candidate, approvedRoots, false)
					if err != nil {
						continue
					}
					switch extension {
					case ".png":
						if img, err := decodeBoundedPNG(resolved); err == nil {
							return img, true
						}
					case ".xpm":
						if img, err := decodeBoundedXPM(resolved); err == nil {
							return img, true
						}
					default:
						// Raw SVG/SVGZ is never decoded or returned. A future renderer
						// must prove script, external-reference, and resource bounds.
					}
				}
			}
		}
	}
	return nil, false
}

func directoryScore(directory directoryMetadata, concept previewConcept) int {
	contextPenalty := 10000
	for _, preferred := range concept.contexts {
		if strings.EqualFold(directory.context, preferred) {
			contextPenalty = 0
			break
		}
	}
	size := directory.size * max(directory.scale, 1)
	if directory.kind == "scalable" {
		minSize := directory.minSize * max(directory.scale, 1)
		maxSize := directory.maxSize * max(directory.scale, 1)
		if minSize > 0 && PreviewSize < minSize {
			size = minSize
		} else if maxSize > 0 && PreviewSize > maxSize {
			size = maxSize
		} else {
			size = PreviewSize
		}
	}
	if size == 0 {
		size = PreviewSize * 4
	}
	return contextPenalty + abs(size-PreviewSize)
}

func decodeBoundedPNG(path string) (image.Image, error) {
	data, err := readBoundedRegularFile(path, MaxSourceIconBytes)
	if err != nil {
		return nil, err
	}
	config, err := png.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	if config.Width <= 0 || config.Height <= 0 || config.Width > MaxRasterDimension || config.Height > MaxRasterDimension {
		return nil, errors.New("PNG dimensions exceed preview bounds")
	}
	return png.Decode(bytes.NewReader(data))
}

func decodeBoundedXPM(path string) (image.Image, error) {
	data, err := readBoundedRegularFile(path, MaxSourceIconBytes)
	if err != nil {
		return nil, err
	}
	lines := xpmStrings(data)
	if len(lines) == 0 {
		return nil, errors.New("XPM has no string data")
	}
	header := strings.Fields(lines[0])
	if len(header) < 4 {
		return nil, errors.New("invalid XPM header")
	}
	width, errWidth := strconv.Atoi(header[0])
	height, errHeight := strconv.Atoi(header[1])
	colorCount, errColors := strconv.Atoi(header[2])
	charsPerPixel, errCPP := strconv.Atoi(header[3])
	if errWidth != nil || errHeight != nil || errColors != nil || errCPP != nil ||
		width <= 0 || height <= 0 || width > MaxRasterDimension || height > MaxRasterDimension ||
		colorCount <= 0 || colorCount > MaxXPMColors || charsPerPixel <= 0 || charsPerPixel > 4 {
		return nil, errors.New("XPM header exceeds bounds")
	}
	if len(lines) < 1+colorCount+height {
		return nil, errors.New("truncated XPM")
	}
	palette := make(map[string]color.Color, colorCount)
	for _, line := range lines[1 : 1+colorCount] {
		if len(line) < charsPerPixel {
			return nil, errors.New("invalid XPM color entry")
		}
		key := line[:charsPerPixel]
		fields := strings.Fields(line[charsPerPixel:])
		value := ""
		for i := 0; i+1 < len(fields); i++ {
			if fields[i] == "c" {
				value = fields[i+1]
				break
			}
		}
		parsed, err := parseXPMColor(value)
		if err != nil {
			return nil, err
		}
		palette[key] = parsed
	}
	img := image.NewNRGBA(image.Rect(0, 0, width, height))
	for y, line := range lines[1+colorCount : 1+colorCount+height] {
		if len(line) != width*charsPerPixel {
			return nil, errors.New("invalid XPM pixel row")
		}
		for x := 0; x < width; x++ {
			key := line[x*charsPerPixel : (x+1)*charsPerPixel]
			value, ok := palette[key]
			if !ok {
				return nil, errors.New("unknown XPM palette key")
			}
			img.Set(x, y, value)
		}
	}
	return img, nil
}

func xpmStrings(data []byte) []string {
	lines := strings.Split(string(data), "\n")
	result := make([]string, 0, len(lines))
	for _, line := range lines {
		start := strings.IndexByte(line, '"')
		end := strings.LastIndexByte(line, '"')
		if start < 0 || end <= start {
			continue
		}
		value, err := strconv.Unquote(line[start : end+1])
		if err == nil {
			result = append(result, value)
		}
	}
	return result
}

func parseXPMColor(value string) (color.Color, error) {
	if strings.EqualFold(value, "None") {
		return color.NRGBA{}, nil
	}
	if len(value) == 4 && value[0] == '#' {
		r, errR := strconv.ParseUint(strings.Repeat(value[1:2], 2), 16, 8)
		g, errG := strconv.ParseUint(strings.Repeat(value[2:3], 2), 16, 8)
		b, errB := strconv.ParseUint(strings.Repeat(value[3:4], 2), 16, 8)
		if errR == nil && errG == nil && errB == nil {
			return color.NRGBA{R: uint8(r), G: uint8(g), B: uint8(b), A: 255}, nil
		}
	}
	if len(value) == 7 && value[0] == '#' {
		parsed, err := strconv.ParseUint(value[1:], 16, 32)
		if err == nil {
			return color.NRGBA{R: uint8(parsed >> 16), G: uint8(parsed >> 8), B: uint8(parsed), A: 255}, nil
		}
	}
	return nil, errors.New("unsupported XPM color")
}

func rasterizePNG(source image.Image) ([]byte, error) {
	bounds := source.Bounds()
	if bounds.Dx() <= 0 || bounds.Dy() <= 0 || bounds.Dx() > MaxRasterDimension || bounds.Dy() > MaxRasterDimension {
		return nil, errors.New("source dimensions exceed preview bounds")
	}
	scale := math.Min(float64(PreviewSize)/float64(bounds.Dx()), float64(PreviewSize)/float64(bounds.Dy()))
	width := max(1, int(math.Round(float64(bounds.Dx())*scale)))
	height := max(1, int(math.Round(float64(bounds.Dy())*scale)))
	resized := image.NewNRGBA(image.Rect(0, 0, width, height))
	xdraw.CatmullRom.Scale(resized, resized.Bounds(), source, bounds, draw.Over, nil)
	canvas := image.NewNRGBA(image.Rect(0, 0, PreviewSize, PreviewSize))
	offset := image.Pt((PreviewSize-width)/2, (PreviewSize-height)/2)
	draw.Draw(canvas, resized.Bounds().Add(offset), resized, image.Point{}, draw.Over)
	var output bytes.Buffer
	if err := png.Encode(&output, canvas); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

// encodePNGDataURL is kept in the backend boundary so source bytes and paths
// can never be returned accidentally by a preview implementation.
func encodePNGDataURL(data []byte) string {
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(data)
}

func clonePreview(preview ThemePreview) ThemePreview {
	result := preview
	result.Samples = append([]PreviewSample(nil), preview.Samples...)
	return result
}

func abs(value int) int {
	if value < 0 {
		return -value
	}
	return value
}
