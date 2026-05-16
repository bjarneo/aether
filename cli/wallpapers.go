package cli

import (
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"strings"
	"sync"

	"aether/internal/wallhaven"
	"aether/internal/wallpaper"
)

func runSearchWallhaven(args []string) int {
	jsonOut, args := stripJSON(args)
	categories, args := parseFlag(args, "--categories")
	purity, args := parseFlag(args, "--purity")
	sorting, args := parseFlag(args, "--sorting")
	order, args := parseFlag(args, "--order")
	pageStr, args := parseFlag(args, "--page")
	atLeast, args := parseFlag(args, "--at-least")
	colors, args := parseFlag(args, "--colors")

	if len(args) == 0 {
		msg := "Usage: aether --search-wallhaven <query> [--categories 111] [--purity 100] [--sorting relevance] [--page 1]"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	params := wallhaven.SearchParams{
		Query: args[0],
	}
	if categories != "" {
		params.Categories = categories
	}
	if purity != "" {
		params.Purity = purity
	}
	if sorting != "" {
		params.Sorting = sorting
	}
	if order != "" {
		params.Order = order
	}
	if pageStr != "" {
		if v, err := strconv.Atoi(pageStr); err == nil {
			params.Page = v
		}
	}
	if atLeast != "" {
		params.AtLeast = atLeast
	}
	if colors != "" {
		params.Colors = colors
	}

	client := wallhaven.NewClient()
	result, err := client.Search(params)
	if err != nil {
		msg := fmt.Sprintf("Search failed: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	if jsonOut {
		return printJSON(result)
	}

	fmt.Printf("Results: %d (page %d/%d, total %d)\n",
		len(result.Data), result.Meta.CurrentPage, result.Meta.LastPage, result.Meta.Total)
	for _, wp := range result.Data {
		fmt.Printf("  %s  %s  %s\n", wp.ID, wp.Resolution, wp.URL)
	}
	return 0
}

// wallhavenSearchParams centralises the common --categories / --purity /
// --sorting / --order / --page / --at-least / --colors flag parsing shared by
// the wallhaven CLI subcommands.
func wallhavenSearchParams(args []string) (wallhaven.SearchParams, []string) {
	categories, args := parseFlag(args, "--categories")
	purity, args := parseFlag(args, "--purity")
	sorting, args := parseFlag(args, "--sorting")
	order, args := parseFlag(args, "--order")
	pageStr, args := parseFlag(args, "--page")
	atLeast, args := parseFlag(args, "--at-least")
	colorsFlag, args := parseFlag(args, "--colors")

	params := wallhaven.SearchParams{}
	if categories != "" {
		params.Categories = categories
	}
	if purity != "" {
		params.Purity = purity
	}
	if sorting != "" {
		params.Sorting = sorting
	}
	if order != "" {
		params.Order = order
	}
	if pageStr != "" {
		if v, err := strconv.Atoi(pageStr); err == nil {
			params.Page = v
		}
	}
	if atLeast != "" {
		params.AtLeast = atLeast
	}
	if colorsFlag != "" {
		params.Colors = colorsFlag
	}

	return params, args
}

// wallhavenThumbEntry is the per-result row returned by --wallhaven-thumbs.
type wallhavenThumbEntry struct {
	ID            string `json:"id"`
	URL           string `json:"url"`
	Path          string `json:"path"`
	Resolution    string `json:"resolution"`
	Category      string `json:"category"`
	Purity        string `json:"purity"`
	ThumbURL      string `json:"thumbURL"`
	ThumbnailPath string `json:"thumbnailPath,omitempty"`
}

func runWallhavenThumbs(args []string) int {
	jsonOut, args := stripJSON(args)
	pagesStr, args := parseFlag(args, "--pages")
	params, args := wallhavenSearchParams(args)

	// Allow an empty query so callers can browse top/popular without a
	// keyword. wallhaven's API treats an absent q= as "no filter".
	if len(args) > 0 {
		params.Query = args[0]
	}

	pages := 1
	if pagesStr != "" {
		if v, err := strconv.Atoi(pagesStr); err == nil && v > 0 {
			pages = v
		}
	}

	client := wallhaven.NewClient()
	var (
		result *wallhaven.SearchResult
		err    error
	)
	if pages > 1 {
		result, err = client.SearchMultiPage(params, pages)
	} else {
		result, err = client.Search(params)
	}
	if err != nil {
		msg := fmt.Sprintf("Search failed: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	out := make([]wallhavenThumbEntry, len(result.Data))

	// Mirror buildWallpapersWithPreviews: cap concurrent thumbnail downloads
	// at 8 so a typical 24-result page finishes in ~3 batches without piling
	// up goroutines or hammering wallhaven's CDN.
	const workers = 8
	sem := make(chan struct{}, workers)
	var wg sync.WaitGroup

	for i, wp := range result.Data {
		// Prefer "large" (~800px wide) over "original" (~300px) or "small"
		// (300x200). The downstream omarchy-menu-images thumbnailer rescales
		// to 1536x864, so feeding it a small source produces visibly blurry
		// cards; "large" gives it enough pixels to look sharp.
		thumbURL := wp.Thumbs["large"]
		if thumbURL == "" {
			thumbURL = wp.Thumbs["original"]
		}
		if thumbURL == "" {
			thumbURL = wp.Thumbs["small"]
		}
		out[i] = wallhavenThumbEntry{
			ID:         wp.ID,
			URL:        wp.URL,
			Path:       wp.Path,
			Resolution: wp.Resolution,
			Category:   wp.Category,
			Purity:     wp.Purity,
			ThumbURL:   thumbURL,
		}
		if thumbURL == "" {
			continue
		}

		sem <- struct{}{}
		wg.Add(1)
		go func(idx int, url string) {
			defer wg.Done()
			defer func() { <-sem }()
			if p, err := client.DownloadThumb(url); err == nil {
				out[idx].ThumbnailPath = p
			}
		}(i, thumbURL)
	}
	wg.Wait()

	if jsonOut {
		return printJSON(map[string]interface{}{
			"wallpapers": out,
			"meta":       result.Meta,
		})
	}

	fmt.Printf("Results: %d (page %d/%d, total %d)\n",
		len(out), result.Meta.CurrentPage, result.Meta.LastPage, result.Meta.Total)
	for _, t := range out {
		fmt.Printf("  %s  %s  %s\n", t.ID, t.Resolution, t.ThumbnailPath)
	}
	return 0
}

// resolveWallhavenArg accepts either a bare ID ("j3qv85"), a wallhaven page URL
// ("https://wallhaven.cc/w/j3qv85"), or a direct image URL. Bare IDs are
// expanded to the page form so ResolveImageURL can look them up via the API.
func resolveWallhavenArg(arg string) string {
	arg = strings.TrimSpace(arg)
	if arg == "" {
		return arg
	}
	if strings.HasPrefix(arg, "http://") || strings.HasPrefix(arg, "https://") {
		return arg
	}
	if !strings.Contains(arg, "/") {
		return "https://wallhaven.cc/w/" + arg
	}
	return arg
}

func runDownloadWallhaven(args []string) int {
	jsonOut, args := stripJSON(args)
	if len(args) == 0 {
		msg := "Usage: aether --wallhaven-download <id-or-url>"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	target := resolveWallhavenArg(args[0])
	client := wallhaven.NewClient()
	path, err := client.DownloadFromURL(target)
	if err != nil {
		msg := fmt.Sprintf("Download failed: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	if jsonOut {
		return printJSON(map[string]string{"path": path})
	}
	fmt.Println(path)
	return 0
}

func runWallhavenInfo(args []string) int {
	jsonOut, args := stripJSON(args)
	if len(args) == 0 {
		msg := "Usage: aether --wallhaven-info <id-or-url>"
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	target := strings.TrimSpace(args[0])
	// Accept either bare ID or page URL; strip everything down to the bare ID.
	if strings.Contains(target, "wallhaven.cc/w/") {
		parts := strings.Split(target, "wallhaven.cc/w/")
		target = strings.SplitN(parts[len(parts)-1], "/", 2)[0]
	}

	client := wallhaven.NewClient()
	info, err := client.Info(target)
	if err != nil {
		msg := fmt.Sprintf("Lookup failed: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	if jsonOut {
		return printJSON(info)
	}
	fmt.Printf("%s  %s  %s\n", info.ID, info.Resolution, info.Path)
	return 0
}

func runListWallpapers(args []string) int {
	jsonOut, args := stripJSON(args)
	withPreviews, _ := hasFlag(args, "--with-previews")

	wallpapers, err := wallpaper.ScanDefaultDirs()
	if err != nil {
		msg := fmt.Sprintf("Failed to scan: %v", err)
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, "Error:", msg)
		return 1
	}

	if jsonOut {
		if withPreviews {
			return printJSON(map[string]interface{}{
				"wallpapers": buildWallpapersWithPreviews(wallpapers),
				"count":      len(wallpapers),
			})
		}
		return printJSON(map[string]interface{}{
			"wallpapers": wallpapers,
			"count":      len(wallpapers),
		})
	}

	if len(wallpapers) == 0 {
		fmt.Println("No wallpapers found.")
		return 0
	}

	fmt.Printf("Local wallpapers (%d):\n", len(wallpapers))
	for _, wp := range wallpapers {
		fmt.Printf("  %s\n", wp.Path)
	}
	return 0
}

// wallpaperWithPreview adds a previewPath field to the standard listing.
// previewPath is populated by GetPreview, which writes an 800 px PNG to
// ~/.cache/aether/thumbnails/ keyed by md5(path + "-preview"). Once cached
// the call is a stat(); the first call per wallpaper takes a few hundred ms.
type wallpaperWithPreview struct {
	wallpaper.WallpaperInfo
	PreviewPath string `json:"previewPath,omitempty"`
}

func buildWallpapersWithPreviews(wps []wallpaper.WallpaperInfo) []wallpaperWithPreview {
	out := make([]wallpaperWithPreview, len(wps))
	for i, wp := range wps {
		out[i] = wallpaperWithPreview{WallpaperInfo: wp}
	}

	// Cap concurrency at 8 in-flight generations. Acquire the semaphore
	// before spawning so we don't pile up hundreds of blocked goroutines
	// for large wallpaper folders.
	const workers = 8
	sem := make(chan struct{}, workers)
	var wg sync.WaitGroup
	for i := range out {
		if out[i].Size == 0 {
			continue // skip broken/empty placeholders
		}
		sem <- struct{}{}
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			defer func() { <-sem }()
			if p, err := wallpaper.GetPreview(out[idx].Path); err == nil {
				out[idx].PreviewPath = p
			}
		}(i)
	}
	wg.Wait()
	return out
}

func runRandomWallpaper(args []string) int {
	jsonOut, _ := stripJSON(args)

	wallpapers, err := wallpaper.ScanDefaultDirs()
	if err != nil || len(wallpapers) == 0 {
		msg := "No wallpapers found"
		if err != nil {
			msg = fmt.Sprintf("Failed to scan: %v", err)
		}
		if jsonOut {
			return printErrorJSON(msg)
		}
		fmt.Fprintln(os.Stderr, msg)
		return 1
	}

	pick := wallpapers[rand.Intn(len(wallpapers))]

	if jsonOut {
		return printJSON(map[string]interface{}{
			"path": pick.Path,
			"name": pick.Name,
			"size": pick.Size,
		})
	}

	fmt.Println(pick.Path)
	return 0
}
