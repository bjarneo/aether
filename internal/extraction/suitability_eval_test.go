package extraction

// Suitability evaluation harness. Not a unit test in the usual sense: it samples
// real wallpapers, runs the (cache-bypassed) extraction pipeline, scores how well
// each palette suits its source image, and renders contact sheets for visual
// inspection. Guarded behind AETHER_EVAL=1 so `make test` stays fast/clean.
//
//	AETHER_EVAL=1 AETHER_EVAL_LIST=/tmp/all_wp.txt AETHER_EVAL_N=100 \
//	  go test ./internal/extraction/ -run TestSuitabilityEval -v -timeout 600s
//
// Outputs to /tmp/aether-eval/: per-image composites, contact sheets (sheet_*.png),
// and report.txt (worst-first) + report.csv.

import (
	"bufio"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math"
	"os"
	"sort"
	"strconv"
	"strings"
	"testing"

	acolor "aether/internal/color"

	"golang.org/x/image/draw"
	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
)

// ---- per-image diagnostics --------------------------------------------------

type evalResult struct {
	path    string
	palette [16]string

	// reference image stats
	isMono       bool    // path the algorithm took
	imgMeanC     float64 // mean OKLCH chroma over sampled pixels (true image saturation)
	imgAchroFrac float64 // fraction of pixels below MonochromeChromaThreshold
	imgDomHue    float64 // chroma-weighted circular mean hue of the image
	imgHasHue    bool

	// suitability metrics (higher = better unless noted)
	bgFgContrast  float64 // want >= 7
	minAnsiCon    float64 // min ANSI(1-6) vs bg; want >= 4.5
	ansiMinDeltaE float64 // smallest pairwise OKLab distance among slots 1-6 (distinguishability)
	hueSupport    float64 // fraction of chromatic accents whose hue is present in the image
	chromaFidel   float64 // 1 = palette accent chroma proportional to image; <1 dull, >1 invented vividness
	bgHueAlign    float64 // hue distance bg<->image dominant (deg); lower better, only if both chromatic

	score float64 // overall 0..1, higher better
	flags []string
}

func TestSuitabilityEval(t *testing.T) {
	if os.Getenv("AETHER_EVAL") != "1" {
		t.Skip("set AETHER_EVAL=1 to run the suitability evaluation harness")
	}
	listPath := envOr("AETHER_EVAL_LIST", "/tmp/all_wp.txt")
	n := envInt("AETHER_EVAL_N", 100)
	lightMode := os.Getenv("AETHER_EVAL_LIGHT") == "1"
	outDir := envOr("AETHER_EVAL_OUT", "/tmp/aether-eval")
	excludePath := os.Getenv("AETHER_EVAL_EXCLUDE") // optional: paths to skip (disjoint batches)
	_ = os.MkdirAll(outDir, 0o755)

	paths := sampleN(t, listPath, n, loadExclude(excludePath))
	// Record exactly which images this run used, so a later run can exclude them.
	_ = os.WriteFile(outDir+"/sample.txt", []byte(strings.Join(paths, "\n")+"\n"), 0o644)
	t.Logf("evaluating %d images (lightMode=%v, excluded=%d)", len(paths), lightMode, len(loadExclude(excludePath)))

	results := make([]evalResult, 0, len(paths))
	for _, p := range paths {
		r, err := evaluateImage(p, lightMode)
		if err != nil {
			t.Logf("skip %s: %v", p, err)
			continue
		}
		results = append(results, r)
	}

	// Sort worst-first so problems surface at the top of the report and sheets.
	sort.Slice(results, func(i, j int) bool { return results[i].score < results[j].score })

	writeReport(t, outDir, results)
	renderSheets(t, outDir, results)
	renderComposites(t, outDir, results)

	// Summary stats
	var sum, minS float64 = 0, 1
	flagCounts := map[string]int{}
	for _, r := range results {
		sum += r.score
		if r.score < minS {
			minS = r.score
		}
		for _, f := range r.flags {
			flagCounts[f]++
		}
	}
	t.Logf("mean score %.3f  min %.3f  n=%d", sum/float64(len(results)), minS, len(results))
	type fc struct {
		f string
		c int
	}
	var fcs []fc
	for f, c := range flagCounts {
		fcs = append(fcs, fc{f, c})
	}
	sort.Slice(fcs, func(i, j int) bool { return fcs[i].c > fcs[j].c })
	for _, x := range fcs {
		t.Logf("flag %-22s %d", x.f, x.c)
	}
	t.Logf("report: %s/report.txt  sheets: %s/sheet_*.png", outDir, outDir)
}

