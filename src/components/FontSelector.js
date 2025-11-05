import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Pango from 'gi://Pango';

import {FontManager} from '../services/font-manager.js';
import {showToast} from '../utils/ui-helpers.js';

/**
 * FontSelector - Component for selecting and managing fonts
 *
 * Features:
 * - Live font preview with customizable text
 * - Browse installed monospace fonts
 * - Download popular programming fonts
 * - Apply font to system via omarchy-font-set
 * - Visual indication of installed/available fonts
 *
 * Signals:
 * - 'font-applied' (fontFamily: string) - Emitted when font is applied to system
 *
 * Popular fonts supported:
 * - JetBrains Mono, Fira Code, Cascadia Code
 * - Meslo, Hack, Source Code Pro
 * - Ubuntu Mono, Inconsolata
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
            this._previewText = 'The quick brown fox jumps over the lazy dog\n0123456789 ~!@#$%^&*()_+-={}[]|:;"<>?,./';

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

            // Tabs for installed and available fonts
            const viewStack = new Gtk.Stack({
                transition_type: Gtk.StackTransitionType.CROSSFADE,
            });

            const installedPage = this._createInstalledFontsPage();
            const availablePage = this._createAvailableFontsPage();

            viewStack.add_titled(installedPage, 'installed', 'Installed');
            viewStack.add_titled(availablePage, 'available', 'Download');

            const stackSwitcher = new Gtk.StackSwitcher({
                stack: viewStack,
                halign: Gtk.Align.CENTER,
            });

            contentBox.append(stackSwitcher);
            contentBox.append(viewStack);

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
                description: 'Preview your selected font',
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

            group.add(frame);

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
                const fontName = row.get_child().get_title().toLowerCase();
                return fontName.includes(searchEntry.text.toLowerCase());
            });

            searchEntry.connect('search-changed', () => {
                this._installedListBox.invalidate_filter();
            });

            this._installedListBox.connect('row-selected', row => {
                if (row) {
                    const fontFamily = row.get_child().get_title();
                    this._selectFont(fontFamily);
                }
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
         * Creates the available fonts page with download functionality
         * @returns {Gtk.Widget} Available fonts page widget
         * @private
         */
        _createAvailableFontsPage() {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 6,
                margin_top: 12,
            });

            const description = new Gtk.Label({
                label: 'Popular monospace fonts for terminals and editors',
                css_classes: ['dim-label'],
                xalign: 0,
                margin_bottom: 6,
            });

            // List box for available fonts
            this._availableListBox = new Gtk.ListBox({
                css_classes: ['boxed-list'],
                selection_mode: Gtk.SelectionMode.NONE,
            });

            const scrolled = new Gtk.ScrolledWindow({
                vexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                min_content_height: 300,
                child: this._availableListBox,
            });

            box.append(description);
            box.append(scrolled);

            // Load available fonts
            this._loadAvailableFonts();

            return box;
        }

        /**
         * Creates action buttons for applying and refreshing fonts
         * @returns {Gtk.Widget} Action buttons widget
         * @private
         */
        _createActionButtons() {
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                homogeneous: true,
                margin_top: 6,
            });

            // Apply font button
            this._applyButton = new Gtk.Button({
                label: 'Apply Font',
                css_classes: ['suggested-action'],
                sensitive: false,
            });

            this._applyButton.connect('clicked', () => {
                this._applyFont();
            });

            // Refresh button
            const refreshButton = new Gtk.Button({
                label: 'Refresh',
                icon_name: 'view-refresh-symbolic',
            });

            refreshButton.connect('clicked', () => {
                this._loadInstalledFonts();
                this._loadAvailableFonts();
                showToast(this, 'Font list refreshed');
            });

            box.append(this._applyButton);
            box.append(refreshButton);

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
                    subtitle: 'Download fonts from the "Download" tab',
                });
                this._installedListBox.append(emptyRow);
                return;
            }

            fonts.forEach(fontFamily => {
                const row = new Adw.ActionRow({
                    title: fontFamily,
                    activatable: true,
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
         * Loads available fonts for download
         * @private
         */
        _loadAvailableFonts() {
            // Clear existing items
            let child = this._availableListBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                this._availableListBox.remove(child);
                child = next;
            }

            const fonts = this._fontManager.getAvailableFonts();

            fonts.forEach(font => {
                const row = new Adw.ActionRow({
                    title: font.displayName,
                    subtitle: font.description,
                });

                if (font.installed) {
                    const installedLabel = new Gtk.Label({
                        label: 'Installed',
                        css_classes: ['success', 'dim-label'],
                    });
                    row.add_suffix(installedLabel);
                } else {
                    const downloadButton = new Gtk.Button({
                        icon_name: 'folder-download-symbolic',
                        valign: Gtk.Align.CENTER,
                        tooltip_text: 'Download and install',
                    });

                    downloadButton.connect('clicked', () => {
                        this._downloadFont(font, downloadButton, row);
                    });

                    row.add_suffix(downloadButton);
                }

                this._availableListBox.append(row);
            });
        }

        /**
         * Downloads and installs a font with progress indication
         * @param {Object} font - Font metadata
         * @param {Gtk.Button} button - Download button to update
         * @param {Adw.ActionRow} row - Row to update after installation
         * @private
         */
        async _downloadFont(font, button, row) {
            // Replace button with progress bar
            row.remove(button);

            const progressBar = new Gtk.ProgressBar({
                valign: Gtk.Align.CENTER,
                show_text: true,
            });
            row.add_suffix(progressBar);

            try {
                await this._fontManager.downloadAndInstallFont(
                    font,
                    percent => {
                        progressBar.set_fraction(percent / 100);
                        progressBar.set_text(`${percent}%`);
                    }
                );

                // Replace progress bar with installed label
                row.remove(progressBar);
                const installedLabel = new Gtk.Label({
                    label: 'Installed',
                    css_classes: ['success', 'dim-label'],
                });
                row.add_suffix(installedLabel);

                showToast(this, `${font.displayName} installed successfully`);

                // Refresh installed fonts list
                this._loadInstalledFonts();
            } catch (error) {
                console.error(`Error downloading font: ${error.message}`);

                // Restore download button
                row.remove(progressBar);
                row.add_suffix(button);

                showToast(this, `Failed to install ${font.displayName}`);
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
                const actionRow = row.get_child();
                if (actionRow && actionRow._checkIcon) {
                    actionRow._checkIcon.visible =
                        actionRow.get_title() === fontFamily;
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
