import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import {wallhavenService} from '../services/wallhaven-service.js';
import {favoritesService} from '../services/favorites-service.js';
import {createWallpaperCard} from './WallpaperCard.js';
import {ResponsiveGridManager} from './wallpaper-browser/ResponsiveGridManager.js';
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

            this._loadConfig();
            this._initializeUI();

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
            });

            toolbarBox.append(this._createSearchActionBar());
            toolbarBox.append(this._createFiltersSection());
            toolbarBox.append(
                new Gtk.Separator({orientation: Gtk.Orientation.HORIZONTAL})
            );

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

            return actionBar;
        }

        /**
         * Creates the collapsible filters section with sort and categories
         * @returns {Gtk.Revealer} The filters revealer widget
         * @private
         */
        _createFiltersSection() {
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

            filtersBox.append(this._createSortDropdown());
            filtersBox.append(
                new Gtk.Separator({orientation: Gtk.Orientation.VERTICAL})
            );
            filtersBox.append(this._createCategoriesCheckboxes());
            filtersBox.append(
                new Gtk.Separator({orientation: Gtk.Orientation.VERTICAL})
            );
            filtersBox.append(this._createPurityControls());

            this._filtersRevealer.set_child(filtersBox);
            return this._filtersRevealer;
        }

        /**
         * Creates the sort dropdown filter
         * @returns {Gtk.Box} The sort dropdown container
         * @private
         */
        _createSortDropdown() {
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
                    this._hasMorePages = true;
                    this._persistFilters();
                    this._performSearch();
                }
            );

            sortBox.append(sortLabel);
            sortBox.append(this._sortDropdown);

            return sortBox;
        }

        /**
         * Creates the purity checkboxes filter
         * @returns {Gtk.Box} The purity checkboxes container
         * @private
         */
        _createPurityControls() {
            const purityBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 3,
            });

            this._purityBox = purityBox;

            const purityLabel = new Gtk.Label({
                label: 'Purity',
                xalign: 0,
                css_classes: ['caption', 'dim-label'],
            });

            const purityCheckBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });

            this._sfwCheck = new Gtk.CheckButton({
                label: 'SFW',
                active: true,
            });
            this._sketchyCheck = new Gtk.CheckButton({
                label: 'Sketchy',
                active: false,
            });
            this._nsfwCheck = new Gtk.CheckButton({
                label: 'NSFW',
                active: false,
                sensitive: this._hasApiKey,
            });

            const updatePurity = () => {
                if (!this._purityControlsEnabled) {
                    return;
                }

                const purity = [
                    this._sfwCheck.get_active() ? '1' : '0',
                    this._sketchyCheck.get_active() ? '1' : '0',
                    this._nsfwCheck.get_active() ? '1' : '0',
                ].join('');

                this._searchParams.purity = this._normalizePurity(
                    purity,
                    this._hasApiKey
                );
                this._currentPage = 1;
                this._hasMorePages = true;
                this._persistFilters();
                this._performSearch();
            };

            this._sfwCheckSignalId = this._sfwCheck.connect(
                'toggled',
                updatePurity
            );
            this._sketchyCheckSignalId = this._sketchyCheck.connect(
                'toggled',
                updatePurity
            );
            this._nsfwCheckSignalId = this._nsfwCheck.connect('toggled', () => {
                const isActive = this._nsfwCheck.get_active();

                if (isActive && !this._hasApiKey) {
                    showToast(
                        this,
                        'NSFW requires a valid Wallhaven API key',
                        3
                    );

                    withSignalBlocked(
                        this._nsfwCheck,
                        this._nsfwCheckSignalId,
                        () => {
                            this._nsfwCheck.set_active(false);
                        }
                    );

                    return;
                }

                updatePurity();
            });

            purityCheckBox.append(this._sfwCheck);
            purityCheckBox.append(this._sketchyCheck);
            purityCheckBox.append(this._nsfwCheck);

            purityBox.append(purityLabel);
            purityBox.append(purityCheckBox);

            purityBox.set_visible(this._purityControlsEnabled);

            return purityBox;
        }

        /**
         * Creates the categories checkboxes filter
         * @returns {Gtk.Box} The categories checkboxes container
         * @private
         */
        _createCategoriesCheckboxes() {
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
                this._hasMorePages = true;
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

            return categoriesBox;
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

            const {mainBox, picture} = createWallpaperCard(
                wallpaperData,
                wp => this._downloadAndUseWallpaper(wallpaper),
                () => this.emit('favorites-changed'),
                wp => this.emit('add-to-additional-images', wallpaperData)
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
            if (!this._purityBox) {
                return;
            }

            this._purityBox.set_visible(this._purityControlsEnabled);

            if (!this._purityControlsEnabled) {
                const normalizedPurity = this._normalizePurity(
                    '100',
                    this._hasApiKey
                );
                this._searchParams.purity = normalizedPurity;

                if (this._sfwCheck && this._sketchyCheck && this._nsfwCheck) {
                    if (this._sfwCheckSignalId) {
                        withSignalBlocked(
                            this._sfwCheck,
                            this._sfwCheckSignalId,
                            () => {
                                this._sfwCheck.set_active(true);
                            }
                        );
                    } else {
                        this._sfwCheck.set_active(true);
                    }

                    if (this._sketchyCheckSignalId) {
                        withSignalBlocked(
                            this._sketchyCheck,
                            this._sketchyCheckSignalId,
                            () => {
                                this._sketchyCheck.set_active(false);
                            }
                        );
                    } else {
                        this._sketchyCheck.set_active(false);
                    }

                    if (this._nsfwCheckSignalId) {
                        withSignalBlocked(
                            this._nsfwCheck,
                            this._nsfwCheckSignalId,
                            () => {
                                this._nsfwCheck.set_active(false);
                            }
                        );
                    } else {
                        this._nsfwCheck.set_active(false);
                    }
                }
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

            if (!this._sfwCheck || !this._sketchyCheck || !this._nsfwCheck) {
                return;
            }

            const normalizedPurity = this._normalizePurity(
                this._searchParams.purity,
                this._hasApiKey
            );

            this._searchParams.purity = normalizedPurity;

            withSignalBlocked(this._sfwCheck, this._sfwCheckSignalId, () => {
                this._sfwCheck.set_active(normalizedPurity[0] === '1');
            });

            withSignalBlocked(
                this._sketchyCheck,
                this._sketchyCheckSignalId,
                () => {
                    this._sketchyCheck.set_active(normalizedPurity[1] === '1');
                }
            );

            withSignalBlocked(this._nsfwCheck, this._nsfwCheckSignalId, () => {
                const allowNsfw =
                    normalizedPurity[2] === '1' &&
                    this._hasApiKey &&
                    this._purityControlsEnabled;

                this._nsfwCheck.set_sensitive(
                    this._hasApiKey && this._purityControlsEnabled
                );
                this._nsfwCheck.set_active(allowNsfw);
            });
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

            const puritySwitchRow = new Adw.SwitchRow({
                title: 'Show purity filters',
                subtitle:
                    'Enable SFW/Sketchy/NSFW controls in the wallpaper browser',
                active: currentPurityControlsEnabled,
            });
            apiGroup.add(puritySwitchRow);

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

        /**
         * Getter for widget instance (for compatibility)
         * @returns {WallpaperBrowser} This widget instance
         */
        get widget() {
            return this;
        }
    }
);
