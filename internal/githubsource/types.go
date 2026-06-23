package githubsource

// ImageInfo describes a single item (file or directory) from a GitHub repository.
type ImageInfo struct {
	Name string `json:"name"`
	URL  string `json:"url"`   // raw.githubusercontent.com download URL (empty for dirs)
	Size int64  `json:"size"`
	Type string `json:"type"`  // "file" or "dir"
	Path string `json:"path"`  // repo-relative path
}

// ListContentsResult is returned by ListImages, containing both files and dirs.
type ListContentsResult struct {
	Items []ImageInfo `json:"items"`
}

// githubContent is a single item from the GitHub Contents API response.
type githubContent struct {
	Name        string `json:"name"`
	Type        string `json:"type"` // "file" or "dir"
	Path        string `json:"path"`
	Size        int64  `json:"size"`
	DownloadURL string `json:"download_url"`
}