// evaluateImage reproduces the extractor's cache-bypassed path and scores the result.
func evaluateImage(path string, lightMode bool) (evalResult, error) {
	r := evalResult{path: path}

	pixels, err := LoadAndSamplePixels(path)
	if err != nil {
		return r, err
	}
	dominant, counts, err := ExtractDominantColorsFromPixels(pixels, DominantColorsToExtract)
	if err != nil {
		return r, err
	}
	if len(dominant) < 8 {
		return r, fmt.Errorf("not enough colors")
	}

	// True image saturation/hue stats from the sampled pixels (not the quantized set).
	var cSum, sinSum, cosSum, wSum float64
	achro := 0
	for _, px := range pixels {
		lch := acolor.RGBToOKLCH(px)
		cSum += lch.C
		if lch.C < MonochromeChromaThreshold {
			achro++
		}
		if lch.C > 0.01 {
			rad := lch.H * math.Pi / 180
			sinSum += math.Sin(rad) * lch.C
			cosSum += math.Cos(rad) * lch.C
			wSum += lch.C
		}
	}
	r.imgMeanC = cSum / float64(len(pixels))
	r.imgAchroFrac = float64(achro) / float64(len(pixels))
	if wSum > 0 {
		r.imgDomHue = math.Mod(math.Atan2(sinSum/wSum, cosSum/wSum)*180/math.Pi+360, 360)
		r.imgHasHue = r.imgMeanC > 0.01
	}

	weights := normalizeCounts(counts)
	r.isMono = isMonochromeWeighted(dominant, weights)
	r.palette = NormalizeBrightness(GeneratePaletteByMode(dominant, weights, lightMode, "normal"))

	scoreResult(&r, dominant, lightMode)
	return r, nil
}

// scoreResult fills the suitability metrics + overall score + flags.
func scoreResult(r *evalResult, dominant []string, lightMode bool) {
	pal := r.palette

	// --- contrast (hard readability requirements) ---
	r.bgFgContrast = acolor.ContrastRatio(pal[0], pal[7])
	r.minAnsiCon = math.Inf(1)
	for i := 1; i <= 6; i++ {
		c := acolor.ContrastRatio(pal[0], pal[i])
		if c < r.minAnsiCon {
			r.minAnsiCon = c
		}
	}

	// --- ANSI distinguishability: smallest pairwise OKLab distance among 1-6 ---
	r.ansiMinDeltaE = math.Inf(1)
	for i := 1; i <= 6; i++ {
		for j := i + 1; j <= 6; j++ {
			d := acolor.OKLabDistance(acolor.HexToOKLab(pal[i]), acolor.HexToOKLab(pal[j]))
			if d < r.ansiMinDeltaE {
				r.ansiMinDeltaE = d
			}
		}
	}

	// --- hue support: does each chromatic accent hue actually occur in the image? ---
	// Build the set of image hues that carry real chroma (from dominant colors).
	type hc struct{ h, c float64 }
	var imgHues []hc
	for _, d := range dominant {
		lch := acolor.HexToOKLCH(d)
		if lch.C >= 0.03 {
			imgHues = append(imgHues, hc{lch.H, lch.C})
		}
	}
	chromAccents, supported := 0, 0
	for i := 1; i <= 6; i++ {
		lch := acolor.HexToOKLCH(pal[i])
		if lch.C < 0.04 {
			continue // achromatic accent: no hue to support (mono palettes)
		}
		chromAccents++
		best := 180.0
		for _, ih := range imgHues {
			if d := CalculateHueDistance(lch.H, ih.h); d < best {
				best = d
			}
		}
		if best <= 30 {
			supported++
		}
	}
	if chromAccents == 0 {
		r.hueSupport = 1 // grayscale palette for a gray image: trivially faithful
	} else {
		r.hueSupport = float64(supported) / float64(chromAccents)
	}

	// --- chroma fidelity: accent saturation vs image saturation ---
	var accentC float64
	nc := 0
	for i := 1; i <= 6; i++ {
		accentC += acolor.HexToOKLCH(pal[i]).C
		nc++
	}
	accentC /= float64(nc)
	// Expected accent chroma tracks the image's SALIENT chroma (the saturation of
	// its most colorful regions), not the pixel mean: a mostly-gray image with a
	// vivid logo should legitimately yield vivid accents in that logo's hue family,
	// so comparing against the mean would wrongly flag it as oversaturated.
	expected := clampF(salientChroma(dominant), 0.05, 0.16)
	r.chromaFidel = accentC / expected

	// --- bg hue alignment (only meaningful when both bg and image are chromatic) ---
	bgLch := acolor.HexToOKLCH(pal[0])
	if bgLch.C >= 0.01 && r.imgHasHue {
		r.bgHueAlign = CalculateHueDistance(bgLch.H, r.imgDomHue)
	} else {
		r.bgHueAlign = 0
	}

	// --- aggregate score + flags ---
	score := 1.0
	r.flags = nil
	add := func(f string) { r.flags = append(r.flags, f) }

	// Contrast: heavy penalties (these are correctness, not taste).
	if r.bgFgContrast < 7 {
		score -= 0.30
		add("bgfg_contrast<7")
	}
	if r.bgFgContrast < 4.5 {
		score -= 0.20
		add("bgfg_contrast<4.5")
	}
	if r.minAnsiCon < 4.5 {
		score -= 0.25
		add("ansi_contrast<4.5")
	}

	// Distinguishability: ANSI slots that collapse together are unusable for syntax.
	if r.ansiMinDeltaE < 0.06 {
		score -= 0.15
		add("ansi_too_similar")
	} else if r.ansiMinDeltaE < 0.10 {
		score -= 0.05
		add("ansi_close")
	}

	// Hue support (chromatic path only; mono path legitimately synthesizes hues).
	if !r.isMono {
		if r.hueSupport < 0.5 {
			score -= 0.25
			add("invented_hues")
		} else if r.hueSupport < 0.8 {
			score -= 0.10
			add("some_invented_hues")
		}
	}

	// Chroma fidelity: flag both directions.
	if r.chromaFidel > 2.0 {
		score -= 0.15
		add("oversaturated_vs_image")
	} else if r.chromaFidel < 0.5 {
		score -= 0.10
		add("undersaturated_vs_image")
	}

	if score < 0 {
		score = 0
	}
	r.score = score
}

