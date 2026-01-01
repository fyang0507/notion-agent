/**
 * Agent Filesystem Abstraction
 *
 * Environment-aware file operations for AGENT_WORKING_FOLDER:
 * - Local development: Direct filesystem access
 * - Vercel deployment: GitHub API (read/write to vercel-agent-commit branch)
 */

export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

export interface AgentFS {
  /**
   * Check if a file or directory exists
   * @param relativePath - Path relative to AGENT_WORKING_FOLDER
   */
  exists(relativePath: string): Promise<boolean>;

  /**
   * Read file content
   * @param relativePath - Path relative to AGENT_WORKING_FOLDER
   * @returns File content as string, or null if not found
   */
  readFile(relativePath: string): Promise<string | null>;

  /**
   * Write file content (creates parent directories if needed)
   * @param relativePath - Path relative to AGENT_WORKING_FOLDER
   * @param content - Content to write
   */
  writeFile(relativePath: string, content: string): Promise<void>;

  /**
   * List directory entries
   * @param relativePath - Path relative to AGENT_WORKING_FOLDER
   * @returns Array of directory entries, or empty array if not found
   */
  readDir(relativePath: string): Promise<DirEntry[]>;

  /**
   * Create directory (recursive)
   * @param relativePath - Path relative to AGENT_WORKING_FOLDER
   */
  mkdir(relativePath: string): Promise<void>;

  /**
   * Remove file or directory
   * @param relativePath - Path relative to AGENT_WORKING_FOLDER
   */
  remove(relativePath: string): Promise<void>;
}
