import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

export const ActionBar = GObject.registerClass(
    {
        Signals: {
            'toggle-settings': {param_types: [GObject.TYPE_BOOLEAN]},
            'show-blueprints': {},
            'export-theme': {},
            'save-blueprint': {},
            'reset': {},
            'apply-theme': {},
        },
    },
    class ActionBar extends Gtk.ActionBar {
        _init() {
            super._init({
                margin_top: 6,
                margin_bottom: 6,
                margin_start: 6,
                margin_end: 6,
            });

            this._settingsVisible = true;
            this._initializeButtons();
        }

        _initializeButtons() {
            // Settings toggle button (left side)
            this._toggleSettingsButton = new Gtk.ToggleButton({
                icon_name: 'sidebar-show-symbolic',
                tooltip_text: 'Hide Settings',
                active: true,
            });
            this._toggleSettingsButton.connect('toggled', btn => {
                this._settingsVisible = btn.get_active();
                btn.set_tooltip_text(
                    btn.get_active() ? 'Hide Settings' : 'Show Settings'
                );
                this.emit('toggle-settings', this._settingsVisible);
            });
            this.pack_start(this._toggleSettingsButton);

            // Blueprints button (left side)
            const blueprintsButton = new Gtk.Button({
                icon_name: 'view-list-symbolic',
                tooltip_text: 'Open Blueprints',
            });
            blueprintsButton.connect('clicked', () =>
                this.emit('show-blueprints')
            );
            this.pack_start(blueprintsButton);

            // Export button (left side)
            const exportButton = new Gtk.Button({label: 'Export Theme'});
            exportButton.connect('clicked', () => this.emit('export-theme'));
            this.pack_start(exportButton);

            // Apply Theme button (right side)
            const applyButton = new Gtk.Button({
                label: 'Apply Theme',
                css_classes: ['suggested-action'],
            });
            applyButton.connect('clicked', () => this.emit('apply-theme'));
            this.pack_end(applyButton);

            // Reset button (right side)
            const resetButton = new Gtk.Button({
                label: 'Reset',
                css_classes: ['destructive-action'],
            });
            resetButton.connect('clicked', () => this.emit('reset'));
            this.pack_end(resetButton);

            // Save Blueprint button (right side)
            const saveButton = new Gtk.Button({label: 'Save Blueprint'});
            saveButton.connect('clicked', () => this.emit('save-blueprint'));
            this.pack_end(saveButton);
        }

        setSettingsVisible(visible) {
            this._toggleSettingsButton.set_active(visible);
        }

        get widget() {
            return this;
        }
    }
);
