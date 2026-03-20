package wallpaper

import (
	"crypto/md5"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"

	// Register decoders for common image formats.
	_ "image/gif"
	_ "image/jpeg"

	"golang.org/x/image/draw"

	"aether/internal/platform"
)

const thumbnailSize = 300

// GetThumbnail returns a cached thumbnail path for the given image, generating
// it if the cache entry is missing or stale. The thumbnail is a 300x300 PNG
// stored in ~/.cache/aether/thumbnails/.
func GetThumbnail(imagePath string) (string, error) {
	hash := fmt.Sprintf("%x", md5.Sum([]byte(imagePath)))
	thumbDir := platform.ThumbnailDir()
	thumbPath := filepath.Join(thumbDir, hash+".png")

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
	if err := platform.EnsureDir(thumbDir); err != nil {
		return "", fmt.Errorf("failed to create thumbnail directory: %w", err)
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
