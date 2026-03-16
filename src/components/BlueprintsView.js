import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gtk from 'gi://Gtk?version=4.0';

import {SPACING, GRID} from '../constants/ui-constants.js';
import {thumbnailService} from '../services/thumbnail-service.js';
import {themeState} from '../state/ThemeState.js';
import {DialogManager} from '../utils/DialogManager.js';
import {
    enumerateDirectory,
    loadJsonFile,
    saveJsonFile,
    deleteFile,
} from '../utils/file-utils.js';
import {
    createButtonRow,
    createToolbar,
    createIconButton,
} from '../utils/ui-builders.js';
import {applyCssToWidget} from '../utils/ui-helpers.js';
import {OmarchyThemesBrowser} from './OmarchyThemesBrowser.js';

/**
 * BlueprintsView - Full-featured blueprints management tab
 *
 * Features:
 * - Save current theme as blueprint
 * - Browse and manage saved blueprints
 * - Import/Export blueprints
 * - Post to Aether community
 * - API key settings
 * - Browse installed Omarchy themes
 *
 * @class BlueprintsView
 * @extends {Gtk.Box}
 */
export const BlueprintsView = GObject.registerClass(
    {
        Signals: {
            'blueprint-applied': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
            'save-requested': {},
            'theme-imported': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
            'theme-applied': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
        },
    },
    class BlueprintsView extends Gtk.Box {
        _init(ohmydebnMode = false) {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this._ohmydebnMode = ohmydebnMode;
            this._blueprints = [];
            this._blueprintsDir = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
                'blueprints',
            ]);

            GLib.mkdir_with_parents(this._blueprintsDir, 0o755);

            this._buildUI();
            this._loadBlueprintsAsync();
        }

        _buildUI() {
            // View switcher at the top - centered
            const switcherBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_top: SPACING.MD,
                margin_bottom: SPACING.SM,
                halign: Gtk.Align.CENTER,
            });

            // Create segmented toggle buttons
            const toggleBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 0,
                css_classes: ['linked'],
            });

            this._blueprintsToggle = new Gtk.ToggleButton({
                label: 'My Blueprints',
                active: true,
            });
            this._themesToggle = new Gtk.ToggleButton({
                label: this._ohmydebnMode ? 'System Themes' : 'Omarchy Themes',
                active: false,
            });

            // Style toggle buttons
            applyCssToWidget(
                toggleBox,
                `
                box button {
                    border-radius: 0;
                    padding: 6px 16px;
                }
            `
            );

            this._blueprintsToggle.connect('toggled', () => {
                if (this._blueprintsToggle.get_active()) {
                    this._themesToggle.set_active(false);
                    this._contentStack.set_visible_child_name('blueprints');
                }
            });

            this._themesToggle.connect('toggled', () => {
                if (this._themesToggle.get_active()) {
                    this._blueprintsToggle.set_active(false);
                    this._contentStack.set_visible_child_name('themes');
                    // Refresh themes when switching to the tab
                    this._omarchyBrowser.refresh();
                }
            });

            toggleBox.append(this._blueprintsToggle);
            toggleBox.append(this._themesToggle);
            switcherBox.append(toggleBox);

            this.append(switcherBox);

            // Content stack for switching between views
            this._contentStack = new Gtk.Stack({
                vexpand: true,
                hexpand: true,
                transition_type: Gtk.StackTransitionType.CROSSFADE,
            });

            // Blueprints view
            const blueprintsContent = this._createBlueprintsContent();
            this._contentStack.add_named(blueprintsContent, 'blueprints');

            // Omarchy themes browser
            this._omarchyBrowser = new OmarchyThemesBrowser(this._ohmydebnMode);
            this._omarchyBrowser.connect('theme-imported', (_, theme) => {
                this.emit('theme-imported', theme);
            });
            this._omarchyBrowser.connect('theme-applied', (_, theme) => {
                this.emit('theme-applied', theme);
            });
            this._contentStack.add_named(this._omarchyBrowser, 'themes');

            const initialView = this._ohmydebnMode ? 'themes' : 'blueprints';
            this._contentStack.set_visible_child_name(initialView);

            // Set toggle button state to match initial view
            if (this._ohmydebnMode) {
                this._themesToggle.set_active(true);
                this._blueprintsToggle.set_active(false);
            } else {
                this._blueprintsToggle.set_active(true);
                this._themesToggle.set_active(false);
            }

            this.append(this._contentStack);
        }

        /**
         * Create the blueprints content view
         * @private
         * @returns {Gtk.ScrolledWindow} Blueprints content
         */
        _createBlueprintsContent() {
            const scrolled = new Gtk.ScrolledWindow({
                vexpand: true,
                hexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
            });

            const clamp = new Adw.Clamp({
                maximum_size: 900,
                tightening_threshold: 700,
            });

            const mainBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 24,
                margin_top: 24,
                margin_bottom: 24,
                margin_start: 12,
                margin_end: 12,
            });

            // Save Current Theme Section
            mainBox.append(this._createSaveSection());

            // My Blueprints Section
            mainBox.append(this._createBlueprintsSection());

            clamp.set_child(mainBox);
            scrolled.set_child(clamp);
            return scrolled;
        }

        _createSaveSection() {
            const group = new Adw.PreferencesGroup({
                title: 'Save Current Theme',
                description:
                    'Save your current color palette as a reusable blueprint',
            });

            const {row} = createButtonRow({
                title: 'Create New Blueprint',
                subtitle: 'Save the current palette with a custom name',
                buttonLabel: 'Save',
                buttonClasses: ['suggested-action'],
                onClicked: () => this.emit('save-requested'),
            });

            group.add(row);

            return group;
        }

        _createBlueprintsSection() {
            const group = new Adw.PreferencesGroup({
                title: 'My Blueprints',
                description: 'Your saved color themes',
            });

            // Search entry
            this._searchEntry = new Gtk.SearchEntry({
                placeholder_text: 'Search blueprints...',
                hexpand: true,
            });
            this._searchEntry.connect('search-changed', () =>
                this._filterBlueprints()
            );

            // Import button
            const importButton = createIconButton({
                iconName: 'document-open-symbolic',
                tooltip: 'Import Blueprint',
                onClicked: () => this._importBlueprint(),
            });

            // Refresh button
            const refreshButton = createIconButton({
                iconName: 'view-refresh-symbolic',
                tooltip: 'Refresh',
                onClicked: () => this.loadBlueprints(true),
            });

            const headerBox = createToolbar({
                startWidgets: [this._searchEntry],
                endWidgets: [importButton, refreshButton],
            });

            group.add(headerBox);

            // Blueprints container
            this._blueprintsContainer = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            // FlowBox for blueprint cards
            this._flowBox = new Gtk.FlowBox({
                valign: Gtk.Align.START,
                max_children_per_line: 6,
                min_children_per_line: 2,
                selection_mode: Gtk.SelectionMode.NONE,
                homogeneous: false,
                row_spacing: GRID.ROW_SPACING,
                column_spacing: GRID.COLUMN_SPACING,
            });

            // Empty state
            this._emptyState = new Adw.StatusPage({
                icon_name: 'color-select-symbolic',
                title: 'No Blueprints Yet',
                description: 'Save your first theme using the button above',
                vexpand: false,
            });
            this._emptyState.set_visible(false);

            this._blueprintsContainer.append(this._flowBox);
            this._blueprintsContainer.append(this._emptyState);

            group.add(this._blueprintsContainer);

            return group;
        }

        _loadBlueprintsAsync() {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this.loadBlueprints();
                return GLib.SOURCE_REMOVE;
            });
        }

        loadBlueprints(forceReload = false) {
            this._blueprints = [];

            enumerateDirectory(
                this._blueprintsDir,
                (fileInfo, filePath, fileName) => {
                    if (!fileName.endsWith('.json')) return;

                    const data = loadJsonFile(filePath);
                    if (data) {
                        data.path = filePath;
                        data.name = data.name || fileName.replace('.json', '');
                        this._blueprints.push(data);
                    }
                }
            );

            this._blueprints.sort(
                (a, b) => (b.timestamp || 0) - (a.timestamp || 0)
            );
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
                this._flowBox.set_visible(false);
                this._emptyState.set_visible(true);
                return;
            }

            this._flowBox.set_visible(true);
            this._emptyState.set_visible(false);

            this._blueprints.forEach(blueprint => {
                const card = this._createCard(blueprint);
                this._flowBox.append(card);
            });
        }

        _createCard(blueprint) {
            const card = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                width_request: 200,
            });

            // Sharp card styling
            applyCssToWidget(
                card,
                `
                box {
                    background-color: alpha(@view_bg_color, 0.5);
                    border: 1px solid alpha(@borders, 0.15);
                    border-radius: 0;
                }
            `
            );

            card._blueprint = blueprint;

            // Thumbnail
            const thumbnail = this._createThumbnail(blueprint);
            card.append(thumbnail);

            // Color grid
            const colorGrid = this._createColorGrid(blueprint);
            card.append(colorGrid);

            // Name label
            const nameLabel = new Gtk.Label({
                label: blueprint.name,
                halign: Gtk.Align.START,
                css_classes: ['heading'],
                ellipsize: 3,
                max_width_chars: 24,
                margin_start: 12,
                margin_end: 12,
                margin_top: 8,
                margin_bottom: 4,
            });
            card.append(nameLabel);

            // Timestamp
            const timestamp = blueprint.timestamp
                ? new Date(blueprint.timestamp).toLocaleDateString()
                : '';
            if (timestamp) {
                const dateLabel = new Gtk.Label({
                    label: timestamp,
                    halign: Gtk.Align.START,
                    css_classes: ['dimmed', 'caption'],
                    margin_start: 12,
                    margin_end: 12,
                    margin_bottom: 8,
                });
                card.append(dateLabel);
            }

            // Action buttons
            const buttonBox = this._createButtons(blueprint);
            card.append(buttonBox);

            return card;
        }

        _createThumbnail(blueprint) {
            const wallpaper = blueprint.palette?.wallpaper;

            if (
                !wallpaper ||
                !GLib.file_test(wallpaper, GLib.FileTest.EXISTS)
            ) {
                return this._createColorPreview(blueprint);
            }

            try {
                const file = Gio.File.new_for_path(wallpaper);
                const thumbPath = thumbnailService.getThumbnailPath(wallpaper);
                const thumbFile = Gio.File.new_for_path(thumbPath);

                if (thumbnailService.isThumbnailValid(thumbFile, file)) {
                    const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                        thumbPath,
                        200,
                        120,
                        true
                    );
                    const texture = Gdk.Texture.new_for_pixbuf(pixbuf);
                    return new Gtk.Picture({
                        paintable: texture,
                        content_fit: Gtk.ContentFit.COVER,
                        width_request: 200,
                        height_request: 120,
                    });
                } else {
                    const pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                        wallpaper,
                        300,
                        300,
                        true
                    );
                    pixbuf.savev(thumbPath, 'png', [], []);

                    const thumbPixbuf = GdkPixbuf.Pixbuf.new_from_file_at_scale(
                        thumbPath,
                        200,
                        120,
                        true
                    );
                    const texture = Gdk.Texture.new_for_pixbuf(thumbPixbuf);
                    return new Gtk.Picture({
                        paintable: texture,
                        content_fit: Gtk.ContentFit.COVER,
                        width_request: 200,
                        height_request: 120,
                    });
                }
            } catch (e) {
                console.warn(
                    `Failed to load thumbnail for ${wallpaper}:`,
                    e.message
                );
                return this._createColorPreview(blueprint);
            }
        }

        _createColorPreview(blueprint) {
            const colors = blueprint.palette?.colors || [];

            const grid = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                width_request: 200,
                height_request: 120,
            });

            if (colors.length >= 4) {
                [0, 5, 10, 15].forEach(i => {
                    const box = new Gtk.Box({hexpand: true});
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
                margin_start: 12,
                margin_end: 12,
                margin_top: 8,
            });

            const colors = blueprint.palette?.colors || [];
            if (colors.length === 0) return container;

            const row1 = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 1,
            });
            for (let i = 0; i < 8 && i < colors.length; i++) {
                const box = new Gtk.Box({
                    width_request: 22,
                    height_request: 16,
                });
                this._setBoxColor(box, colors[i]);
                row1.append(box);
            }

            const row2 = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 1,
            });
            for (let i = 8; i < 16 && i < colors.length; i++) {
                const box = new Gtk.Box({
                    width_request: 22,
                    height_request: 16,
                });
                this._setBoxColor(box, colors[i]);
                row2.append(box);
            }

            container.append(row1);
            container.append(row2);
            return container;
        }

        _setBoxColor(box, color) {
            applyCssToWidget(
                box,
                `
                box {
                    background-color: ${color};
                    border-radius: 0;
                }
            `
            );
        }

        _createButtons(blueprint) {
            const buttonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_top: 8,
                margin_bottom: SPACING.MD,
            });

            // Use button
            const applyButton = new Gtk.Button({
                label: 'Use',
                hexpand: true,
                css_classes: ['suggested-action'],
            });
            applyCssToWidget(
                applyButton,
                `
                button {
                    border-radius: 0;
                    padding: 6px 12px;
                }
            `
            );
            applyButton.connect('clicked', () => {
                // Load blueprint into centralized state
                themeState.fromBlueprint(blueprint);
                this.emit('blueprint-applied', blueprint);
            });
            buttonBox.append(applyButton);

            // Menu button
            const menuButton = new Gtk.MenuButton({
                icon_name: 'view-more-symbolic',
                css_classes: ['flat'],
            });
            applyCssToWidget(
                menuButton,
                `
                menubutton button {
                    border-radius: 0;
                }
            `
            );

            const menu = Gio.Menu.new();
            menu.append('Export to File', 'blueprint.export');
            menu.append('Delete', 'blueprint.delete');
            menuButton.set_menu_model(menu);

            const actionGroup = Gio.SimpleActionGroup.new();

            const exportAction = Gio.SimpleAction.new('export', null);
            exportAction.connect('activate', () =>
                this._exportBlueprint(blueprint)
            );
            actionGroup.add_action(exportAction);

            const deleteAction = Gio.SimpleAction.new('delete', null);
            deleteAction.connect('activate', () =>
                this._deleteBlueprint(blueprint)
            );
            actionGroup.add_action(deleteAction);

            menuButton.insert_action_group('blueprint', actionGroup);

            buttonBox.append(menuButton);

            return buttonBox;
        }

        _deleteBlueprint(blueprint) {
            const dialogManager = new DialogManager(this.get_root());
            dialogManager.showConfirmation({
                heading: 'Delete Blueprint',
                body: `Are you sure you want to delete "${blueprint.name}"?`,
                confirmText: 'Delete',
                cancelText: 'Cancel',
                onConfirm: () => {
                    if (deleteFile(blueprint.path)) {
                        this.loadBlueprints(true);
                    }
                },
            });
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
                    const path = GLib.build_filenamev([
                        this._blueprintsDir,
                        filename,
                    ]);

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
                    const path = GLib.build_filenamev([
                        this._blueprintsDir,
                        filename,
                    ]);

                    if (saveJsonFile(path, blueprint)) {
                        this.loadBlueprints(true);
                        const dm = new DialogManager(this.get_root());
                        dm.showMessage({
                            heading: 'Blueprint Saved',
                            body: `"${blueprint.name}" has been saved`,
                        });
                    }
                },
            });
        }

        _filterBlueprints() {
            const query = this._searchEntry.get_text().toLowerCase();

            let child = this._flowBox.get_first_child();
            while (child) {
                const card = child.get_first_child();
                const visible =
                    !query ||
                    card?._blueprint?.name?.toLowerCase().includes(query);
                child.set_visible(visible);
                child = child.get_next_sibling();
            }
        }

        get widget() {
            return this;
        }
    }
);
