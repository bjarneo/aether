package theme

// HistoryManager manages an undo/redo stack of ThemeState snapshots.
type HistoryManager struct {
	undoStack []ThemeState
	redoStack []ThemeState
	maxSize   int
}

// NewHistoryManager returns a HistoryManager with a default capacity of 50.
func NewHistoryManager() *HistoryManager {
	return &HistoryManager{
		undoStack: make([]ThemeState, 0, 50),
		redoStack: make([]ThemeState, 0, 50),
		maxSize:   50,
	}
}

// Push saves a copy of the state onto the undo stack and clears the redo
// stack. If the stack exceeds maxSize, the oldest entry is dropped.
func (h *HistoryManager) Push(state ThemeState) {
	h.undoStack = append(h.undoStack, deepCopy(state))
	h.redoStack = h.redoStack[:0]

	if len(h.undoStack) > h.maxSize {
		h.undoStack = h.undoStack[1:]
	}
}

// Undo pops the last saved state from the undo stack, pushes current onto
// the redo stack, and returns the restored state. Returns false if undo is
// not available.
func (h *HistoryManager) Undo(current ThemeState) (ThemeState, bool) {
	if !h.CanUndo() {
		return ThemeState{}, false
	}

	// Push current state onto redo stack
	h.redoStack = append(h.redoStack, deepCopy(current))

	// Pop from undo stack
	n := len(h.undoStack)
	restored := h.undoStack[n-1]
	h.undoStack = h.undoStack[:n-1]

	return restored, true
}

// Redo pops the last state from the redo stack, pushes current onto the
// undo stack, and returns the restored state. Returns false if redo is not
// available.
func (h *HistoryManager) Redo(current ThemeState) (ThemeState, bool) {
	if !h.CanRedo() {
		return ThemeState{}, false
	}

	// Push current state onto undo stack
	h.undoStack = append(h.undoStack, deepCopy(current))

	// Pop from redo stack
	n := len(h.redoStack)
	restored := h.redoStack[n-1]
	h.redoStack = h.redoStack[:n-1]

	return restored, true
}

// CanUndo reports whether there are states available to undo to.
func (h *HistoryManager) CanUndo() bool {
	return len(h.undoStack) > 0
}

// CanRedo reports whether there are states available to redo to.
func (h *HistoryManager) CanRedo() bool {
	return len(h.redoStack) > 0
}

// deepCopy creates a deep copy of a ThemeState to prevent aliased map/slice
// mutations from affecting stored history entries.
func deepCopy(s ThemeState) ThemeState {
	cp := s

	cp.LockedColors = make(map[int]bool, len(s.LockedColors))
	for k, v := range s.LockedColors {
		cp.LockedColors[k] = v
	}

	cp.ExtendedColors = make(map[string]string, len(s.ExtendedColors))
	for k, v := range s.ExtendedColors {
		cp.ExtendedColors[k] = v
	}

	cp.AdditionalImages = make([]string, len(s.AdditionalImages))
	copy(cp.AdditionalImages, s.AdditionalImages)

	cp.AppOverrides = make(map[string]map[string]string, len(s.AppOverrides))
	for app, colors := range s.AppOverrides {
		m := make(map[string]string, len(colors))
		for k, v := range colors {
			m[k] = v
		}
		cp.AppOverrides[app] = m
	}

	return cp
}
