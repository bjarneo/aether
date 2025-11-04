import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import {wallhavenService} from '../services/wallhaven-service.js';
import {favoritesService} from '../services/favorites-service.js';
import {createWallpaperCard} from './WallpaperCard.js';
import {
    removeAllChildren,
    showToast,
    withSignalBlocked,
    updateWithoutSignal,
} from '../utils/ui-helpers.js';
import {
    ensureDirectoryExists,
    loadJsonFile,
    saveJsonFile,
} from '../utils/file-utils.js';

/**
 * WallpaperBrowser - GTK widget for browsing and downloading wallpapers from wallhaven.cc
 *
 * Features:
 * - Search wallpapers by tags, colors, and categories
 * - Filter by category (General, Anime, People) and resolution
 * - Pagination support with page navigation
 * - Thumbnail caching for improved performance
 * - Responsive grid layout that adapts to window size
 * - Download wallpapers to local cache
 * - Favorites management (integrated with favoritesService)
 *
 * Signals:
 * - 'wallpaper-selected' (path: string) - Emitted when a wallpaper is selected
 * - 'favorites-changed' - Emitted when favorites are modified
 *
 * Configuration:
 * - Stores API key and preferences in ~/.config/aether/wallhaven.json
 * - Caches thumbnails in ~/.cache/aether/wallhaven-thumbs/
 * - Downloads full wallpapers to ~/.cache/aether/wallhaven-wallpapers/
 *
 * @class WallpaperBrowser
 * @extends {Gtk.Box}
 */
