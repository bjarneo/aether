package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// allowedMediaExts maps extensions to MIME types for files the handler may serve.
var allowedMediaExts = map[string]string{
	".mp4":  "video/mp4",
	".webm": "video/webm",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".gif":  "image/gif",
	".webp": "image/webp",
	".bmp":  "image/bmp",
}

// MediaServer serves local media files over a real HTTP connection on localhost.
// webkit2gtk uses GStreamer for <video> playback, and GStreamer only understands
// http/https/file schemes — not the custom wails:// scheme.  By running a small
// localhost server we get proper Range-request streaming for free.
type MediaServer struct {
	port int
}

// Start listens on a random available port and serves in the background.
// Call this once at startup, then use URL() to build playback URLs.
func (s *MediaServer) Start() error {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return fmt.Errorf("media server listen: %w", err)
	}
	s.port = ln.Addr().(*net.TCPAddr).Port

	mux := http.NewServeMux()
	mux.HandleFunc("/media", s.handleMedia)

	go http.Serve(ln, mux)
	return nil
}

// URL returns an http://localhost URL that the frontend can use in <video src>.
func (s *MediaServer) URL(filePath string) string {
	return fmt.Sprintf("http://127.0.0.1:%d/media?path=%s", s.port, filePath)
}

// Port returns the port the server is listening on.
func (s *MediaServer) Port() int {
	return s.port
}

func (s *MediaServer) handleMedia(w http.ResponseWriter, r *http.Request) {
	filePath := r.URL.Query().Get("path")
	if filePath == "" {
		http.Error(w, "missing path parameter", http.StatusBadRequest)
		return
	}

	ext := strings.ToLower(filepath.Ext(filePath))
	mime, ok := allowedMediaExts[ext]
	if !ok {
		http.Error(w, "unsupported file type", http.StatusForbidden)
		return
	}

	f, err := os.Open(filePath)
	if err != nil {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		http.Error(w, "cannot stat file", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", mime)
	w.Header().Set("Access-Control-Allow-Origin", "*")
	http.ServeContent(w, r, filepath.Base(filePath), stat.ModTime(), f)
}
