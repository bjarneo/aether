import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {
    ensureDirectoryExists,
    loadJsonFile,
    saveJsonFile,
    fileExists,
    writeTextToFile,
    readFileAsText,
} from '../utils/file-utils.js';
import {blueprintService} from './BlueprintService.js';
import {ConfigWriter} from '../utils/ConfigWriter.js';
import {ColorMapper} from '../cli/utils/color-mapper.js';

/**
 * Service for managing theme schedules
 * Handles schedule storage, validation, and systemd service management
 *
 * @example
 * // Use singleton for stateless operations
 * import { schedulerService } from './services/SchedulerService.js';
 * const schedules = schedulerService.loadSchedules();
 */
export class SchedulerService {
    constructor() {
        this.configDir = GLib.build_filenamev([
            GLib.get_user_config_dir(),
            'aether',
        ]);
        this.schedulesPath = GLib.build_filenamev([
            this.configDir,
            'schedules.json',
        ]);
        this.systemdUserDir = GLib.build_filenamev([
            GLib.get_home_dir(),
            '.config',
            'systemd',
            'user',
        ]);

        ensureDirectoryExists(this.configDir);
        this.blueprintService = blueprintService;
    }

    /**
     * Load all schedules from disk
     * @returns {Array<Object>} Array of schedule objects
     */
    loadSchedules() {
        try {
            const data = loadJsonFile(this.schedulesPath);
            if (data && Array.isArray(data.schedules)) {
                return data.schedules;
            }
            return [];
        } catch (error) {
            console.log('No schedules found, returning empty array');
            return [];
        }
    }

    /**
     * Save schedules to disk
     * @param {Array<Object>} schedules - Array of schedule objects
     */
    saveSchedules(schedules) {
        const data = {
            schedules: schedules,
            version: 1,
            lastModified: Date.now(),
        };
        saveJsonFile(this.schedulesPath, data);
    }

    /**
     * Add a new schedule
     * @param {Object} schedule - Schedule to add
     * @param {string} schedule.blueprintName - Name of the blueprint to apply
     * @param {string} schedule.time - Time in HH:MM format
     * @param {boolean} schedule.enabled - Whether schedule is active
     * @param {Array<number>} [schedule.days] - Days of week (0=Sun, 6=Sat), empty = every day
     * @returns {Object} The created schedule with generated ID
     */
    addSchedule(schedule) {
        const schedules = this.loadSchedules();

        const newSchedule = {
            id: this._generateId(),
            blueprintName: schedule.blueprintName,
            time: schedule.time,
            enabled: schedule.enabled !== false,
            days: schedule.days || [], // Empty array = every day
            createdAt: Date.now(),
        };

        schedules.push(newSchedule);
        this.saveSchedules(schedules);
        this._regenerateSystemdTimers();

        return newSchedule;
    }

    /**
     * Update an existing schedule
     * @param {string} id - Schedule ID
     * @param {Object} updates - Properties to update
     * @returns {Object|null} Updated schedule or null if not found
     */
    updateSchedule(id, updates) {
        const schedules = this.loadSchedules();
        const index = schedules.findIndex(s => s.id === id);

        if (index === -1) {
            return null;
        }

        schedules[index] = {
            ...schedules[index],
            ...updates,
            modifiedAt: Date.now(),
        };

        this.saveSchedules(schedules);
        this._regenerateSystemdTimers();

        return schedules[index];
    }

    /**
     * Delete a schedule
     * @param {string} id - Schedule ID
     * @returns {boolean} True if deleted, false if not found
     */
    deleteSchedule(id) {
        const schedules = this.loadSchedules();
        const index = schedules.findIndex(s => s.id === id);

        if (index === -1) {
            return false;
        }

        schedules.splice(index, 1);
        this.saveSchedules(schedules);
        this._regenerateSystemdTimers();

        return true;
    }

    /**
     * Toggle schedule enabled state
     * @param {string} id - Schedule ID
     * @returns {Object|null} Updated schedule or null if not found
     */
    toggleSchedule(id) {
        const schedules = this.loadSchedules();
        const schedule = schedules.find(s => s.id === id);

        if (!schedule) {
            return null;
        }

        return this.updateSchedule(id, {enabled: !schedule.enabled});
    }

    /**
     * Get all available blueprints for scheduling
     * @returns {Array<Object>} Array of blueprint objects
     */
    getAvailableBlueprints() {
        return this.blueprintService.loadAll();
    }

