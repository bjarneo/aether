import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';

import {favoritesService} from '../services/favorites-service.js';
import {applyCssToWidget} from '../utils/ui-helpers.js';
import {SPACING} from '../constants/ui-constants.js';

// Shared CSS styles for overlay elements
const OVERLAY_BUTTON_CSS = `
    button {
        background-color: alpha(@window_bg_color, 0.9);
        border-radius: 0;
        min-width: 28px;
        min-height: 28px;
        padding: 4px;
    }
    button:hover {
        background-color: @window_bg_color;
    }
`;

const OVERLAY_LABEL_CSS = `
    label {
        background-color: alpha(@window_bg_color, 0.85);
        color: @window_fg_color;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 0;
    }
`;

/**
 * Creates a modern wallpaper card with sharp design
 * @param {Object} wallpaper - Wallpaper data object
 * @param {Function} onSelect - Callback when card is selected
 * @param {Function} [onFavoriteToggle] - Callback when favorite is toggled
 * @param {Function} [onAddToAdditional] - Callback to add to additional images
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.showCheckbox] - Whether to show multi-select checkbox
 * @param {boolean} [options.isSelected] - Whether the card is selected (for multi-select)
 * @param {string} [options.dimensions] - Image dimensions string (e.g., "1920x1080")
 * @param {Function} [options.onContextMenu] - Callback for context menu (wallpaper, widget, x, y)
 * @param {Function} [options.onCheckboxToggle] - Callback when checkbox is toggled (wallpaper, isChecked)
 * @param {number} [options.height] - Custom thumbnail height
 * @returns {Object} Card components {mainBox, picture, favButton, addButton, checkbox}
 */
export function createWallpaperCard(
    wallpaper,
    onSelect,
    onFavoriteToggle,
    onAddToAdditional,
    options = {}
) {
    const {
        showCheckbox = false,
        isSelected = false,
        dimensions = null,
        onContextMenu = null,
        onCheckboxToggle = null,
        height = 180,
    } = options;

    const mainBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: SPACING.SM,
    });

    // Image container with sharp styling
    const imageContainer = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
    });
    applyCssToWidget(
        imageContainer,
        `
        box {
            background-color: alpha(@view_bg_color, 0.3);
            border: 1px solid alpha(@borders, 0.15);
            border-radius: 0;
        }
    `
    );

    // Overlay for image + action buttons
    const overlay = new Gtk.Overlay();

    // Thumbnail image
    const picture = new Gtk.Picture({
        height_request: height,
        can_shrink: true,
        hexpand: true,
        content_fit: Gtk.ContentFit.COVER,
    });
    applyCssToWidget(
        picture,
        `
        picture {
            border-radius: 0;
        }
    `
    );

    overlay.set_child(picture);

    // Checkbox overlay (top-left) for multi-select mode
    let checkbox = null;
    if (showCheckbox) {
        checkbox = new Gtk.CheckButton({
            halign: Gtk.Align.START,
            valign: Gtk.Align.START,
            margin_top: 6,
            margin_start: 6,
            active: isSelected,
        });
        applyCssToWidget(checkbox, `
            checkbutton {
                background-color: alpha(@window_bg_color, 0.9);
                border-radius: 0;
                min-width: 24px;
                min-height: 24px;
            }
        `);

        if (onCheckboxToggle) {
            checkbox.connect('toggled', () => {
                onCheckboxToggle(wallpaper, checkbox.get_active());
            });
        }

        overlay.add_overlay(checkbox);
    }

    // Dimensions label overlay (bottom-left)
    if (dimensions) {
        const dimensionsLabel = new Gtk.Label({
            label: dimensions,
            halign: Gtk.Align.START,
            valign: Gtk.Align.END,
            margin_bottom: 6,
            margin_start: 6,
        });
        applyCssToWidget(dimensionsLabel, OVERLAY_LABEL_CSS);
        overlay.add_overlay(dimensionsLabel);
    }

    // Hover actions overlay (top-right)
    const actionsBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 2,
        halign: Gtk.Align.END,
        valign: Gtk.Align.START,
        margin_top: 6,
        margin_end: 6,
    });

    // Add to additional images button
    const addButton = new Gtk.Button({
        icon_name: 'list-add-symbolic',
        tooltip_text: 'Add to additional images',
    });
    applyCssToWidget(addButton, OVERLAY_BUTTON_CSS);

    if (onAddToAdditional) {
        addButton.connect('clicked', () => onAddToAdditional(wallpaper));
    } else {
        addButton.set_sensitive(false);
        addButton.set_visible(false);
    }

    // Favorite button
    const isFavorite = favoritesService.isFavorite(wallpaper.path);
    const favButton = new Gtk.Button({
        icon_name: 'emblem-favorite-symbolic',
        tooltip_text: isFavorite ? 'Remove from favorites' : 'Add to favorites',
    });

    function updateFavButtonStyle(active) {
        const color = active ? '@accent_bg_color' : 'alpha(@window_fg_color, 0.7)';
        applyCssToWidget(favButton, `
            button {
                background-color: alpha(@window_bg_color, 0.9);
                border-radius: 0;
                min-width: 28px;
                min-height: 28px;
                padding: 4px;
                color: ${color};
            }
            button:hover {
                background-color: @window_bg_color;
                color: @accent_bg_color;
            }
        `);
    }

    updateFavButtonStyle(isFavorite);

    favButton.connect('clicked', () => {
        const isFav = favoritesService.toggleFavorite(
            wallpaper.path,
            wallpaper.type,
            wallpaper.data
        );
        updateFavButtonStyle(isFav);
        favButton.set_tooltip_text(isFav ? 'Remove from favorites' : 'Add to favorites');
        if (onFavoriteToggle) {
            onFavoriteToggle(wallpaper, isFav);
        }
    });

    actionsBox.append(addButton);
    actionsBox.append(favButton);
    overlay.add_overlay(actionsBox);

    imageContainer.append(overlay);

    // Left-click gesture on picture only (not the overlay buttons)
    const clickGesture = new Gtk.GestureClick();
    clickGesture.connect('pressed', () => {
        onSelect(wallpaper);
    });
    picture.add_controller(clickGesture);
    picture.set_cursor(Gdk.Cursor.new_from_name('pointer', null));

    // Right-click gesture for context menu
    if (onContextMenu) {
        const rightClickGesture = new Gtk.GestureClick({button: 3});
        rightClickGesture.connect('pressed', (gesture, nPress, x, y) => {
            onContextMenu(wallpaper, mainBox, x, y);
        });
        picture.add_controller(rightClickGesture);
    }

    mainBox.append(imageContainer);

    // Info row
    const infoRow = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: SPACING.SM,
    });

    // Info label
    const infoText = wallpaper.info || wallpaper.name || '';
    if (infoText) {
        const infoLabel = new Gtk.Label({
            label: infoText,
            xalign: 0,
            hexpand: true,
            ellipsize: 3, // PANGO_ELLIPSIZE_END
        });
        applyCssToWidget(
            infoLabel,
            `
            label {
                font-size: 11px;
                opacity: 0.5;
            }
        `
        );
        infoRow.append(infoLabel);
        mainBox.append(infoRow);
    }

    return {mainBox, picture, favButton, addButton, checkbox};
}
