package extraction

import (
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"os"

	"aether/internal/color"

	"golang.org/x/image/draw"
)

// LoadAndSamplePixels loads an image, scales it to ImageScaleSize (preserving aspect ratio),
// and samples up to MaxPixelsToSample pixels, skipping transparent pixels (alpha < 128).
// Returns a slice of color.RGB values.
func LoadAndSamplePixels(imagePath string) ([]color.RGB, error) {
	f, err := os.Open(imagePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open image: %w", err)
	}
	defer f.Close()

	src, _, err := image.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	bounds := src.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()

	// Scale to fit within ImageScaleSize x ImageScaleSize, preserving aspect ratio
	var dstW, dstH int
	if srcW >= srcH {
		dstW = ImageScaleSize
		dstH = int(math.Round(float64(srcH) * float64(ImageScaleSize) / float64(srcW)))
		if dstH < 1 {
			dstH = 1
		}
	} else {
		dstH = ImageScaleSize
		dstW = int(math.Round(float64(srcW) * float64(ImageScaleSize) / float64(srcH)))
		if dstW < 1 {
			dstW = 1
		}
	}

	dst := image.NewNRGBA(image.Rect(0, 0, dstW, dstH))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, bounds, draw.Over, nil)

	totalPixels := dstW * dstH
	step := int(math.Max(1, math.Floor(float64(totalPixels)/float64(MaxPixelsToSample))))

	var colors []color.RGB
	for y := 0; y < dstH; y += step {
		for x := 0; x < dstW; x += step {
			offset := (y*dstW + x) * 4
			a := dst.Pix[offset+3]

			// Skip transparent pixels
			if a < 128 {
				continue
			}

			colors = append(colors, color.RGB{
				R: float64(dst.Pix[offset]),
				G: float64(dst.Pix[offset+1]),
				B: float64(dst.Pix[offset+2]),
			})
		}
	}

	return colors, nil
}
