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
import {aetherApiService} from '../services/aether-api-service.js';

/**
 * BlueprintsView - Full-featured blueprints management tab
 *
 * Features:
 * - Save current theme as blueprint
 * - Browse and manage saved blueprints
 * - Import/Export blueprints
 * - Post to Aether community
 * - API key settings
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
        },
    },
    class BlueprintsView extends Gtk.Box {
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

            this._buildUI();
            this._loadBlueprintsAsync();
        }

        _buildUI() {
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

            // Community Section
            mainBox.append(this._createSettingsSection());

            // My Blueprints Section
            mainBox.append(this._createBlueprintsSection());

            clamp.set_child(mainBox);
            scrolled.set_child(clamp);
            this.append(scrolled);
        }

        _createSaveSection() {
            const group = new Adw.PreferencesGroup({
                title: 'Save Current Theme',
                description: 'Save your current color palette as a reusable blueprint',
            });

            const saveRow = new Adw.ActionRow({
                title: 'Create New Blueprint',
                subtitle: 'Save the current palette with a custom name',
                activatable: true,
            });

            const saveButton = new Gtk.Button({
                label: 'Save',
                valign: Gtk.Align.CENTER,
                css_classes: ['suggested-action'],
            });
            saveButton.connect('clicked', () => {
                this.emit('save-requested');
            });
            saveRow.add_suffix(saveButton);
            saveRow.set_activatable_widget(saveButton);

            group.add(saveRow);

            return group;
        }

        _createBlueprintsSection() {
            const group = new Adw.PreferencesGroup({
                title: 'My Blueprints',
                description: 'Your saved color themes',
            });

            // Header with actions
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                margin_bottom: 12,
            });

            // Search entry
            this._searchEntry = new Gtk.SearchEntry({
                placeholder_text: 'Search blueprints...',
                hexpand: true,
            });
            this._searchEntry.connect('search-changed', () =>
                this._filterBlueprints()
            );
            headerBox.append(this._searchEntry);

            // Import button
            const importButton = new Gtk.Button({
                icon_name: 'document-open-symbolic',
                tooltip_text: 'Import Blueprint',
            });
            importButton.connect('clicked', () => this._importBlueprint());
            headerBox.append(importButton);

            // Refresh button
            const refreshButton = new Gtk.Button({
                icon_name: 'view-refresh-symbolic',
                tooltip_text: 'Refresh',
            });
            refreshButton.connect('clicked', () => this.loadBlueprints(true));
            headerBox.append(refreshButton);

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
                row_spacing: 12,
                column_spacing: 12,
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

        _createSettingsSection() {
            const group = new Adw.PreferencesGroup({
                title: 'Community',
                description: 'Share blueprints with the Aether community',
            });

            // API Key row
            const apiKeyRow = new Adw.ActionRow({
                title: 'API Key',
                subtitle: aetherApiService.hasApiKey()
                    ? 'Connected to aether.oever.li'
                    : 'Configure to share blueprints online',
            });

            const statusIcon = new Gtk.Image({
                icon_name: aetherApiService.hasApiKey()
                    ? 'emblem-ok-symbolic'
                    : 'dialog-warning-symbolic',
                valign: Gtk.Align.CENTER,
            });
            if (aetherApiService.hasApiKey()) {
                statusIcon.add_css_class('success');
            } else {
                statusIcon.add_css_class('warning');
            }
            apiKeyRow.add_prefix(statusIcon);

            const configureButton = new Gtk.Button({
                label: aetherApiService.hasApiKey() ? 'Change' : 'Configure',
                valign: Gtk.Align.CENTER,
            });
            configureButton.connect('clicked', () => {
                this._showApiKeyDialog();
            });
            apiKeyRow.add_suffix(configureButton);

            this._apiKeyRow = apiKeyRow;
            this._apiKeyStatusIcon = statusIcon;
            this._apiKeyConfigButton = configureButton;

            group.add(apiKeyRow);

            // Website link
            const websiteRow = new Adw.ActionRow({
                title: 'Browse Community',
                subtitle: 'Discover themes shared by others',
                activatable: true,
            });

            const linkIcon = new Gtk.Image({
                icon_name: 'web-browser-symbolic',
                valign: Gtk.Align.CENTER,
            });
            websiteRow.add_prefix(linkIcon);

            const openButton = new Gtk.Button({
                icon_name: 'external-link-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['flat'],
            });
            openButton.connect('clicked', () => {
                Gio.AppInfo.launch_default_for_uri(
                    'https://aether.oever.li/',
                    null
                );
            });
            websiteRow.add_suffix(openButton);
            websiteRow.set_activatable_widget(openButton);

            group.add(websiteRow);

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
                css_classes: ['card'],
                width_request: 200,
            });

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
                    css_classes: ['dim-label', 'caption'],
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
                margin_start: 12,
                margin_end: 12,
                margin_top: 8,
                margin_bottom: 12,
            });

            // Apply button
            const applyButton = new Gtk.Button({
                label: 'Apply',
                hexpand: true,
                css_classes: ['suggested-action'],
            });
            applyButton.connect('clicked', () => {
                this.emit('blueprint-applied', blueprint);
            });
            buttonBox.append(applyButton);

            // Menu button
            const menuButton = new Gtk.MenuButton({
                icon_name: 'view-more-symbolic',
                css_classes: ['flat'],
            });

            const menu = Gio.Menu.new();
            menu.append('Export to File', 'blueprint.export');
            if (aetherApiService.hasApiKey()) {
                menu.append('Post to Community', 'blueprint.post');
            }
            menu.append('Delete', 'blueprint.delete');
            menuButton.set_menu_model(menu);

            const actionGroup = Gio.SimpleActionGroup.new();

            const exportAction = Gio.SimpleAction.new('export', null);
            exportAction.connect('activate', () =>
                this._exportBlueprint(blueprint)
            );
            actionGroup.add_action(exportAction);

            const postAction = Gio.SimpleAction.new('post', null);
            postAction.connect('activate', () =>
                this._postToCommunity(blueprint)
            );
            actionGroup.add_action(postAction);

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

        _showApiKeyDialog() {
            const currentKey = aetherApiService.getApiKey();
            const dialog = new Adw.MessageDialog({
                heading: 'Aether Community API Key',
                body: 'Enter your API key to post blueprints to aether.oever.li\n\nGet your API key from your account settings on the website.',
                transient_for: this.get_root(),
            });

            dialog.add_response('cancel', 'Cancel');
            dialog.add_response('save', 'Save');
            dialog.set_response_appearance(
                'save',
                Adw.ResponseAppearance.SUGGESTED
            );

            const entry = new Gtk.Entry({
                placeholder_text: 'sk_live_...',
                text: currentKey,
                margin_start: 12,
                margin_end: 12,
                margin_top: 6,
                margin_bottom: 6,
            });

            dialog.set_extra_child(entry);

            dialog.connect('response', (_, response) => {
                if (response === 'save') {
                    const apiKey = entry.get_text().trim();
                    aetherApiService.setApiKey(apiKey);

                    // Update UI
                    this._updateApiKeyUI();
                    this._updateUI();

                    const dm = new DialogManager(this.get_root());
                    if (apiKey) {
                        dm.showMessage({
                            heading: 'API Key Saved',
                            body: 'You can now post blueprints to the community.',
                        });
                    } else {
                        dm.showMessage({
                            heading: 'API Key Removed',
                            body: 'Your API key has been removed.',
                        });
                    }
                }
            });

            dialog.present();
        }

        _updateApiKeyUI() {
            const hasKey = aetherApiService.hasApiKey();

            this._apiKeyRow.set_subtitle(
                hasKey
                    ? 'Connected to aether.oever.li'
                    : 'Configure to share blueprints online'
            );

            this._apiKeyStatusIcon.set_from_icon_name(
                hasKey ? 'emblem-ok-symbolic' : 'dialog-warning-symbolic'
            );

            if (hasKey) {
                this._apiKeyStatusIcon.remove_css_class('warning');
                this._apiKeyStatusIcon.add_css_class('success');
            } else {
                this._apiKeyStatusIcon.remove_css_class('success');
                this._apiKeyStatusIcon.add_css_class('warning');
            }

            this._apiKeyConfigButton.set_label(hasKey ? 'Change' : 'Configure');
        }

        async _postToCommunity(blueprint) {
            if (!aetherApiService.hasApiKey()) {
                const dm = new DialogManager(this.get_root());
                dm.showMessage({
                    heading: 'API Key Required',
                    body: 'Please configure your API key in the Community section below.',
                });
                return;
            }

            const dialogManager = new DialogManager(this.get_root());
            dialogManager.showConfirmation({
                heading: 'Post to Community',
                body: `Post "${blueprint.name}" to the Aether community as a draft?\n\nYou can publish it from the website when ready.`,
                confirmText: 'Post',
                cancelText: 'Cancel',
                onConfirm: async () => {
                    const spinnerDialog = new Adw.MessageDialog({
                        heading: 'Uploading...',
                        body: `Posting "${blueprint.name}" to the community`,
                        transient_for: this.get_root(),
                        close_response: '',
                    });

                    const spinnerBox = new Gtk.Box({
                        orientation: Gtk.Orientation.VERTICAL,
                        spacing: 12,
                        margin_start: 24,
                        margin_end: 24,
                        margin_top: 12,
                        margin_bottom: 12,
                        halign: Gtk.Align.CENTER,
                    });

                    const spinner = new Gtk.Spinner({
                        spinning: true,
                        width_request: 32,
                        height_request: 32,
                    });
                    spinnerBox.append(spinner);

                    spinnerDialog.set_extra_child(spinnerBox);
                    spinnerDialog.present();

                    try {
                        const result = await aetherApiService.postBlueprint(blueprint);

                        spinnerDialog.close();

                        const dm = new DialogManager(this.get_root());

                        if (result.success) {
                            dm.showMessage({
                                heading: 'Blueprint Posted',
                                body: `"${blueprint.name}" has been posted as a draft.\n\nVisit aether.oever.li to publish it.`,
                            });
                        } else {
                            dm.showMessage({
                                heading: 'Post Failed',
                                body: result.message || 'Failed to post blueprint',
                            });
                        }
                    } catch (e) {
                        spinnerDialog.close();

                        console.error('Error posting blueprint:', e.message);
                        const dm = new DialogManager(this.get_root());
                        dm.showMessage({
                            heading: 'Post Failed',
                            body: e.message || 'An error occurred while posting',
                        });
                    }
                },
            });
        }

        get widget() {
            return this;
        }
    }
);