// ---- reporting --------------------------------------------------------------

func writeReport(t *testing.T, outDir string, results []evalResult) {
	f, err := os.Create(outDir + "/report.txt")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	w := bufio.NewWriter(f)
	defer w.Flush()

	csv, _ := os.Create(outDir + "/report.csv")
	defer csv.Close()
	fmt.Fprintln(csv, "score,mono,bgfg,minansi,ansiDE,hueSupport,chromaFidel,imgMeanC,achroFrac,bgHueAlign,flags,path")

	fmt.Fprintf(w, "Suitability report (worst first), n=%d\n\n", len(results))
	for idx, r := range results {
		fmt.Fprintf(w, "#%03d  score=%.3f  %s\n", idx, r.score, shortName(r.path))
		fmt.Fprintf(w, "      mono=%v imgC=%.3f achro=%.2f domHue=%.0f | bgfg=%.2f minAnsi=%.2f ansiDE=%.3f hueSup=%.2f chroma=%.2f bgHueΔ=%.0f\n",
			r.isMono, r.imgMeanC, r.imgAchroFrac, r.imgDomHue, r.bgFgContrast, r.minAnsiCon, r.ansiMinDeltaE, r.hueSupport, r.chromaFidel, r.bgHueAlign)
		fmt.Fprintf(w, "      palette: %s\n", strings.Join(r.palette[:], " "))
		if len(r.flags) > 0 {
			fmt.Fprintf(w, "      FLAGS: %s\n", strings.Join(r.flags, ", "))
		}
		fmt.Fprintln(w)
		fmt.Fprintf(csv, "%.3f,%v,%.2f,%.2f,%.3f,%.2f,%.2f,%.3f,%.2f,%.0f,%q,%q\n",
			r.score, r.isMono, r.bgFgContrast, r.minAnsiCon, r.ansiMinDeltaE, r.hueSupport, r.chromaFidel,
			r.imgMeanC, r.imgAchroFrac, r.bgHueAlign, strings.Join(r.flags, "|"), r.path)
	}
}

// ---- contact sheets ---------------------------------------------------------

const (
	cellW    = 280
	wpH      = 150
	swatchH  = 34
	labelH   = 30
	cellH    = wpH + 2*swatchH + labelH
	cols     = 5
	perSheet = 20
)

