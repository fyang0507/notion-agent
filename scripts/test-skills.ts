/**
 * Test script to validate the skill system
 * Run with: pnpm tsx scripts/test-skills.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { scanSkills, getSkillList, createSkillCommands } from '../src/agents/notion-agent/skills/index.js';

console.log('=== Testing Skill System ===\n');

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

// Test 3: Skill commands
console.log('3. Skill read commands:');
const commands = createSkillCommands();

console.log('   skill list:');
console.log('   ' + commands['skill list']('').replace(/\n/g, ', '));

if (skills.length > 0) {
  const testSkill = skills[0].name;

  console.log(`\n   skill info ${testSkill}:`);
  console.log('   ' + commands['skill info'](testSkill).replace(/\n/g, '\n   '));

  console.log(`\n   skill read ${testSkill}:`);
  const content = commands['skill read'](testSkill);
  console.log(`   [OK] Content loaded (${content.length} chars)`);
}

// Test 4: Quoted arguments (via executor)
console.log('\n4. Quoted argument handling:');
const { createCommandExecutor } = await import('../src/agents/notion-agent/utils/shell-executor.js');
const exec = createCommandExecutor(commands);

const unquoted = exec('skill info 2025 Progress Tracker');
const doubleQuoted = exec('skill info "2025 Progress Tracker"');
const singleQuoted = exec("skill info '2025 Progress Tracker'");

console.log(`   Unquoted:      ${unquoted.startsWith('Name:') ? '[OK]' : '[FAIL] ' + unquoted}`);
console.log(`   Double-quoted: ${doubleQuoted.startsWith('Name:') ? '[OK]' : '[FAIL] ' + doubleQuoted}`);
console.log(`   Single-quoted: ${singleQuoted.startsWith('Name:') ? '[OK]' : '[FAIL] ' + singleQuoted}`);

// Test 5: Draft skill commands
console.log('\n5. Skill draft commands:');

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

// Test 6: Show draft
console.log('\n6. Show draft:');
const showResult = exec('skill show-draft "Test Database"');
console.log(`   skill show-draft (exists):     ${showResult.includes('Default status') ? '[OK]' : '[FAIL] ' + showResult}`);

const showMissingResult = exec('skill show-draft "Nonexistent"');
console.log(`   skill show-draft (missing):    ${showMissingResult.includes('No draft found') ? '[OK]' : '[FAIL] ' + showMissingResult}`);

// Test 7: Commit skill
console.log('\n7. Commit skill:');

// First test committing non-existent draft
const commitMissingResult = exec('skill commit "Nonexistent"');
console.log(`   skill commit (missing draft):  ${commitMissingResult.includes('No draft found') ? '[OK]' : '[FAIL] ' + commitMissingResult}`);

// Commit the test skill
const commitResult = exec('skill commit "Test Database"');
console.log(`   skill commit (exists):         ${commitResult.includes('committed successfully') ? '[OK]' : '[FAIL] ' + commitResult}`);

// Verify skill now exists in the active skills
const verifyResult = exec('skill info "Test Database"');
console.log(`   skill exists after commit:     ${verifyResult.startsWith('Name:') ? '[OK]' : '[FAIL] ' + verifyResult}`);

// Test 8: Discard draft
console.log('\n8. Discard draft:');

// Create a new draft to discard
exec(`skill draft "Discard Test" "---\nname: Discard Test\ndescription: To be discarded\n---\nContent"`);

const discardResult = exec('skill discard "Discard Test"');
console.log(`   skill discard (exists):        ${discardResult.includes('discarded') ? '[OK]' : '[FAIL] ' + discardResult}`);

const discardMissingResult = exec('skill discard "Nonexistent"');
console.log(`   skill discard (missing):       ${discardMissingResult.includes('No draft found') ? '[OK]' : '[FAIL] ' + discardMissingResult}`);

// Test 9: Skill check (datasource schema)
console.log('\n9. Skill check:');
const checkResult = exec('skill check "Nonexistent Database"');
console.log(`   skill check (not cached):      ${checkResult.includes('No cached datasource') ? '[OK]' : '[FAIL] ' + checkResult}`);

// Test 10: Cleanup - remove test skill
console.log('\n10. Cleanup:');
const skillsDir = path.join(import.meta.dirname, '..', 'src', 'agents', 'notion-agent', 'skills');
const testSkillPath = path.join(skillsDir, 'Test Database');
if (fs.existsSync(testSkillPath)) {
  fs.rmSync(testSkillPath, { recursive: true });
  console.log('   Removed test skill:            [OK]');
} else {
  console.log('   Test skill not found:          [SKIP]');
}

console.log('\n=== All tests completed ===');
