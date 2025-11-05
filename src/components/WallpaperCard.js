import Gtk from 'gi://Gtk?version=4.0';
import {favoritesService} from '../services/favorites-service.js';

export function createWallpaperCard(
    wallpaper,
    onSelect,
    onFavoriteToggle,
    onAddToAdditional
) {
    const mainBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 8,
    });

    // Image button with card styling
    const imageButton = new Gtk.Button({
        css_classes: ['card'],
    });

    // Custom CSS for transparent button background
    const buttonCss = `
        .card button {
            background: none;
            border: none;
            box-shadow: none;
        }
    `;
    const buttonProvider = new Gtk.CssProvider();
    buttonProvider.load_from_data(buttonCss, -1);
    imageButton
        .get_style_context()
        .add_provider(buttonProvider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

    // Thumbnail image
    const picture = new Gtk.Picture({
        height_request: 180,
        can_shrink: true,
        hexpand: true,
        content_fit: Gtk.ContentFit.COVER,
    });

    imageButton.set_child(picture);
    imageButton.connect('clicked', () => onSelect(wallpaper));

    mainBox.append(imageButton);

    // Info row with details and favorite button
    const infoRow = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 8,
    });

    // Info label
    const infoLabel = new Gtk.Label({
        label: wallpaper.info || wallpaper.name || '',
        css_classes: ['caption', 'dim-label'],
        xalign: 0,
        hexpand: true,
        ellipsize: 3, // PANGO_ELLIPSIZE_END
    });

    // Add to additional images button
    const addButton = new Gtk.Button({
        icon_name: 'list-add-symbolic',
        css_classes: ['flat'],
        halign: Gtk.Align.END,
        tooltip_text: 'Add to additional images',
    });

    if (onAddToAdditional) {
        addButton.connect('clicked', () => {
            onAddToAdditional(wallpaper);
        });
    } else {
        addButton.set_sensitive(false);
    }

    // Favorite button
    const favButton = new Gtk.Button({
        icon_name: 'emblem-favorite-symbolic',
        css_classes: favoritesService.isFavorite(wallpaper.path)
            ? ['flat', 'favorite-active']
            : ['flat', 'favorite-inactive'],
        halign: Gtk.Align.END,
    });

    // Add custom CSS for favorite button
    const css = `
        .favorite-active {
            color: @accent_bg_color;
        }
        .favorite-inactive {
            color: alpha(@window_fg_color, 0.5);
        }
        .favorite-inactive:hover {
            color: @window_fg_color;
        }
    `;
    const provider = new Gtk.CssProvider();
    provider.load_from_data(css, -1);
    favButton
        .get_style_context()
        .add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

    favButton.connect('clicked', () => {
        const isFav = favoritesService.toggleFavorite(
            wallpaper.path,
            wallpaper.type,
            wallpaper.data
        );
        favButton.set_css_classes(
            isFav ? ['flat', 'favorite-active'] : ['flat', 'favorite-inactive']
        );
        if (onFavoriteToggle) {
            onFavoriteToggle(wallpaper, isFav);
        }
    });

    infoRow.append(infoLabel);
    infoRow.append(addButton);
    infoRow.append(favButton);
    mainBox.append(infoRow);

    return {mainBox, picture, favButton, addButton};
}