    /**
     * Check if the scheduler daemon is enabled/running
     * @returns {Object} Status object with enabled and active properties
     */
    getSchedulerStatus() {
        try {
            // Check if the timer is enabled
            const [enabledSuccess, enabledStdout] =
                GLib.spawn_command_line_sync(
                    'systemctl --user is-enabled aether-scheduler.timer'
                );
            const enabled =
                enabledStdout &&
                new TextDecoder().decode(enabledStdout).trim() === 'enabled';

            // Check if the timer is active
            const [activeSuccess, activeStdout] = GLib.spawn_command_line_sync(
                'systemctl --user is-active aether-scheduler.timer'
            );
            const active =
                activeStdout &&
                new TextDecoder().decode(activeStdout).trim() === 'active';

            return {enabled, active};
        } catch (error) {
            return {enabled: false, active: false};
        }
    }

    /**
     * Enable the scheduler daemon (starts on boot and now)
     * @returns {boolean} Success status
     */
    enableScheduler() {
        try {
            this._installSystemdUnits();

            // Reload systemd user daemon
            GLib.spawn_command_line_sync('systemctl --user daemon-reload');

            // Enable and start the timer
            GLib.spawn_command_line_sync(
                'systemctl --user enable --now aether-scheduler.timer'
            );

            console.log('Scheduler enabled and started');
            return true;
        } catch (error) {
            console.error('Failed to enable scheduler:', error.message);
            return false;
        }
    }

    /**
     * Disable the scheduler daemon
     * @returns {boolean} Success status
     */
    disableScheduler() {
        try {
            GLib.spawn_command_line_sync(
                'systemctl --user disable --now aether-scheduler.timer'
            );
            console.log('Scheduler disabled');
            return true;
        } catch (error) {
            console.error('Failed to disable scheduler:', error.message);
            return false;
        }
    }

    /**
     * Run the scheduler check manually (called by systemd or CLI)
     * Checks all enabled schedules and applies matching themes
     * @returns {Object} Result with applied blueprint name or null
     */
    runScheduleCheck() {
        const schedules = this.loadSchedules();
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

        const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

        print(
            `[Scheduler] Checking schedules at ${currentTimeStr} (day ${currentDay})`
        );
        print(`[Scheduler] Found ${schedules.length} schedule(s)`);

        for (const schedule of schedules) {
            if (!schedule.enabled) {
                print(
                    `[Scheduler] Skipping disabled: ${schedule.blueprintName}`
                );
                continue;
            }

            // Check if current day matches (empty days = every day)
            if (schedule.days && schedule.days.length > 0) {
                if (!schedule.days.includes(currentDay)) {
                    print(
                        `[Scheduler] Day mismatch for ${schedule.blueprintName}: need ${schedule.days}, got ${currentDay}`
                    );
                    continue;
                }
            }

            print(
                `[Scheduler] Checking ${schedule.blueprintName}: scheduled ${schedule.time}, current ${currentTimeStr}`
            );

            // Check if time matches (exact match to the minute)
            if (schedule.time === currentTimeStr) {
                print(
                    `[Scheduler] ✓ Time match! Applying ${schedule.blueprintName}`
                );

                // Apply the blueprint directly (not via subprocess)
                try {
                    const result = this._applyBlueprintDirectly(
                        schedule.blueprintName
                    );
                    if (result) {
                        print(
                            `[Scheduler] ✓ Applied blueprint: ${schedule.blueprintName}`
                        );
                        return {
                            applied: true,
                            blueprintName: schedule.blueprintName,
                        };
                    } else {
                        print(
                            `[Scheduler] ✗ Failed to apply blueprint: ${schedule.blueprintName}`
                        );
                    }
                } catch (error) {
                    print(
                        `[Scheduler] ✗ Error applying blueprint: ${error.message}`
                    );
                }
            }
        }

        return {applied: false, blueprintName: null};
    }

    /**
     * Apply a blueprint directly without spawning a subprocess
     * @param {string} blueprintName - Name of the blueprint to apply
     * @returns {boolean} True if successful
     * @private
     */
    _applyBlueprintDirectly(blueprintName) {
        const blueprint = this.blueprintService.findByName(blueprintName);

        if (!blueprint) {
            print(`[Scheduler] Blueprint not found: ${blueprintName}`);
            return false;
        }

        if (!this.blueprintService.validateBlueprint(blueprint)) {
            print(`[Scheduler] Invalid blueprint structure: ${blueprintName}`);
            return false;
        }

        const palette = blueprint.palette;
        const colorRoles = ColorMapper.mapColorsToRoles(palette.colors);
        const settings = blueprint.settings || {};
        const lightMode = palette.lightMode || settings.lightMode || false;
        const appOverrides = palette.appOverrides || {};

        const configWriter = new ConfigWriter();
        configWriter.applyTheme({
            colorRoles,
            wallpaperPath: palette.wallpaper,
            settings,
            lightMode,
            appOverrides,
            additionalImages: [],
            sync: true,
        });

        return true;
    }

