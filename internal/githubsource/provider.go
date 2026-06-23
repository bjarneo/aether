package githubsource

import (
	"bytes"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/image/draw"

	"aether/internal/platform"
)

const thumbnailSize = 300

const githubAPIBase = "https://api.github.com"
const rawBase = "https://raw.githubusercontent.com"

// imageExtensions are the image file extensions accepted by this provider.
var imageExtensions = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".webp": true,
}

// parsedGitHubURL holds the components extracted from a GitHub URL.
type parsedGitHubURL struct {
	Owner  string
	Repo   string
	Branch string
	Path   string
}

// Client is an HTTP client for the GitHub Contents API.
type Client struct {
	http  *http.Client
	cache *ttlCache
}

// NewClient creates a new GitHub source client.
func NewClient() *Client {
	return &Client{
		http:  &http.Client{Timeout: 30 * time.Second},
		cache: newTTLCache(5*time.Minute, 100),
	}
}

// ClearCache clears the in-memory response cache.
func (c *Client) ClearCache() {
	c.cache.clear()
}

// ListImages parses a GitHub URL and returns all files (images) and directories
// found at that location. Supports github.com repos, GitHub Pages
// (<owner>.github.io), and raw.githubusercontent.com URLs.
// Results are cached in memory for 5 minutes to avoid redundant API calls.
func (c *Client) ListImages(rawURL string) (*ListContentsResult, error) {
	if result, ok := c.cache.get(rawURL); ok {
		return result, nil
	}

	gh, err := parseURL(rawURL)
	if err != nil {
		return nil, err
	}

	contents, err := c.listContents(gh.Owner, gh.Repo, gh.Path, gh.Branch)
	if err != nil {
		return nil, err
	}

	items := make([]ImageInfo, 0, len(contents))
	for _, item := range contents {
		if item.Type == "dir" {
			items = append(items, ImageInfo{
				Name: item.Name,
				Size: item.Size,
				Type: "dir",
				Path: item.Path,
			})
		} else if isImageFile(item.Name) && item.DownloadURL != "" {
			items = append(items, ImageInfo{
				Name: item.Name,
				URL:  item.DownloadURL,
				Size: item.Size,
				Type: "file",
				Path: item.Path,
			})
		}
	}

	result := &ListContentsResult{Items: items}
	c.cache.set(rawURL, result)
	return result, nil
}

// listContents calls the GitHub Contents API for a given path in a repo.
func (c *Client) listContents(owner, repo, filePath, branch string) ([]githubContent, error) {
	apiURL := fmt.Sprintf("%s/repos/%s/%s/contents/%s", githubAPIBase, owner, repo, filePath)
	if branch != "" {
		apiURL += "?ref=" + url.QueryEscape(branch)
	}

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "Aether/1.0")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("github API request failed: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusForbidden:
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("github API rate limit exceeded: %s", string(body))
	case http.StatusNotFound:
		return nil, fmt.Errorf("repository or path not found: %s/%s/%s", owner, repo, filePath)
	case http.StatusOK:
		// proceed
	default:
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("github API returned %d: %s", resp.StatusCode, string(body))
	}

	var raw json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	var items []githubContent
	if err := json.Unmarshal(raw, &items); err == nil {
		return items, nil
	}

	var single githubContent
	if err := json.Unmarshal(raw, &single); err != nil {
		return nil, fmt.Errorf("unexpected API response format")
	}
	return []githubContent{single}, nil
}

// isImageFile checks if a filename has an image extension.
func isImageFile(name string) bool {
	ext := strings.ToLower(path.Ext(name))
	return imageExtensions[ext]
}

// filterImages filters a GitHub API contents response to only image files.
func filterImages(items []githubContent) []githubContent {
	out := make([]githubContent, 0, len(items))
	for _, item := range items {
		if item.Type == "file" && isImageFile(item.Name) {
			out = append(out, item)
		}
	}
	return out
}

// buildRawURL constructs a raw.githubusercontent.com URL for a file.
func buildRawURL(owner, repo, branch, filePath string) string {
	return fmt.Sprintf("%s/%s/%s/%s/%s", rawBase, owner, repo, branch, filePath)
}

