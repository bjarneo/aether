import {Output} from '../utils/output.js';

/**
 * Command handler for displaying help
 */
export class HelpCommand {
    /**
     * Executes the help command
     */
    execute() {
        const helpText = `
Aether - Create Omarchy themes the easy way

Usage:
  aether [OPTIONS]
  aether blue-prints
  aether apply-blue-print <name>
  aether menu
  aether install-menu

Options:
  -h, --help                    Show this help message

Commands:
  blue-prints                   List all saved blueprint themes
  apply-blue-print <name>       Apply a blueprint by name
  menu                          Interactive menu to select and apply a blueprint
  install-menu                  Install keyboard shortcut (SUPER+ALT+CTRL+space) in Hyprland bindings

Examples:
  aether                        # Open the GUI application
  aether blue-prints            # List all saved blueprints
  aether apply-blue-print nord  # Apply the "nord" blueprint
  aether menu                   # Show interactive menu to select a blueprint
  aether install-menu           # Install keyboard shortcut in Hyprland
`;

        Output.print(helpText);
    }
}

