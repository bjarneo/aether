import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gdk from 'gi://Gdk?version=4.0';

import {
    enumerateDirectory,
    loadJsonFile,
    saveJsonFile,
    deleteFile,
} from '../utils/file-utils.js';
import {DialogManager} from '../utils/DialogManager.js';
import {thumbnailService} from '../services/thumbnail-service.js';

/**
 * BlueprintManagerWindow - Ultra-compact blueprint manager
 *
 * Features:
 * - 80px wide cards for maximum density
 * - All 16 colors displayed (2 rows of 8)
 * - Efficient async thumbnail loading
 * - 60x45px thumbnails with proper aspect ratio
 * - Minimal margins and spacing
 *
 * @class BlueprintManagerWindow
 * @extends {Gtk.Box}
 */
export const BlueprintManagerWindow = GObject.registerClass(
    {
        Signals: {
            'blueprint-applied': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
            'close-requested': {},
        },
    },
    class BlueprintManagerWindow extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this._blueprints = [];
            this._blueprintsDir = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
                'blueprints',
            ]);

            GLib.mkdir_with_parents(this._blueprintsDir, 0o755);

            // Shared CSS provider for all color boxes
            this._colorProvider = new Gtk.CssProvider();
            this._cssCache = '';

            this._buildUI();
            this._loadBlueprintsAsync();
        }

        _buildUI() {
            // Header bar
            const headerBar = new Adw.HeaderBar();

            const closeButton = new Gtk.Button({
                icon_name: 'window-close-symbolic',
                tooltip_text: 'Close',
            });
            closeButton.connect('clicked', () => this.emit('close-requested'));
            headerBar.pack_start(closeButton);

            const importButton = new Gtk.Button({
                icon_name: 'document-open-symbolic',
                tooltip_text: 'Import Blueprint',
            });
            importButton.connect('clicked', () => this._importBlueprint());
            headerBar.pack_end(importButton);

            const refreshButton = new Gtk.Button({
                icon_name: 'view-refresh-symbolic',
                tooltip_text: 'Refresh',
            });
            refreshButton.connect('clicked', () => this.loadBlueprints(true));
            headerBar.pack_end(refreshButton);

            this.append(headerBar);

            // Search bar
            const searchBar = new Gtk.SearchBar();
            this._searchEntry = new Gtk.SearchEntry({
                placeholder_text: 'Search blueprints...',
                hexpand: true,
            });
            searchBar.set_child(this._searchEntry);
            searchBar.set_key_capture_widget(this);

            const searchButton = new Gtk.ToggleButton({
                icon_name: 'system-search-symbolic',
                tooltip_text: 'Search',
            });
            headerBar.pack_end(searchButton);
            searchButton.bind_property(
                'active',
                searchBar,
                'search-mode-enabled',
                GObject.BindingFlags.BIDIRECTIONAL
            );
            searchBar.connect_entry(this._searchEntry);
            this._searchEntry.connect('search-changed', () => this._filterBlueprints());

            this.append(searchBar);

            // Content area - FlowBox with strict sizing
            const scrolled = new Gtk.ScrolledWindow({
                vexpand: true,
                hexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
            });

            this._flowBox = new Gtk.FlowBox({
                valign: Gtk.Align.START,
                max_children_per_line: 10,
                min_children_per_line: 2,
                selection_mode: Gtk.SelectionMode.NONE,
                homogeneous: false,
                row_spacing: 6,
                column_spacing: 6,
                margin_start: 6,
                margin_end: 6,
                margin_top: 6,
                margin_bottom: 6,
            });

            scrolled.set_child(this._flowBox);

            // Empty state
            this._emptyState = new Adw.StatusPage({
                icon_name: 'folder-symbolic',
                title: 'No Blueprints',
                description: 'Create and save a theme',
                vexpand: true,
            });

            this._stack = new Gtk.Stack();
            this._stack.add_named(scrolled, 'blueprints');
            this._stack.add_named(this._emptyState, 'empty');

            this.append(this._stack);
        }

        _loadBlueprintsAsync() {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this.loadBlueprints();
                return GLib.SOURCE_REMOVE;
            });
        }

        loadBlueprints(forceReload = false) {
            this._blueprints = [];

            enumerateDirectory(this._blueprintsDir, (fileInfo, filePath, fileName) => {
                if (!fileName.endsWith('.json')) return;

                const data = loadJsonFile(filePath);
                if (data) {
                    data.path = filePath;
                    data.name = data.name || fileName.replace('.json', '');
                    this._blueprints.push(data);
                }
            });

            this._blueprints.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            this._updateUI();
        }

        _updateUI() {
            // Clear flowbox
            let child = this._flowBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                this._flowBox.remove(child);
                child = next;
            }

            if (this._blueprints.length === 0) {
                this._stack.set_visible_child_name('empty');
                return;
            }

            this._stack.set_visible_child_name('blueprints');
            this._blueprints.forEach(blueprint => {
                const card = this._createCard(blueprint);
                this._flowBox.append(card);
            });
        }

        _createCard(blueprint) {
            const card = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                css_classes: ['card'],
                width_request: 180,
            });

            card._blueprint = blueprint;

            // Thumbnail (synchronous from cache) - 180x105 (50% larger)
            const thumbnail = this._createThumbnail(blueprint);
            card.append(thumbnail);

            // Color grid - 16 colors in 2 rows
            const colorGrid = this._createColorGrid(blueprint);
            card.append(colorGrid);

            // Name label
            const nameLabel = new Gtk.Label({
                label: blueprint.name,
                halign: Gtk.Align.START,
                css_classes: ['caption'],
                ellipsize: 3,
                max_width_chars: 20,
                margin_start: 6,
                margin_end: 6,
                margin_top: 4,
                margin_bottom: 3,
            });
            card.append(nameLabel);

            // Buttons
            const buttonBox = this._createButtons(blueprint);
            card.append(buttonBox);

            return card;
        }

        _createThumbnail(blueprint) {
            const wallpaper = blueprint.palette?.wallpaper;

            // If no wallpaper or doesn't exist, use color preview
            if (!wallpaper || !GLib.file_test(wallpaper, GLib.FileTest.EXISTS)) {
                return this._createColorPreview(blueprint);
            }

            try {
                const file = Gio.File.new_for_path(wallpaper);
                const thumbPath = thumbnailService.getThumbnailPath(wallpaper);
                const thumbFile = Gio.File.new_for_path(thumbPath);

                // Check if thumbnail exists and is valid
                if (thumbnailService.isThumbnailValid(thumbFile, file)) {
                    // Load from cache - fast! (50% larger: 180x105)
                    const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                        thumbPath,
                        180,
                        105,
                        true
                    );
                    const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
                    return new Gtk.Picture({
                        paintable: texture,
                        content_fit: Gtk.ContentFit.COVER,
                        width_request: 180,
                        height_request: 105,
                    });
                } else {
                    // Generate thumbnail synchronously (will be cached for next time)
                    const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                        wallpaper,
                        300,
                        300,
                        true
                    );
                    // Save to cache
                    pixbuf.savev(thumbPath, 'png', [], []);

                    // Now load the thumbnail (50% larger: 180x105)
                    const thumbPixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                        thumbPath,
                        180,
                        105,
                        true
                    );
                    const texture = Gdk.Texture.new_for_pixbuf(thumbPixbuf);
                    return new Gtk.Picture({
                        paintable: texture,
                        content_fit: Gtk.ContentFit.COVER,
                        width_request: 180,
                        height_request: 105,
                    });
                }
            } catch (e) {
                console.warn(`Failed to load thumbnail for ${wallpaper}:`, e.message);
                return this._createColorPreview(blueprint);
            }
        }

        _createColorPreview(blueprint) {
            const colors = blueprint.palette?.colors || [];

            // Use a grid of 4 color blocks instead of gradient for better performance
            const grid = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                width_request: 180,
                height_request: 105,
            });

            if (colors.length >= 4) {
                [0, 5, 10, 15].forEach(i => {
                    const box = new Gtk.Box({ hexpand: true });
                    this._setBoxColor(box, colors[i] || colors[0]);
                    grid.append(box);
                });
            }

            return grid;
        }

        _createColorGrid(blueprint) {
            const container = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 1,
                margin_start: 6,
                margin_end: 6,
                margin_top: 4,
                margin_bottom: 4,
            });

            const colors = blueprint.palette?.colors || [];
            if (colors.length === 0) return container;

            // Row 1: colors 0-7 (20x20 squares for 180px width)
            const row1 = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 1,
            });
            for (let i = 0; i < 8 && i < colors.length; i++) {
                const box = new Gtk.Box({
                    width_request: 20,
                    height_request: 20,
                });
                this._setBoxColor(box, colors[i]);
                row1.append(box);
            }

            // Row 2: colors 8-15 (20x20 squares)
            const row2 = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 1,
            });
            for (let i = 8; i < 16 && i < colors.length; i++) {
                const box = new Gtk.Box({
                    width_request: 20,
                    height_request: 20,
                });
                this._setBoxColor(box, colors[i]);
                row2.append(box);
            }

            container.append(row1);
            container.append(row2);
            return container;
        }

        _setBoxColor(box, color) {
            const css = `* { background-color: ${color}; }`;
            const provider = new Gtk.CssProvider();
            provider.load_from_data(css, -1);
            box.get_style_context().add_provider(
                provider,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
            );
        }


        _createButtons(blueprint) {
            const buttonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                margin_start: 6,
                margin_end: 6,
                margin_top: 4,
                margin_bottom: 6,
                homogeneous: true,
            });

            const applyButton = new Gtk.Button({
                label: 'Apply',
            });
            applyButton.connect('clicked', () => {
                this.emit('blueprint-applied', blueprint);
                this.emit('close-requested');
            });

            const menuButton = new Gtk.MenuButton({
                icon_name: 'view-more-symbolic',
                css_classes: ['flat'],
            });

            const menu = Gio.Menu.new();
            menu.append('Export', 'blueprint.export');
            menu.append('Delete', 'blueprint.delete');
            menuButton.set_menu_model(menu);

            const actionGroup = Gio.SimpleActionGroup.new();

            const exportAction = Gio.SimpleAction.new('export', null);
            exportAction.connect('activate', () => this._exportBlueprint(blueprint));
            actionGroup.add_action(exportAction);

            const deleteAction = Gio.SimpleAction.new('delete', null);
            deleteAction.connect('activate', () => this._deleteBlueprint(blueprint));
            actionGroup.add_action(deleteAction);

            menuButton.insert_action_group('blueprint', actionGroup);

            buttonBox.append(applyButton);
            buttonBox.append(menuButton);

            return buttonBox;
        }

        _deleteBlueprint(blueprint) {
            if (deleteFile(blueprint.path)) {
                this.loadBlueprints(true);
            }
        }

        _exportBlueprint(blueprint) {
            const dialogManager = new DialogManager(this.get_root());
            dialogManager.showSaveDialog({
                title: 'Export Blueprint',
                initialName: `${blueprint.name}.json`,
                onSave: exportPath => {
                    const data = {
                        name: blueprint.name,
                        timestamp: blueprint.timestamp,
                        palette: blueprint.palette,
                    };
                    if (saveJsonFile(exportPath, data)) {
                        const dm = new DialogManager(this.get_root());
                        dm.showMessage({
                            heading: 'Blueprint Exported',
                            body: `"${blueprint.name}" exported successfully`,
                        });
                    }
                },
            });
        }

        _importBlueprint() {
            const dialogManager = new DialogManager(this.get_root());
            dialogManager.showFilePicker({
                title: 'Import Blueprint',
                mimeTypes: ['application/json'],
                onSelect: importPath => {
                    const data = loadJsonFile(importPath);
                    if (!data) {
                        const dm = new DialogManager(this.get_root());
                        dm.showMessage({
                            heading: 'Import Failed',
                            body: 'Invalid blueprint file',
                        });
                        return;
                    }

                    const filename = `${(data.name || 'blueprint').toLowerCase().replace(/\s+/g, '-')}.json`;
                    const path = GLib.build_filenamev([this._blueprintsDir, filename]);

                    if (saveJsonFile(path, data)) {
                        this.loadBlueprints(true);
                        const dm = new DialogManager(this.get_root());
                        dm.showMessage({
                            heading: 'Blueprint Imported',
                            body: `"${data.name}" imported successfully`,
                        });
                    }
                },
            });
        }

        saveBlueprint(blueprint) {
            const dialogManager = new DialogManager(this.get_root());
            dialogManager.showTextInput({
                heading: 'Save Blueprint',
                body: 'Enter a name for your blueprint',
                placeholder: 'My Theme',
                onSubmit: name => {
                    blueprint.name = name || `Blueprint ${Date.now()}`;
                    const filename = `${name.toLowerCase().replace(/\s+/g, '-')}.json`;
                    const path = GLib.build_filenamev([this._blueprintsDir, filename]);

                    if (saveJsonFile(path, blueprint)) {
                        this.loadBlueprints(true);
                    }
                },
            });
        }

        _filterBlueprints() {
            const query = this._searchEntry.get_text().toLowerCase();

            let child = this._flowBox.get_first_child();
            while (child) {
                const card = child.get_first_child();
                const visible = !query || card?._blueprint?.name?.toLowerCase().includes(query);
                child.set_visible(visible);
                child = child.get_next_sibling();
            }
        }

        get widget() {
            return this;
        }
    }
);