export const WallpaperBrowser = GObject.registerClass(
    {
        Signals: {
            'wallpaper-selected': {param_types: [GObject.TYPE_STRING]},
            'favorites-changed': {},
        },
    },
    class WallpaperBrowser extends Gtk.Box {
        /**
         * Initializes the WallpaperBrowser widget
         * Sets up search parameters, loads configuration, creates UI, and performs initial search
         * @private
         */
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
            });

            this._currentPage = 1;
            this._totalPages = 1;
            this._searchParams = {
                q: '',
                categories: '111', // All categories
                purity: '100', // SFW only
                sorting: 'date_added',
                order: 'desc',
                resolutions: '', // Resolution filter
            };

            this._loadConfig();
            this._initializeUI();
            this._setupResponsiveColumns();
            this._loadInitialWallpapers();
        }

        /**
         * Initializes the UI components of the browser
         * Creates toolbar, content stack (loading/error/content states), grid, and pagination
         * @private
         */
        _initializeUI() {
            // Toolbar/Header section
            const toolbar = this._createToolbar();
            this.append(toolbar);

            // Main content box with loading state
            this._contentStack = new Gtk.Stack({
                vexpand: true,
                transition_type: Gtk.StackTransitionType.CROSSFADE,
            });

            // Loading spinner
            const loadingBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                halign: Gtk.Align.CENTER,
                spacing: 12,
            });
            const spinner = new Gtk.Spinner({
                width_request: 48,
                height_request: 48,
            });
            spinner.start();
            const loadingLabel = new Gtk.Label({
                label: 'Loading wallpapers...',
                css_classes: ['dim-label'],
            });
            loadingBox.append(spinner);
            loadingBox.append(loadingLabel);
            this._contentStack.add_named(loadingBox, 'loading');

            // Error state
            const errorBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                valign: Gtk.Align.CENTER,
                halign: Gtk.Align.CENTER,
                spacing: 12,
            });
            this._errorLabel = new Gtk.Label({
                label: 'Failed to load wallpapers',
                css_classes: ['error'],
            });
            const retryButton = new Gtk.Button({
                label: 'Retry',
            });
            retryButton.connect('clicked', () => this._performSearch());
            errorBox.append(this._errorLabel);
            errorBox.append(retryButton);
            this._contentStack.add_named(errorBox, 'error');

            // Scrolled window for wallpaper grid
            this._scrolledWindow = new Gtk.ScrolledWindow({
                vexpand: true,
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            });

            // Wallpaper grid - start with default 3 columns, will be updated based on screen size
            this._gridFlow = new Gtk.FlowBox({
                valign: Gtk.Align.START,
                max_children_per_line: 3,
                min_children_per_line: 2,
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: 12,
                row_spacing: 12,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
                homogeneous: true,
            });

            this._scrolledWindow.set_child(this._gridFlow);
            this._contentStack.add_named(this._scrolledWindow, 'content');

            this._contentStack.set_visible_child_name('loading');
            this.append(this._contentStack);

            // Pagination controls
            const paginationBox = this._createPaginationControls();
            this.append(paginationBox);
        }

        /**
         * Creates the toolbar section with search, filters, and settings
         * Includes search entry, sort dropdown, category filters, and settings dialog button
         * @returns {Gtk.Box} The toolbar widget
         * @private
         */
        _createToolbar() {
            const toolbarBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            // Top action bar with search and buttons
            const actionBar = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                margin_top: 6,
                margin_bottom: 6,
                margin_start: 12,
                margin_end: 12,
            });

            // Search entry
            this._searchEntry = new Gtk.SearchEntry({
                placeholder_text: 'Search by tags, colors...',
                hexpand: true,
            });

            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._updateUIFromConfig();
                return GLib.SOURCE_REMOVE;
            });

            this._searchEntry.connect('activate', () => {
                this._searchParams.q = this._searchEntry.get_text();
                this._currentPage = 1;
                this._performSearch();
            });

            // Search button
            const searchButton = new Gtk.Button({
                icon_name: 'system-search-symbolic',
                tooltip_text: 'Search',
            });
            searchButton.connect('clicked', () => {
                this._searchParams.q = this._searchEntry.get_text();
                this._currentPage = 1;
                this._performSearch();
            });

            // Filters button (toggle)
            this._filtersButton = new Gtk.ToggleButton({
                icon_name: 'preferences-other-symbolic',
                tooltip_text: 'Show Filters',
            });

            this._filtersButton.connect('toggled', () => {
                this._filtersRevealer.set_reveal_child(
                    this._filtersButton.get_active()
                );
            });

            // Settings button
            const settingsButton = new Gtk.Button({
                icon_name: 'emblem-system-symbolic',
                tooltip_text: 'Settings',
            });
            settingsButton.connect('clicked', () => {
                this._showSettingsDialog();
            });

            actionBar.append(this._searchEntry);
            actionBar.append(searchButton);
            actionBar.append(
                new Gtk.Separator({orientation: Gtk.Orientation.VERTICAL})
            );
            actionBar.append(this._filtersButton);
            actionBar.append(settingsButton);

            toolbarBox.append(actionBar);

            // Filters section (collapsible)
            this._filtersRevealer = new Gtk.Revealer({
                transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
                reveal_child: false,
            });

            const filtersBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_top: 6,
                margin_bottom: 6,
                margin_start: 12,
                margin_end: 12,
            });

            // Sort dropdown
            const sortBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 3,
            });

            const sortLabel = new Gtk.Label({
                label: 'Sort',
                xalign: 0,
                css_classes: ['caption', 'dim-label'],
            });

            this._sortDropdown = new Gtk.DropDown({
                model: new Gtk.StringList(),
            });

            const sortModel = this._sortDropdown.get_model();
            [
                'Latest',
                'Relevance',
                'Random',
                'Views',
                'Favorites',
                'Top List',
            ].forEach(item => {
                sortModel.append(item);
            });

            this._sortDropdownSignalId = this._sortDropdown.connect(
                'notify::selected',
                () => {
                    const sortMethods = [
                        'date_added',
                        'relevance',
                        'random',
                        'views',
                        'favorites',
                        'toplist',
                    ];
                    this._searchParams.sorting =
                        sortMethods[this._sortDropdown.get_selected()];
                    this._currentPage = 1;
                    this._persistFilters();
                    this._performSearch();
                }
            );

            sortBox.append(sortLabel);
            sortBox.append(this._sortDropdown);

            // Categories
            const categoriesBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 3,
            });

            const categoriesLabel = new Gtk.Label({
                label: 'Categories',
                xalign: 0,
                css_classes: ['caption', 'dim-label'],
            });

            const categoriesCheckBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            this._generalCheck = new Gtk.CheckButton({
                label: 'General',
                active: true,
            });
            this._animeCheck = new Gtk.CheckButton({
                label: 'Anime',
                active: true,
            });
            this._peopleCheck = new Gtk.CheckButton({
                label: 'People',
                active: true,
            });

            const updateCategories = () => {
                const cats = [
                    this._generalCheck.get_active() ? '1' : '0',
                    this._animeCheck.get_active() ? '1' : '0',
                    this._peopleCheck.get_active() ? '1' : '0',
                ].join('');
                this._searchParams.categories = cats;
                this._currentPage = 1;
                this._persistFilters();
                this._performSearch();
            };

            this._generalCheckSignalId = this._generalCheck.connect(
                'toggled',
                updateCategories
            );
            this._animeCheckSignalId = this._animeCheck.connect(
                'toggled',
                updateCategories
            );
            this._peopleCheckSignalId = this._peopleCheck.connect(
                'toggled',
                updateCategories
            );

            categoriesCheckBox.append(this._generalCheck);
            categoriesCheckBox.append(this._animeCheck);
            categoriesCheckBox.append(this._peopleCheck);

            categoriesBox.append(categoriesLabel);
            categoriesBox.append(categoriesCheckBox);

            filtersBox.append(sortBox);
            filtersBox.append(
                new Gtk.Separator({orientation: Gtk.Orientation.VERTICAL})
            );
            filtersBox.append(categoriesBox);

            this._filtersRevealer.set_child(filtersBox);
            toolbarBox.append(this._filtersRevealer);

            // Separator
            toolbarBox.append(
                new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL})
            );

            return toolbarBox;
        }

        /**
         * Creates pagination controls (previous/next buttons and page label)
         * @returns {Gtk.Box} The pagination controls widget
         * @private
         */
        _createPaginationControls() {
            this._paginationBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                halign: Gtk.Align.CENTER,
                spacing: 12,
                margin_top: 6,
                margin_bottom: 6,
            });

            this._prevButton = new Gtk.Button({
                icon_name: 'go-previous-symbolic',
                sensitive: false,
            });
            this._prevButton.connect('clicked', () => {
                if (this._currentPage > 1) {
                    this._currentPage--;
                    this._performSearch();
                    this._scrollToTop();
                }
            });

            this._pageLabel = new Gtk.Label({
                label: 'Page 1 of 1',
            });

            this._nextButton = new Gtk.Button({
                icon_name: 'go-next-symbolic',
                sensitive: false,
            });
            this._nextButton.connect('clicked', () => {
                if (this._currentPage < this._totalPages) {
                    this._currentPage++;
                    this._performSearch();
                    this._scrollToTop();
                }
            });

            this._paginationBox.append(this._prevButton);
            this._paginationBox.append(this._pageLabel);
            this._paginationBox.append(this._nextButton);

            return this._paginationBox;
        }

        /**
         * Sets up responsive column layout system for the wallpaper grid
         * Implements efficient polling-based resize detection with change threshold
         * Grid automatically adjusts columns (2-6) based on available width
         * @private
         */
        _setupResponsiveColumns() {
            // Responsive grid constants
            this.LAYOUT_CONSTANTS = {
                MIN_COLUMNS: 2, // Minimum columns to maintain usable grid
                FALLBACK_WIDTH: 1200, // Default width when allocation unavailable
                CONTENT_WIDTH_RATIO: 0.65, // Content area ratio of total window (accounts for sidebar)
                WINDOW_SCROLL_THRESHOLD: 2, // Window must be 2x scroll width to use window-based calculation
                MIN_WINDOW_WIDTH: 1200, // Minimum window width to apply window-based calculation
                ITEM_WIDTH: 280, // Width of each wallpaper item (from _createWallpaperItem)
                GRID_MARGINS: 24, // Total margins (12px left + 12px right)
                CHANGE_THRESHOLD: 50, // Minimum width change (px) to trigger column recalculation
                INITIAL_DELAY: 300, // Initial delay (ms) before first column calculation
                POLLING_INTERVAL: 1000, // Polling interval (ms) for resize detection
            };

            this._lastWidth = 0;
            this._resizeTimeoutId = null;
            this._isCleanedUp = false;

            // Cache column spacing to avoid repeated method calls
            this._cachedColumnSpacing = this._gridFlow.get_column_spacing();

            // Initial update
            GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this.LAYOUT_CONSTANTS.INITIAL_DELAY,
                () => {
                    this._updateColumns();
                    return GLib.SOURCE_REMOVE;
                }
            );

            // Connect to size allocation signals for efficient resize detection
            this.connect('realize', () => {
                this._connectResizeSignals();
            });

            // Cleanup when component is destroyed
            this.connect('destroy', () => {
                this._cleanupResponsiveColumns();
            });
        }

        /**
         * Connects resize detection signals using efficient polling
         * Only triggers column recalculation when width changes exceed threshold
         * @private
         */
        _connectResizeSignals() {
            // Use efficient polling with change detection
            // Check at POLLING_INTERVAL, but only update if width changed significantly
            this._resizeTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this.LAYOUT_CONSTANTS.POLLING_INTERVAL,
                () => {
                    const width = this._getAvailableWidth();
                    if (
                        Math.abs(width - this._lastWidth) >
                        this.LAYOUT_CONSTANTS.CHANGE_THRESHOLD
                    ) {
                        this._updateColumns();
                        this._lastWidth = width;
                    }
                    return GLib.SOURCE_CONTINUE;
                }
            );
        }

        /**
         * Cleans up resize detection resources when widget is destroyed
         * Removes timeout handlers and sets cleanup flag
         * @private
         */
        _cleanupResponsiveColumns() {
            // Guard against double cleanup
            if (this._isCleanedUp) {
                return;
            }
            this._isCleanedUp = true;

            // Cleanup timeout
            if (this._resizeTimeoutId) {
                GLib.source_remove(this._resizeTimeoutId);
                this._resizeTimeoutId = null;
            }
        }

        /**
         * Calculates available width for the wallpaper grid
         * Uses window-based calculation when scroll area hasn't expanded yet
         * Falls back to scroll area width or default fallback width
         * @returns {number} Available width in pixels
         * @private
         */
        _getAvailableWidth() {
            const scrollWidth = this._scrolledWindow.get_allocated_width();
            const window = this.get_root();
            const windowWidth = window?.get_allocated_width() || 0;

            // Use window-based calculation if scroll area hasn't expanded yet
            const shouldUseWindowWidth =
                windowWidth >
                    scrollWidth *
                        this.LAYOUT_CONSTANTS.WINDOW_SCROLL_THRESHOLD &&
                windowWidth > this.LAYOUT_CONSTANTS.MIN_WINDOW_WIDTH;

            return shouldUseWindowWidth
                ? windowWidth * this.LAYOUT_CONSTANTS.CONTENT_WIDTH_RATIO
                : scrollWidth || this.LAYOUT_CONSTANTS.FALLBACK_WIDTH;
        }

        /**
         * Updates the grid's column count based on available width
         * Sets both max and min columns for responsive behavior
         * @private
         */
        _updateColumns() {
            const width = this._getAvailableWidth();
            const columns = this._calculateColumns(width);

            if (this._gridFlow.get_max_children_per_line() !== columns) {
                this._gridFlow.set_max_children_per_line(columns);

                // Set min to columns-1, but never below MIN_COLUMNS
                const minColumns = Math.max(
                    this.LAYOUT_CONSTANTS.MIN_COLUMNS,
                    columns - 1
                );
                this._gridFlow.set_min_children_per_line(minColumns);
            }
        }

        /**
         * Calculates optimal number of columns based on available width
         * Applies responsive breakpoints (2-6 columns) based on width
         * @param {number} width - Available width in pixels
         * @returns {number} Number of columns (2-6)
         * @private
         */
        _calculateColumns(width) {
            // Use cached spacing value for better performance
            const itemSize =
                this.LAYOUT_CONSTANTS.ITEM_WIDTH + this._cachedColumnSpacing;
            const availableWidth = width - this.LAYOUT_CONSTANTS.GRID_MARGINS;
            const calculated = Math.floor(availableWidth / itemSize);

            // Apply responsive breakpoints
            if (width >= 2560) return Math.max(4, Math.min(calculated, 6));
            if (width >= 1920) return Math.max(3, Math.min(calculated, 5));
            if (width >= 1400) return Math.max(3, Math.min(calculated, 4));
            return Math.max(
                this.LAYOUT_CONSTANTS.MIN_COLUMNS,
                Math.min(calculated, 3)
            );
        }

        /**
         * Loads initial set of wallpapers on component mount
         * @private
         */
        _loadInitialWallpapers() {
            this._performSearch();
        }

        /**
         * Scrolls the wallpaper grid back to the top
         * Used when navigating between pages
         * @private
         */
        _scrollToTop() {
            // Scroll back to top when changing pages
            const adjustment = this._scrolledWindow.get_vadjustment();
            if (adjustment) {
                adjustment.set_value(0);
            }
        }

        /**
         * Performs wallpaper search with current parameters
         * Displays loading state, calls wallhaven API, and updates UI with results
         * Handles pagination and error states
         * @async
         * @private
         */
        async _performSearch() {
            this._contentStack.set_visible_child_name('loading');

            try {
                const params = {
                    ...this._searchParams,
                    page: this._currentPage,
                };

                // Only include resolutions if set
                if (this._searchParams.resolutions) {
                    params.resolutions = this._searchParams.resolutions;
                }

                const result = await wallhavenService.search(params);

                if (result.data && result.data.length > 0) {
                    this._displayWallpapers(result.data);
                    this._updatePagination(result.meta);
                    this._contentStack.set_visible_child_name('content');
                } else {
                    this._showError('No wallpapers found');
                }
            } catch (e) {
                console.error('Search failed:', e.message);
                this._showError(`Failed to load wallpapers: ${e.message}`);
            }
        }

        /**
         * Displays wallpapers in the grid
         * Clears existing items and creates new wallpaper cards
         * @param {Array<Object>} wallpapers - Array of wallpaper objects from API
         * @private
         */
        _displayWallpapers(wallpapers) {
            // Clear existing items
            removeAllChildren(this._gridFlow);

            // Add wallpaper thumbnails
            wallpapers.forEach(wallpaper => {
                const item = this._createWallpaperItem(wallpaper, false);
                this._gridFlow.append(item);
            });
        }

        /**
         * Creates a wallpaper item card for the grid
         * @param {Object} wallpaper - Wallpaper metadata from API
         * @param {boolean} isFavorite - Whether wallpaper is favorited
         * @returns {Gtk.Widget} The wallpaper card widget
         * @private
         */
        _createWallpaperItem(wallpaper, isFavorite) {
            const wallpaperData = {
                path: wallpaper.path,
                type: 'wallhaven',
                name: wallpaper.id,
                info: `${wallpaper.resolution} • ${this._formatFileSize(wallpaper.file_size)}`,
                data: {
                    id: wallpaper.id,
                    resolution: wallpaper.resolution,
                    file_size: wallpaper.file_size,
                    thumbUrl: wallpaper.thumbs.small,
                },
            };

            const {mainBox, picture} = createWallpaperCard(
                wallpaperData,
                wp => this._downloadAndUseWallpaper(wallpaper),
                () => this.emit('favorites-changed')
            );

            // Load thumbnail asynchronously
            this._loadThumbnail(wallpaper.thumbs.small, picture);

            return mainBox;
        }

        /**
         * Loads a thumbnail from cache or downloads it
         * @param {string} url - Thumbnail URL
         * @param {Gtk.Picture} picture - Picture widget to update
         * @private
         */
        async _loadThumbnail(url, picture) {
            try {
                const cacheDir = GLib.build_filenamev([
                    GLib.get_user_cache_dir(),
                    'aether',
                    'wallhaven-thumbs',
                ]);

                ensureDirectoryExists(cacheDir);

                const filename = url.split('/').pop();
                const cachePath = GLib.build_filenamev([cacheDir, filename]);

                // Check if already cached
                const file = Gio.File.new_for_path(cachePath);
                if (file.query_exists(null)) {
                    picture.set_file(file);
                    return;
                }

                // Download to cache
                await wallhavenService.downloadWallpaper(url, cachePath);
                picture.set_file(Gio.File.new_for_path(cachePath));
            } catch (e) {
                console.error('Failed to load thumbnail:', e.message);
            }
        }

        /**
         * Downloads wallpaper and emits wallpaper-selected signal
         * @param {Object} wallpaper - Wallpaper metadata from wallhaven API
         * @private
         */
        async _downloadAndUseWallpaper(wallpaper) {
            try {
                showToast(this, 'Downloading wallpaper...', 0);

                const cacheDir = GLib.build_filenamev([
                    GLib.get_user_cache_dir(),
                    'aether',
                    'wallhaven-wallpapers',
                ]);

                ensureDirectoryExists(cacheDir);

                const filename = wallpaper.path.split('/').pop();
                const wallpaperPath = GLib.build_filenamev([
                    cacheDir,
                    filename,
                ]);

                await wallhavenService.downloadWallpaper(
                    wallpaper.path,
                    wallpaperPath
                );

                this.emit('wallpaper-selected', wallpaperPath);
                showToast(this, 'Wallpaper downloaded successfully');
            } catch (e) {
                console.error(
                    '[WallpaperBrowser] Failed to download wallpaper:',
                    e.message
                );
                console.error('[WallpaperBrowser] Stack:', e.stack);
                showToast(this, `Download failed: ${e.message}`, 3);
            }
        }

        /**
         * Updates pagination controls based on API metadata
         * Sets page label and enables/disables navigation buttons
         * @param {Object} meta - Pagination metadata from API response
         * @param {number} meta.last_page - Total number of pages
         * @private
         */
        _updatePagination(meta) {
            this._totalPages = meta.last_page || 1;
            this._pageLabel.set_label(
                `Page ${this._currentPage} of ${this._totalPages}`
            );

            this._prevButton.set_sensitive(this._currentPage > 1);
            this._nextButton.set_sensitive(
                this._currentPage < this._totalPages
            );
        }

        /**
         * Shows error state with custom message
         * @param {string} message - Error message to display
         * @private
         */
        _showError(message) {
            this._errorLabel.set_label(message);
            this._contentStack.set_visible_child_name('error');
        }

        /**
         * Formats file size in bytes to human-readable format (B/KB/MB)
         * @param {number} bytes - File size in bytes
         * @returns {string} Formatted file size string
         * @private
         */
        _formatFileSize(bytes) {
            if (bytes < 1024) return `${bytes} B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        }

        /**
         * Checks if a wallpaper is in favorites
         * @param {Object} wallpaper - Wallpaper object to check
         * @returns {boolean} True if wallpaper is favorited
         * @private
         */
        _isFavorite(wallpaper) {
            const key = this._getFavoriteKey(wallpaper);
            return this._favorites.has(key);
        }

        /**
         * Generates a unique key for a wallpaper (for favorites storage)
         * @param {Object} wallpaper - Wallpaper object
         * @returns {string} JSON string key containing wallpaper metadata
         * @private
         */
        _getFavoriteKey(wallpaper) {
            // Use wallpaper ID or path as unique key
            return JSON.stringify({
                id: wallpaper.id,
                path: wallpaper.path,
                thumbs: wallpaper.thumbs,
                resolution: wallpaper.resolution,
                file_size: wallpaper.file_size,
            });
        }

        /**
         * Toggles favorite status for a wallpaper
         * @param {Object} wallpaper - Wallpaper object
         * @param {Gtk.Button} button - Favorite button widget
         * @private
         */
        _toggleFavorite(wallpaper, button) {
            const key = this._getFavoriteKey(wallpaper);

            if (this._favorites.has(key)) {
                this._favorites.delete(key);
                button.set_css_classes(['circular', 'favorite-inactive']);
            } else {
                this._favorites.add(key);
                button.set_css_classes(['circular', 'favorite-active']);
            }

            this._saveFavorites();
        }

        /**
         * Loads favorites from disk
         * Reads from ~/.config/aether/favorites.json
         * @private
         */
        _loadFavorites() {
            try {
                const favPath = GLib.build_filenamev([
                    GLib.get_user_config_dir(),
                    'aether',
                    'favorites.json',
                ]);

                const favArray = loadJsonFile(favPath, []);
                this._favorites = new Set(favArray);
            } catch (e) {
                console.error('Failed to load favorites:', e.message);
                this._favorites = new Set();
            }
        }

        /**
         * Saves favorites to disk
         * Writes to ~/.config/aether/favorites.json
         * @private
         */
        _saveFavorites() {
            try {
                const configDir = GLib.build_filenamev([
                    GLib.get_user_config_dir(),
                    'aether',
                ]);
                ensureDirectoryExists(configDir);

                const favPath = GLib.build_filenamev([
                    configDir,
                    'favorites.json',
                ]);

                const favArray = Array.from(this._favorites);
                saveJsonFile(favPath, favArray);
            } catch (e) {
                console.error('Failed to save favorites:', e.message);
            }
        }

        /**
         * Loads wallhaven configuration from disk
         * @private
         */
        _loadConfig() {
            const configPath = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
                'wallhaven.json',
            ]);

            const config = loadJsonFile(configPath, {});

            if (config.apiKey) {
                wallhavenService.setApiKey(config.apiKey);
            }

            if (config.resolutions) {
                this._searchParams.resolutions = config.resolutions;
            }

            if (config.sorting) {
                this._searchParams.sorting = config.sorting;
            }

            if (config.categories) {
                this._searchParams.categories = config.categories;
            }
        }

        /**
         * Updates UI elements to match loaded configuration
         * @private
         */
        _updateUIFromConfig() {
            if (this._sortDropdown) {
                const sortMethods = [
                    'date_added',
                    'relevance',
                    'random',
                    'views',
                    'favorites',
                    'toplist',
                ];
                const index = sortMethods.indexOf(this._searchParams.sorting);
                if (index !== -1) {
                    updateWithoutSignal(
                        this._sortDropdown,
                        this._sortDropdownSignalId,
                        index
                    );
                }
            }

            if (
                !this._generalCheck ||
                !this._animeCheck ||
                !this._peopleCheck
            ) {
                return;
            }

            const cats = this._searchParams.categories;

            withSignalBlocked(
                this._generalCheck,
                this._generalCheckSignalId,
                () => {
                    this._generalCheck.set_active(cats[0] === '1');
                }
            );

            withSignalBlocked(
                this._animeCheck,
                this._animeCheckSignalId,
                () => {
                    this._animeCheck.set_active(cats[1] === '1');
                }
            );

            withSignalBlocked(
                this._peopleCheck,
                this._peopleCheckSignalId,
                () => {
                    this._peopleCheck.set_active(cats[2] === '1');
                }
            );
        }

        /**
         * Persists current filter settings to disk
         * @private
         */
        _persistFilters() {
            const configDir = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
            ]);
            ensureDirectoryExists(configDir);

            const configPath = GLib.build_filenamev([
                configDir,
                'wallhaven.json',
            ]);

            const defaultConfig = {
                apiKey: '',
                resolutions: '',
                sorting: 'date_added',
                categories: '111',
            };

            const config = loadJsonFile(configPath, defaultConfig);

            config.sorting = this._searchParams.sorting;
            config.categories = this._searchParams.categories;

            saveJsonFile(configPath, config);
        }

        /**
         * Saves wallhaven configuration (API key and resolutions)
         * @param {string} apiKey - Wallhaven API key
         * @param {string} resolutions - Resolution filter string
         * @private
         */
        _saveConfig(apiKey, resolutions) {
            try {
                const configDir = GLib.build_filenamev([
                    GLib.get_user_config_dir(),
                    'aether',
                ]);
                ensureDirectoryExists(configDir);

                const configPath = GLib.build_filenamev([
                    configDir,
                    'wallhaven.json',
                ]);

                const defaultConfig = {
                    apiKey: '',
                    resolutions: '',
                    sorting: 'date_added',
                    categories: '111',
                };

                const config = loadJsonFile(configPath, defaultConfig);

                config.apiKey = apiKey;
                config.resolutions = resolutions;
                config.sorting = this._searchParams.sorting;
                config.categories = this._searchParams.categories;

                saveJsonFile(configPath, config);

                wallhavenService.setApiKey(apiKey);
                this._searchParams.resolutions = resolutions;
            } catch (e) {
                console.error('Failed to save config:', e.message);
                throw e;
            }
        }

        /**
         * Shows the settings dialog for API key and resolution filters
         * Allows user to configure wallhaven API key and set resolution preferences
         * @private
         */
        _showSettingsDialog() {
            const dialog = new Adw.Dialog({
                title: 'Wallhaven Settings',
                content_width: 450,
            });

            const toolbarView = new Adw.ToolbarView();

            const headerBar = new Adw.HeaderBar({
                show_title: true,
            });
            toolbarView.add_top_bar(headerBar);

            const contentBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
            });

            // API Configuration Group
            const apiGroup = new Adw.PreferencesGroup({
                title: 'API Configuration',
                description:
                    'Configure your wallhaven.cc API key for access to additional content and higher rate limits',
            });

            // API Key entry
            const apiKeyRow = new Adw.EntryRow({
                title: 'API Key',
                show_apply_button: false,
            });

            // Load current config
            const configPath = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
                'wallhaven.json',
            ]);

            const config = loadJsonFile(configPath, {});
            const currentApiKey = config.apiKey || '';
            const currentResolutions = config.resolutions || '';

            if (currentApiKey) {
                apiKeyRow.set_text(currentApiKey);
            }

            apiGroup.add(apiKeyRow);

            // Help text for API key
            const apiHelpLabel = new Gtk.Label({
                label: 'Get your API key from:\nhttps://wallhaven.cc/settings/account',
                wrap: true,
                xalign: 0,
                css_classes: ['dim-label', 'caption'],
            });

            contentBox.append(apiGroup);
            contentBox.append(apiHelpLabel);

            // Resolution Filter Group
            const resolutionGroup = new Adw.PreferencesGroup({
                title: 'Resolution Filters',
                description:
                    'Filter wallpapers by resolution (comma-separated, e.g., "1920x1080,2560x1440")',
                margin_top: 12,
            });

            const resolutionRow = new Adw.EntryRow({
                title: 'Resolutions',
                show_apply_button: false,
                text: currentResolutions,
            });

            resolutionGroup.add(resolutionRow);

            // Common resolutions as presets
            const presetsBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                halign: Gtk.Align.START,
                margin_start: 12,
                margin_end: 12,
                margin_top: 6,
            });

            const presets = [
                {label: '1080p', value: '1920x1080'},
                {label: '1440p', value: '2560x1440'},
                {label: '4K', value: '3840x2160'},
                {label: 'Ultrawide', value: '3440x1440,2560x1080'},
            ];

            presets.forEach(preset => {
                const btn = new Gtk.Button({
                    label: preset.label,
                    css_classes: ['pill'],
                });
                btn.connect('clicked', () => {
                    const currentText = resolutionRow.get_text();
                    if (currentText) {
                        // Append to existing
                        const existing = currentText
                            .split(',')
                            .map(s => s.trim());
                        const newValues = preset.value.split(',');
                        const combined = [
                            ...new Set([...existing, ...newValues]),
                        ];
                        resolutionRow.set_text(combined.join(','));
                    } else {
                        resolutionRow.set_text(preset.value);
                    }
                });
                presetsBox.append(btn);
            });

            const clearBtn = new Gtk.Button({
                label: 'Clear',
                css_classes: ['pill'],
            });
            clearBtn.connect('clicked', () => {
                resolutionRow.set_text('');
            });
            presetsBox.append(clearBtn);

            // Resolution help text
            const resolutionHelpLabel = new Gtk.Label({
                label: 'Leave empty to show all resolutions. Use presets above or enter custom resolutions.',
                wrap: true,
                xalign: 0,
                css_classes: ['dim-label', 'caption'],
                margin_start: 12,
                margin_end: 12,
                margin_top: 6,
            });

            contentBox.append(resolutionGroup);
            contentBox.append(presetsBox);
            contentBox.append(resolutionHelpLabel);

            // Action buttons
            const buttonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
                halign: Gtk.Align.END,
                margin_top: 12,
            });

            const cancelButton = new Gtk.Button({
                label: 'Cancel',
            });
            cancelButton.connect('clicked', () => dialog.close());

            const saveButton = new Gtk.Button({
                label: 'Save',
                css_classes: ['suggested-action'],
            });
            saveButton.connect('clicked', () => {
                const apiKey = apiKeyRow.get_text().trim();
                const resolutions = resolutionRow.get_text().trim();

                try {
                    this._saveConfig(apiKey, resolutions);

                    // Refresh search with new filters
                    this._currentPage = 1;
                    this._performSearch();

                    showToast(this, 'Settings saved successfully', 2);
                    dialog.close();
                } catch (e) {
                    showToast(this, `Failed to save settings: ${e.message}`, 3);
                }
            });

            buttonBox.append(cancelButton);
            buttonBox.append(saveButton);
            contentBox.append(buttonBox);

            toolbarView.set_content(contentBox);
            dialog.set_child(toolbarView);

            dialog.present(this.get_root());
        }

        /**
         * Getter for widget instance (for compatibility)
         * @returns {WallpaperBrowser} This widget instance
         */
        get widget() {
            return this;
        }
    }
);
