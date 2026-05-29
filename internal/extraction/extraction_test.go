package extraction

import (
	"math"
	"testing"

	"aether/internal/color"
)

func TestNormalizeCounts(t *testing.T) {
	got := normalizeCounts([]int{1, 3})
	want := []float64{0.25, 0.75}
	if len(got) != len(want) {
		t.Fatalf("len = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if math.Abs(got[i]-want[i]) > 1e-9 {
			t.Errorf("weights[%d] = %v, want %v", i, got[i], want[i])
		}
	}
	if normalizeCounts(nil) != nil {
		t.Error("normalizeCounts(nil) should be nil")
	}
	if normalizeCounts([]int{0, 0}) != nil {
		t.Error("normalizeCounts(all-zero) should be nil (avoid div-by-zero)")
	}
}

// With nil weights, background selection is pure lightness extremity: the single
// darkest color in dark mode, regardless of how little of the image it covers.
func TestFindBackgroundColorNilWeightsIsPureLightness(t *testing.T) {
	colors := []string{"#202020", "#000000", "#808080"}
	_, idx := FindBackgroundColor(colors, nil, false /* dark */)
	if idx != 1 {
		t.Errorf("dark-mode nil-weight bg index = %d (%s), want 1 (#000000)", idx, colors[idx])
	}
	_, idx = FindBackgroundColor(colors, nil, true /* light */)
	if idx != 2 {
		t.Errorf("light-mode nil-weight bg index = %d (%s), want 2 (#808080)", idx, colors[idx])
	}
}

// A deep tone that covers most of the image should beat a marginally-darker speck
// once coverage weights are supplied. Without the bias the near-black speck (index 0)
// would win; with it, the dominant deep color (index 1) should.
func TestFindBackgroundColorDominanceBias(t *testing.T) {
	colors := []string{"#050505" /* darkest speck */, "#10243a" /* dominant deep blue */}

	_, idxNoBias := FindBackgroundColor(colors, nil, false)
	if idxNoBias != 0 {
		t.Fatalf("precondition: without bias the darkest speck should win, got idx %d", idxNoBias)
	}

	weights := normalizeCounts([]int{2, 98}) // speck barely present, deep blue dominant
	_, idxBias := FindBackgroundColor(colors, weights, false)
	if idxBias != 1 {
		t.Errorf("with dominance bias, dominant deep tone should win: got idx %d (%s), want 1 (%s)",
			idxBias, colors[idxBias], colors[1])
	}
}

// Even a heavily-dominant bright color must never be chosen as a dark-mode background:
// the lightness term outranks the bounded dominance nudge.
func TestFindBackgroundColorDominanceNeverFlipsLightness(t *testing.T) {
	colors := []string{"#101010" /* dark, rare */, "#f0f0f0" /* bright, dominant */}
	weights := normalizeCounts([]int{5, 95})
	_, idx := FindBackgroundColor(colors, weights, false /* dark mode */)
	if idx != 0 {
		t.Errorf("dark-mode bg should stay dark even vs a dominant bright color: got idx %d (%s)",
			idx, colors[idx])
	}
}

func oklabAt(chroma float64) color.OKLab {
	// Place the chroma entirely on the +a axis at a mid lightness; only the
	// chroma magnitude matters to boostChromaticPixels.
	return color.OKLab{L: 0.5, A: chroma, B: 0}
}

// The chroma boost must be graded and monotonic: a pixel just above the threshold
// gets exactly one extra copy (matching the historical flat-2x), the most vivid
// pixels get ChromaBoostMaxExtra, and copies never decrease with chroma.
func TestBoostChromaticPixelsGraded(t *testing.T) {
	cases := []struct {
		name       string
		chroma     float64
		wantCopies int // total copies including the original
	}{
		{"achromatic", 0.0, 1},
		{"at threshold", ChromaBoostThreshold, 1},
		{"just above threshold", ChromaBoostThreshold + 0.001, 2},
		{"very vivid", ChromaBoostThreshold + ChromaBoostRampChroma, 1 + ChromaBoostMaxExtra},
		{"beyond max clamps", ChromaBoostThreshold + 2*ChromaBoostRampChroma, 1 + ChromaBoostMaxExtra},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out := boostChromaticPixels([]color.OKLab{oklabAt(tc.chroma)})
			if len(out) != tc.wantCopies {
				t.Errorf("chroma %.3f -> %d copies, want %d", tc.chroma, len(out), tc.wantCopies)
			}
		})
	}

	// Monotonicity across the ramp.
	prev := 0
	for c := 0.0; c <= 0.3; c += 0.01 {
		n := len(boostChromaticPixels([]color.OKLab{oklabAt(c)}))
		if n < prev {
			t.Errorf("copies decreased at chroma %.3f: %d < %d", c, n, prev)
		}
		prev = n
	}
}
