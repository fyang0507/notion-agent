/**
 * GitHub API implementation of AgentFS
 * Used in Vercel deployment - reads/writes to vercel-agent-commit branch
 */

import { Octokit } from 'octokit';
import type { AgentFS, DirEntry } from './types';

const BRANCH_NAME = 'vercel-agent-commit';
const BASE_PATH = 'AGENT_WORKING_FOLDER';

function getConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    throw new Error('GitHub credentials not configured (GITHUB_TOKEN, GITHUB_REPO)');
  }

  const [owner, repoName] = repo.split('/');
  if (!owner || repoName === undefined) {
    throw new Error(`Invalid GITHUB_REPO format: ${repo}. Expected "owner/repo"`);
  }

  return { token, owner, repo: repoName };
}

function resolvePath(relativePath: string): string {
  // Normalize path: remove leading/trailing slashes, handle empty path
  const normalized = relativePath.replace(/^\/+|\/+$/g, '');
  return normalized ? `${BASE_PATH}/${normalized}` : BASE_PATH;
}

async function ensureBranchExists(octokit: Octokit, owner: string, repo: string): Promise<void> {
  try {
    await octokit.rest.repos.getBranch({ owner, repo, branch: BRANCH_NAME });
    return;
  } catch {
    // Branch doesn't exist, create it
  }

  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const { data: baseBranch } = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch: repoData.default_branch,
  });

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${BRANCH_NAME}`,
    sha: baseBranch.commit.sha,
  });

  console.log(`[AgentFS/GitHub] Created branch ${BRANCH_NAME}`);
}

export const githubFS: AgentFS = {
  async exists(relativePath: string): Promise<boolean> {
    const { token, owner, repo } = getConfig();
    const octokit = new Octokit({ auth: token });
    const path = resolvePath(relativePath);

    try {
      await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: BRANCH_NAME,
      });
      return true;
    } catch {
      return false;
    }
  },

  async readFile(relativePath: string): Promise<string | null> {
    const { token, owner, repo } = getConfig();
    const octokit = new Octokit({ auth: token });
    const path = resolvePath(relativePath);

    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: BRANCH_NAME,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        return null;
      }

      // Content is base64 encoded
      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  },

  async writeFile(relativePath: string, content: string): Promise<void> {
    const { token, owner, repo } = getConfig();
    const octokit = new Octokit({ auth: token });
    const path = resolvePath(relativePath);

    await ensureBranchExists(octokit, owner, repo);

    // Get current file SHA if it exists (needed for updates)
    let fileSha: string | undefined;
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: BRANCH_NAME,
      });
      if (!Array.isArray(data) && data.type === 'file') {
        fileSha = data.sha;
      }
    } catch {
      // File doesn't exist yet
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `[agent] Update ${relativePath}`,
      content: Buffer.from(content).toString('base64'),
      branch: BRANCH_NAME,
      sha: fileSha,
    });

    console.log(`[AgentFS/GitHub] Wrote ${path}`);
  },

  async readDir(relativePath: string): Promise<DirEntry[]> {
    const { token, owner, repo } = getConfig();
    const octokit = new Octokit({ auth: token });
    const path = resolvePath(relativePath);

    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: BRANCH_NAME,
      });

      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((item) => ({
        name: item.name,
        isDirectory: item.type === 'dir',
      }));
    } catch {
      return [];
    }
  },

  async mkdir(relativePath: string): Promise<void> {
    // GitHub doesn't have empty directories - they're created implicitly when files are added
    // This is a no-op, but we ensure the branch exists
    const { token, owner, repo } = getConfig();
    const octokit = new Octokit({ auth: token });
    await ensureBranchExists(octokit, owner, repo);
  },

  async remove(relativePath: string): Promise<void> {
    const { token, owner, repo } = getConfig();
    const octokit = new Octokit({ auth: token });
    const path = resolvePath(relativePath);

    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: BRANCH_NAME,
      });

      if (Array.isArray(data)) {
        // It's a directory - delete all files recursively
        for (const item of data) {
          await githubFS.remove(`${relativePath}/${item.name}`);
        }
      } else if (data.type === 'file') {
        // It's a file - delete it
        await octokit.rest.repos.deleteFile({
          owner,
          repo,
          path,
          message: `[agent] Delete ${relativePath}`,
          sha: data.sha,
          branch: BRANCH_NAME,
        });
        console.log(`[AgentFS/GitHub] Deleted ${path}`);
      }
    } catch {
      // File/directory doesn't exist, nothing to delete
    }
  },
};
