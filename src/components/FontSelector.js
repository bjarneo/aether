import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Pango from 'gi://Pango';

import {FontManager} from '../services/font-manager.js';
import {showToast} from '../utils/ui-helpers.js';

/**
 * FontSelector - Component for selecting and managing system fonts
 *
 * Features:
 * - Live font preview with customizable text
 * - Browse installed monospace fonts (searchable)
 * - Shows current system font
 * - Apply font to system via omarchy-font-set
 * - Open fonts folder in file manager
 * - Refresh font list
 *
 * Signals:
 * - 'font-applied' (fontFamily: string) - Emitted when font is applied to system
 *
 * @class FontSelector
 * @extends {Gtk.Box}
 */
export const FontSelector = GObject.registerClass(
    {
        Signals: {
            'font-applied': {param_types: [GObject.TYPE_STRING]},
        },
    },
    class FontSelector extends Gtk.Box {
        /**
         * Initializes the FontSelector with font manager and UI
         * @private
         */
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
            });

            this._fontManager = new FontManager();
            this._selectedFont = null;
            this._previewText =
                'The quick brown fox jumps over the lazy dog\n0123456789 ~!@#$%^&*()_+-={}[]|:;"<>?,./';

            this._buildUI();
            this._loadInstalledFonts();
        }

        /**
         * Builds the complete UI with tabs for installed and available fonts
         * @private
         */
        _buildUI() {
            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
            });

            // Font preview section
            contentBox.append(this._createPreviewSection());

            // Installed fonts list
            const installedPage = this._createInstalledFontsPage();
            contentBox.append(installedPage);

            // Action buttons
            contentBox.append(this._createActionButtons());

            this.append(contentBox);
        }

        /**
         * Creates font preview section with live preview text
         * @returns {Gtk.Widget} Preview section widget
         * @private
         */
        _createPreviewSection() {
            const group = new Adw.PreferencesGroup({
                title: 'Font Preview',
            });

            // Current font label
            const currentFont = this._fontManager.getCurrentFont();
            this._currentFontLabel = new Gtk.Label({
                label: currentFont
                    ? `Current: ${currentFont}`
                    : 'No font configured',
                css_classes: ['dim-label', 'caption'],
                xalign: 0,
                margin_start: 6,
                margin_bottom: 6,
            });

            // Preview text display
            this._previewLabel = new Gtk.Label({
                label: this._previewText,
                wrap: true,
                xalign: 0,
                css_classes: ['font-preview'],
            });

            // Apply monospace styling
            const attrs = new Pango.AttrList();
            attrs.insert(Pango.attr_family_new('monospace'));
            attrs.insert(Pango.attr_size_new(12 * Pango.SCALE));
            this._previewLabel.set_attributes(attrs);

            const frame = new Gtk.Frame({
                child: this._previewLabel,
                margin_top: 6,
                margin_bottom: 6,
                margin_start: 6,
                margin_end: 6,
            });

            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            contentBox.append(this._currentFontLabel);
            contentBox.append(frame);

            group.add(contentBox);

            return group;
        }

        /**
         * Creates the installed fonts page with searchable list
         * @returns {Gtk.Widget} Installed fonts page widget
         * @private
         */
        _createInstalledFontsPage() {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 6,
                margin_top: 12,
            });

            // Search entry
            const searchEntry = new Gtk.SearchEntry({
                placeholder_text: 'Search fonts...',
            });

            // List box for fonts
            this._installedListBox = new Gtk.ListBox({
                css_classes: ['boxed-list'],
                selection_mode: Gtk.SelectionMode.SINGLE,
            });

            // Filter model for search
            this._installedListBox.set_filter_func(row => {
                if (!searchEntry.text) return true;

                // ActionRows are direct children in the ListBox
                if (!row || !row.get_title) return true;

                const fontName = row.get_title().toLowerCase();
                return fontName.includes(searchEntry.text.toLowerCase());
            });

            searchEntry.connect('search-changed', () => {
                this._installedListBox.invalidate_filter();
            });

            const scrolled = new Gtk.ScrolledWindow({
                vexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                min_content_height: 300,
                child: this._installedListBox,
            });

            box.append(searchEntry);
            box.append(scrolled);

            return box;
        }

        /**
         * Creates action buttons for applying, refreshing, and opening fonts folder
         * @returns {Gtk.Widget} Action buttons widget
         * @private
         */
        _createActionButtons() {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                margin_top: 6,
            });

            // Apply font button
            this._applyButton = new Gtk.Button({
                label: 'Apply Font',
                css_classes: ['suggested-action'],
                sensitive: false,
                hexpand: true,
            });

            this._applyButton.connect('clicked', () => {
                this._applyFont();
            });

            // Refresh button
            const refreshButton = new Gtk.Button({
                icon_name: 'view-refresh-symbolic',
                tooltip_text: 'Refresh font list',
            });

            refreshButton.connect('clicked', () => {
                this._loadInstalledFonts();

                // Update current font label
                const currentFont = this._fontManager.getCurrentFont();
                this._currentFontLabel.set_label(
                    currentFont
                        ? `Current: ${currentFont}`
                        : 'No font configured'
                );

                showToast(this, 'Font list refreshed');
            });

            // Open fonts folder button
            const openFolderButton = new Gtk.Button({
                icon_name: 'folder-open-symbolic',
                tooltip_text: 'Open fonts folder',
            });

            openFolderButton.connect('clicked', () => {
                this._openFontsFolder();
            });

            box.append(this._applyButton);
            box.append(refreshButton);
            box.append(openFolderButton);

            return box;
        }

        /**
         * Loads installed monospace fonts from the system
         * @private
         */
        _loadInstalledFonts() {
            // Clear existing items
            let child = this._installedListBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                this._installedListBox.remove(child);
                child = next;
            }

            const fonts = this._fontManager.getInstalledFonts();

            if (fonts.length === 0) {
                const emptyRow = new Adw.ActionRow({
                    title: 'No monospace fonts found',
                    subtitle: 'Install fonts to ~/.local/share/fonts/',
                });
                this._installedListBox.append(emptyRow);
                return;
            }

            fonts.forEach(fontFamily => {
                const row = new Adw.ActionRow({
                    title: fontFamily,
                    activatable: true,
                });

                // Connect activated signal to select font
                row.connect('activated', () => {
                    this._selectFont(fontFamily);
                });

                const checkIcon = new Gtk.Image({
                    icon_name: 'object-select-symbolic',
                    visible: false,
                });

                row.add_suffix(checkIcon);
                row._checkIcon = checkIcon;

                this._installedListBox.append(row);
            });
        }

        /**
         * Opens the fonts folder in file manager
         * @private
         */
        _openFontsFolder() {
            try {
                const fontsDir = this._fontManager.getFontsDirectory();
                GLib.spawn_command_line_async(`xdg-open "${fontsDir}"`);
            } catch (error) {
                console.error(`Error opening fonts folder: ${error.message}`);
                showToast(this, 'Failed to open fonts folder');
            }
        }

        /**
         * Selects a font and updates preview
         * @param {string} fontFamily - Font family name
         * @private
         */
        _selectFont(fontFamily) {
            this._selectedFont = fontFamily;

            // Update preview
            const attrs = new Pango.AttrList();
            attrs.insert(Pango.attr_family_new(fontFamily));
            attrs.insert(Pango.attr_size_new(12 * Pango.SCALE));
            this._previewLabel.set_attributes(attrs);

            // Enable apply button
            this._applyButton.sensitive = true;

            // Update checkmark in list
            let row = this._installedListBox.get_first_child();
            while (row) {
                // ActionRows are direct children, no need for get_child()
                if (row && row._checkIcon) {
                    row._checkIcon.visible = row.get_title() === fontFamily;
                }
                row = row.get_next_sibling();
            }
        }

        /**
         * Applies the selected font to the system
         * @private
         */
        async _applyFont() {
            if (!this._selectedFont) {
                return;
            }

            this._applyButton.sensitive = false;

            try {
                await this._fontManager.setFont(this._selectedFont);

                // Update current font label
                this._currentFontLabel.set_label(
                    `Current: ${this._selectedFont}`
                );

                showToast(this, `Font applied: ${this._selectedFont}`);
                this.emit('font-applied', this._selectedFont);
            } catch (error) {
                console.error(`Error applying font: ${error.message}`);
                showToast(this, `Failed to apply font: ${error.message}`);
            } finally {
                this._applyButton.sensitive = true;
            }
        }

        /**
         * Gets the currently selected font family
         * @returns {string|null} Selected font family or null
         */
        getSelectedFont() {
            return this._selectedFont;
        }

        /**
         * Sets the preview text
         * @param {string} text - Text to display in preview
         */
        setPreviewText(text) {
            this._previewText = text;
            this._previewLabel.set_label(text);
        }
    }
);
