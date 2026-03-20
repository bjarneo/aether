package wallhaven

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
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
