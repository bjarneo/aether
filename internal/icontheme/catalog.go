package icontheme

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

const (
	MaxRoots                   = 64
	MaxEntriesPerRoot          = 4096
	MaxThemes                  = 1024
	MaxMetadataBytes     int64 = 1 << 20
	MaxMetadataLineBytes       = 64 << 10
	PreviewSize                = 96
)

// Origin identifies whether effective theme metadata came from a user or
// system icon root.
type Origin string

const (
	OriginUser   Origin = "user"
	OriginSystem Origin = "system"
)

// Root is an approved icon-theme search root.
type Root struct {
	Path   string
	Origin Origin
}

// ThemeSummary is the path-free catalog DTO returned to the frontend.
type ThemeSummary struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Inherits   []string `json:"inherits,omitempty"`
	Origin     Origin   `json:"origin"`
	HasPreview bool     `json:"hasPreview"`
}

// PreviewSample is one backend-rasterized representative icon.
type PreviewSample struct {
	Kind    string `json:"kind"`
	PNGData string `json:"pngData"`
}

// ThemePreview contains only bounded PNG data, never source paths or markup.
type ThemePreview struct {
	ThemeID string          `json:"themeId"`
	Samples []PreviewSample `json:"samples"`
}

type canonicalRoot struct {
	path   string
	origin Origin
}

type themeFragment struct {
	path     string
	origin   Origin
	metadata *themeMetadata
}

type themeRecord struct {
	id        string
	fragments []themeFragment
	metadata  themeMetadata
	origin    Origin
}

// BuildRoots applies XDG icon-root precedence to explicit environment values.
func BuildRoots(home, dataHome, dataDirs string) []Root {
	if !filepath.IsAbs(dataHome) {
		dataHome = filepath.Join(home, ".local", "share")
	}
	if dataDirs == "" {
		dataDirs = "/usr/local/share:/usr/share"
	}

	roots := make([]Root, 0, 6)
	seen := make(map[string]struct{})
	add := func(path string, origin Origin) {
		if len(roots) >= MaxRoots || !filepath.IsAbs(path) {
			return
		}
		path = filepath.Clean(path)
		if _, ok := seen[path]; ok {
			return
		}
		seen[path] = struct{}{}
		roots = append(roots, Root{Path: path, Origin: origin})
	}

	add(filepath.Join(dataHome, "icons"), OriginUser)
	if filepath.IsAbs(home) {
		add(filepath.Join(home, ".icons"), OriginUser)
	}
	for _, entry := range filepath.SplitList(dataDirs) {
		if entry == "" || !filepath.IsAbs(entry) {
			continue
		}
		add(filepath.Join(entry, "icons"), OriginSystem)
	}
	add("/usr/local/share/icons", OriginSystem)
	add("/usr/share/icons", OriginSystem)
	return roots
}

// Catalog is a cached, read-only installed icon-theme catalog.
type Catalog struct {
	roots         []Root
	rootsProvider func() []Root

	scanMu     sync.Mutex
	mu         sync.RWMutex
	loaded     bool
	items      []ThemeSummary
	themes     map[string]*themeRecord
	generation uint64

	previewMu    sync.Mutex
	previewCache map[string]ThemePreview
	previewOrder []string
	previewSem   chan struct{}
}

// NewCatalog uses icon roots from the current launch environment.
func NewCatalog() *Catalog {
	provider := func() []Root {
		home, _ := os.UserHomeDir()
		return BuildRoots(home, os.Getenv("XDG_DATA_HOME"), os.Getenv("XDG_DATA_DIRS"))
	}
	catalog := NewCatalogWithRoots(provider())
	catalog.rootsProvider = provider
	return catalog
}

// NewCatalogWithRoots constructs a catalog using injected approved roots.
func NewCatalogWithRoots(roots []Root) *Catalog {
	copyRoots := append([]Root(nil), roots...)
	if len(copyRoots) > MaxRoots {
		copyRoots = copyRoots[:MaxRoots]
	}
	return &Catalog{
		roots:        copyRoots,
		themes:       make(map[string]*themeRecord),
		previewCache: make(map[string]ThemePreview),
		previewSem:   make(chan struct{}, 4),
	}
}

// List returns a cached path-free catalog snapshot.
func (c *Catalog) List(ctx context.Context) ([]ThemeSummary, error) {
	c.mu.RLock()
	if c.loaded {
		items := cloneSummaries(c.items)
		c.mu.RUnlock()
		return items, nil
	}
	c.mu.RUnlock()
	return c.Refresh(ctx)
}

// Refresh rescans roots and atomically replaces the catalog snapshot.
func (c *Catalog) Refresh(ctx context.Context) ([]ThemeSummary, error) {
	c.scanMu.Lock()
	defer c.scanMu.Unlock()

	c.mu.RLock()
	roots := append([]Root(nil), c.roots...)
	c.mu.RUnlock()
	if c.rootsProvider != nil {
		roots = c.rootsProvider()
		if len(roots) > MaxRoots {
			roots = roots[:MaxRoots]
		}
	}
	items, themes, err := scanCatalog(ctx, roots)
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	c.items = cloneSummaries(items)
	c.themes = themes
	c.roots = append([]Root(nil), roots...)
	c.loaded = true
	c.generation++
	c.mu.Unlock()
	c.previewMu.Lock()
	c.previewCache = make(map[string]ThemePreview)
	c.previewOrder = nil
	c.previewMu.Unlock()
	return cloneSummaries(items), nil
}

