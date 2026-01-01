import { Octokit } from "octokit";
import * as path from "path";

const BRANCH_NAME = "vercel-agent-commit";

/**
 * Syncs a file to GitHub by committing it to the vercel-agent-commit branch.
 * Fire-and-forget: errors are logged but don't block execution.
 *
 * @param filePath - Absolute path to the file (will be converted to repo-relative path)
 * @param content - File content to commit
 */
export function syncFileToGitHub(filePath: string, content: string): void {
  // Fire-and-forget: don't await, just log errors
  syncFileToGitHubAsync(filePath, content).catch((error) => {
    console.error(`[GitHub Sync] Failed to sync ${filePath}:`, error);
  });
}

async function syncFileToGitHubAsync(
  filePath: string,
  content: string
): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  // Skip if credentials not configured
  if (!token || !repo) {
    return;
  }

  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    console.error(
      `[GitHub Sync] Invalid GITHUB_REPO format: ${repo}. Expected "owner/repo"`
    );
    return;
  }

  // Convert absolute path to repo-relative path
  const cwd = process.cwd();
  const relativePath = path.relative(cwd, filePath);

  const octokit = new Octokit({ auth: token });

  // Ensure branch exists (create from main if it doesn't)
  const branchSha = await ensureBranchExists(octokit, owner, repoName);
  if (!branchSha) {
    return;
  }

  // Get current file SHA if it exists (needed for updates)
  let fileSha: string | undefined;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo: repoName,
      path: relativePath,
      ref: BRANCH_NAME,
    });
    if (!Array.isArray(data) && data.type === "file") {
      fileSha = data.sha;
    }
  } catch {
    // File doesn't exist yet, that's fine
  }

  // Create or update file
  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo: repoName,
    path: relativePath,
    message: `[agent] Update ${relativePath}`,
    content: Buffer.from(content).toString("base64"),
    branch: BRANCH_NAME,
    sha: fileSha,
  });

  console.log(`[GitHub Sync] Synced ${relativePath} to ${BRANCH_NAME}`);
}

async function ensureBranchExists(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string | null> {
  // Check if branch exists
  try {
    const { data } = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: BRANCH_NAME,
    });
    return data.commit.sha;
  } catch {
    // Branch doesn't exist, create it from default branch
  }

  // Get repo's default branch
  try {
    const { data: repoData } = await octokit.rest.repos.get({
      owner,
      repo,
    });

    const defaultBranch = repoData.default_branch;

    const { data: baseBranch } = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: defaultBranch,
    });

    // Create new branch
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${BRANCH_NAME}`,
      sha: baseBranch.commit.sha,
    });

    console.log(
      `[GitHub Sync] Created branch ${BRANCH_NAME} from ${defaultBranch}`
    );
    return baseBranch.commit.sha;
  } catch (error) {
    console.error(`[GitHub Sync] Failed to create branch:`, error);
    return null;
  }
}
