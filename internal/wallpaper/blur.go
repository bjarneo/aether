package wallpaper

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"image"
	"image/jpeg"
	"math"
	"os"
	"path/filepath"
	"strings"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp" // register WebP decoder

	"aether/internal/platform"
)

// Heavy-blur variant generation. The blurred file is what gets applied as
// the desktop wallpaper; the palette pipeline keeps sampling the untouched
// original, so extraction results are identical with and without blur.
const (
	// blurWorkSize caps the longest edge the blur is computed at. Heavy
	// Gaussian blur erases fine detail, so computing at full resolution
	// only costs time — the result is upscaled afterwards.
	blurWorkSize = 640
	// blurSigma is the Gaussian sigma at the working resolution (~5% of
	// the image width — a very heavy blur once scaled to screen size).
	blurSigma = 32.0
	// blurMaxOutputSize caps the upscaled variant's longest edge.
	blurMaxOutputSize = 2560
	// blurJPEGQuality for the encoded variant.
	blurJPEGQuality = 92
)

// CreateBlurredVariant decodes the image at srcPath, applies a heavy Gaussian
// blur and writes a JPEG variant into destDir. The source file is never
// modified — callers keep using it for color extraction and editing.
// The variant file name is derived from the source path, size, mtime and
// blur parameters, so unchanged images reuse their cached variant.
// Returns the path of the blurred variant.
func CreateBlurredVariant(srcPath, destDir string) (string, error) {
	srcInfo, err := os.Stat(srcPath)
	if err != nil {
		return "", fmt.Errorf("stat image: %w", err)
	}

	key := fmt.Sprintf("v1|%s|%d|%d|%d|%g", srcPath, srcInfo.Size(),
		srcInfo.ModTime().UnixNano(), blurWorkSize, blurSigma)
	sum := sha256.Sum256([]byte(key))

	// Human-readable name (shown by desktop background cyclers when the
	// variant is copied into a theme folder): <name>-blurred-<hash8>.jpg
	base := strings.TrimSuffix(filepath.Base(srcPath), filepath.Ext(srcPath))
	if base == "" || base == "." || base == "/" {
		base = "wallpaper"
	}
	outPath := filepath.Join(destDir, fmt.Sprintf("%s-blurred-%s.jpg", base, hex.EncodeToString(sum[:8])))

	// Reuse the cached variant when it exists and is fully written.
	if outInfo, err := os.Stat(outPath); err == nil && outInfo.Size() > 0 {
		return outPath, nil
	}

	src, err := loadImage(srcPath)
	if err != nil {
		return "", fmt.Errorf("load image: %w", err)
	}

	blurred := heavyGaussianBlur(src)

	if err := platform.EnsureDir(destDir); err != nil {
		return "", fmt.Errorf("create blur cache dir: %w", err)
	}

	// Write via a temp file + rename so a crash mid-encode can never leave
	// a truncated file that later passes the cache check above.
	tmp, err := os.CreateTemp(destDir, ".blur-*")
	if err != nil {
		return "", fmt.Errorf("create temp file: %w", err)
	}
	tmpName := tmp.Name()
	if err := jpeg.Encode(tmp, blurred, &jpeg.Options{Quality: blurJPEGQuality}); err != nil {
		tmp.Close()
		_ = os.Remove(tmpName)
		return "", fmt.Errorf("encode blurred image: %w", err)
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpName)
		return "", fmt.Errorf("close temp file: %w", err)
	}
	if err := os.Rename(tmpName, outPath); err != nil {
		_ = os.Remove(tmpName)
		return "", fmt.Errorf("finalize blurred image: %w", err)
	}

	return outPath, nil
}