// parseURL parses a GitHub URL and extracts owner, repo, branch, and path.
// Supported formats:
//   - https://github.com/{owner}/{repo}[/tree/{branch}/{path}]
//   - https://github.com/{owner}/{repo}/blob/{branch}/{path}
//   - https://{owner}.github.io/{path}
//   - https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}
func parseURL(rawURL string) (*parsedGitHubURL, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	host := strings.ToLower(u.Host)
	segments := splitPath(u.Path)

	// raw.githubusercontent.com/{owner}/{repo}/{branch}/{path...}
	if host == "raw.githubusercontent.com" {
		if len(segments) < 3 {
			return nil, fmt.Errorf("raw URL must include owner, repo, and branch")
		}
		return &parsedGitHubURL{
			Owner:  segments[0],
			Repo:   segments[1],
			Branch: segments[2],
			Path:   strings.Join(segments[3:], "/"),
		}, nil
	}

	// {owner}.github.io/{path...}
	if strings.HasSuffix(host, ".github.io") {
		owner := strings.TrimSuffix(host, ".github.io")
		if owner == "" {
			return nil, fmt.Errorf("invalid GitHub Pages URL")
		}
		return &parsedGitHubURL{
			Owner:  owner,
			Repo:   owner + ".github.io",
			Branch: "",
			Path:   strings.Join(segments, "/"),
		}, nil
	}

	// github.com/{owner}/{repo}[/tree|blob/{branch}/{path}]
	if host != "github.com" {
		return nil, fmt.Errorf("not a GitHub URL: %s", rawURL)
	}

	if len(segments) < 2 {
		return nil, fmt.Errorf("GitHub URL must include owner and repo")
	}

	owner := segments[0]
	repo := strings.TrimSuffix(segments[1], ".git")
	branch := ""
	filePath := ""

	if len(segments) >= 4 && (segments[2] == "tree" || segments[2] == "blob") {
		branch = segments[3]
		if len(segments) > 4 {
			filePath = strings.Join(segments[4:], "/")
		}
	} else if len(segments) >= 3 {
		filePath = strings.Join(segments[2:], "/")
	}

	return &parsedGitHubURL{
		Owner:  owner,
		Repo:   repo,
		Branch: branch,
		Path:   filePath,
	}, nil
}

// splitPath splits a URL path into non-empty segments.
func splitPath(p string) []string {
	var segs []string
	for _, s := range strings.Split(p, "/") {
		if s != "" {
			segs = append(segs, s)
		}
	}
	return segs
}

// cachePath returns the filesystem path for a cached thumbnail of the given URL.
func thumbnailCachePath(rawURL string) string {
	hash := fmt.Sprintf("%x", md5.Sum([]byte(rawURL)))
	return filepath.Join(platform.ThumbnailDir(), "github", hash+".png")
}

// DownloadThumbnail downloads an image from a URL, generates a thumbnail,
// caches it to disk, and returns it as a data URL. Subsequent calls for the
// same URL skip the download and return the cached thumbnail.
func DownloadThumbnail(rawURL string) (string, error) {
	cacheFile := thumbnailCachePath(rawURL)

	// Return cached thumbnail if it exists
	if data, err := os.ReadFile(cacheFile); err == nil {
		encoded := base64.StdEncoding.EncodeToString(data)
		return fmt.Sprintf("data:image/png;base64,%s", encoded), nil
	}

	// Download the image
	resp, err := http.Get(rawURL)
	if err != nil {
		return "", fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download returned %d", resp.StatusCode)
	}

	// Decode
	img, _, err := image.Decode(resp.Body)
	if err != nil {
		return "", fmt.Errorf("decode failed: %w", err)
	}

	// Scale to thumbnail
	thumb := scaleImage(img, thumbnailSize)

	// Encode to PNG and write to cache
	if err := os.MkdirAll(filepath.Dir(cacheFile), 0755); err != nil {
		return "", fmt.Errorf("create cache dir: %w", err)
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, thumb); err != nil {
		return "", fmt.Errorf("encode thumbnail: %w", err)
	}

	if err := os.WriteFile(cacheFile, buf.Bytes(), 0644); err != nil {
		return "", fmt.Errorf("write cache file: %w", err)
	}

	encoded := base64.StdEncoding.EncodeToString(buf.Bytes())
	return fmt.Sprintf("data:image/png;base64,%s", encoded), nil
}

// scaleImage scales an image to fit within size×size bounding box, preserving
// aspect ratio.
func scaleImage(src image.Image, size int) image.Image {
	bounds := src.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()

	if srcW == 0 || srcH == 0 {
		return src
	}

	var dstW, dstH int
	if srcW >= srcH {
		dstW = size
		dstH = size * srcH / srcW
	} else {
		dstH = size
		dstW = size * srcW / srcH
	}

	if dstW < 1 {
		dstW = 1
	}
	if dstH < 1 {
		dstH = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, bounds, draw.Over, nil)

	return dst
}
