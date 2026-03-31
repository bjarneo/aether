package wallpaper

import (
	"crypto/md5"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"

	// Register decoders for common image formats.
	_ "image/gif"
	_ "image/jpeg"

	"golang.org/x/image/draw"

	"aether/internal/platform"
)

const thumbnailSize = 300
const previewSize = 800

func cachePath(imagePath, suffix string) string {
	hash := fmt.Sprintf("%x", md5.Sum([]byte(imagePath+suffix)))
	return filepath.Join(platform.ThumbnailDir(), hash+".png")
}

// GetThumbnail returns a cached thumbnail path for the given image, generating
// it if the cache entry is missing or stale. The thumbnail is a 300x300 PNG
// stored in ~/.cache/aether/thumbnails/.
func GetThumbnail(imagePath string) (string, error) {
	thumbPath := cachePath(imagePath, "")

	// Check if the source image exists.
	srcInfo, err := os.Stat(imagePath)
	if err != nil {
		return "", fmt.Errorf("source image not found: %w", err)
	}

	// If a cached thumbnail exists and is newer than the source, return it.
	if thumbInfo, err := os.Stat(thumbPath); err == nil {
		if thumbInfo.ModTime().After(srcInfo.ModTime()) {
			return thumbPath, nil
		}
	}

	// Generate the thumbnail.
	thumbDir := platform.ThumbnailDir()
	if err := platform.EnsureDir(thumbDir); err != nil {
		return "", fmt.Errorf("failed to create thumbnail directory: %w", err)
	}

	// For video files, extract a frame with ffmpeg first
	ext := strings.ToLower(filepath.Ext(imagePath))
	if ext == ".mp4" || ext == ".webm" {
		return getVideoThumbnail(imagePath, thumbDir, thumbPath)
	}

	src, err := loadImage(imagePath)
	if err != nil {
		return "", fmt.Errorf("failed to load image %s: %w", imagePath, err)
	}

	thumb := scaleThumbnail(src, thumbnailSize)

	out, err := os.Create(thumbPath)
	if err != nil {
		return "", fmt.Errorf("failed to create thumbnail file: %w", err)
	}
	defer out.Close()

	if err := png.Encode(out, thumb); err != nil {
		_ = os.Remove(thumbPath)
		return "", fmt.Errorf("failed to encode thumbnail: %w", err)
	}

	return thumbPath, nil
}

// GetPreview returns a cached preview path (800px) for the slider widget.
func GetPreview(imagePath string) (string, error) {
	previewPath := cachePath(imagePath, "-preview")

	srcInfo, err := os.Stat(imagePath)
	if err != nil {
		return "", fmt.Errorf("source image not found: %w", err)
	}

	if pInfo, err := os.Stat(previewPath); err == nil {
		if pInfo.ModTime().After(srcInfo.ModTime()) {
			return previewPath, nil
		}
	}

	if err := platform.EnsureDir(platform.ThumbnailDir()); err != nil {
		return "", fmt.Errorf("failed to create preview directory: %w", err)
	}

	ext := strings.ToLower(filepath.Ext(imagePath))
	if ext == ".mp4" || ext == ".webm" {
		_, err := platform.RunSync("ffmpeg",
			"-ss", "1", "-i", imagePath,
			"-vframes", "1", "-vf", fmt.Sprintf("scale=%d:-1", previewSize),
			"-y", previewPath)
		if err != nil {
			return "", fmt.Errorf("ffmpeg preview failed: %w", err)
		}
		return previewPath, nil
	}

	src, err := loadImage(imagePath)
	if err != nil {
		return "", fmt.Errorf("failed to load image: %w", err)
	}

	preview := scaleThumbnail(src, previewSize)
	out, err := os.Create(previewPath)
	if err != nil {
		return "", fmt.Errorf("failed to create preview file: %w", err)
	}
	defer out.Close()

	if err := png.Encode(out, preview); err != nil {
		_ = os.Remove(previewPath)
		return "", fmt.Errorf("failed to encode preview: %w", err)
	}

	return previewPath, nil
}

// IsPreviewCached returns true if a fresh preview exists for the given path.
func IsPreviewCached(imagePath string) bool {
	previewPath := cachePath(imagePath, "-preview")
	srcInfo, err := os.Stat(imagePath)
	if err != nil {
		return false
	}
	pInfo, err := os.Stat(previewPath)
	if err != nil {
		return false
	}
	return pInfo.ModTime().After(srcInfo.ModTime())
}

// loadImage opens and decodes an image file.
func loadImage(path string) (image.Image, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	img, _, err := image.Decode(f)
	return img, err
}

// scaleThumbnail scales an image to fit within a size x size bounding box,
// preserving aspect ratio.
func scaleThumbnail(src image.Image, size int) image.Image {
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

// getVideoThumbnail extracts a frame from a video file using ffmpeg.
func getVideoThumbnail(videoPath, thumbDir, thumbPath string) (string, error) {
	_, err := platform.RunSync("ffmpeg",
		"-ss", "1", "-i", videoPath,
		"-vframes", "1", "-vf", "scale=300:-1",
		"-y", thumbPath)
	if err != nil {
		// Fallback: try first frame (video might be shorter than 1s)
		_, err = platform.RunSync("ffmpeg",
			"-i", videoPath,
			"-vframes", "1", "-vf", "scale=300:-1",
			"-y", thumbPath)
		if err != nil {
			return "", fmt.Errorf("ffmpeg thumbnail failed: %w", err)
		}
	}
	return thumbPath, nil
}

// ExtractVideoFrame extracts a single frame from a video for color extraction.
// Returns the path to a cached PNG in the thumbnail directory.
func ExtractVideoFrame(videoPath string) (string, error) {
	framePath := cachePath(videoPath, "-frame")

	if info, err := os.Stat(framePath); err == nil {
		srcInfo, _ := os.Stat(videoPath)
		if srcInfo != nil && info.ModTime().After(srcInfo.ModTime()) {
			return framePath, nil
		}
	}

	if err := platform.EnsureDir(platform.ThumbnailDir()); err != nil {
		return "", err
	}

	_, err := platform.RunSync("ffmpeg",
		"-ss", "1", "-i", videoPath,
		"-vframes", "1", "-y", framePath)
	if err != nil {
		_, err = platform.RunSync("ffmpeg",
			"-i", videoPath,
			"-vframes", "1", "-y", framePath)
	}
	if err != nil {
		return "", fmt.Errorf("ffmpeg frame extraction failed: %w", err)
	}
	return framePath, nil
}