// heavyGaussianBlur downscales the image, runs a separable Gaussian blur at
// the working resolution and scales the result back up. Working at reduced
// resolution makes a blur of this strength fast without any visible
// difference — fine detail is gone either way.
func heavyGaussianBlur(src image.Image) image.Image {
	bounds := src.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()
	if srcW < 1 || srcH < 1 {
		return src
	}

	// Downscale only — never upscale small sources before blurring.
	scale := math.Min(1, float64(blurWorkSize)/math.Max(float64(srcW), float64(srcH)))
	workW := max(1, int(math.Round(float64(srcW)*scale)))
	workH := max(1, int(math.Round(float64(srcH)*scale)))

	work := image.NewRGBA(image.Rect(0, 0, workW, workH))
	xdraw.CatmullRom.Scale(work, work.Bounds(), src, bounds, xdraw.Over, nil)

	// Wallpapers are opaque: flatten alpha (premultiplied RGBA over black
	// is just alpha=255) so channel blurring can't bleed transparency.
	for i := 3; i < len(work.Pix); i += 4 {
		work.Pix[i] = 0xff
	}

	gaussianBlurRGBA(work, blurSigma)

	// Upscale back to (a capped version of) the original dimensions.
	outW, outH := srcW, srcH
	if maxOut := max(srcW, srcH); maxOut > blurMaxOutputSize {
		adjust := float64(blurMaxOutputSize) / float64(maxOut)
		outW = max(1, int(math.Round(float64(srcW)*adjust)))
		outH = max(1, int(math.Round(float64(srcH)*adjust)))
	}
	if outW == workW && outH == workH {
		return work
	}

	out := image.NewRGBA(image.Rect(0, 0, outW, outH))
	xdraw.CatmullRom.Scale(out, out.Bounds(), work, work.Bounds(), xdraw.Over, nil)
	return out
}

// gaussianBlurRGBA blurs img in place with a separable Gaussian kernel.
// Edges are handled by clamping sample coordinates (replicate). The image
// is treated as opaque: alpha passes through untouched.
func gaussianBlurRGBA(img *image.RGBA, sigma float64) {
	if sigma <= 0 {
		return
	}
	radius := int(math.Ceil(sigma * 3))
	if radius < 1 {
		return
	}

	kernel := make([]float64, 2*radius+1)
	norm := 0.0
	for i := range kernel {
		x := float64(i - radius)
		kernel[i] = math.Exp(-(x * x) / (2 * sigma * sigma))
		norm += kernel[i]
	}
	for i := range kernel {
		kernel[i] /= norm
	}

	w := img.Rect.Dx()
	h := img.Rect.Dy()
	pix := img.Pix
	stride := img.Stride

	// Horizontal pass into scratch, then vertical pass back into pix.
	scratch := make([]float32, w*h*4)
	for y := 0; y < h; y++ {
		row := pix[y*stride : y*stride+w*4]
		out := scratch[y*w*4 : (y+1)*w*4]
		for x := 0; x < w; x++ {
			var r, g, b float64
			for k, kv := range kernel {
				sx := x + k - radius
				if sx < 0 {
					sx = 0
				} else if sx >= w {
					sx = w - 1
				}
				o := sx * 4
				r += kv * float64(row[o])
				g += kv * float64(row[o+1])
				b += kv * float64(row[o+2])
			}
			o := x * 4
			out[o] = float32(r)
			out[o+1] = float32(g)
			out[o+2] = float32(b)
			out[o+3] = float32(row[o+3])
		}
	}
	for y := 0; y < h; y++ {
		out := pix[y*stride : y*stride+w*4]
		for x := 0; x < w; x++ {
			var r, g, b float64
			for k, kv := range kernel {
				sy := y + k - radius
				if sy < 0 {
					sy = 0
				} else if sy >= h {
					sy = h - 1
				}
				t := scratch[(sy*w+x)*4:]
				r += kv * float64(t[0])
				g += kv * float64(t[1])
				b += kv * float64(t[2])
			}
			o := x * 4
			out[o] = clampByte(r)
			out[o+1] = clampByte(g)
			out[o+2] = clampByte(b)
		}
	}
}

func clampByte(v float64) byte {
	if v <= 0 {
		return 0
	}
	if v >= 255 {
		return 255
	}
	return byte(math.Round(v))
}
