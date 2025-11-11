import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk?version=4.0';
import Gtk4LayerShell from 'gi://Gtk4LayerShell?version=1.0';
import {BlueprintService} from '../services/BlueprintService.js';
import {createColorSwatchRow} from '../utils/blueprint-ui-helpers.js';

/**
 * BlueprintWidget - Minimal layer shell widget for blueprint selection
 * Displays blueprints with name on left and color swatches on right
 * Uses GTK Layer Shell to display above all windows
 *
 * @class BlueprintWidget
 * @extends {Adw.ApplicationWindow}
 */
export const BlueprintWidget = GObject.registerClass(
    {
        Signals: {
            'blueprint-selected': {param_types: [GObject.TYPE_JSOBJECT]},
        },
    },
    class BlueprintWidget extends Adw.ApplicationWindow {
        /**
         * Initializes the layer shell blueprint widget
         * @param {Adw.Application} application - Parent application
         */
        _init(application) {
            super._init({
                application,
                title: 'Aether Blueprints',
                default_width: 275,
                default_height: 350,
            });

            this.blueprintService = new BlueprintService();

            // Configure GTK Layer Shell
            this._configureLayerShell();

            this._initializeUI();
            this._loadBlueprints();

            // Connect keyboard shortcuts
            this._setupKeyboardShortcuts();
        }

        /**
         * Configures window as a GTK Layer Shell overlay
         * Displays centered above all windows without compositor-specific commands
         * @private
         */
        _configureLayerShell() {
            // Initialize GTK Layer Shell for this window
            Gtk4LayerShell.init_for_window(this);

            // Set layer to overlay (above normal windows)
            Gtk4LayerShell.set_layer(this, Gtk4LayerShell.Layer.OVERLAY);

            // Center the window on screen
            Gtk4LayerShell.set_anchor(this, Gtk4LayerShell.Edge.TOP, false);
            Gtk4LayerShell.set_anchor(this, Gtk4LayerShell.Edge.BOTTOM, false);
            Gtk4LayerShell.set_anchor(this, Gtk4LayerShell.Edge.LEFT, false);
            Gtk4LayerShell.set_anchor(this, Gtk4LayerShell.Edge.RIGHT, false);

            // Enable keyboard interactivity
            Gtk4LayerShell.set_keyboard_mode(
                this,
                Gtk4LayerShell.KeyboardMode.ON_DEMAND
            );

            // Set namespace for compositor identification
            Gtk4LayerShell.set_namespace(this, 'aether-blueprint-selector');
        }

        /**
         * Initializes the widget UI structure
         * @private
         */
        _initializeUI() {
            // Header bar with close button
            const headerBar = new Adw.HeaderBar();
            headerBar.show_title_buttons = true;

            // Toolbar view
            const toolbarView = new Adw.ToolbarView();
            toolbarView.add_top_bar(headerBar);

            // Main content box (search + list)
            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            // Search entry - always visible for filtering
            const searchBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                margin_start: 12,
                margin_end: 12,
                margin_top: 6,
                margin_bottom: 6,
            });

            this._searchEntry = new Gtk.SearchEntry({
                placeholder_text: 'Search blueprints...',
                hexpand: true,
            });
            this._searchEntry.connect('search-changed', () =>
                this._filterBlueprints()
            );

            searchBox.append(this._searchEntry);
            contentBox.append(searchBox);

            // Scrolled window for blueprint list
            const scrolledWindow = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vexpand: true,
            });

            // List box for blueprints
            this.listBox = new Gtk.ListBox({
                selection_mode: Gtk.SelectionMode.SINGLE,
                margin_top: 6,
                margin_bottom: 6,
                margin_start: 6,
                margin_end: 6,
            });

            // Filter function for search
            this.listBox.set_filter_func(row => {
                const query = this._searchEntry?.get_text()?.toLowerCase() || '';
                if (!query) return true;

                const blueprint = row._blueprintData;
                return blueprint?.name?.toLowerCase().includes(query) || false;
            });

            // Handle blueprint selection
            this.listBox.connect('row-activated', (_, row) => {
                this._onBlueprintActivated(row);
            });

            // Handle row selection for highlighting
            this.listBox.connect('row-selected', (_, row) => {
                if (row) {
                    row.add_css_class('selected');
                }
            });

            scrolledWindow.set_child(this.listBox);
            contentBox.append(scrolledWindow);
            toolbarView.set_content(contentBox);

            this.set_content(toolbarView);
        }

        /**
         * Loads all blueprints and populates the list
         * @private
         */
        _loadBlueprints() {
            // Clear existing items
            let child = this.listBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                this.listBox.remove(child);
                child = next;
            }

            // Load blueprints
            const blueprints = this.blueprintService.loadAll();

            if (blueprints.length === 0) {
                this._showEmptyState();
                return;
            }

            // Sort by timestamp (newest first)
            blueprints.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            // Add blueprint rows
            blueprints.forEach(blueprint => {
                const row = this._createBlueprintRow(blueprint);
                this.listBox.append(row);
            });
        }

        /**
         * Creates a blueprint row with name and color swatches
         * @param {Object} blueprint - Blueprint data
         * @returns {Gtk.ListBoxRow} Blueprint row widget
         * @private
         */
        _createBlueprintRow(blueprint) {
            const row = new Gtk.ListBoxRow({
                activatable: true,
            });

            // Store blueprint data
            row._blueprintData = blueprint;

            // Main horizontal box
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
                margin_top: 6,
                margin_bottom: 6,
                margin_start: 8,
                margin_end: 8,
            });

            // Left side: Blueprint name
            const nameLabel = new Gtk.Label({
                label: blueprint.name || 'Unnamed',
                xalign: 0,
                hexpand: true,
                ellipsize: 3, // PANGO_ELLIPSIZE_END
                max_width_chars: 15,
                css_classes: ['title-4'],
            });

            // Right side: Color swatches (using shared helper)
            const colorBox = createColorSwatchRow(blueprint, 20, 8);

            box.append(nameLabel);
            box.append(colorBox);
            row.set_child(box);

            return row;
        }

        /**
         * Shows empty state when no blueprints exist
         * @private
         */
        _showEmptyState() {
            const statusPage = new Adw.StatusPage({
                icon_name: 'folder-symbolic',
                title: 'No Blueprints',
                description: 'Save a blueprint in Aether to see it here',
            });

            this.listBox.append(statusPage);
        }

        /**
         * Filters blueprints based on search query
         * @private
         */
        _filterBlueprints() {
            this.listBox.invalidate_filter();
        }

        /**
         * Handles blueprint activation (selection)
         * @param {Gtk.ListBoxRow} row - Activated row
         * @private
         */
        _onBlueprintActivated(row) {
            const blueprint = row._blueprintData;
            if (!blueprint) {
                return;
            }

            console.log(`Blueprint selected: ${blueprint.name}`);
            this.emit('blueprint-selected', blueprint);
            this.close();
        }

        /**
         * Sets up keyboard shortcuts (Escape to close)
         * @private
         */
        _setupKeyboardShortcuts() {
            const controller = new Gtk.EventControllerKey();

            controller.connect('key-pressed', (_, keyval, keycode, state) => {
                // Escape key
                if (keyval === 65307) {
                    this.close();
                    return true;
                }
                return false;
            });

            this.add_controller(controller);
        }
    }
);
