package wallpaper

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/webp"

	"aether/internal/platform"
)

const (
	// MaxDocumentBytes limits remotely imported palette and blueprint files.
	MaxDocumentBytes int64 = 1 << 20
	// MaxImageBytes limits remotely imported wallpapers.
	MaxImageBytes     int64 = 50 << 20
	maxImageDimension       = 16384
	maxImagePixels          = 40_000_000
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
func DownloadToCache(rawURL string, maxBytes int64) (string, error) {
	if rawURL == "" {
		return "", fmt.Errorf("empty URL")
	}
	if maxBytes <= 0 {
		return "", fmt.Errorf("invalid download size limit")
	}
	if err := validateRemoteURL(rawURL); err != nil {
		return "", err
	}

	dir, err := webImportsDir()
	if err != nil {
		return "", err
	}

	ext := extFromURL(rawURL)
	sum := sha256.Sum256([]byte(rawURL))
	name := hex.EncodeToString(sum[:8]) + ext
	dest := filepath.Join(dir, name)

	if info, err := os.Stat(dest); err == nil {
		if !info.Mode().IsRegular() {
			return "", fmt.Errorf("cached download is not a regular file")
		}
		if info.Size() > maxBytes {
			return "", fmt.Errorf("cached download exceeds %d-byte limit", maxBytes)
		}
		return dest, nil
	}

	client := secureHTTPClient()
	resp, err := client.Get(rawURL)
	if err != nil {
		return "", fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	if resp.ContentLength > maxBytes {
		return "", fmt.Errorf("download exceeds %d-byte limit", maxBytes)
	}

	tmp, err := os.CreateTemp(dir, ".part-*")
	if err != nil {
		return "", fmt.Errorf("temp file: %w", err)
	}
	tmpName := tmp.Name()
	written, err := io.Copy(tmp, io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		tmp.Close()
		os.Remove(tmpName)
		return "", fmt.Errorf("write: %w", err)
	}
	if written > maxBytes {
		tmp.Close()
		os.Remove(tmpName)
		return "", fmt.Errorf("download exceeds %d-byte limit", maxBytes)
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

// ValidateImageFile verifies that path contains a supported image with
// dimensions that are safe to preview and decode.
func ValidateImageFile(filePath string) error {
	f, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("open image: %w", err)
	}
	defer f.Close()

	config, _, err := image.DecodeConfig(f)
	if err != nil {
		return fmt.Errorf("decode image header: %w", err)
	}
	if config.Width <= 0 || config.Height <= 0 ||
		config.Width > maxImageDimension || config.Height > maxImageDimension ||
		int64(config.Width)*int64(config.Height) > maxImagePixels {
		return fmt.Errorf("unsafe image dimensions %dx%d", config.Width, config.Height)
	}
	return nil
}

func secureHTTPClient() *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = dialPublicAddress
	return &http.Client{
		Transport: transport,
		Timeout:   60 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return fmt.Errorf("too many redirects")
			}
			return validateRemoteURL(req.URL.String())
		},
	}
}

func validateRemoteURL(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}
	if u.Scheme != "https" {
		return fmt.Errorf("URL must use HTTPS")
	}
	if u.Hostname() == "" {
		return fmt.Errorf("URL must include a host")
	}
	if u.User != nil {
		return fmt.Errorf("URL credentials are not allowed")
	}
	host := strings.TrimSuffix(strings.ToLower(u.Hostname()), ".")
	if host == "localhost" || strings.HasSuffix(host, ".localhost") ||
		strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") || host == "home.arpa" ||
		strings.HasSuffix(host, ".home.arpa") {
		return fmt.Errorf("URL host must be public")
	}
	if ip, err := netip.ParseAddr(u.Hostname()); err == nil && !isPublicAddress(ip) {
		return fmt.Errorf("URL host must be a public address")
	}
	return nil
}

func dialPublicAddress(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, fmt.Errorf("parse remote address: %w", err)
	}
	ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
	if err != nil {
		return nil, fmt.Errorf("resolve remote host: %w", err)
	}

	dialer := &net.Dialer{Timeout: 15 * time.Second, KeepAlive: 30 * time.Second}
	for _, ip := range ips {
		if !isPublicAddress(ip) {
			continue
		}
		conn, err := dialer.DialContext(ctx, network, net.JoinHostPort(ip.String(), port))
		if err == nil {
			return conn, nil
		}
	}
	return nil, fmt.Errorf("remote host has no reachable public address")
}

func isPublicAddress(ip netip.Addr) bool {
	ip = ip.Unmap()
	if !ip.IsValid() || !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() ||
		ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() {
		return false
	}
	for _, prefix := range blockedPublicPrefixes {
		if prefix.Contains(ip) {
			return false
		}
	}
	return true
}

var blockedPublicPrefixes = []netip.Prefix{
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("2001:db8::/32"),
}

// extFromURL pulls a sensible file extension off a URL path. Falls back to
// "" if none is present, so the caller is responsible for any default.
func extFromURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	ext := strings.ToLower(path.Ext(u.Path))
	if len(ext) < 2 || len(ext) > 8 {
		return ""
	}
	for i := 1; i < len(ext); i++ {
		if c := ext[i]; (c < 'a' || c > 'z') && (c < '0' || c > '9') {
			return ""
		}
	}
	return ext
}
