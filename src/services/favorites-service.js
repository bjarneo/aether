import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

/**
 * FavoritesService - Manages wallpaper favorites with efficient storage and lookup
 * Uses the old JSON string format for backward compatibility
 */
export const FavoritesService = GObject.registerClass(
    {
        Signals: {
            'changed': {},
        },
    },
    class FavoritesService extends GObject.Object {
        _init() {
            super._init();
            
            this._favorites = new Set(); // Set of JSON strings
            this._pathIndex = new Map(); // path -> JSON string (for fast lookup)
            this._configPath = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
                'favorites.json',
            ]);
            
            this._loadFavorites();
        }

        _loadFavorites() {
            try {
                const file = Gio.File.new_for_path(this._configPath);
                
                if (!file.query_exists(null)) {
                    return;
                }

                const [success, contents] = file.load_contents(null);
                if (!success) {
                    return;
                }

                const decoder = new TextDecoder('utf-8');
                const text = decoder.decode(contents);
                const favArray = JSON.parse(text);
                
                // Process favorites and build index
                favArray.forEach(fav => {
                    if (typeof fav === 'string') {
                        // Old format: already JSON string
                        this._addToIndex(fav);
                    } else {
                        // New format: convert object to JSON string
                        const jsonStr = this._objectToJsonString(fav);
                        this._addToIndex(jsonStr);
                    }
                });
            } catch (e) {
                console.error('Failed to load favorites:', e.message);
            }
        }

        _addToIndex(jsonStr) {
            try {
                const obj = JSON.parse(jsonStr);
                if (obj.path) {
                    this._favorites.add(jsonStr);
                    this._pathIndex.set(obj.path, jsonStr);
                }
            } catch (e) {
                console.error('Failed to index favorite:', e.message);
            }
        }

        _objectToJsonString(obj) {
            // Convert object to old JSON string format
            if (obj.type === 'wallhaven') {
                return JSON.stringify({
                    id: obj.data?.id,
                    path: obj.path,
                    thumbs: { small: obj.data?.thumbUrl },
                    resolution: obj.data?.resolution,
                    file_size: obj.data?.file_size,
                });
            } else if (obj.type === 'local') {
                return JSON.stringify({
                    path: obj.path,
                    name: obj.data?.name || GLib.path_get_basename(obj.path),
                });
            }
            return JSON.stringify({ path: obj.path });
        }

        _saveFavorites() {
            try {
                const configDir = GLib.path_get_dirname(this._configPath);
                GLib.mkdir_with_parents(configDir, 0o755);

                const favArray = Array.from(this._favorites);
                const content = JSON.stringify(favArray, null, 2);

                const file = Gio.File.new_for_path(this._configPath);
                file.replace_contents(
                    content,
                    null,
                    false,
                    Gio.FileCreateFlags.REPLACE_DESTINATION,
                    null
                );

                this.emit('changed');
            } catch (e) {
                console.error('Failed to save favorites:', e.message);
            }
        }

        isFavorite(path) {
            return this._pathIndex.has(path);
        }

        addFavorite(path, type, data = {}) {
            if (this.isFavorite(path)) {
                return false;
            }

            const obj = { path, type, data };
            const jsonStr = this._objectToJsonString(obj);
            
            this._favorites.add(jsonStr);
            this._pathIndex.set(path, jsonStr);
            this._saveFavorites();
            
            return true;
        }

        removeFavorite(path) {
            const jsonStr = this._pathIndex.get(path);
            if (!jsonStr) {
                return false;
            }

            this._favorites.delete(jsonStr);
            this._pathIndex.delete(path);
            this._saveFavorites();
            
            return true;
        }

        toggleFavorite(path, type, data = {}) {
            if (this.isFavorite(path)) {
                this.removeFavorite(path);
                return false;
            } else {
                this.addFavorite(path, type, data);
                return true;
            }
        }

        getFavorites() {
            const favorites = [];
            
            for (const jsonStr of this._favorites) {
                try {
                    const obj = JSON.parse(jsonStr);
                    
                    // Determine type and convert to standard format
                    if (obj.id && obj.thumbs) {
                        // Wallhaven format
                        favorites.push({
                            path: obj.path,
                            type: 'wallhaven',
                            data: {
                                id: obj.id,
                                resolution: obj.resolution,
                                file_size: obj.file_size,
                                thumbUrl: obj.thumbs?.small,
                            },
                        });
                    } else if (obj.name) {
                        // Local format
                        favorites.push({
                            path: obj.path,
                            type: 'local',
                            data: {
                                name: obj.name,
                            },
                        });
                    }
                } catch (e) {
                    console.error('Failed to parse favorite:', e.message);
                }
            }
            
            return favorites;
        }

        getCount() {
            return this._favorites.size;
        }

        clear() {
            this._favorites.clear();
            this._pathIndex.clear();
            this._saveFavorites();
        }
    }
);

export const favoritesService = new FavoritesService();
