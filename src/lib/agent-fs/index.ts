/**
 * Agent Filesystem - Environment-aware file operations
 *
 * Automatically selects the appropriate backend:
 * - Local development: Direct filesystem (localFS)
 * - Vercel deployment: GitHub API (githubFS)
 *
 * Detection logic:
 * - If VERCEL env var is set AND GITHUB_TOKEN is configured → use GitHub
 * - Otherwise → use local filesystem
 */

import { localFS } from './local';
import { githubFS } from './github';
import type { AgentFS } from './types';

export type { AgentFS, DirEntry } from './types';

function isVercelWithGitHub(): boolean {
  return !!(process.env.VERCEL && process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
}

/**
 * Get the appropriate AgentFS implementation for the current environment
 */
export function getAgentFS(): AgentFS {
  if (isVercelWithGitHub()) {
    console.log('[AgentFS] Using GitHub backend');
    return githubFS;
  }
  return localFS;
}

/**
 * Singleton instance - use this for most cases
 */
let _instance: AgentFS | null = null;

export function agentFS(): AgentFS {
  if (!_instance) {
    _instance = getAgentFS();
  }
  return _instance;
}

// Re-export individual implementations for testing
export { localFS } from './local';
export { githubFS } from './github';
