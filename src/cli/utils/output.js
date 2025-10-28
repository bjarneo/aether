/**
 * Output utilities for CLI messages
 */
export class Output {
    /**
     * Prints a message directly to stdout
     */
    static print(message) {
        print(message);
    }

    /**
     * Prints an error message
     */
    static error(message) {
        print(`Error: ${message}`);
    }

    /**
     * Prints a success message
     */
    static success(message) {
        print(message);
    }

    /**
     * Prints a warning message
     */
    static warning(message) {
        print(`Warning: ${message}`);
    }
}
