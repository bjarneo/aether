package githubsource

import (
	"testing"
	"time"
)

func TestParseURL_githubCom(t *testing.T) {
	tests := []struct {
		raw   string
		owner string
		repo  string
		branch string
		path  string
	}{
		{"https://github.com/dharmx/walls", "dharmx", "walls", "", ""},
		{"https://github.com/dharmx/walls.git", "dharmx", "walls", "", ""},
		{"https://github.com/dharmx/walls/", "dharmx", "walls", "", ""},
		{"https://github.com/dharmx/walls/tree/main", "dharmx", "walls", "main", ""},
		{"https://github.com/dharmx/walls/tree/main/subdir", "dharmx", "walls", "main", "subdir"},
		{"https://github.com/dharmx/walls/tree/master/images/nature", "dharmx", "walls", "master", "images/nature"},
		{"https://github.com/dharmx/walls/blob/main/wallpaper.jpg", "dharmx", "walls", "main", "wallpaper.jpg"},
		{"https://github.com/bjarneo/wallpapers/tree/gh-pages", "bjarneo", "wallpapers", "gh-pages", ""},
		{"https://github.com/dharmx/walls/abstract", "dharmx", "walls", "", "abstract"},
		{"https://github.com/dharmx/walls/subdir/nested", "dharmx", "walls", "", "subdir/nested"},
	}

	for _, tt := range tests {
		t.Run(tt.raw, func(t *testing.T) {
			gh, err := parseURL(tt.raw)
			if err != nil {
				t.Fatalf("parseURL(%q) unexpected error: %v", tt.raw, err)
			}
			if gh.Owner != tt.owner {
				t.Errorf("owner = %q, want %q", gh.Owner, tt.owner)
			}
			if gh.Repo != tt.repo {
				t.Errorf("repo = %q, want %q", gh.Repo, tt.repo)
			}
			if gh.Branch != tt.branch {
				t.Errorf("branch = %q, want %q", gh.Branch, tt.branch)
			}
			if gh.Path != tt.path {
				t.Errorf("path = %q, want %q", gh.Path, tt.path)
			}
		})
	}
}

func TestParseURL_githubPages(t *testing.T) {
	tests := []struct {
		raw   string
		owner string
		repo  string
		branch string
		path  string
	}{
		{"https://bjarneo.github.io/wallpapers/", "bjarneo", "bjarneo.github.io", "", "wallpapers"},
		{"https://bjarneo.github.io/", "bjarneo", "bjarneo.github.io", "", ""},
		{"https://bjarneo.github.io/wallpapers/nature", "bjarneo", "bjarneo.github.io", "", "wallpapers/nature"},
	}

	for _, tt := range tests {
		t.Run(tt.raw, func(t *testing.T) {
			gh, err := parseURL(tt.raw)
			if err != nil {
				t.Fatalf("parseURL(%q) unexpected error: %v", tt.raw, err)
			}
			if gh.Owner != tt.owner {
				t.Errorf("owner = %q, want %q", gh.Owner, tt.owner)
			}
			if gh.Repo != tt.repo {
				t.Errorf("repo = %q, want %q", gh.Repo, tt.repo)
			}
			if gh.Branch != tt.branch {
				t.Errorf("branch = %q, want %q", gh.Branch, tt.branch)
			}
			if gh.Path != tt.path {
				t.Errorf("path = %q, want %q", gh.Path, tt.path)
			}
		})
	}
}

func TestParseURL_rawContent(t *testing.T) {
	tests := []struct {
		raw   string
		owner string
		repo  string
		branch string
		path  string
	}{
		{"https://raw.githubusercontent.com/bjarneo/wallpapers/main/wallpaper.jpg", "bjarneo", "wallpapers", "main", "wallpaper.jpg"},
		{"https://raw.githubusercontent.com/dharmx/walls/master/images/nature/mountain.png", "dharmx", "walls", "master", "images/nature/mountain.png"},
	}

	for _, tt := range tests {
		t.Run(tt.raw, func(t *testing.T) {
			gh, err := parseURL(tt.raw)
			if err != nil {
				t.Fatalf("parseURL(%q) unexpected error: %v", tt.raw, err)
			}
			if gh.Owner != tt.owner {
				t.Errorf("owner = %q, want %q", gh.Owner, tt.owner)
			}
			if gh.Repo != tt.repo {
				t.Errorf("repo = %q, want %q", gh.Repo, tt.repo)
			}
			if gh.Branch != tt.branch {
				t.Errorf("branch = %q, want %q", gh.Branch, tt.branch)
			}
			if gh.Path != tt.path {
				t.Errorf("path = %q, want %q", gh.Path, tt.path)
			}
		})
	}
}