    /**
     * Generate a unique ID for a schedule
     * @returns {string} Unique ID
     * @private
     */
    _generateId() {
        return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Install systemd user units for the scheduler
     * @private
     */
    _installSystemdUnits() {
        ensureDirectoryExists(this.systemdUserDir);

        // Get the path to the aether executable
        const aetherPath = this._getAetherPath();

        // Get current environment values for Wayland
        const waylandDisplay = GLib.getenv('WAYLAND_DISPLAY') || 'wayland-1';
        const xdgRuntimeDir =
            GLib.getenv('XDG_RUNTIME_DIR') ||
            `/run/user/${GLib.getenv('UID') || '1000'}`;
        const hyprlandInstance =
            GLib.getenv('HYPRLAND_INSTANCE_SIGNATURE') || '';

        // Create the service unit with proper Wayland environment
        const serviceContent = `[Unit]
Description=Aether Theme Scheduler
Documentation=https://github.com/bjarneo/aether
After=graphical-session.target

[Service]
Type=oneshot
ExecStart=${aetherPath} --check-schedule
Environment=DISPLAY=:0
Environment=WAYLAND_DISPLAY=${waylandDisplay}
Environment=XDG_RUNTIME_DIR=${xdgRuntimeDir}
Environment=XDG_SESSION_TYPE=wayland
Environment=XDG_CURRENT_DESKTOP=Hyprland
${hyprlandInstance ? `Environment=HYPRLAND_INSTANCE_SIGNATURE=${hyprlandInstance}` : ''}

[Install]
WantedBy=default.target
`;

        const servicePath = GLib.build_filenamev([
            this.systemdUserDir,
            'aether-scheduler.service',
        ]);
        writeTextToFile(servicePath, serviceContent);

        // Create the timer unit (runs every minute)
        const timerContent = `[Unit]
Description=Aether Theme Scheduler Timer
Documentation=https://github.com/bjarneo/aether

[Timer]
OnCalendar=*:*:00
Persistent=true
Unit=aether-scheduler.service

[Install]
WantedBy=timers.target
`;

        const timerPath = GLib.build_filenamev([
            this.systemdUserDir,
            'aether-scheduler.timer',
        ]);
        writeTextToFile(timerPath, timerContent);

        console.log('Installed systemd units for scheduler');
    }

    /**
     * Regenerate systemd timers based on enabled schedules
     * @private
     */
    _regenerateSystemdTimers() {
        const status = this.getSchedulerStatus();
        if (status.enabled) {
            // Reload to pick up any changes
            try {
                GLib.spawn_command_line_sync('systemctl --user daemon-reload');
            } catch (error) {
                console.error('Failed to reload systemd:', error.message);
            }
        }
    }

    /**
     * Get the path to the aether executable
     * @returns {string} Path to aether
     * @private
     */
    _getAetherPath() {
        // Try common locations
        const possiblePaths = [
            '/usr/local/bin/aether',
            '/usr/bin/aether',
            GLib.build_filenamev([
                GLib.get_home_dir(),
                '.local',
                'bin',
                'aether',
            ]),
        ];

        for (const path of possiblePaths) {
            if (fileExists(path)) {
                return path;
            }
        }

        // Fall back to hoping it's in PATH
        return 'aether';
    }

    /**
     * Get next scheduled theme change
     * @returns {Object|null} Next schedule or null if none
     */
    getNextScheduledChange() {
        const schedules = this.loadSchedules().filter(s => s.enabled);
        if (schedules.length === 0) return null;

        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const currentDay = now.getDay();

        let nextSchedule = null;
        let minMinutesUntil = Infinity;

        for (const schedule of schedules) {
            const [hours, minutes] = schedule.time.split(':').map(Number);
            const scheduleMinutes = hours * 60 + minutes;

            // Check each day (or just today if no days specified)
            const daysToCheck =
                schedule.days && schedule.days.length > 0
                    ? schedule.days
                    : [0, 1, 2, 3, 4, 5, 6];

            for (const day of daysToCheck) {
                let daysUntil = day - currentDay;
                if (daysUntil < 0) daysUntil += 7;

                let minutesUntil =
                    daysUntil * 24 * 60 + (scheduleMinutes - currentMinutes);

                // If it's today but already passed, add a week
                if (
                    minutesUntil <= 0 &&
                    schedule.days &&
                    schedule.days.length > 0
                ) {
                    minutesUntil += 7 * 24 * 60;
                } else if (
                    minutesUntil < 0 &&
                    (!schedule.days || schedule.days.length === 0)
                ) {
                    minutesUntil += 24 * 60; // Add a day for daily schedules
                }

                if (minutesUntil > 0 && minutesUntil < minMinutesUntil) {
                    minMinutesUntil = minutesUntil;
                    nextSchedule = {
                        ...schedule,
                        minutesUntil,
                    };
                }
            }
        }

        return nextSchedule;
    }
}

/**
 * Singleton instance for CLI/stateless operations
 */
export const schedulerService = new SchedulerService();
