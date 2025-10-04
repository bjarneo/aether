import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

export const BlueprintManager = GObject.registerClass(
    class BlueprintManager extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

        this._blueprints = [];
        this._blueprintsDir = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
            'blueprints'
        ]);

        // Ensure blueprints directory exists
        GLib.mkdir_with_parents(this._blueprintsDir, 0o755);

        // Search bar
        const searchEntry = new Gtk.SearchEntry({
            placeholder_text: 'Search blueprints...',
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });

        // Blueprints list
        this._scrolledWindow = new Gtk.ScrolledWindow({
            vexpand: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
        });

        this._listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['navigation-sidebar'],
        });

        this._scrolledWindow.set_child(this._listBox);

        // Empty state
        this._emptyState = new Adw.StatusPage({
            icon_name: 'folder-symbolic',
            title: 'No Blueprints',
            description: 'Create your first theme blueprint',
        });

        this.append(searchEntry);
        this.append(this._scrolledWindow);

        // Load existing blueprints
        this.loadBlueprints();

        // Connect search
        searchEntry.connect('search-changed', () => {
            this.filterBlueprints(searchEntry.get_text());
        });
    }

    loadBlueprints() {
        this._blueprints = [];

        try {
            const dir = Gio.File.new_for_path(this._blueprintsDir);
            const enumerator = dir.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let fileInfo;
            while ((fileInfo = enumerator.next_file(null)) !== null) {
                const name = fileInfo.get_name();
                if (name.endsWith('.json')) {
                    const blueprintPath = GLib.build_filenamev([this._blueprintsDir, name]);
                    const blueprint = this.loadBlueprintFile(blueprintPath);
                    if (blueprint) {
                        this._blueprints.push(blueprint);
                    }
                }
            }
        } catch (e) {
            console.log('No blueprints directory yet:', e.message);
        }

        this.updateUI();
    }

    loadBlueprintFile(path) {
        try {
            const file = Gio.File.new_for_path(path);
            const [success, contents] = file.load_contents(null);

            if (success) {
                const decoder = new TextDecoder();
                const jsonStr = decoder.decode(contents);
                const data = JSON.parse(jsonStr);
                data.path = path;
                data.name = data.name || GLib.path_get_basename(path).replace('.json', '');
                return data;
            }
        } catch (e) {
            console.error(`Error loading blueprint ${path}:`, e.message);
        }
        return null;
    }

    updateUI() {
        // Clear list
        let child = this._listBox.get_first_child();
        while (child) {
            const next = child.get_next_sibling();
            this._listBox.remove(child);
            child = next;
        }

        if (this._blueprints.length === 0) {
            this._scrolledWindow.set_child(this._emptyState);
        } else {
            this._scrolledWindow.set_child(this._listBox);

            this._blueprints.forEach(blueprint => {
                const row = this.createBlueprintRow(blueprint);
                this._listBox.append(row);
            });
        }
    }

    createBlueprintRow(blueprint) {
        const row = new Gtk.ListBoxRow();

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_start: 12,
            margin_end: 12,
            margin_top: 8,
            margin_bottom: 8,
        });

        // Preview colors
        const colorBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 2,
            height_request: 6,
        });

        if (blueprint.palette && blueprint.palette.colors) {
            blueprint.palette.colors.slice(0, 6).forEach(color => {
                const colorBar = new Gtk.Box({
                    hexpand: true,
                });

                const cssProvider = new Gtk.CssProvider();
                cssProvider.load_from_string(`
                    * { background-color: ${color}; }
                `);

                colorBar.get_style_context().add_provider(
                    cssProvider,
                    Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
                );

                colorBox.append(colorBar);
            });
        }

        // Name and metadata
        const nameLabel = new Gtk.Label({
            label: blueprint.name,
            halign: Gtk.Align.START,
            css_classes: ['heading'],
        });

        const dateLabel = new Gtk.Label({
            label: this.formatDate(blueprint.timestamp),
            halign: Gtk.Align.START,
            css_classes: ['dim-label', 'caption'],
        });

        const buttonBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            margin_top: 6,
        });

        const applyButton = new Gtk.Button({
            label: 'Apply',
            css_classes: ['suggested-action', 'pill'],
        });

        const deleteButton = new Gtk.Button({
            icon_name: 'user-trash-symbolic',
            css_classes: ['flat'],
        });

        applyButton.connect('clicked', () => {
            this.applyBlueprint(blueprint);
        });

        deleteButton.connect('clicked', () => {
            this.deleteBlueprint(blueprint);
        });

        buttonBox.append(applyButton);
        buttonBox.append(deleteButton);

        box.append(colorBox);
        box.append(nameLabel);
        box.append(dateLabel);
        box.append(buttonBox);

        row.set_child(box);
        return row;
    }

    saveBlueprint(blueprint) {
        const dialog = new Adw.MessageDialog({
            heading: 'Save Blueprint',
            body: 'Enter a name for your blueprint',
            transient_for: this.get_root(),
        });

        dialog.add_response('cancel', 'Cancel');
        dialog.add_response('save', 'Save');
        dialog.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED);

        const entry = new Gtk.Entry({
            placeholder_text: 'My Awesome Theme',
            margin_start: 12,
            margin_end: 12,
            margin_top: 6,
            margin_bottom: 6,
        });

        dialog.set_extra_child(entry);

        dialog.connect('response', (_, response) => {
            if (response === 'save') {
                const name = entry.get_text().trim() || `Blueprint ${Date.now()}`;
                blueprint.name = name;
                this.saveBlueprintToFile(blueprint);
            }
        });

        dialog.present();
    }

    saveBlueprintToFile(blueprint) {
        try {
            const filename = `${blueprint.name.toLowerCase().replace(/\s+/g, '-')}.json`;
            const path = GLib.build_filenamev([this._blueprintsDir, filename]);

            const file = Gio.File.new_for_path(path);
            const jsonStr = JSON.stringify(blueprint, null, 2);

            file.replace_contents(
                jsonStr,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );

            this.loadBlueprints();
        } catch (e) {
            console.error('Error saving blueprint:', e.message);
        }
    }

    applyBlueprint(blueprint) {
        this.emit('blueprint-applied', blueprint);
    }

    deleteBlueprint(blueprint) {
        try {
            const file = Gio.File.new_for_path(blueprint.path);
            file.delete(null);
            this.loadBlueprints();
        } catch (e) {
            console.error('Error deleting blueprint:', e.message);
        }
    }

    filterBlueprints(query) {
        const lowerQuery = query.toLowerCase();

        let child = this._listBox.get_first_child();
        while (child) {
            const visible = !query ||
                child._blueprint?.name?.toLowerCase().includes(lowerQuery);
            child.set_visible(visible);
            child = child.get_next_sibling();
        }
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Unknown date';
        const date = new Date(timestamp);
        return date.toLocaleDateString();
    }

    get widget() {
        return this;
    }
});
