import GLib from 'gi://GLib';

/**
 * SignalTracker - Utility for tracking and cleaning up GObject signal connections
 *
 * Prevents memory leaks by tracking all signal connections and providing
 * a single cleanup method to disconnect them all.
 *
 * Usage:
 * ```javascript
 * class MyComponent extends Gtk.Box {
 *     _init() {
 *         super._init();
 *         this._signals = new SignalTracker();
 *
 *         // Track signal connections
 *         this._signals.track(someObject, 'notify::property', () => { ... });
 *         this._signals.track(themeState, 'colors-changed', () => { ... });
 *
 *         // Track timeout sources
 *         this._signals.trackTimeout(GLib.timeout_add(...));
 *     }
 *
 *     // Call in vfunc_unroot or destroy handler
 *     _cleanup() {
 *         this._signals.disconnectAll();
 *     }
 * }
 * ```
 *
 * @class SignalTracker
 */
export class SignalTracker {
    constructor() {
        /** @type {Array<{object: GObject.Object, handlerId: number}>} */
        this._connections = [];
        /** @type {Array<number>} */
        this._timeoutIds = [];
        /** @type {Array<number>} */
        this._idleIds = [];
    }

    /**
     * Connects a signal and tracks it for later cleanup
     * @param {GObject.Object} object - The object to connect to
     * @param {string} signal - The signal name
     * @param {Function} callback - The callback function
     * @returns {number} The handler ID
     */
    track(object, signal, callback) {
        const handlerId = object.connect(signal, callback);
        this._connections.push({object, handlerId});
        return handlerId;
    }

    /**
     * Tracks a GLib.timeout_add source for later cleanup
     * @param {number} sourceId - The source ID from GLib.timeout_add
     * @returns {number} The same source ID
     */
    trackTimeout(sourceId) {
        this._timeoutIds.push(sourceId);
        return sourceId;
    }

    /**
     * Tracks a GLib.idle_add source for later cleanup
     * @param {number} sourceId - The source ID from GLib.idle_add
     * @returns {number} The same source ID
     */
    trackIdle(sourceId) {
        this._idleIds.push(sourceId);
        return sourceId;
    }

    /**
     * Disconnects a specific signal by handler ID
     * @param {GObject.Object} object - The object the signal is connected to
     * @param {number} handlerId - The handler ID to disconnect
     */
    disconnect(object, handlerId) {
        const index = this._connections.findIndex(
            c => c.object === object && c.handlerId === handlerId
        );
        if (index === -1) return;

        try {
            object.disconnect(handlerId);
        } catch (_) {}
        this._connections.splice(index, 1);
    }

    /**
     * Removes a timeout source
     * @param {number} sourceId - The source ID to remove
     */
    removeTimeout(sourceId) {
        const index = this._timeoutIds.indexOf(sourceId);
        if (index !== -1) {
            GLib.Source.remove(sourceId);
            this._timeoutIds.splice(index, 1);
        }
    }

    /**
     * Disconnects all tracked signals and removes all sources
     * Call this in the widget's cleanup/destroy handler
     */
    disconnectAll() {
        for (const {object, handlerId} of this._connections) {
            try {
                object.disconnect(handlerId);
            } catch (_) {}
        }
        this._connections = [];

        for (const sourceId of [...this._timeoutIds, ...this._idleIds]) {
            try {
                GLib.Source.remove(sourceId);
            } catch (_) {}
        }
        this._timeoutIds = [];
        this._idleIds = [];
    }

    /**
     * Returns the number of tracked connections
     * @returns {number}
     */
    get connectionCount() {
        return this._connections.length;
    }

    /**
     * Returns the number of tracked timeout sources
     * @returns {number}
     */
    get timeoutCount() {
        return this._timeoutIds.length;
    }
}
