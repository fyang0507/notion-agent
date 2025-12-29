/**
 * Test script to validate the skill system
 * Run with: pnpm tsx scripts/test-skills.ts
 */

import * as fs from 'fs';
import { scanSkills, getSkillList, createSkillCommands } from '../src/agents/notion-agent/skills/index.js';
import { getDatasourcePath, getDraftsDir, runMigration } from '../src/agents/notion-agent/utils/datasource-store.js';

console.log('=== Testing Skill System ===\n');

// Ensure migration runs first
console.log('0. Running migration (if needed):');
runMigration();
console.log();

// Test 1: scanSkills()
console.log('1. scanSkills():');
const skills = scanSkills();
console.log(`   Found ${skills.length} skill(s):`);
skills.forEach((s) => console.log(`   - ${s.name}: ${s.description}`));
console.log();

// Test 2: getSkillList()
console.log('2. getSkillList():');
console.log(getSkillList());
console.log();

// Test 3: Skill read commands
console.log('3. Skill read commands:');
const commands = createSkillCommands();

console.log('   skill list:');
console.log('   ' + commands['skill list']('').replace(/\n/g, ', '));

if (skills.length > 0) {
  const testSkill = skills[0].name;

  console.log(`\n   skill read ${testSkill}:`);
  const content = commands['skill read'](testSkill);
  console.log(`   [OK] Content loaded (${content.length} chars)`);
}

// Test 4: skill help command
console.log('\n4. Skill help command:');
const helpOutput = commands['skill help']('');
const hasReadCommands = helpOutput.includes('skill list') && helpOutput.includes('skill read');
const hasWriteCommands = helpOutput.includes('skill draft') && helpOutput.includes('skill commit');
console.log(`   skill help (read):  ${hasReadCommands ? '[OK]' : '[FAIL] Missing read commands'}`);
console.log(`   skill help (write): ${hasWriteCommands ? '[OK]' : '[FAIL] Missing write commands'}`);

// Test 5: Quoted arguments (via executor)
console.log('\n5. Quoted argument handling:');
const { createCommandExecutor } = await import('../src/agents/notion-agent/utils/shell-executor.js');
const exec = createCommandExecutor(commands);

if (skills.length > 0) {
  const testSkillName = skills[0].name;
  const unquoted = exec(`skill read ${testSkillName}`);
  const doubleQuoted = exec(`skill read "${testSkillName}"`);
  const singleQuoted = exec(`skill read '${testSkillName}'`);

  // skill read returns content (not an error)
  const isValid = (result: string) => !result.startsWith('Error:');

  console.log(`   Unquoted:      ${isValid(unquoted) ? '[OK]' : '[FAIL] ' + unquoted}`);
  console.log(`   Double-quoted: ${isValid(doubleQuoted) ? '[OK]' : '[FAIL] ' + doubleQuoted}`);
  console.log(`   Single-quoted: ${isValid(singleQuoted) ? '[OK]' : '[FAIL] ' + singleQuoted}`);
} else {
  console.log('   [SKIP] No skills available to test');
}

// Test 6: Draft skill commands
console.log('\n6. Skill draft commands:');

const testContent = `---
name: Test Database
description: Test skill for validation
---

Default status to "Active".
Always require a title.
`;

// Test draft with valid content
const draftResult = exec(`skill draft "Test Database" "${testContent}"`);
console.log(`   skill draft (valid):    ${draftResult.includes('Draft saved') ? '[OK]' : '[FAIL] ' + draftResult}`);

// Test draft with missing frontmatter
const invalidContent = `No frontmatter here`;
const invalidDraftResult = exec(`skill draft "Invalid Skill" "${invalidContent}"`);
console.log(`   skill draft (invalid):  ${invalidDraftResult.includes('Missing required') ? '[OK]' : '[FAIL] ' + invalidDraftResult}`);

// Test 7: Show draft
console.log('\n7. Show draft:');
const showResult = exec('skill show-draft "Test Database"');
console.log(`   skill show-draft (exists):     ${showResult.includes('Default status') ? '[OK]' : '[FAIL] ' + showResult}`);

const showMissingResult = exec('skill show-draft "Nonexistent"');
console.log(`   skill show-draft (missing):    ${showMissingResult.includes('No draft found') ? '[OK]' : '[FAIL] ' + showMissingResult}`);

// Test 8: Commit skill
console.log('\n8. Commit skill:');

// First test committing non-existent draft
const commitMissingResult = exec('skill commit "Nonexistent"');
console.log(`   skill commit (missing draft):  ${commitMissingResult.includes('No draft found') ? '[OK]' : '[FAIL] ' + commitMissingResult}`);

// Commit the test skill
const commitResult = exec('skill commit "Test Database"');
console.log(`   skill commit (exists):         ${commitResult.includes('committed successfully') ? '[OK]' : '[FAIL] ' + commitResult}`);

// Verify skill now exists in the active skills (use skill list)
const verifyResult = exec('skill list');
console.log(`   skill exists after commit:     ${verifyResult.includes('Test Database') ? '[OK]' : '[FAIL] ' + verifyResult}`);

// Test 9: Discard draft
console.log('\n9. Discard draft:');

// Create a new draft to discard
exec(`skill draft "Discard Test" "---\nname: Discard Test\ndescription: To be discarded\n---\nContent"`);

const discardResult = exec('skill discard "Discard Test"');
console.log(`   skill discard (exists):        ${discardResult.includes('discarded') ? '[OK]' : '[FAIL] ' + discardResult}`);

const discardMissingResult = exec('skill discard "Nonexistent"');
console.log(`   skill discard (missing):       ${discardMissingResult.includes('No draft found') ? '[OK]' : '[FAIL] ' + discardMissingResult}`);

// Test 10: Skill check (datasource schema)
console.log('\n10. Skill check:');
const checkResult = exec('skill check "Nonexistent Database"');
console.log(`   skill check (not cached):      ${checkResult.includes('No cached datasource') ? '[OK]' : '[FAIL] ' + checkResult}`);

// Test 11: Cleanup - remove test skill
console.log('\n11. Cleanup:');
const testSkillPath = getDatasourcePath('Test Database');
if (fs.existsSync(testSkillPath)) {
  fs.rmSync(testSkillPath, { recursive: true });
  console.log('    Removed test skill:           [OK]');
} else {
  console.log('    Test skill not found:         [SKIP]');
}

// Clean up drafts directory if empty
const draftsDir = getDraftsDir();
if (fs.existsSync(draftsDir)) {
  const draftEntries = fs.readdirSync(draftsDir);
  if (draftEntries.length === 0) {
    fs.rmdirSync(draftsDir);
    console.log('    Removed empty _drafts:        [OK]');
  }
}

console.log('\n=== All tests completed ===');
