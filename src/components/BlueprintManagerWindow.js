import GLib from 'gi://GLib';
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
import {applyCssToWidget} from '../utils/ui-helpers.js';
import {DialogManager} from '../utils/DialogManager.js';

// Constants
const THUMBNAIL_WIDTH = 280;
const THUMBNAIL_HEIGHT = 160;
const PREVIEW_COLORS_COUNT = 4;
const GRID_SPACING = 12;
const CARD_WIDTH = 280;

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

            this._ensureBlueprintsDirectory();
            this._initializeUI();
            this._loadBlueprintsAsync();
        }

        _ensureBlueprintsDirectory() {
            GLib.mkdir_with_parents(this._blueprintsDir, 0o755);
        }

        _initializeUI() {
            this._createHeaderBar();
            this._createSearchBar();
            this._createContentArea();
        }

        _createHeaderBar() {
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

            this._searchButton = new Gtk.ToggleButton({
                icon_name: 'system-search-symbolic',
                tooltip_text: 'Search',
            });
            headerBar.pack_end(this._searchButton);

            this.append(headerBar);
        }

        _createSearchBar() {
            const searchBar = new Gtk.SearchBar();
            this._searchEntry = new Gtk.SearchEntry({
                placeholder_text: 'Search blueprints...',
                hexpand: true,
            });

            searchBar.set_child(this._searchEntry);
            searchBar.set_key_capture_widget(this);
            searchBar.connect_entry(this._searchEntry);

            this._searchButton.bind_property(
                'active',
                searchBar,
                'search-mode-enabled',
                GObject.BindingFlags.BIDIRECTIONAL
            );

            this._searchEntry.connect('search-changed', () => {
                this._filterBlueprints(this._searchEntry.get_text());
            });

            this.append(searchBar);
        }

        _createContentArea() {
            const scrolled = new Gtk.ScrolledWindow({
                vexpand: true,
                hexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
            });

            this._flowBox = new Gtk.FlowBox({
                valign: Gtk.Align.START,
                max_children_per_line: 3,
                min_children_per_line: 1,
                selection_mode: Gtk.SelectionMode.NONE,
                homogeneous: true,
                row_spacing: GRID_SPACING,
                column_spacing: GRID_SPACING,
                margin_start: GRID_SPACING,
                margin_end: GRID_SPACING,
                margin_top: GRID_SPACING,
                margin_bottom: GRID_SPACING,
            });

            scrolled.set_child(this._flowBox);

            this._emptyState = new Adw.StatusPage({
                icon_name: 'folder-symbolic',
                title: 'No Blueprints',
                description: 'Create and save a theme to see it here',
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

        loadBlueprints() {
            this._blueprints = [];

            enumerateDirectory(
                this._blueprintsDir,
                (fileInfo, filePath, fileName) => {
                    if (!fileName.endsWith('.json')) return;

                    const blueprint = this._loadBlueprintFromFile(filePath);
                    if (blueprint) {
                        this._blueprints.push(blueprint);
                    }
                }
            );

            this._updateUI();
        }

        _loadBlueprintFromFile(path) {
            const data = loadJsonFile(path);
            if (!data) return null;

            return {
                ...data,
                path,
                name: data.name || this._extractNameFromPath(path),
            };
        }

        _extractNameFromPath(path) {
            return GLib.path_get_basename(path).replace('.json', '');
        }

        _updateUI() {
            this._clearFlowBox();

            if (this._blueprints.length === 0) {
                this._stack.set_visible_child_name('empty');
                return;
            }

            this._stack.set_visible_child_name('blueprints');
            this._sortBlueprints();
            this._blueprints.forEach(blueprint => {
                const card = this._createBlueprintCard(blueprint);
                this._flowBox.append(card);
            });
        }

        _clearFlowBox() {
            let child = this._flowBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                this._flowBox.remove(child);
                child = next;
            }
        }

        _sortBlueprints() {
            this._blueprints.sort(
                (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
            );
        }

        _createBlueprintCard(blueprint) {
            const card = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                css_classes: ['card'],
                width_request: CARD_WIDTH,
            });

            card._blueprint = blueprint;

            card.append(this._createPreviewSection(blueprint));
            card.append(this._createColorStrip(blueprint));
            card.append(this._createInfoSection(blueprint));

            return card;
        }

        _createPreviewSection(blueprint) {
            const previewBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                height_request: THUMBNAIL_HEIGHT,
            });

            if (blueprint.palette?.wallpaper) {
                const spinner = this._createSpinner();
                previewBox.append(spinner);
                this._loadWallpaperThumbnailAsync(
                    blueprint.palette.wallpaper,
                    previewBox,
                    spinner,
                    blueprint
                );
            } else {
                previewBox.append(this._createColorPreviewFallback(blueprint));
            }

            return previewBox;
        }

        _createSpinner() {
            return new Gtk.Spinner({
                spinning: true,
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER,
                width_request: 32,
                height_request: 32,
            });
        }

        _loadWallpaperThumbnailAsync(
            wallpaperPath,
            previewBox,
            spinner,
            blueprint
        ) {
            GLib.idle_add(GLib.PRIORITY_LOW, () => {
                if (!GLib.file_test(wallpaperPath, GLib.FileTest.EXISTS)) {
                    this._replacePreview(
                        previewBox,
                        spinner,
                        this._createColorPreviewFallback(blueprint)
                    );
                    return GLib.SOURCE_REMOVE;
                }

                try {
                    const picture = this._createWallpaperPicture(wallpaperPath);
                    this._replacePreview(previewBox, spinner, picture);
                } catch (e) {
                    console.error(`Failed to load thumbnail: ${e.message}`);
                    this._replacePreview(
                        previewBox,
                        spinner,
                        this._createColorPreviewFallback(blueprint)
                    );
                }

                return GLib.SOURCE_REMOVE;
            });
        }

        _createWallpaperPicture(wallpaperPath) {
            const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                wallpaperPath,
                THUMBNAIL_WIDTH,
                THUMBNAIL_HEIGHT,
                false
            );
            const texture = Gdk.Texture.new_for_pixbuf(pixbuf);

            return new Gtk.Picture({
                paintable: texture,
                content_fit: Gtk.ContentFit.COVER,
                height_request: THUMBNAIL_HEIGHT,
            });
        }

        _replacePreview(container, oldWidget, newWidget) {
            container.remove(oldWidget);
            container.append(newWidget);
        }

        _createColorPreviewFallback(blueprint) {
            const colorGrid = new Gtk.Grid({
                row_homogeneous: true,
                column_homogeneous: true,
            });

            const colors = blueprint.palette?.colors;
            if (!colors || colors.length < PREVIEW_COLORS_COUNT) {
                return colorGrid;
            }

            colors.slice(0, PREVIEW_COLORS_COUNT).forEach((color, i) => {
                const colorBox = new Gtk.Box({
                    hexpand: true,
                    vexpand: true,
                });
                applyCssToWidget(colorBox, `* { background-color: ${color}; }`);
                colorGrid.attach(colorBox, i % 2, Math.floor(i / 2), 1, 1);
            });

            return colorGrid;
        }

        _createColorStrip(blueprint) {
            const colorBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 1,
                height_request: 8,
            });

            blueprint.palette?.colors?.forEach(color => {
                const colorBar = new Gtk.Box({hexpand: true});
                applyCssToWidget(colorBar, `* { background-color: ${color}; }`);
                colorBox.append(colorBar);
            });

            return colorBox;
        }

        _createInfoSection(blueprint) {
            const infoBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 6,
                margin_start: 12,
                margin_end: 12,
                margin_top: 12,
                margin_bottom: 12,
            });

            infoBox.append(this._createNameLabel(blueprint.name));
            infoBox.append(this._createMetaBox(blueprint));
            infoBox.append(this._createActionButtons(blueprint));

            return infoBox;
        }

        _createNameLabel(name) {
            return new Gtk.Label({
                label: name,
                halign: Gtk.Align.START,
                css_classes: ['heading'],
                ellipsize: 3, // PANGO_ELLIPSIZE_END
                max_width_chars: 25,
            });
        }

        _createMetaBox(blueprint) {
            const metaBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            const dateLabel = new Gtk.Label({
                label: this._formatDate(blueprint.timestamp),
                halign: Gtk.Align.START,
                hexpand: true,
                css_classes: ['dim-label', 'caption'],
            });
            metaBox.append(dateLabel);

            if (blueprint.palette?.lightMode !== undefined) {
                metaBox.append(
                    this._createModeIcon(blueprint.palette.lightMode)
                );
            }

            return metaBox;
        }

        _createModeIcon(isLightMode) {
            return new Gtk.Image({
                icon_name: isLightMode
                    ? 'weather-clear-symbolic'
                    : 'weather-clear-night-symbolic',
                tooltip_text: isLightMode ? 'Light mode' : 'Dark mode',
                css_classes: ['dim-label'],
            });
        }

        _createActionButtons(blueprint) {
            const buttonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                margin_top: 6,
            });

            const applyButton = new Gtk.Button({
                label: 'Apply',
                hexpand: true,
                css_classes: ['suggested-action'],
            });
            applyButton.connect('clicked', () =>
                this._applyBlueprint(blueprint)
            );

            const exportButton = new Gtk.Button({
                icon_name: 'document-save-symbolic',
                tooltip_text: 'Export blueprint',
            });
            exportButton.connect('clicked', () =>
                this._exportBlueprint(blueprint)
            );

            const deleteButton = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                css_classes: ['destructive-action'],
                tooltip_text: 'Delete blueprint',
            });
            deleteButton.connect('clicked', () =>
                this._deleteBlueprint(blueprint)
            );

            buttonBox.append(applyButton);
            buttonBox.append(exportButton);
            buttonBox.append(deleteButton);

            return buttonBox;
        }

        _applyBlueprint(blueprint) {
            this.emit('blueprint-applied', blueprint);
            this.emit('close-requested');
        }

        _deleteBlueprint(blueprint) {
            if (deleteFile(blueprint.path)) {
                this.loadBlueprints();
            }
        }

        _exportBlueprint(blueprint) {
            const dialogManager = new DialogManager(this.get_root());

            dialogManager.showSaveDialog({
                title: 'Export Blueprint',
                initialName: `${blueprint.name}.json`,
                onSave: exportPath => {
                    const exportData = {
                        name: blueprint.name,
                        timestamp: blueprint.timestamp,
                        palette: blueprint.palette,
                    };

                    if (saveJsonFile(exportPath, exportData)) {
                        this._showMessage(
                            'Blueprint Exported',
                            `"${blueprint.name}" was exported successfully`
                        );
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
                    const blueprint = this._loadBlueprintFromFile(importPath);

                    if (!blueprint) {
                        this._showMessage(
                            'Import Failed',
                            'Invalid blueprint file'
                        );
                        return;
                    }

                    this._saveBlueprintToFile(blueprint);
                    this._showMessage(
                        'Blueprint Imported',
                        `"${blueprint.name}" was imported successfully`
                    );
                },
            });
        }

        saveBlueprint(blueprint) {
            const dialogManager = new DialogManager(this.get_root());

            dialogManager.showTextInput({
                heading: 'Save Blueprint',
                body: 'Enter a name for your blueprint',
                placeholder: 'My Awesome Theme',
                onSubmit: name => {
                    blueprint.name = name || `Blueprint ${Date.now()}`;
                    this._saveBlueprintToFile(blueprint);
                },
            });
        }

        _saveBlueprintToFile(blueprint) {
            const filename = this._sanitizeFilename(blueprint.name);
            const path = GLib.build_filenamev([this._blueprintsDir, filename]);

            if (saveJsonFile(path, blueprint)) {
                this.loadBlueprints();
            }
        }

        _sanitizeFilename(name) {
            return `${name.toLowerCase().replace(/\s+/g, '-')}.json`;
        }

        _showMessage(heading, body) {
            const dialogManager = new DialogManager(this.get_root());
            dialogManager.showMessage({heading, body});
        }

        _filterBlueprints(query) {
            const lowerQuery = query.toLowerCase();

            let flowBoxChild = this._flowBox.get_first_child();
            while (flowBoxChild) {
                const card = flowBoxChild.get_first_child();
                const visible =
                    !query ||
                    card?._blueprint?.name?.toLowerCase().includes(lowerQuery);
                flowBoxChild.set_visible(visible);
                flowBoxChild = flowBoxChild.get_next_sibling();
            }
        }

        _formatDate(timestamp) {
            if (!timestamp) return 'Unknown date';
            return new Date(timestamp).toLocaleDateString();
        }

        get widget() {
            return this;
        }
    }
);
