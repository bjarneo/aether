package wallpaper

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"aether/internal/platform"
)

// webImportsDir returns ~/.cache/aether/web-imports/, creating it if missing.
func webImportsDir() (string, error) {
	dir := filepath.Join(platform.CacheDir(), "web-imports")
	if err := platform.EnsureDir(dir); err != nil {
		return "", fmt.Errorf("ensure dir: %w", err)
	}
	return dir, nil
}

// DownloadToCache fetches a remote URL into ~/.cache/aether/web-imports/ and
// returns the local path. The filename is sha256(url)[:16] + the original
// extension, so repeated clicks on the same link are idempotent and skip
// re-downloading.
func DownloadToCache(rawURL string) (string, error) {
	if rawURL == "" {
		return "", fmt.Errorf("empty URL")
	}

	dir, err := webImportsDir()
	if err != nil {
		return "", err
	}

	ext := extFromURL(rawURL)
	sum := sha256.Sum256([]byte(rawURL))
	name := hex.EncodeToString(sum[:8]) + ext
	dest := filepath.Join(dir, name)

	if _, err := os.Stat(dest); err == nil {
		return dest, nil
	}

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(rawURL)
	if err != nil {
		return "", fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	tmp, err := os.CreateTemp(dir, ".part-*")
	if err != nil {
		return "", fmt.Errorf("temp file: %w", err)
	}
	tmpName := tmp.Name()
	if _, err := io.Copy(tmp, resp.Body); err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return "", fmt.Errorf("write: %w", err)
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmpName)
		return "", fmt.Errorf("close: %w", err)
	}
	if err := os.Rename(tmpName, dest); err != nil {
		os.Remove(tmpName)
		return "", fmt.Errorf("rename: %w", err)
	}
	return dest, nil
}

// extFromURL pulls a sensible file extension off a URL path. Falls back to
// "" if none is present, so the caller is responsible for any default.
func extFromURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	ext := strings.ToLower(path.Ext(u.Path))
	if len(ext) > 8 {
		return ""
	}
	return ext
}
