package githubsource

// ImageInfo describes a single image file from a GitHub repository.
type ImageInfo struct {
	Name string `json:"name"`
	URL  string `json:"url"`  // raw.githubusercontent.com download URL
	Size int64  `json:"size"`
}

// githubContent is a single item from the GitHub Contents API response.
type githubContent struct {
	Name        string `json:"name"`
	Type        string `json:"type"` // "file" or "dir"
	Path        string `json:"path"`
	Size        int64  `json:"size"`
	DownloadURL string `json:"download_url"`
}