func renderSheets(t *testing.T, outDir string, results []evalResult) {
	for start, sheet := 0, 0; start < len(results); start, sheet = start+perSheet, sheet+1 {
		end := start + perSheet
		if end > len(results) {
			end = len(results)
		}
		batch := results[start:end]
		rows := (len(batch) + cols - 1) / cols
		img := image.NewRGBA(image.Rect(0, 0, cols*cellW, rows*cellH))
		draw.Draw(img, img.Bounds(), &image.Uniform{color.RGBA{20, 20, 24, 255}}, image.Point{}, draw.Src)

		for i, r := range batch {
			cx := (i % cols) * cellW
			cy := (i / cols) * cellH
			drawCell(img, cx, cy, start+i, r)
		}
		fn := fmt.Sprintf("%s/sheet_%02d.png", outDir, sheet)
		out, err := os.Create(fn)
		if err != nil {
			t.Fatal(err)
		}
		_ = png.Encode(out, img)
		out.Close()
	}
}

func drawCell(dst *image.RGBA, x, y, idx int, r evalResult) {
	// Wallpaper thumbnail (aspect-fit, letterboxed).
	if src := loadThumb(r.path, cellW-8, wpH-8); src != nil {
		draw.Draw(dst, image.Rect(x+4, y+4, x+cellW-4, y+wpH-4),
			&image.Uniform{color.RGBA{0, 0, 0, 255}}, image.Point{}, draw.Src)
		sb := src.Bounds()
		fr := fitRect(sb, cellW-8, wpH-8)
		draw.CatmullRom.Scale(dst, image.Rect(x+4+fr.Min.X, y+4+fr.Min.Y, x+4+fr.Max.X, y+4+fr.Max.Y), src, sb, draw.Over, nil)
	}

	// Two rows of 8 swatches (0-7 top, 8-15 bottom).
	sw := cellW / 8
	for k := 0; k < 16; k++ {
		col := k % 8
		row := k / 8
		c := hexToRGBA(r.palette[k])
		x0 := x + col*sw
		y0 := y + wpH + row*swatchH
		draw.Draw(dst, image.Rect(x0, y0, x0+sw, y0+swatchH), &image.Uniform{c}, image.Point{}, draw.Src)
	}

	// Label: index, score, key flag.
	label := fmt.Sprintf("#%03d s=%.2f", idx, r.score)
	tag := ""
	if r.isMono {
		tag = "MONO "
	}
	if len(r.flags) > 0 {
		tag += r.flags[0]
	}
	ly := y + wpH + 2*swatchH + 13
	drawText(dst, x+4, ly, label, color.RGBA{235, 235, 235, 255})
	drawText(dst, x+4, ly+14, tag, color.RGBA{255, 170, 120, 255})
}

func drawText(dst *image.RGBA, x, y int, s string, col color.Color) {
	d := &font.Drawer{
		Dst:  dst,
		Src:  &image.Uniform{col},
		Face: basicfont.Face7x13,
		Dot:  fixed.P(x, y),
	}
	d.DrawString(s)
}

