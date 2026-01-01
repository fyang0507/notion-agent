/**
 * Test script for GitHub sync functionality
 * Run with: pnpm tsx scripts/test-github-sync.ts
 *
 * Prerequisites:
 * - GITHUB_TOKEN in .env with repo scope
 * - GITHUB_REPO in .env in "owner/repo" format
 *
 * This test is idempotent:
 * - Creates a test file in AGENT_WORKING_FOLDER/.test/
 * - Syncs it to GitHub on the vercel-agent-commit branch
 * - Verifies the file exists on GitHub
 * - Cleans up both local and remote test files
 */

import 'dotenv/config';
import { Octokit } from 'octokit';
import * as fs from 'fs';
import * as path from 'path';

const BRANCH_NAME = 'vercel-agent-commit';
const TEST_DIR = path.join(process.cwd(), 'AGENT_WORKING_FOLDER', '.test');
const TEST_FILE_NAME = 'github-sync-test.txt';
const TEST_FILE_PATH = path.join(TEST_DIR, TEST_FILE_NAME);
const TEST_CONTENT = `GitHub sync test - ${new Date().toISOString()}`;

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function log(name: string, passed: boolean, message: string) {
  results.push({ name, passed, message });
  const status = passed ? '[OK]' : '[FAIL]';
  console.log(`   ${name}: ${status} ${message}`);
}

async function main() {
  console.log('=== Testing GitHub Sync ===\n');

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  // Test 1: Check environment variables
  console.log('1. Environment check:');
  if (!token) {
    log('GITHUB_TOKEN', false, 'Not set. Set GITHUB_TOKEN env var.');
    console.log('\n=== Tests aborted (missing credentials) ===');
    process.exit(1);
  }
  log('GITHUB_TOKEN', true, 'Set');

  if (!repo) {
    log('GITHUB_REPO', false, 'Not set. Set GITHUB_REPO env var (e.g., "owner/repo").');
    console.log('\n=== Tests aborted (missing credentials) ===');
    process.exit(1);
  }
  log('GITHUB_REPO', true, repo);

  const [owner, repoName] = repo.split('/');
  if (!owner || !repoName) {
    log('GITHUB_REPO format', false, `Invalid format: ${repo}. Expected "owner/repo".`);
    console.log('\n=== Tests aborted (invalid config) ===');
    process.exit(1);
  }
  log('GITHUB_REPO format', true, `owner=${owner}, repo=${repoName}`);

  const octokit = new Octokit({ auth: token });
  const relativePath = path.relative(process.cwd(), TEST_FILE_PATH);

  // Test 2: Create local test file
  console.log('\n2. Local file operations:');
  try {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    fs.writeFileSync(TEST_FILE_PATH, TEST_CONTENT);
    log('Create test file', true, relativePath);
  } catch (err) {
    log('Create test file', false, String(err));
    console.log('\n=== Tests aborted (local file error) ===');
    process.exit(1);
  }

  // Test 3: Ensure branch exists
  console.log('\n3. Branch operations:');
  let branchExists = false;
  try {
    await octokit.rest.repos.getBranch({
      owner,
      repo: repoName,
      branch: BRANCH_NAME,
    });
    branchExists = true;
    log('Branch exists', true, BRANCH_NAME);
  } catch {
    log('Branch exists', false, `${BRANCH_NAME} not found, will create`);

    // Create branch from default branch
    try {
      const { data: repoData } = await octokit.rest.repos.get({
        owner,
        repo: repoName,
      });
      const defaultBranch = repoData.default_branch;

      const { data: baseBranch } = await octokit.rest.repos.getBranch({
        owner,
        repo: repoName,
        branch: defaultBranch,
      });

      await octokit.rest.git.createRef({
        owner,
        repo: repoName,
        ref: `refs/heads/${BRANCH_NAME}`,
        sha: baseBranch.commit.sha,
      });

      branchExists = true;
      log('Create branch', true, `Created ${BRANCH_NAME} from ${defaultBranch}`);
    } catch (err) {
      log('Create branch', false, String(err));
    }
  }

  if (!branchExists) {
    cleanup();
    console.log('\n=== Tests aborted (branch error) ===');
    process.exit(1);
  }

  // Test 4: Sync file to GitHub
  console.log('\n4. Sync to GitHub:');
  let fileSha: string | undefined;

  // Check if file already exists (for update)
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo: repoName,
      path: relativePath,
      ref: BRANCH_NAME,
    });
    if (!Array.isArray(data) && data.type === 'file') {
      fileSha = data.sha;
      log('File exists on GitHub', true, 'Will update');
    }
  } catch {
    log('File exists on GitHub', true, 'Will create new');
  }

  // Create or update file
  try {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: relativePath,
      message: `[test] GitHub sync test - ${new Date().toISOString()}`,
      content: Buffer.from(TEST_CONTENT).toString('base64'),
      branch: BRANCH_NAME,
      sha: fileSha,
    });
    log('Sync file', true, `Committed to ${BRANCH_NAME}`);
  } catch (err) {
    log('Sync file', false, String(err));
    cleanup();
    console.log('\n=== Tests aborted (sync error) ===');
    process.exit(1);
  }

  // Test 5: Verify file on GitHub
  console.log('\n5. Verify on GitHub:');
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo: repoName,
      path: relativePath,
      ref: BRANCH_NAME,
    });

    if (!Array.isArray(data) && data.type === 'file') {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      const matches = content === TEST_CONTENT;
      log('Verify content', matches, matches ? 'Content matches' : 'Content mismatch');
      fileSha = data.sha; // Update SHA for deletion
    } else {
      log('Verify content', false, 'Unexpected response type');
    }
  } catch (err) {
    log('Verify content', false, String(err));
  }

  // Test 6: Cleanup - delete from GitHub
  console.log('\n6. Cleanup:');
  try {
    await octokit.rest.repos.deleteFile({
      owner,
      repo: repoName,
      path: relativePath,
      message: `[test] Cleanup GitHub sync test`,
      sha: fileSha!,
      branch: BRANCH_NAME,
    });
    log('Delete from GitHub', true, 'Removed test file');
  } catch (err) {
    log('Delete from GitHub', false, String(err));
  }

  // Cleanup local
  cleanup();
  log('Delete local file', true, 'Removed test file and directory');

  // Summary
  console.log('\n=== Test Summary ===');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n   Failed tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`   - ${r.name}: ${r.message}`));
    process.exit(1);
  }

  console.log('\n=== All tests passed ===');
}

function cleanup() {
  try {
    if (fs.existsSync(TEST_FILE_PATH)) {
      fs.unlinkSync(TEST_FILE_PATH);
    }
    if (fs.existsSync(TEST_DIR)) {
      const entries = fs.readdirSync(TEST_DIR);
      if (entries.length === 0) {
        fs.rmdirSync(TEST_DIR);
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  cleanup();
  process.exit(1);
});
