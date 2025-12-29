export type CommandHandler = (args: string) => string;

/**
 * Strip surrounding quotes from a string (like bash does)
 */
function stripQuotes(str: string): string {
  const trimmed = str.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Create a command executor that routes commands to registered handlers.
 *
 * Commands are matched by prefix, e.g., "skill list" matches handler registered as "skill list".
 * The remaining string after the command prefix is passed as args to the handler.
 * Quotes are stripped from arguments (like bash).
 */
export function createCommandExecutor(
  commands: Record<string, CommandHandler>
): (command: string) => string {
  // Sort commands by length (longest first) to match most specific command
  const sortedCommands = Object.keys(commands).sort((a, b) => b.length - a.length);

  return function executeCommand(input: string): string {
    const trimmed = input.trim();

    for (const cmd of sortedCommands) {
      if (trimmed === cmd || trimmed.startsWith(cmd + ' ')) {
        const args = stripQuotes(trimmed.slice(cmd.length).trim());
        return commands[cmd](args);
      }
    }

    const available = Object.keys(commands).join(', ');
    return `Error: Unknown command. Available commands: ${available}`;
  };
}