func TestParseURL_errors(t *testing.T) {
	invalid := []string{
		"",
		"not-a-url",
		"https://example.com/some/page",
		"https://gitlab.com/owner/repo",
		"https://raw.githubusercontent.com/onlyowner",
	}

	for _, raw := range invalid {
		t.Run(raw, func(t *testing.T) {
			_, err := parseURL(raw)
			if err == nil {
				t.Errorf("parseURL(%q) expected error, got nil", raw)
			}
		})
	}
}

func TestFilterImages(t *testing.T) {
	items := []githubContent{
		{Name: "photo.jpg", Type: "file", Size: 1024},
		{Name: "photo.jpeg", Type: "file", Size: 2048},
		{Name: "screenshot.png", Type: "file", Size: 4096},
		{Name: "animation.webp", Type: "file", Size: 512},
		{Name: "document.pdf", Type: "file", Size: 300},
		{Name: "script.js", Type: "file", Size: 100},
		{Name: "subdir", Type: "dir", Size: 0},
		{Name: "archive.zip", Type: "file", Size: 9999},
		{Name: "image.PNG", Type: "file", Size: 2000},   // uppercase
		{Name: "Photo.JPG", Type: "file", Size: 3000},   // uppercase
	}

	images := filterImages(items)
	if len(images) != 6 {
		t.Fatalf("got %d images, want 6", len(images))
	}

	expected := map[string]bool{
		"photo.jpg":      true,
		"photo.jpeg":     true,
		"screenshot.png": true,
		"animation.webp": true,
		"image.PNG":      true,
		"Photo.JPG":      true,
	}

	for _, img := range images {
		if !expected[img.Name] {
			t.Errorf("unexpected image: %s", img.Name)
		}
	}
}

func TestIsImageFile(t *testing.T) {
	tests := []struct {
		name  string
		image bool
	}{
		{"photo.jpg", true},
		{"photo.jpeg", true},
		{"screenshot.png", true},
		{"animation.webp", true},
		{"image.PNG", true},
		{"Photo.JPG", true},
		{"noext", false},
		{"document.pdf", false},
		{"script.js", false},
		{"archive.zip", false},
		{"Makefile", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isImageFile(tt.name)
			if got != tt.image {
				t.Errorf("isImageFile(%q) = %v, want %v", tt.name, got, tt.image)
			}
		})
	}
}

func TestTTLCache(t *testing.T) {
	c := newTTLCache(5*time.Minute, 10)

	// Get on empty cache
	_, ok := c.get("key1")
	if ok {
		t.Fatal("expected miss on empty cache")
	}

	result := &ListContentsResult{Items: []ImageInfo{{Name: "test.jpg"}}}
	c.set("key1", result)

	got, ok := c.get("key1")
	if !ok {
		t.Fatal("expected hit after set")
	}
	if len(got.Items) != 1 || got.Items[0].Name != "test.jpg" {
		t.Fatal("wrong cached data")
	}
}

func TestTTLCache_expiry(t *testing.T) {
	c := newTTLCache(1*time.Millisecond, 10)
	c.set("k", &ListContentsResult{Items: []ImageInfo{{Name: "x"}}})

	time.Sleep(5 * time.Millisecond)

	_, ok := c.get("k")
	if ok {
		t.Fatal("expected miss after TTL expiry")
	}
}

func TestTTLCache_eviction(t *testing.T) {
	c := newTTLCache(5*time.Minute, 2)
	c.set("a", &ListContentsResult{Items: []ImageInfo{{Name: "a"}}})
	c.set("b", &ListContentsResult{Items: []ImageInfo{{Name: "b"}}})
	c.set("c", &ListContentsResult{Items: []ImageInfo{{Name: "c"}}})

	// "a" should have been evicted
	_, ok := c.get("a")
	if ok {
		t.Fatal("expected eviction of oldest entry")
	}
	// "b" and "c" should still be present
	if _, ok := c.get("b"); !ok {
		t.Fatal("expected 'b' to still be in cache")
	}
	if _, ok := c.get("c"); !ok {
		t.Fatal("expected 'c' to still be in cache")
	}
}

func TestBuildRawURL(t *testing.T) {
	url := buildRawURL("dharmx", "walls", "main", "images/nature/mountain.png")
	want := "https://raw.githubusercontent.com/dharmx/walls/main/images/nature/mountain.png"
	if url != want {
		t.Errorf("got %q, want %q", url, want)
	}
}