func scanCatalog(ctx context.Context, roots []Root) ([]ThemeSummary, map[string]*themeRecord, error) {
	canonical := canonicalizeRoots(roots)
	fragments := make(map[string][]themeFragment)
	readableRoots := 0
	for _, root := range canonical {
		if err := ctx.Err(); err != nil {
			return nil, nil, err
		}
		names, err := boundedDirectoryNames(root.path)
		if err != nil {
			continue
		}
		readableRoots++
		for _, name := range names {
			if err := ctx.Err(); err != nil {
				return nil, nil, err
			}
			if ValidateID(name) != nil {
				continue
			}
			path, err := resolveContained(filepath.Join(root.path, name), canonical, true)
			if err != nil {
				continue
			}
			fragment := themeFragment{path: path, origin: root.origin}
			if !containsFragment(fragments[name], fragment.path) {
				fragments[name] = append(fragments[name], fragment)
			}
		}
	}
	if len(canonical) > 0 && readableRoots == 0 {
		return nil, nil, errors.New("no approved icon roots are readable")
	}

	ids := make([]string, 0, len(fragments))
	for id := range fragments {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	items := make([]ThemeSummary, 0, len(ids))
	themes := make(map[string]*themeRecord, len(ids))
	for _, id := range ids {
		if err := ctx.Err(); err != nil {
			return nil, nil, err
		}
		var effective themeMetadata
		var origin Origin
		found := false
		recordFragments := append([]themeFragment(nil), fragments[id]...)
		for i := range recordFragments {
			fragment := &recordFragments[i]
			metadata, err := parseThemeMetadata(filepath.Join(fragment.path, "index.theme"), canonical)
			if err != nil {
				continue
			}
			fragment.metadata = &metadata
			if !found {
				effective = metadata
				origin = fragment.origin
				found = true
			}
		}
		if !found || effective.hidden {
			continue
		}
		for i := range recordFragments {
			if recordFragments[i].metadata == nil {
				recordFragments[i].metadata = &effective
			}
		}
		name := effective.name
		if name == "" {
			name = id
		}
		hasPreview := len(effective.inherits) > 0
		for _, fragment := range recordFragments {
			if fragment.metadata != nil && len(fragment.metadata.directories) > 0 {
				hasPreview = true
				break
			}
		}
		record := &themeRecord{id: id, fragments: recordFragments, metadata: effective, origin: origin}
		themes[id] = record
		items = append(items, ThemeSummary{
			ID:         id,
			Name:       name,
			Inherits:   append([]string(nil), effective.inherits...),
			Origin:     origin,
			HasPreview: hasPreview,
		})
		if len(items) >= MaxThemes {
			break
		}
	}
	sort.Slice(items, func(i, j int) bool {
		left := strings.ToLower(items[i].Name)
		right := strings.ToLower(items[j].Name)
		if left == right {
			return items[i].ID < items[j].ID
		}
		return left < right
	})
	return items, themes, nil
}

func canonicalizeRoots(roots []Root) []canonicalRoot {
	result := make([]canonicalRoot, 0, len(roots))
	seen := make(map[string]struct{})
	for _, root := range roots {
		if len(result) >= MaxRoots || !filepath.IsAbs(root.Path) {
			continue
		}
		canonical, err := filepath.EvalSymlinks(filepath.Clean(root.Path))
		if err != nil {
			continue
		}
		info, err := os.Stat(canonical)
		if err != nil || !info.IsDir() {
			continue
		}
		canonical = filepath.Clean(canonical)
		if _, ok := seen[canonical]; ok {
			continue
		}
		seen[canonical] = struct{}{}
		result = append(result, canonicalRoot{path: canonical, origin: root.Origin})
	}
	return result
}

func boundedDirectoryNames(path string) ([]string, error) {
	dir, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer dir.Close()
	names, err := dir.Readdirnames(MaxEntriesPerRoot + 1)
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, err
	}
	if len(names) > MaxEntriesPerRoot {
		names = names[:MaxEntriesPerRoot]
	}
	sort.Strings(names)
	return names, nil
}

func resolveContained(path string, roots []canonicalRoot, wantDir bool) (string, error) {
	if _, err := os.Lstat(path); err != nil {
		return "", err
	}
	resolved, err := filepath.EvalSymlinks(path)
	if err != nil {
		return "", err
	}
	resolved = filepath.Clean(resolved)
	contained := false
	for _, root := range roots {
		if pathWithin(root.path, resolved) {
			contained = true
			break
		}
	}
	if !contained {
		return "", errors.New("resolved path escapes approved icon roots")
	}
	info, err := os.Stat(resolved)
	if err != nil {
		return "", err
	}
	if wantDir != info.IsDir() || (!wantDir && !info.Mode().IsRegular()) {
		return "", errors.New("resolved path has unexpected file type")
	}
	return resolved, nil
}

func pathWithin(root, candidate string) bool {
	rel, err := filepath.Rel(root, candidate)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && !filepath.IsAbs(rel))
}

func containsFragment(fragments []themeFragment, path string) bool {
	for _, fragment := range fragments {
		if fragment.path == path {
			return true
		}
	}
	return false
}

func cloneSummaries(items []ThemeSummary) []ThemeSummary {
	result := make([]ThemeSummary, len(items))
	for i, item := range items {
		result[i] = item
		result[i].Inherits = append([]string(nil), item.Inherits...)
	}
	return result
}
