/**
 * WallpaperFiltersPanel.js - Collapsible filters panel for WallpaperBrowser
 *
 * Contains:
 * - Sort dropdown (Latest, Relevance, Random, Views, Favorites, Top List)
 * - Category checkboxes (General, Anime, People)
 * - Purity checkboxes (SFW, Sketchy, NSFW)
 *
 * Emits signals when filters change so parent can perform search.
 *
 * @module WallpaperFiltersPanel
 */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

import {showToast, withSignalBlocked} from '../../utils/ui-helpers.js';
import {SPACING} from '../../constants/ui-constants.js';

/**
 * Sort method options for the dropdown
 * @type {Array<{label: string, value: string}>}
 */
const SORT_OPTIONS = [
    {label: 'Latest', value: 'date_added'},
    {label: 'Relevance', value: 'relevance'},
    {label: 'Random', value: 'random'},
    {label: 'Views', value: 'views'},
    {label: 'Favorites', value: 'favorites'},
    {label: 'Top List', value: 'toplist'},
];

/**
 * WallpaperFiltersPanel - Collapsible panel with filter controls
 *
 * @fires filters-changed - When any filter value changes
 */
export const WallpaperFiltersPanel = GObject.registerClass(
    {
        Signals: {
            'filters-changed': {
                param_types: [GObject.TYPE_JSOBJECT],
            },
        },
    },
    class WallpaperFiltersPanel extends Gtk.Revealer {
        /**
         * Initialize the filters panel
         * @param {Object} options - Configuration options
         * @param {boolean} [options.hasApiKey=false] - Whether user has API key (enables NSFW)
         * @param {boolean} [options.purityControlsEnabled=false] - Whether to show purity controls
         * @param {Object} [options.initialFilters={}] - Initial filter values
         */
        _init(options = {}) {
            super._init({
                transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
                reveal_child: false,
            });

            this._hasApiKey = options.hasApiKey ?? false;
            this._purityControlsEnabled = options.purityControlsEnabled ?? false;
            this._initialFilters = options.initialFilters ?? {};

            // Signal IDs for blocking during programmatic updates
            this._signalIds = {};

            this._buildUI();
            this._applyInitialFilters();
        }

        /**
         * Build the filters panel UI
         * @private
         */
        _buildUI() {
            const filtersBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: SPACING.MD,
                margin_top: SPACING.SM,
                margin_bottom: SPACING.SM,
                margin_start: SPACING.MD,
                margin_end: SPACING.MD,
            });

            filtersBox.append(this._createSortDropdown());
            filtersBox.append(
                new Gtk.Separator({orientation: Gtk.Orientation.VERTICAL})
            );
            filtersBox.append(this._createCategoriesCheckboxes());

            this._puritySeparator = new Gtk.Separator({
                orientation: Gtk.Orientation.VERTICAL,
            });
            this._puritySeparator.set_visible(this._purityControlsEnabled);
            filtersBox.append(this._puritySeparator);

            filtersBox.append(this._createPurityControls());

            this.set_child(filtersBox);
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
            SORT_OPTIONS.forEach(option => {
                sortModel.append(option.label);
            });

            this._signalIds.sort = this._sortDropdown.connect(
                'notify::selected',
                () => {
                    const selectedIndex = this._sortDropdown.get_selected();
                    this._emitFiltersChanged({
                        sorting: SORT_OPTIONS[selectedIndex].value,
                    });
                }
            );

            sortBox.append(sortLabel);
            sortBox.append(this._sortDropdown);

            return sortBox;
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
                spacing: SPACING.SM,
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
                const categories = [
                    this._generalCheck.get_active() ? '1' : '0',
                    this._animeCheck.get_active() ? '1' : '0',
                    this._peopleCheck.get_active() ? '1' : '0',
                ].join('');
                this._emitFiltersChanged({categories});
            };

            this._signalIds.general = this._generalCheck.connect(
                'toggled',
                updateCategories
            );
            this._signalIds.anime = this._animeCheck.connect(
                'toggled',
                updateCategories
            );
            this._signalIds.people = this._peopleCheck.connect(
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
                spacing: SPACING.SM,
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

                this._emitFiltersChanged({purity});
            };

            this._signalIds.sfw = this._sfwCheck.connect('toggled', updatePurity);
            this._signalIds.sketchy = this._sketchyCheck.connect(
                'toggled',
                updatePurity
            );
            this._signalIds.nsfw = this._nsfwCheck.connect('toggled', () => {
                const isActive = this._nsfwCheck.get_active();

                if (isActive && !this._hasApiKey) {
                    showToast(
                        this,
                        'NSFW requires a valid Wallhaven API key',
                        3
                    );

                    withSignalBlocked(
                        this._nsfwCheck,
                        this._signalIds.nsfw,
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
         * Apply initial filter values without emitting signals
         * @private
         */
        _applyInitialFilters() {
            const filters = this._initialFilters;

            // Sort
            if (filters.sorting) {
                const sortIndex = SORT_OPTIONS.findIndex(
                    o => o.value === filters.sorting
                );
                if (sortIndex >= 0) {
                    withSignalBlocked(
                        this._sortDropdown,
                        this._signalIds.sort,
                        () => {
                            this._sortDropdown.set_selected(sortIndex);
                        }
                    );
                }
            }

            // Categories
            if (filters.categories) {
                const cats = filters.categories;
                withSignalBlocked(
                    this._generalCheck,
                    this._signalIds.general,
                    () => {
                        this._generalCheck.set_active(cats[0] === '1');
                    }
                );
                withSignalBlocked(this._animeCheck, this._signalIds.anime, () => {
                    this._animeCheck.set_active(cats[1] === '1');
                });
                withSignalBlocked(
                    this._peopleCheck,
                    this._signalIds.people,
                    () => {
                        this._peopleCheck.set_active(cats[2] === '1');
                    }
                );
            }

            // Purity
            if (filters.purity) {
                const purity = filters.purity;
                withSignalBlocked(this._sfwCheck, this._signalIds.sfw, () => {
                    this._sfwCheck.set_active(purity[0] === '1');
                });
                withSignalBlocked(
                    this._sketchyCheck,
                    this._signalIds.sketchy,
                    () => {
                        this._sketchyCheck.set_active(purity[1] === '1');
                    }
                );
                withSignalBlocked(this._nsfwCheck, this._signalIds.nsfw, () => {
                    this._nsfwCheck.set_active(purity[2] === '1');
                });
            }
        }

        /**
         * Emit filters-changed signal with updated values
         * @param {Object} changedFilters - The filters that changed
         * @private
         */
        _emitFiltersChanged(changedFilters) {
            this.emit('filters-changed', changedFilters);
        }

        /**
         * Update filter values programmatically (without emitting signals)
         * @param {Object} filters - Filter values to set
         */
        setFilters(filters) {
            this._initialFilters = filters;
            this._applyInitialFilters();
        }

        /**
         * Get current filter values
         * @returns {Object} Current filter state
         */
        getFilters() {
            const selectedIndex = this._sortDropdown.get_selected();
            return {
                sorting: SORT_OPTIONS[selectedIndex].value,
                categories: [
                    this._generalCheck.get_active() ? '1' : '0',
                    this._animeCheck.get_active() ? '1' : '0',
                    this._peopleCheck.get_active() ? '1' : '0',
                ].join(''),
                purity: [
                    this._sfwCheck.get_active() ? '1' : '0',
                    this._sketchyCheck.get_active() ? '1' : '0',
                    this._nsfwCheck.get_active() ? '1' : '0',
                ].join(''),
            };
        }

        /**
         * Set whether purity controls are enabled/visible
         * @param {boolean} enabled - Whether purity controls are enabled
         */
        setPurityControlsEnabled(enabled) {
            this._purityControlsEnabled = enabled;
            this._purityBox.set_visible(enabled);
            this._puritySeparator.set_visible(enabled);
        }

        /**
         * Set whether user has API key (affects NSFW checkbox sensitivity)
         * @param {boolean} hasKey - Whether user has API key
         */
        setHasApiKey(hasKey) {
            this._hasApiKey = hasKey;
            this._nsfwCheck.set_sensitive(hasKey);
        }

        /**
         * Toggle the panel visibility
         * @param {boolean} visible - Whether to show the panel
         */
        toggle(visible) {
            this.set_reveal_child(visible);
        }
    }
);

export default WallpaperFiltersPanel;