// renderComposites writes one large, labeled PNG per image: the wallpaper, the 16
// palette swatches (each labeled with its index + hex), and a few lines of metrics.
// These are the artifacts the vision-judge agents read — large enough to judge
// whether the palette suits the wallpaper at a glance.
func renderComposites(t *testing.T, outDir string, results []evalResult) {
	const (
		W      = 640
		wpA    = 340 // wallpaper area height
		swW    = W / 8
		swH    = 58
		textY0 = wpA + 2*swH + 20
		H      = wpA + 2*swH + 130
	)
	for idx, r := range results {
		img := image.NewRGBA(image.Rect(0, 0, W, H))
		draw.Draw(img, img.Bounds(), &image.Uniform{color.RGBA{18, 18, 22, 255}}, image.Point{}, draw.Src)

		// Wallpaper (aspect-fit, letterboxed on black).
		draw.Draw(img, image.Rect(0, 0, W, wpA), &image.Uniform{color.RGBA{0, 0, 0, 255}}, image.Point{}, draw.Src)
		if src := loadThumb(r.path, W, wpA); src != nil {
			fr := fitRect(src.Bounds(), W, wpA)
			draw.CatmullRom.Scale(img, fr, src, src.Bounds(), draw.Over, nil)
		}

		// 16 swatches, two rows (0-7 top, 8-15 bottom), labeled with index + hex.
		for k := 0; k < 16; k++ {
			col, row := k%8, k/8
			c := hexToRGBA(r.palette[k])
			x0, y0 := col*swW, wpA+row*swH
			draw.Draw(img, image.Rect(x0, y0, x0+swW, y0+swH), &image.Uniform{c}, image.Point{}, draw.Src)
			ink := color.RGBA{0, 0, 0, 255}
			if acolor.HexToOKLab(r.palette[k]).L < 0.55 {
				ink = color.RGBA{255, 255, 255, 255}
			}
			drawText(img, x0+3, y0+14, fmt.Sprintf("%d", k), ink)
			drawText(img, x0+3, y0+30, strings.TrimPrefix(strings.ToLower(r.palette[k]), "#"), ink)
		}

		// Metric lines.
		white := color.RGBA{235, 235, 235, 255}
		amber := color.RGBA{255, 180, 120, 255}
		drawText(img, 6, textY0, fmt.Sprintf("#%03d  score=%.2f  %s", idx, r.score, shortName(r.path)), white)
		path := "chromatic"
		if r.isMono {
			path = "MONOCHROME"
		}
		drawText(img, 6, textY0+18, fmt.Sprintf("path=%s  imgChroma=%.3f  achroFrac=%.2f  domHue=%.0f", path, r.imgMeanC, r.imgAchroFrac, r.imgDomHue), white)
		drawText(img, 6, textY0+36, fmt.Sprintf("bg/fg contrast=%.1f  minANSIcontrast=%.1f  ansiMinDeltaE=%.3f", r.bgFgContrast, r.minAnsiCon, r.ansiMinDeltaE), white)
		drawText(img, 6, textY0+54, fmt.Sprintf("hueSupport=%.2f  chromaFidelity=%.2f  bgHueAlign=%.0f", r.hueSupport, r.chromaFidel, r.bgHueAlign), white)
		if len(r.flags) > 0 {
			drawText(img, 6, textY0+72, "flags: "+strings.Join(r.flags, ", "), amber)
		}

		fn := fmt.Sprintf("%s/c_%03d.png", outDir, idx)
		out, err := os.Create(fn)
		if err != nil {
			t.Fatal(err)
		}
		_ = png.Encode(out, img)
		out.Close()
	}
}

// ---- small helpers ----------------------------------------------------------

func loadThumb(path string, maxW, maxH int) image.Image {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()
	src, _, err := image.Decode(f)
	if err != nil {
		return nil
	}
	return src
}

func fitRect(sb image.Rectangle, maxW, maxH int) image.Rectangle {
	w, h := sb.Dx(), sb.Dy()
	scale := math.Min(float64(maxW)/float64(w), float64(maxH)/float64(h))
	dw := int(float64(w) * scale)
	dh := int(float64(h) * scale)
	ox := (maxW - dw) / 2
	oy := (maxH - dh) / 2
	return image.Rect(ox, oy, ox+dw, oy+dh)
}

func hexToRGBA(hex string) color.RGBA {
	rgb := acolor.HexToRGB(hex)
	return color.RGBA{uint8(clampF(rgb.R, 0, 255)), uint8(clampF(rgb.G, 0, 255)), uint8(clampF(rgb.B, 0, 255)), 255}
}

func loadExclude(path string) map[string]bool {
	set := map[string]bool{}
	if path == "" {
		return set
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return set
	}
	for _, line := range strings.Split(string(data), "\n") {
		if s := strings.TrimSpace(line); s != "" {
			set[s] = true
		}
	}
	return set
}

func sampleN(t *testing.T, listPath string, n int, exclude map[string]bool) []string {
	f, err := os.Open(listPath)
	if err != nil {
		t.Fatalf("open list %s: %v", listPath, err)
	}
	defer f.Close()
	var all []string
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line != "" && !exclude[line] {
			all = append(all, line)
		}
	}
	if len(all) <= n {
		return all
	}
	// Deterministic even spread across the sorted list.
	step := float64(len(all)) / float64(n)
	out := make([]string, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, all[int(float64(i)*step)])
	}
	return out
}

func shortName(p string) string {
	parts := strings.Split(p, "/")
	if len(parts) >= 2 {
		return parts[len(parts)-2] + "/" + parts[len(parts)-1]
	}
	return p
}

func envOr(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func envInt(k string, d int) int {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return d
}

// clampF is defined in palette_modes.go (same package).
