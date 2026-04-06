package wallhaven

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"time"

	"aether/internal/platform"
)

const baseURL = "https://wallhaven.cc/api/v1"

// Client is an HTTP client for the wallhaven.cc API.
type Client struct {
	http   *http.Client
	apiKey string
}

// NewClient creates a new wallhaven API client.
func NewClient() *Client {
	return &Client{
		http: &http.Client{Timeout: 30 * time.Second},
	}
}

// SetAPIKey sets the optional API key used for authenticated requests.
func (c *Client) SetAPIKey(key string) { c.apiKey = key }

// Search searches wallhaven.cc with the given params and returns the results.
func (c *Client) Search(params SearchParams) (*SearchResult, error) {
	q := url.Values{}

	if params.Query != "" {
		q.Set("q", params.Query)
	}

	categories := params.Categories
	if categories == "" {
		categories = "111"
	}
	q.Set("categories", categories)

	purity := params.Purity
	if purity == "" {
		purity = "100"
	}
	q.Set("purity", purity)

	sorting := params.Sorting
	if sorting == "" {
		sorting = "date_added"
	}
	q.Set("sorting", sorting)

	order := params.Order
	if order == "" {
		order = "desc"
	}
	q.Set("order", order)

	page := params.Page
	if page < 1 {
		page = 1
	}
	q.Set("page", strconv.Itoa(page))

	if params.AtLeast != "" {
		q.Set("atleast", params.AtLeast)
	}
	if params.Colors != "" {
		q.Set("colors", params.Colors)
	}
	if c.apiKey != "" {
		q.Set("apikey", c.apiKey)
	}

	reqURL := baseURL + "/search?" + q.Encode()

	resp, err := c.http.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("wallhaven search request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("wallhaven API returned %d: %s", resp.StatusCode, string(body))
	}

	var result SearchResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode wallhaven response: %w", err)
	}

	return &result, nil
}

// SearchMultiPage fetches numPages consecutive pages concurrently and merges
// the results. Metadata is normalized so the caller sees logical pagination
// (e.g. last_page is adjusted for the multi-page fetch).
func (c *Client) SearchMultiPage(params SearchParams, numPages int) (*SearchResult, error) {
	if numPages <= 1 {
		return c.Search(params)
	}

	type pageResult struct {
		index  int
		result *SearchResult
		err    error
	}

	ch := make(chan pageResult, numPages)
	for i := 0; i < numPages; i++ {
		go func(idx int) {
			p := params
			p.Page = params.Page + idx
			res, err := c.Search(p)
			ch <- pageResult{index: idx, result: res, err: err}
		}(i)
	}

	results := make([]*SearchResult, numPages)
	for i := 0; i < numPages; i++ {
		pr := <-ch
		if pr.err != nil {
			if pr.index == 0 {
				return nil, pr.err
			}
			continue
		}
		results[pr.index] = pr.result
	}

	merged := results[0]
	if merged == nil {
		return nil, fmt.Errorf("wallhaven search failed for first page")
	}
	for i := 1; i < numPages; i++ {
		if results[i] != nil {
			merged.Data = append(merged.Data, results[i].Data...)
		}
	}

	// Normalize pagination metadata so the caller sees logical pages
	merged.Meta.CurrentPage = (params.Page-1)/numPages + 1
	merged.Meta.LastPage = (merged.Meta.LastPage + numPages - 1) / numPages

	return merged, nil
}

// wallhavenPagePattern matches wallhaven.cc page URLs and extracts the ID.
var wallhavenPagePattern = regexp.MustCompile(`wallhaven\.cc/w/([a-zA-Z0-9]+)`)

// ResolveImageURL resolves a wallhaven page URL (e.g. https://wallhaven.cc/w/j3qv85)
// to the direct image URL by querying the wallhaven API. If the URL is already a
// direct image URL it is returned as-is.
func (c *Client) ResolveImageURL(wallpaperURL string) (string, error) {
	// If it's already a direct image URL, return it.
	if !wallhavenPagePattern.MatchString(wallpaperURL) {
		return wallpaperURL, nil
	}

	matches := wallhavenPagePattern.FindStringSubmatch(wallpaperURL)
	if len(matches) < 2 {
		return "", fmt.Errorf("cannot extract wallpaper ID from URL: %s", wallpaperURL)
	}
	id := matches[1]

	reqURL := baseURL + "/w/" + id
	if c.apiKey != "" {
		reqURL += "?apikey=" + url.QueryEscape(c.apiKey)
	}

	resp, err := c.http.Get(reqURL)
	if err != nil {
		return "", fmt.Errorf("wallhaven API request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("wallhaven API returned %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Data WallpaperInfo `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode wallhaven response: %w", err)
	}

	if result.Data.Path == "" {
		return "", fmt.Errorf("wallhaven API returned no image path for %s", id)
	}

	return result.Data.Path, nil
}

// DownloadFromURL resolves a wallhaven URL (page or direct) and downloads the
// wallpaper. Returns the local file path.
func (c *Client) DownloadFromURL(wallpaperURL string) (string, error) {
	imageURL, err := c.ResolveImageURL(wallpaperURL)
	if err != nil {
		return "", err
	}
	return c.Download(imageURL)
}

// Download downloads a wallpaper image to the local downloads directory.
// Returns the local file path.
func (c *Client) Download(imageURL string) (string, error) {
	filename := filepath.Base(imageURL)
	if filename == "" || filename == "." || filename == "/" {
		return "", fmt.Errorf("cannot determine filename from URL: %s", imageURL)
	}

	destDir := platform.DownloadDir()
	if err := platform.EnsureDir(destDir); err != nil {
		return "", fmt.Errorf("failed to create download directory: %w", err)
	}

	destPath := filepath.Join(destDir, filename)

	// If the file already exists, return it directly.
	if platform.FileExists(destPath) {
		return destPath, nil
	}

	resp, err := c.http.Get(imageURL)
	if err != nil {
		return "", fmt.Errorf("wallpaper download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download returned HTTP %d for %s", resp.StatusCode, imageURL)
	}

	out, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("failed to create file %s: %w", destPath, err)
	}
	defer out.Close()

	if _, err := io.Copy(out, resp.Body); err != nil {
		// Clean up partial file on error.
		_ = os.Remove(destPath)
		return "", fmt.Errorf("failed to write wallpaper: %w", err)
	}

	return destPath, nil
}
