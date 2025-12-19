import {schedulerService} from '../../services/SchedulerService.js';

/**
 * Command handler for checking and executing scheduled theme changes
 * This is called by the systemd timer every minute
 */
export class CheckScheduleCommand {
    /**
     * Executes the schedule check
     * Finds any schedules matching the current time and applies them
     *
     * @returns {Promise<boolean>} True if a theme was applied, false otherwise
     */
    static async execute() {
        try {
            print('[Aether Scheduler] Running schedule check...');

            const result = schedulerService.runScheduleCheck();

            if (result.applied) {
                print(
                    `[Aether Scheduler] ✓ Applied theme: "${result.blueprintName}"`
                );
                return true;
            } else {
                print(
                    '[Aether Scheduler] No matching schedule for current time'
                );
                return false;
            }
        } catch (error) {
            printerr(`[Aether Scheduler] Error: ${error.message}`);
            if (error.stack) {
                printerr(error.stack);
            }
            return false;
        }
    }
}
