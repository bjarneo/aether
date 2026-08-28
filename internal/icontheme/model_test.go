package icontheme

import (
	"strings"
	"testing"
)

func TestValidateID(t *testing.T) {
	t.Parallel()

	valid := []string{
		"Papirus-Dark",
		"Tela.circle_blue",
		"Breeze (Dark)",
		"Íconos-日本語",
		strings.Repeat("a", 255),
	}
	for _, id := range valid {
		id := id
		t.Run("valid/"+id, func(t *testing.T) {
			t.Parallel()
			if err := ValidateID(id); err != nil {
				t.Errorf("ValidateID(%q) = %v, want nil", id, err)
			}
		})
	}

	invalid := []string{
		"",
		".",
		"..",
		"/absolute",
		`C:\icons`,
		"parent/child",
		`parent\child`,
		" leading",
		"trailing ",
		"line\nfeed",
		"carriage\rreturn",
		"nul\x00byte",
		"control\u0085byte",
		string([]byte{'b', 'a', 'd', 0xff}),
		strings.Repeat("a", 256),
	}
	for _, id := range invalid {
		id := id
		t.Run("invalid/"+id, func(t *testing.T) {
			t.Parallel()
			if err := ValidateID(id); err == nil {
				t.Errorf("ValidateID(%q) = nil, want error", id)
			}
		})
	}
}

func TestNormalizeSelection(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		input   Selection
		want    Selection
		wantErr bool
	}{
		{name: "legacy zero", input: Selection{}, want: Automatic()},
		{name: "automatic", input: Automatic(), want: Automatic()},
		{
			name:  "explicit safe missing ID",
			input: Selection{Mode: SelectionExplicit, ID: "Missing-But-Safe"},
			want:  Selection{Mode: SelectionExplicit, ID: "Missing-But-Safe"},
		},
		{
			name:    "automatic with ID",
			input:   Selection{Mode: SelectionAutomatic, ID: "Papirus"},
			wantErr: true,
		},
		{
			name:    "explicit without ID",
			input:   Selection{Mode: SelectionExplicit},
			wantErr: true,
		},
		{
			name:    "explicit unsafe ID",
			input:   Selection{Mode: SelectionExplicit, ID: "../escape"},
			wantErr: true,
		},
		{
			name:    "unknown mode",
			input:   Selection{Mode: "installed", ID: "Papirus"},
			wantErr: true,
		},
		{
			name:    "missing mode with ID",
			input:   Selection{ID: "Papirus"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		tc := tt
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := NormalizeSelection(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("NormalizeSelection(%+v) = %+v, nil; want error", tc.input, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("NormalizeSelection(%+v) error = %v", tc.input, err)
			}
			if got != tc.want {
				t.Errorf("NormalizeSelection(%+v) = %+v, want %+v", tc.input, got, tc.want)
			}
		})
	}
}
