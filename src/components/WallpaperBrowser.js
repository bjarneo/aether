import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import {wallhavenService} from '../services/wallhaven-service.js';
import {favoritesService} from '../services/favorites-service.js';
import {batchProcessingState} from '../state/BatchProcessingState.js';
import {createWallpaperCard} from './WallpaperCard.js';
import {ResponsiveGridManager} from './wallpaper-browser/ResponsiveGridManager.js';
import {WallpaperFiltersPanel} from './wallpaper-browser/WallpaperFiltersPanel.js';
import {
    removeAllChildren,
    showToast,
    applyCssToWidget,
} from '../utils/ui-helpers.js';
import {
    ensureDirectoryExists,
    loadJsonFile,
    saveJsonFile,
} from '../utils/file-utils.js';
import {SPACING, GRID} from '../constants/ui-constants.js';
import {createSectionHeader, createEmptyState} from './ui/BrowserHeader.js';

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
 * - 'add-to-additional-images' (wallpaper: object) - Emitted when adding to additional images
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
            'wallpaper-selected': {
                param_types: [GObject.TYPE_STRING, GObject.TYPE_JSOBJECT],
            },
            'favorites-changed': {},
            'add-to-additional-images': {param_types: [GObject.TYPE_JSOBJECT]},
            'process-batch-requested': {param_types: [GObject.TYPE_JSOBJECT]},
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
                spacing: SPACING.MD,
            });

            this._currentPage = 1;
            this._totalPages = 1;
            this._isLoading = false;
            this._hasMorePages = true;
            this._hasApiKey = false;
            this._purityControlsEnabled = false;
            this._searchParams = {
                q: '',
                categories: '111', // All categories
                purity: '100', // SFW only
                sorting: 'date_added',
                order: 'desc',
                resolutions: '', // Resolution filter
            };

            // Selection mode state
            this._selectionMode = false;
            this._downloadedWallpapers = new Map(); // path -> wallpaper data for batch

            this._loadConfig();
            this._initializeUI();
            this._connectBatchStateSignals();

            // Initialize responsive grid manager
            this._gridManager = new ResponsiveGridManager(
                this._gridFlow,
                this._scrolledWindow,
                this
            );
            this._gridManager.initialize();

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

            // Batch actions bar (hidden by default)
            this._batchActionsBar = this._createBatchActionsBar();
            this._batchActionsBar.set_visible(false);
            this.append(this._batchActionsBar);

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
                spacing: SPACING.MD,
                margin_top: 48,
                margin_bottom: 48,
            });
            const spinner = new Gtk.Spinner({
                width_request: 32,
                height_request: 32,
            });
            spinner.start();
            const loadingLabel = new Gtk.Label({
                label: 'Loading...',
            });
            applyCssToWidget(
                loadingLabel,
                `
                label {
                    font-size: 13px;
                    opacity: 0.5;
                }
            `
            );
            loadingBox.append(spinner);
            loadingBox.append(loadingLabel);
            this._contentStack.add_named(loadingBox, 'loading');

            // Error state
            const errorBox = createEmptyState({
                icon: 'dialog-error-symbolic',
                title: 'Failed to load wallpapers',
                description: 'Check your internet connection',
            });
            const retryButton = new Gtk.Button({
                label: 'Retry',
                halign: Gtk.Align.CENTER,
            });
            applyCssToWidget(
                retryButton,
                `
                button {
                    border-radius: 0;
                    padding: 8px 24px;
                }
            `
            );
            retryButton.connect('clicked', () => this._performSearch());
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
                vexpand: true, // Ensure proper height negotiation with ScrolledWindow
                max_children_per_line: GRID.MAX_COLUMNS,
                min_children_per_line: GRID.MIN_COLUMNS,
                selection_mode: Gtk.SelectionMode.NONE,
                column_spacing: GRID.COLUMN_SPACING,
                row_spacing: GRID.ROW_SPACING,
                margin_top: SPACING.MD,
                margin_bottom: SPACING.MD,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                homogeneous: true,
            });

            this._scrolledWindow.set_child(this._gridFlow);
            this._contentStack.add_named(this._scrolledWindow, 'content');

            this._contentStack.set_visible_child_name('loading');
            this.append(this._contentStack);

            // Set up infinite scroll
            this._setupInfiniteScroll();
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
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_top: SPACING.MD,
            });

            // Section header
            const header = createSectionHeader(
                'Wallhaven',
                'Browse and download wallpapers'
            );
            toolbarBox.append(header);

            toolbarBox.append(this._createSearchActionBar());
            toolbarBox.append(this._createFiltersSection());

            return toolbarBox;
        }

        /**
         * Creates the search action bar with search entry and control buttons
         * @returns {Gtk.Box} The action bar widget
         * @private
         */
        _createSearchActionBar() {
            const actionBar = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
                margin_bottom: SPACING.SM,
            });

            // Search entry
            this._searchEntry = new Gtk.SearchEntry({
                placeholder_text: 'Search by tags, colors...',
                hexpand: true,
            });
            applyCssToWidget(
                this._searchEntry,
                `
                entry {
                    border-radius: 0;
                }
            `
            );

            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._updateUIFromConfig();
                this._updatePurityControlsVisibility();
                return GLib.SOURCE_REMOVE;
            });

            this._searchEntry.connect('activate', () => {
                this._searchParams.q = this._searchEntry.get_text();
                this._currentPage = 1;
                this._hasMorePages = true;
                this._performSearch();
            });

            // Search button
            const searchButton = new Gtk.Button({
                icon_name: 'system-search-symbolic',
                tooltip_text: 'Search',
            });
            applyCssToWidget(
                searchButton,
                `
                button {
                    border-radius: 0;
                }
            `
            );
            searchButton.connect('clicked', () => {
                this._searchParams.q = this._searchEntry.get_text();
                this._currentPage = 1;
                this._hasMorePages = true;
                this._performSearch();
            });

            // Filters button (toggle)
            this._filtersButton = new Gtk.ToggleButton({
                icon_name: 'preferences-other-symbolic',
                tooltip_text: 'Show Filters',
            });
            applyCssToWidget(
                this._filtersButton,
                `
                button {
                    border-radius: 0;
                }
            `
            );

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
            applyCssToWidget(
                settingsButton,
                `
                button {
                    border-radius: 0;
                }
            `
            );
            settingsButton.connect('clicked', () => {
                this._showSettingsDialog();
            });

            // Selection mode toggle button
            this._selectionModeButton = new Gtk.ToggleButton({
                icon_name: 'selection-mode-symbolic',
                tooltip_text: 'Selection Mode',
            });
            applyCssToWidget(
                this._selectionModeButton,
                `
                button {
                    border-radius: 0;
                }
            `
            );
            this._selectionModeButton.connect('toggled', () => {
                this._toggleSelectionMode(
                    this._selectionModeButton.get_active()
                );
            });

            actionBar.append(this._searchEntry);
            actionBar.append(searchButton);
            actionBar.append(this._filtersButton);
            actionBar.append(settingsButton);
            actionBar.append(this._selectionModeButton);

            return actionBar;
        }

        /**
         * Creates the collapsible filters section for sorting, categories, and purity controls.
         * @returns {WallpaperFiltersPanel} The filters panel widget
         * @private
         */
        _createFiltersSection() {
            this._filtersPanel = new WallpaperFiltersPanel({
                hasApiKey: this._hasApiKey,
                purityControlsEnabled: this._purityControlsEnabled,
                initialFilters: {
                    sorting: this._searchParams.sorting,
                    categories: this._searchParams.categories,
                    purity: this._searchParams.purity,
                },
            });

            this._filtersPanel.connect(
                'filters-changed',
                (_, changedFilters) => {
                    this._onFiltersChanged(changedFilters);
                }
            );

            // Keep reference for toggle button
            this._filtersRevealer = this._filtersPanel;

            return this._filtersPanel;
        }

        /**
         * Handle filter changes from the filters panel
         * @param {Object} changedFilters - The filters that changed
         * @private
         */
        _onFiltersChanged(changedFilters) {
            // Update search params
            Object.assign(this._searchParams, changedFilters);

            // Normalize purity if needed
            if (changedFilters.purity) {
                this._searchParams.purity = this._normalizePurity(
                    changedFilters.purity,
                    this._hasApiKey
                );
            }

            // Reset pagination and search
            this._currentPage = 1;
            this._hasMorePages = true;
            this._persistFilters();
            this._performSearch();
        }

        /**
         * Sets up infinite scroll behavior on the scrolled window
         * Automatically loads more wallpapers when user scrolls near the bottom
         * @private
         */
        _setupInfiniteScroll() {
            const adjustment = this._scrolledWindow.get_vadjustment();

            adjustment.connect('value-changed', () => {
                // Don't load if already loading or no more pages
                if (this._isLoading || !this._hasMorePages) {
                    return;
                }

                const value = adjustment.get_value();
                const upper = adjustment.get_upper();
                const pageSize = adjustment.get_page_size();

                // Load more when scrolled to within 200px of the bottom
                const scrollThreshold = 200;
                const distanceFromBottom = upper - (value + pageSize);

                if (distanceFromBottom < scrollThreshold) {
                    this._loadNextPage();
                }
            });
        }

        /**
         * Loads initial set of wallpapers on component mount
         * @private
         */
        _loadInitialWallpapers() {
            this._performSearch();
        }

        /**
         * Loads the next page of wallpapers for infinite scroll
         * @private
         */
        async _loadNextPage() {
            if (this._currentPage >= this._totalPages) {
                this._hasMorePages = false;
                return;
            }

            this._currentPage++;
            await this._performSearch(true); // true = append mode
        }

        /**
         * Performs wallpaper search with current parameters
         * Displays loading state, calls wallhaven API, and updates UI with results
         * Handles pagination and error states
         * @param {boolean} append - If true, append results instead of replacing them
         * @async
         * @private
         */
        async _performSearch(append = false) {
            // Prevent concurrent requests
            if (this._isLoading) {
                return;
            }

            this._isLoading = true;

            // Only show loading screen for initial load
            if (!append) {
                this._contentStack.set_visible_child_name('loading');
            }

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
                    this._displayWallpapers(result.data, append);
                    this._updatePagination(result.meta);
                    this._contentStack.set_visible_child_name('content');
                } else {
                    if (!append) {
                        this._showError('No wallpapers found');
                    }
                }
            } catch (e) {
                console.error('Search failed:', e.message);
                if (!append) {
                    this._showError(`Failed to load wallpapers: ${e.message}`);
                }
            } finally {
                this._isLoading = false;
            }
        }

        /**
         * Displays wallpapers in the grid
         * Clears existing items or appends new ones based on mode
         * @param {Array<Object>} wallpapers - Array of wallpaper objects from API
         * @param {boolean} append - If true, append to existing wallpapers instead of replacing
         * @private
         */
        _displayWallpapers(wallpapers, append = false) {
            // Clear existing items only if not appending
            if (!append) {
                removeAllChildren(this._gridFlow);
            }

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

            // Options for selection mode
            const cardOptions = {
                showCheckbox: this._selectionMode,
                isSelected: batchProcessingState.isSelected(wallpaper.path),
                onCheckboxToggle: (wp, isChecked) => {
                    this._onWallpaperCheckboxToggle(wallpaper, isChecked);
                },
            };

            const {mainBox, picture} = createWallpaperCard(
                wallpaperData,
                wp => this._downloadAndUseWallpaper(wallpaper),
                () => this.emit('favorites-changed'),
                wp => this.emit('add-to-additional-images', wallpaperData),
                cardOptions
            );

            // Store wallpaper data for later reference
            mainBox._wallpaperPath = wallpaper.path;
            mainBox._wallpaperData = wallpaper;

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
            // Show downloading toast (auto-dismiss after 2 seconds)
            showToast(this, 'Downloading wallpaper...');

            try {
                // Use permanent data directory instead of cache
                const wallpapersDir = GLib.build_filenamev([
                    GLib.get_user_data_dir(),
                    'aether',
                    'wallpapers',
                ]);

                ensureDirectoryExists(wallpapersDir);

                const filename = wallpaper.path.split('/').pop();
                const wallpaperPath = GLib.build_filenamev([
                    wallpapersDir,
                    filename,
                ]);

                await wallhavenService.downloadWallpaper(
                    wallpaper.path,
                    wallpaperPath
                );

                // Emit wallpaper with metadata including URL
                const wallpaperData = {
                    path: wallpaperPath,
                    url: wallpaper.url,
                    source: 'wallhaven',
                };

                this.emit('wallpaper-selected', wallpaperPath, wallpaperData);
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
         * Updates pagination state based on API metadata
         * Updates hasMorePages flag for infinite scroll
         * @param {Object} meta - Pagination metadata from API response
         * @param {number} meta.last_page - Total number of pages
         * @private
         */
        _updatePagination(meta) {
            this._totalPages = meta.last_page || 1;
            this._hasMorePages = this._currentPage < this._totalPages;
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
         * Uses centralized favoritesService
         * @param {Object} wallpaper - Wallpaper object to check
         * @returns {boolean} True if wallpaper is favorited
         * @private
         */
        _isFavorite(wallpaper) {
            return favoritesService.isFavorite(wallpaper.path);
        }

        /**
         * Toggles favorite status for a wallpaper
         * Uses centralized favoritesService
         * @param {Object} wallpaper - Wallpaper object
         * @param {Gtk.Button} button - Favorite button widget
         * @private
         */
        _toggleFavorite(wallpaper, button) {
            const isFavorited = favoritesService.toggleFavorite(
                wallpaper.path,
                'wallhaven',
                {
                    id: wallpaper.id,
                    resolution: wallpaper.resolution,
                    file_size: wallpaper.file_size,
                    thumbUrl: wallpaper.thumbs?.small,
                }
            );

            button.set_css_classes([
                'circular',
                isFavorited ? 'favorite-active' : 'favorite-inactive',
            ]);
        }

        /**
         * Updates visibility and state of purity controls based on configuration
         * Resets purity to SFW-only when controls are disabled
         * @private
         */
        _updatePurityControlsVisibility() {
            if (!this._filtersPanel) {
                return;
            }

            this._filtersPanel.setPurityControlsEnabled(
                this._purityControlsEnabled
            );

            if (!this._purityControlsEnabled) {
                const normalizedPurity = this._normalizePurity(
                    '100',
                    this._hasApiKey
                );
                this._searchParams.purity = normalizedPurity;

                // Update panel with normalized purity
                this._filtersPanel.setFilters({
                    purity: normalizedPurity,
                });
            }
        }

        /**
         * Normalizes a purity string based on API key availability
         * Ensures proper format and disables NSFW when API key is missing
         * @param {string} purity - Raw purity string (e.g., "100", "110", "111")
         * @param {boolean} hasApiKey - Whether a valid API key is configured
         * @returns {string} Normalized purity string
         * @private
         */
        _normalizePurity(purity, hasApiKey) {
            const safePurity =
                typeof purity === 'string' && purity.length === 3
                    ? purity
                    : '100';

            if (hasApiKey) {
                return safePurity;
            }

            return `${safePurity[0]}${safePurity[1]}0`;
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

            const defaultConfig = {
                apiKey: '',
                resolutions: '',
                sorting: 'date_added',
                categories: '111',
                purity: '100',
                purityControlsEnabled: false,
            };

            const config = loadJsonFile(configPath, defaultConfig);
            const rawApiKey =
                typeof config.apiKey === 'string' ? config.apiKey.trim() : '';

            this._hasApiKey = rawApiKey.length > 0;

            if (this._hasApiKey) {
                wallhavenService.setApiKey(rawApiKey);
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

            this._purityControlsEnabled = Boolean(config.purityControlsEnabled);
        }

        /**
         * Updates UI elements to match loaded configuration
         * @private
         */
        _updateUIFromConfig() {
            if (!this._filtersPanel) {
                return;
            }

            const normalizedPurity = this._normalizePurity(
                this._searchParams.purity,
                this._hasApiKey
            );
            this._searchParams.purity = normalizedPurity;

            // Update filters panel with current search params
            this._filtersPanel.setFilters({
                sorting: this._searchParams.sorting,
                categories: this._searchParams.categories,
                purity: normalizedPurity,
            });

            // Update API key status
            this._filtersPanel.setHasApiKey(this._hasApiKey);
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
                purity: '100',
                purityControlsEnabled: false,
            };

            const config = loadJsonFile(configPath, defaultConfig);

            config.sorting = this._searchParams.sorting;
            config.categories = this._searchParams.categories;
            config.purityControlsEnabled = this._purityControlsEnabled;

            const effectivePurity = this._purityControlsEnabled
                ? this._searchParams.purity
                : '100';

            const normalizedPurity = this._normalizePurity(
                effectivePurity,
                this._hasApiKey
            );

            config.purity = normalizedPurity;
            this._searchParams.purity = normalizedPurity;

            saveJsonFile(configPath, config);
        }

        /**
         * Saves wallhaven configuration (API key, resolutions, and purity controls)
         * @param {string} apiKey - Wallhaven API key
         * @param {string} resolutions - Resolution filter string
         * @param {boolean} purityControlsEnabled - Whether purity controls are visible in the browser
         * @private
         */
        _saveConfig(apiKey, resolutions, purityControlsEnabled) {
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
                    purity: '100',
                    purityControlsEnabled: false,
                };

                const config = loadJsonFile(configPath, defaultConfig);

                const sanitizedApiKey = apiKey.trim();
                const hasApiKey = sanitizedApiKey.length > 0;

                this._purityControlsEnabled = Boolean(purityControlsEnabled);

                config.apiKey = sanitizedApiKey;
                config.resolutions = resolutions;
                config.sorting = this._searchParams.sorting;
                config.categories = this._searchParams.categories;
                config.purityControlsEnabled = this._purityControlsEnabled;

                let normalizedPurity;

                if (!this._purityControlsEnabled) {
                    this._searchParams.purity = '100';
                    normalizedPurity = this._normalizePurity('100', hasApiKey);
                } else {
                    normalizedPurity = this._normalizePurity(
                        this._searchParams.purity,
                        hasApiKey
                    );
                }

                config.purity = normalizedPurity;
                this._searchParams.purity = normalizedPurity;

                saveJsonFile(configPath, config);

                this._hasApiKey = hasApiKey;

                if (this._hasApiKey) {
                    wallhavenService.setApiKey(sanitizedApiKey);
                }

                this._searchParams.resolutions = resolutions;
                this._updateUIFromConfig();
                this._updatePurityControlsVisibility();
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
                spacing: SPACING.MD,
                margin_top: SPACING.MD,
                margin_bottom: SPACING.MD,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
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

            const defaultConfig = {
                apiKey: '',
                resolutions: '',
                sorting: 'date_added',
                categories: '111',
                purity: '100',
                purityControlsEnabled: false,
            };

            const config = loadJsonFile(configPath, defaultConfig);
            const currentApiKey = config.apiKey || '';
            const currentResolutions = config.resolutions || '';
            const currentPurityControlsEnabled = Boolean(
                config.purityControlsEnabled
            );

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
                margin_top: SPACING.MD,
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
                spacing: SPACING.SM,
                halign: Gtk.Align.START,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_top: SPACING.SM,
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

            const purityGroup = new Adw.PreferencesGroup({
                title: 'Content Filters',
            });

            const puritySwitchRow = new Adw.SwitchRow({
                title: 'Show purity filters',
                subtitle:
                    'Enable SFW/Sketchy/NSFW controls in the wallpaper browser',
                active: currentPurityControlsEnabled,
            });
            purityGroup.add(puritySwitchRow);
            contentBox.append(purityGroup);

            // Action buttons
            const buttonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
                halign: Gtk.Align.END,
                margin_top: SPACING.MD,
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
                const purityControlsEnabled = puritySwitchRow.get_active();

                try {
                    this._saveConfig(
                        apiKey,
                        resolutions,
                        purityControlsEnabled
                    );

                    // Refresh search with new filters
                    this._currentPage = 1;
                    this._hasMorePages = true;
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

        // ==================== Batch Selection Mode ====================

        /**
         * Creates the batch actions bar with selection count and process button
         * @returns {Gtk.Box} The batch actions bar widget
         * @private
         */
        _createBatchActionsBar() {
            const bar = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.SM,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
                margin_bottom: SPACING.SM,
            });

            applyCssToWidget(
                bar,
                `
                box {
                    background-color: alpha(@accent_bg_color, 0.1);
                    border: 1px solid alpha(@accent_bg_color, 0.3);
                    padding: 8px 12px;
                    border-radius: 0;
                }
            `
            );

            this._selectionCountLabel = new Gtk.Label({
                label: '0 selected',
                hexpand: true,
                xalign: 0,
            });
            bar.append(this._selectionCountLabel);

            // Clear selection button
            const clearButton = new Gtk.Button({
                icon_name: 'edit-clear-all-symbolic',
                tooltip_text: 'Clear selection',
            });
            applyCssToWidget(
                clearButton,
                `
                button {
                    border-radius: 0;
                }
            `
            );
            clearButton.connect('clicked', () => {
                batchProcessingState.clearSelections();
            });
            bar.append(clearButton);

            // Process selected button
            this._processSelectedButton = new Gtk.Button({
                label: 'Process Selected',
                css_classes: ['suggested-action'],
                sensitive: false,
            });
            applyCssToWidget(
                this._processSelectedButton,
                `
                button {
                    border-radius: 0;
                    padding: 6px 16px;
                }
            `
            );
            this._processSelectedButton.connect('clicked', () => {
                this._processSelectedWallpapers();
            });
            bar.append(this._processSelectedButton);

            return bar;
        }

        /**
         * Connect to batch processing state signals
         * @private
         */
        _connectBatchStateSignals() {
            batchProcessingState.connect('selection-changed', (_, count) => {
                this._updateSelectionUI(count);
            });

            batchProcessingState.connect(
                'selection-mode-changed',
                (_, enabled) => {
                    if (this._selectionMode !== enabled) {
                        this._selectionMode = enabled;
                        this._selectionModeButton.set_active(enabled);
                        this._refreshDisplayedWallpapers();
                    }
                }
            );
        }

        /**
         * Toggle selection mode
         * @private
         * @param {boolean} enabled - Whether to enable selection mode
         */
        _toggleSelectionMode(enabled) {
            this._selectionMode = enabled;
            batchProcessingState.setSelectionMode(enabled);

            // Show/hide batch actions bar
            this._batchActionsBar.set_visible(enabled);

            // Refresh display to show/hide checkboxes
            this._refreshDisplayedWallpapers();
        }

        /**
         * Refresh displayed wallpapers (to update checkboxes)
         * @private
         */
        _refreshDisplayedWallpapers() {
            // Re-render the current wallpapers to update checkbox state
            // This preserves the current view but updates the cards
            this._currentPage = 1;
            this._hasMorePages = true;
            this._performSearch();
        }

        /**
         * Handle checkbox toggle on a wallpaper
         * @private
         * @param {Object} wallpaper - Wallpaper data
         * @param {boolean} isChecked - New checked state
         */
        _onWallpaperCheckboxToggle(wallpaper, isChecked) {
            const wallpaperData = {
                path: wallpaper.path,
                type: 'wallhaven',
                name: wallpaper.id,
                data: {
                    id: wallpaper.id,
                    resolution: wallpaper.resolution,
                    file_size: wallpaper.file_size,
                    thumbUrl: wallpaper.thumbs.small,
                },
            };

            if (isChecked) {
                batchProcessingState.addSelection(wallpaperData);
            } else {
                batchProcessingState.removeSelection(wallpaper.path);
            }
        }

        /**
         * Update selection UI based on count
         * @private
         * @param {number} count - Number of selected items
         */
        _updateSelectionUI(count) {
            const maxSelections = batchProcessingState.getMaxSelections();
            this._selectionCountLabel.set_label(
                `${count} of ${maxSelections} selected`
            );
            this._processSelectedButton.set_sensitive(count > 0);

            // Update button text
            if (count > 0) {
                this._processSelectedButton.set_label(
                    `Process ${count} Wallpaper${count !== 1 ? 's' : ''}`
                );
            } else {
                this._processSelectedButton.set_label('Process Selected');
            }
        }

        /**
         * Process selected wallpapers - download and emit for batch processing
         * @private
         */
        async _processSelectedWallpapers() {
            const selections = batchProcessingState.getSelections();
            if (selections.length === 0) return;

            showToast(this, `Preparing ${selections.length} wallpapers...`);

            const wallpapersDir = GLib.build_filenamev([
                GLib.get_user_data_dir(),
                'aether',
                'wallpapers',
            ]);
            ensureDirectoryExists(wallpapersDir);

            const downloadedWallpapers = [];
            for (const selection of selections) {
                const filename = selection.path.split('/').pop();
                const localPath = GLib.build_filenamev([
                    wallpapersDir,
                    filename,
                ]);

                try {
                    const file = Gio.File.new_for_path(localPath);
                    if (!file.query_exists(null)) {
                        await wallhavenService.downloadWallpaper(
                            selection.path,
                            localPath
                        );
                    }

                    downloadedWallpapers.push({
                        ...selection,
                        path: localPath,
                        originalPath: selection.path,
                    });
                } catch (e) {
                    console.error(
                        `Failed to download ${selection.path}:`,
                        e.message
                    );
                }
            }

            if (downloadedWallpapers.length === 0) {
                showToast(this, 'Failed to download any wallpapers', 3);
                return;
            }

            this._toggleSelectionMode(false);
            this.emit('process-batch-requested', downloadedWallpapers);
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
