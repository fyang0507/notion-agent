/**
 * Local filesystem implementation of AgentFS
 * Used in local development environment
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AgentFS, DirEntry } from './types';

const BASE_PATH = path.join(process.cwd(), 'AGENT_WORKING_FOLDER');

function resolvePath(relativePath: string): string {
  return path.join(BASE_PATH, relativePath);
}

export const localFS: AgentFS = {
  async exists(relativePath: string): Promise<boolean> {
    return fs.existsSync(resolvePath(relativePath));
  },

  async readFile(relativePath: string): Promise<string | null> {
    const fullPath = resolvePath(relativePath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    return fs.readFileSync(fullPath, 'utf-8');
  },

  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = resolvePath(relativePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content);
  },

  async readDir(relativePath: string): Promise<DirEntry[]> {
    const fullPath = resolvePath(relativePath);
    if (!fs.existsSync(fullPath)) {
      return [];
    }

    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }));
  },

  async mkdir(relativePath: string): Promise<void> {
    const fullPath = resolvePath(relativePath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  },

  async remove(relativePath: string): Promise<void> {
    const fullPath = resolvePath(relativePath);
    if (!fs.existsSync(fullPath)) {
      return;
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true });
    } else {
      fs.unlinkSync(fullPath);
    }
  },
};
