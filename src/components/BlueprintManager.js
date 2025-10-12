import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {
    enumerateDirectory,
    loadJsonFile,
    saveJsonFile,
    deleteFile,
} from '../utils/file-utils.js';
import {
    applyCssToWidget,
    removeAllChildren,
    forEachChild,
} from '../utils/ui-helpers.js';
import {DialogManager} from '../utils/DialogManager.js';

export const BlueprintManager = GObject.registerClass(
    {
        Signals: {
            'blueprint-applied': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
        },
    },
    class BlueprintManager extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this._blueprints = [];
            this._dialog = null;
            this._blueprintsDir = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
                'blueprints',
            ]);

            GLib.mkdir_with_parents(this._blueprintsDir, 0o755);

            this._initializeUI();
            this.loadBlueprints();
        }

        _initializeUI() {
            const searchEntry = new Gtk.SearchEntry({
                placeholder_text: 'Search blueprints...',
                margin_start: 12,
                margin_end: 12,
                margin_top: 12,
                margin_bottom: 6,
            });

            searchEntry.connect('search-changed', () => {
                this._filterBlueprints(searchEntry.get_text());
            });

            // Import button
            const importButton = new Gtk.Button({
                label: 'Import Blueprint',
                icon_name: 'document-open-symbolic',
                margin_start: 12,
                margin_end: 12,
                margin_bottom: 12,
            });
            importButton.connect('clicked', () => this._importBlueprint());

            this._scrolledWindow = new Gtk.ScrolledWindow({
                vexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
            });

            this._listBox = new Gtk.ListBox({
                selection_mode: Gtk.SelectionMode.NONE,
                css_classes: ['navigation-sidebar'],
            });

            this._scrolledWindow.set_child(this._listBox);

            this._emptyState = new Adw.StatusPage({
                icon_name: 'folder-symbolic',
                title: 'No Blueprints',
                description: 'Create your first theme blueprint',
            });

            this.append(searchEntry);
            this.append(importButton);
            this.append(this._scrolledWindow);
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

            data.path = path;
            data.name =
                data.name || GLib.path_get_basename(path).replace('.json', '');
            return data;
        }

        _updateUI() {
            removeAllChildren(this._listBox);

            if (this._blueprints.length === 0) {
                this._scrolledWindow.set_child(this._emptyState);
                return;
            }

            this._scrolledWindow.set_child(this._listBox);
            this._blueprints.forEach(blueprint => {
                const row = this._createBlueprintRow(blueprint);
                this._listBox.append(row);
            });
        }

        _createBlueprintRow(blueprint) {
            const row = new Gtk.ListBoxRow();

            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 4,
                margin_start: 8,
                margin_end: 8,
                margin_top: 6,
                margin_bottom: 6,
            });

            const colorPreview = this._createColorPreview(blueprint);
            const nameLabel = new Gtk.Label({
                label: blueprint.name,
                halign: Gtk.Align.START,
                css_classes: ['heading'],
            });

            const dateLabel = new Gtk.Label({
                label: this._formatDate(blueprint.timestamp),
                halign: Gtk.Align.START,
                css_classes: ['dim-label', 'caption'],
            });

            const buttonBox = this._createButtonBox(blueprint);

            box.append(colorPreview);
            box.append(nameLabel);
            box.append(dateLabel);
            box.append(buttonBox);

            row.set_child(box);
            row._blueprint = blueprint;

            return row;
        }

        _createColorPreview(blueprint) {
            const colorBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 1,
                height_request: 4,
            });

            if (!blueprint.palette?.colors) return colorBox;

            blueprint.palette.colors.slice(0, 6).forEach(color => {
                const colorBar = new Gtk.Box({hexpand: true});
                const css = `* { background-color: ${color}; }`;
                applyCssToWidget(colorBar, css);
                colorBox.append(colorBar);
            });

            return colorBox;
        }

        _createButtonBox(blueprint) {
            const buttonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 4,
                margin_top: 4,
            });

            const applyButton = new Gtk.Button({
                label: 'Apply',
                css_classes: ['suggested-action'],
            });

            const exportButton = new Gtk.Button({
                icon_name: 'document-save-symbolic',
                css_classes: ['flat'],
                tooltip_text: 'Export blueprint',
            });

            const deleteButton = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                css_classes: ['flat'],
                tooltip_text: 'Delete blueprint',
            });

            applyButton.connect('clicked', () =>
                this._applyBlueprint(blueprint)
            );
            exportButton.connect('clicked', () =>
                this._exportBlueprint(blueprint)
            );
            deleteButton.connect('clicked', () =>
                this._deleteBlueprint(blueprint)
            );

            buttonBox.append(applyButton);
            buttonBox.append(exportButton);
            buttonBox.append(deleteButton);

            return buttonBox;
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
            const filename = `${blueprint.name.toLowerCase().replace(/\s+/g, '-')}.json`;
            const path = GLib.build_filenamev([this._blueprintsDir, filename]);

            const success = saveJsonFile(path, blueprint);
            if (success) {
                this.loadBlueprints();
            }
        }

        _applyBlueprint(blueprint) {
            this.emit('blueprint-applied', blueprint);

            // Auto-close dialog after applying blueprint
            if (this._dialog) {
                this._dialog.close();
            }
        }

        setDialog(dialog) {
            this._dialog = dialog;
        }

        _deleteBlueprint(blueprint) {
            const success = deleteFile(blueprint.path);
            if (success) {
                this.loadBlueprints();
            }
        }

        _exportBlueprint(blueprint) {
            const dialogManager = new DialogManager(this.get_root());

            dialogManager.showSaveDialog({
                title: 'Export Blueprint',
                initialName: `${blueprint.name}.json`,
                onSave: exportPath => {
                    // Create a clean copy without the internal path property
                    const exportData = {
                        name: blueprint.name,
                        timestamp: blueprint.timestamp,
                        palette: blueprint.palette,
                    };

                    const success = saveJsonFile(exportPath, exportData);
                    if (success) {
                        this._showExportSuccess(blueprint.name);
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
                        this._showImportError('Invalid blueprint file');
                        return;
                    }

                    // Import by saving to blueprints directory
                    this._saveBlueprintToFile(blueprint);
                    this._showImportSuccess(blueprint.name);
                },
            });
        }

        _showExportSuccess(name) {
            const dialogManager = new DialogManager(this.get_root());
            dialogManager.showMessage({
                heading: 'Blueprint Exported',
                body: `"${name}" was exported successfully`,
            });
        }

        _showImportSuccess(name) {
            const dialogManager = new DialogManager(this.get_root());
            dialogManager.showMessage({
                heading: 'Blueprint Imported',
                body: `"${name}" was imported successfully`,
            });
        }

        _showImportError(error) {
            const dialogManager = new DialogManager(this.get_root());
            dialogManager.showMessage({
                heading: 'Import Failed',
                body: `Failed to import blueprint: ${error}`,
            });
        }

        _filterBlueprints(query) {
            const lowerQuery = query.toLowerCase();

            forEachChild(this._listBox, child => {
                const visible =
                    !query ||
                    child._blueprint?.name?.toLowerCase().includes(lowerQuery);
                child.set_visible(visible);
            });
        }

        _formatDate(timestamp) {
            if (!timestamp) return 'Unknown date';
            const date = new Date(timestamp);
            return date.toLocaleDateString();
        }

        get widget() {
            return this;
        }
    }
);
