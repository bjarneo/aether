package update

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		name string
		a    string
		b    string
		want int
	}{
		{name: "newer patch", a: "v3.0.1", b: "3.0.0", want: 1},
		{name: "newer minor", a: "3.1", b: "3.0.9", want: 1},
		{name: "equal with tag prefix", a: "v3.0.0", b: "3.0.0", want: 0},
		{name: "stable beats prerelease", a: "3.0.0", b: "3.0.0-rc.1", want: 1},
		{name: "older major", a: "2.9.9", b: "3.0.0", want: -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := compareVersions(tt.a, tt.b)
			if err != nil {
				t.Fatal(err)
			}
			if got != tt.want {
				t.Errorf("compareVersions(%q, %q) = %d; want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestCheck(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Accept"); got != "application/vnd.github+json" {
			t.Errorf("Accept header = %q; want GitHub API media type", got)
		}
		_, _ = w.Write([]byte(`{
			"tag_name": "v3.1.0",
			"html_url": "https://github.com/omacom-io/aether/releases/tag/v3.1.0",
			"assets": [{"name": "aether-linux-amd64", "browser_download_url": "https://example.com/aether"}]
		}`))
	}))
	defer server.Close()

	release, err := check(context.Background(), "3.0.0", server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	if !release.UpdateAvailable {
		t.Error("UpdateAvailable = false; want true")
	}
	if release.CurrentVersion != "3.0.0" || release.LatestVersion != "3.1.0" {
		t.Errorf("versions = %q -> %q; want 3.0.0 -> 3.1.0", release.CurrentVersion, release.LatestVersion)
	}
	if got := release.assetURL("aether-linux-amd64"); got != "https://example.com/aether" {
		t.Errorf("assetURL() = %q; want download URL", got)
	}
}
