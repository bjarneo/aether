/**
 * OmarchyThemesBrowser - Full browser for installed Omarchy themes
 *
 * Features:
 * - Grid view of all installed themes
 * - Search/filter by theme name
 * - Current theme indicator
 * - Import themes into Aether editor
 * - Apply themes directly
 *
 * @module OmarchyThemesBrowser
 */

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Adw from 'gi://Adw?version=1';
import Gtk from 'gi://Gtk?version=4.0';

import {SPACING, GRID} from '../constants/ui-constants.js';
import {omarchyThemeService} from '../services/omarchy-theme-service.js';
import {applyCssToWidget} from '../utils/ui-helpers.js';
import {OmarchyThemeCard} from './OmarchyThemeCard.js';

/**
 * OmarchyThemesBrowser - Component for browsing and managing Omarchy themes
 * @class
 * @extends {Gtk.Box}
 */
export const OmarchyThemesBrowser = GObject.registerClass(
    {
        Signals: {
            'theme-imported': {param_types: [GObject.TYPE_JSOBJECT]},
            'theme-applied': {param_types: [GObject.TYPE_JSOBJECT]},
        },
    },
    class OmarchyThemesBrowser extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this._themes = [];
            this._searchQuery = '';

            this._buildUI();
            this._loadThemesAsync();
        }

        /**
         * Build the browser UI
         * @private
         */
        _buildUI() {
            // Wrap everything in a scrolled window with clamp (like blueprints)
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
                spacing: 0,
                margin_top: 24,
                margin_bottom: 24,
                margin_start: 12,
                margin_end: 12,
            });

            // Header with title and current theme
            const header = this._createHeader();
            mainBox.append(header);

            // Toolbar with search and refresh
            const toolbar = this._createToolbar();
            mainBox.append(toolbar);

            // Content stack (loading, empty, content)
            this._contentStack = new Gtk.Stack({
                vexpand: true,
                transition_type: Gtk.StackTransitionType.CROSSFADE,
            });

            // Loading state
            this._contentStack.add_named(this._createLoadingState(), 'loading');

            // Empty state
            this._contentStack.add_named(this._createEmptyState(), 'empty');

            // Content view
            this._contentStack.add_named(this._createContentView(), 'content');

            this._contentStack.set_visible_child_name('loading');
            mainBox.append(this._contentStack);

            clamp.set_child(mainBox);
            scrolled.set_child(clamp);
            this.append(scrolled);
        }

        /**
         * Create header section
         * @private
         * @returns {Gtk.Box} Header widget
         */
        _createHeader() {
            const header = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                margin_bottom: SPACING.SM,
            });

            const titleBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                hexpand: true,
            });

            const title = new Gtk.Label({
                label: 'Omarchy Themes',
                halign: Gtk.Align.START,
                css_classes: ['title-2'],
            });
            titleBox.append(title);

            this._currentThemeLabel = new Gtk.Label({
                label: 'Loading...',
                halign: Gtk.Align.START,
                css_classes: ['dim-label', 'caption'],
            });
            titleBox.append(this._currentThemeLabel);

            header.append(titleBox);

            return header;
        }

        /**
         * Create toolbar with search and actions
         * @private
         * @returns {Gtk.Box} Toolbar widget
         */
        _createToolbar() {
            const toolbar = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
                margin_bottom: SPACING.MD,
            });

            // Search entry
            this._searchEntry = new Gtk.SearchEntry({
                placeholder_text: 'Search themes...',
                hexpand: true,
            });
            this._searchEntry.connect('search-changed', () => {
                this._filterThemes();
            });
            toolbar.append(this._searchEntry);

            // Action buttons container
            const actionsBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 2,
            });
            applyCssToWidget(
                actionsBox,
                `
                box {
                    background-color: alpha(@view_bg_color, 0.5);
                    border: 1px solid alpha(@borders, 0.15);
                    border-radius: 0;
                    padding: 2px;
                }
            `
            );

            // Refresh button
            const refreshButton = new Gtk.Button({
                icon_name: 'view-refresh-symbolic',
                tooltip_text: 'Refresh themes',
                css_classes: ['flat'],
            });
            refreshButton.connect('clicked', () => this._loadThemesAsync());
            actionsBox.append(refreshButton);

            // Open folder button
            const folderButton = new Gtk.Button({
                icon_name: 'folder-open-symbolic',
                tooltip_text: 'Open themes folder',
                css_classes: ['flat'],
            });
            folderButton.connect('clicked', () => this._openThemesFolder());
            actionsBox.append(folderButton);

            toolbar.append(actionsBox);

            return toolbar;
        }

        /**
         * Create loading state
         * @private
         * @returns {Gtk.Box} Loading state widget
         */
        _createLoadingState() {
            const loadingBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                halign: Gtk.Align.CENTER,
                spacing: SPACING.MD,
                margin_top: 48,
            });

            const spinner = new Gtk.Spinner({
                width_request: 32,
                height_request: 32,
            });
            spinner.start();
            loadingBox.append(spinner);

            const loadingLabel = new Gtk.Label({
                label: 'Loading themes...',
            });
            applyCssToWidget(
                loadingLabel,
                `
                label {
                    font-size: 13px;
                    opacity: 0.6;
                }
            `
            );
            loadingBox.append(loadingLabel);

            return loadingBox;
        }

        /**
         * Create empty state
         * @private
         * @returns {Adw.StatusPage} Empty state widget
         */
        _createEmptyState() {
            return new Adw.StatusPage({
                icon_name: 'color-select-symbolic',
                title: 'No Themes Found',
                description: 'Install themes to ~/.config/omarchy/themes/',
                vexpand: true,
            });
        }

        /**
         * Create content view with grid
         * @private
         * @returns {Gtk.FlowBox} Content view widget
         */
        _createContentView() {
            this._flowBox = new Gtk.FlowBox({
                valign: Gtk.Align.START,
                max_children_per_line: 6,
                min_children_per_line: 2,
                selection_mode: Gtk.SelectionMode.NONE,
                homogeneous: false,
                row_spacing: GRID.ROW_SPACING,
                column_spacing: GRID.COLUMN_SPACING,
            });

            return this._flowBox;
        }

        /**
         * Load themes asynchronously
         * @private
         */
        async _loadThemesAsync() {
            this._contentStack.set_visible_child_name('loading');

            try {
                this._themes = await omarchyThemeService.loadAllThemes();
                this._updateCurrentThemeLabel();

                if (this._themes.length === 0) {
                    this._contentStack.set_visible_child_name('empty');
                    return;
                }

                this._renderThemes();
                this._contentStack.set_visible_child_name('content');
            } catch (e) {
                console.error('Error loading themes:', e.message);
                this._contentStack.set_visible_child_name('empty');
            }
        }

        /**
         * Update the current theme label
         * @private
         */
        _updateCurrentThemeLabel() {
            const currentTheme = omarchyThemeService.getCurrentThemeName();
            const label = currentTheme ? `Current: ${currentTheme}` : 'No theme active';
            this._currentThemeLabel.set_label(label);
        }

        /**
         * Render theme cards
         * @private
         */
        _renderThemes() {
            this._clearFlowBox();

            for (const theme of this._themes) {
                const card = new OmarchyThemeCard(theme);
                card._themeName = theme.name.toLowerCase();

                card.connect('theme-import', (_, themeData) => {
                    this.emit('theme-imported', themeData);
                });
                card.connect('theme-apply', (_, themeData) => {
                    this._applyTheme(themeData);
                });

                this._flowBox.append(card);
            }
        }

        /**
         * Clear all children from the flow box
         * @private
         */
        _clearFlowBox() {
            let child = this._flowBox.get_first_child();
            while (child) {
                const next = child.get_next_sibling();
                this._flowBox.remove(child);
                child = next;
            }
        }

        /**
         * Filter themes by search query
         * @private
         */
        _filterThemes() {
            const query = this._searchEntry.get_text().toLowerCase().trim();
            this._searchQuery = query;

            let child = this._flowBox.get_first_child();
            while (child) {
                const card = child.get_child();
                const name = card?._themeName || '';
                child.set_visible(!query || name.includes(query));
                child = child.get_next_sibling();
            }
        }

        /**
         * Apply a theme
         * @private
         * @param {Object} theme - Theme to apply
         */
        async _applyTheme(theme) {
            try {
                const success = await omarchyThemeService.applyTheme(theme.name);
                if (success) {
                    this.emit('theme-applied', theme);
                    // Reload to update current theme indicator
                    this._loadThemesAsync();
                }
            } catch (e) {
                console.error('Error applying theme:', e.message);
            }
        }

        /**
         * Open themes folder in file manager
         * @private
         */
        _openThemesFolder() {
            const themesDir = GLib.build_filenamev([
                GLib.get_home_dir(),
                '.config',
                'omarchy',
                'themes',
            ]);

            try {
                const launcher = new Gtk.FileLauncher({
                    file: Gio.File.new_for_path(themesDir),
                });

                launcher.open_containing_folder(
                    this.get_root(),
                    null,
                    (source, result) => {
                        try {
                            launcher.open_containing_folder_finish(result);
                        } catch (e) {
                            console.error('Error opening folder:', e.message);
                        }
                    }
                );
            } catch (e) {
                console.error('Error opening themes folder:', e.message);
            }
        }

        /**
         * Refresh the themes list
         */
        refresh() {
            this._loadThemesAsync();
        }
    }
);
