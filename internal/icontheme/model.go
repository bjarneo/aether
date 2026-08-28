// Package icontheme owns installed icon-theme selection and catalog behavior.
package icontheme

import (
	"errors"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"
)

// MaxIDBytes bounds a theme directory ID to a common filesystem component
// limit while permitting non-ASCII UTF-8 names.
const MaxIDBytes = 255

// SelectionMode identifies how Aether chooses the generated desktop icon theme.
type SelectionMode string

const (
	SelectionAutomatic SelectionMode = "automatic"
	SelectionExplicit  SelectionMode = "explicit"
)

// Selection is the persisted icon-theme choice.
type Selection struct {
	Mode SelectionMode `json:"mode"`
	ID   string        `json:"id,omitempty"`
}

// Automatic returns the canonical automatic selection.
func Automatic() Selection {
	return Selection{Mode: SelectionAutomatic}
}

// ValidateID validates one installed icon-theme directory ID.
func ValidateID(id string) error {
	if id == "" {
		return errors.New("icon theme ID is empty")
	}
	if !utf8.ValidString(id) {
		return errors.New("icon theme ID is not valid UTF-8")
	}
	if len(id) > MaxIDBytes {
		return fmt.Errorf("icon theme ID exceeds %d bytes", MaxIDBytes)
	}
	if id == "." || id == ".." {
		return errors.New("icon theme ID is not a directory name")
	}
	if strings.TrimSpace(id) != id {
		return errors.New("icon theme ID has leading or trailing whitespace")
	}
	if strings.ContainsAny(id, `/\`) {
		return errors.New("icon theme ID must be one path segment")
	}
	for _, r := range id {
		if unicode.IsControl(r) {
			return errors.New("icon theme ID contains a control character")
		}
	}
	return nil
}

// NormalizeSelection validates selection and canonicalizes legacy zero values.
func NormalizeSelection(selection Selection) (Selection, error) {
	switch selection.Mode {
	case "":
		if selection.ID != "" {
			return Selection{}, errors.New("icon theme selection has an ID without a mode")
		}
		return Automatic(), nil
	case SelectionAutomatic:
		if selection.ID != "" {
			return Selection{}, errors.New("automatic icon theme selection must not have an ID")
		}
		return Automatic(), nil
	case SelectionExplicit:
		if err := ValidateID(selection.ID); err != nil {
			return Selection{}, fmt.Errorf("explicit icon theme selection: %w", err)
		}
		return selection, nil
	default:
		return Selection{}, fmt.Errorf("unknown icon theme selection mode %q", selection.Mode)
	}
}
