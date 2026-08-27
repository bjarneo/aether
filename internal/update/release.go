// Package update checks for and installs Aether releases.
package update

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const latestReleaseURL = "https://api.github.com/repos/omacom-io/aether/releases/latest"

// Release describes the newest published Aether release and its relation to
// the version currently running.
type Release struct {
	CurrentVersion  string `json:"currentVersion"`
	LatestVersion   string `json:"latestVersion"`
	ReleaseURL      string `json:"releaseURL"`
	UpdateAvailable bool   `json:"updateAvailable"`
	assets          []asset
}

type asset struct {
	Name        string `json:"name"`
	DownloadURL string `json:"browser_download_url"`
}

type githubRelease struct {
	TagName string  `json:"tag_name"`
	HTMLURL string  `json:"html_url"`
	Assets  []asset `json:"assets"`
}

// Check fetches the latest published GitHub release and compares it with
// currentVersion. The check intentionally does not cache so the caller can
// explicitly refresh the status.
func Check(ctx context.Context, currentVersion string) (Release, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	return check(ctx, currentVersion, latestReleaseURL, client)
}

func check(ctx context.Context, currentVersion, url string, client *http.Client) (Release, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return Release{}, fmt.Errorf("create release request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "Aether")

	resp, err := client.Do(req)
	if err != nil {
		return Release{}, fmt.Errorf("get latest release: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Release{}, fmt.Errorf("get latest release: GitHub returned %s", resp.Status)
	}

	var latest githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&latest); err != nil {
		return Release{}, fmt.Errorf("decode latest release: %w", err)
	}
	if latest.TagName == "" {
		return Release{}, fmt.Errorf("latest release has no version tag")
	}

	newer, err := isNewer(currentVersion, latest.TagName)
	if err != nil {
		return Release{}, err
	}
	return Release{
		CurrentVersion:  normalizeVersion(currentVersion),
		LatestVersion:   normalizeVersion(latest.TagName),
		ReleaseURL:      latest.HTMLURL,
		UpdateAvailable: newer,
		assets:          latest.Assets,
	}, nil
}

func (r Release) assetURL(name string) string {
	for _, a := range r.assets {
		if a.Name == name {
			return a.DownloadURL
		}
	}
	return ""
}

func isNewer(current, latest string) (bool, error) {
	comparison, err := compareVersions(latest, current)
	if err != nil {
		return false, err
	}
	return comparison > 0, nil
}

func compareVersions(a, b string) (int, error) {
	parsedA, err := parseVersion(a)
	if err != nil {
		return 0, fmt.Errorf("parse version %q: %w", a, err)
	}
	parsedB, err := parseVersion(b)
	if err != nil {
		return 0, fmt.Errorf("parse version %q: %w", b, err)
	}

	for i := range parsedA.core {
		if parsedA.core[i] > parsedB.core[i] {
			return 1, nil
		}
		if parsedA.core[i] < parsedB.core[i] {
			return -1, nil
		}
	}

	if parsedA.prerelease == "" && parsedB.prerelease != "" {
		return 1, nil
	}
	if parsedA.prerelease != "" && parsedB.prerelease == "" {
		return -1, nil
	}
	return strings.Compare(parsedA.prerelease, parsedB.prerelease), nil
}

type version struct {
	core       [3]int
	prerelease string
}

func parseVersion(raw string) (version, error) {
	value := normalizeVersion(raw)
	if value == "" {
		return version{}, fmt.Errorf("empty version")
	}

	core, prerelease, _ := strings.Cut(value, "-")
	core, _, _ = strings.Cut(core, "+")
	parts := strings.Split(core, ".")
	if len(parts) > 3 {
		return version{}, fmt.Errorf("expected at most three numeric components")
	}

	var parsed version
	parsed.prerelease = prerelease
	for i, part := range parts {
		if part == "" {
			return version{}, fmt.Errorf("empty numeric component")
		}
		n, err := strconv.Atoi(part)
		if err != nil || n < 0 {
			return version{}, fmt.Errorf("invalid numeric component %q", part)
		}
		parsed.core[i] = n
	}
	return parsed, nil
}

func normalizeVersion(version string) string {
	return strings.TrimPrefix(strings.TrimSpace(version), "v")
}
