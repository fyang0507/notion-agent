/**
 * Test script to validate the notion skill system
 * Run with: pnpm tsx scripts/test-skills.ts
 */

import * as fs from 'fs';
import { scanSkills, getSkillList, createNotionCommands } from '../src/skills/notion/index.js';
import { getDatasourcePath, getDraftsDir } from '../src/skills/notion/utils/datasource-store.js';
import { createCommandExecutor } from '../src/agents/utils/shell-executor.js';

async function runTests() {
  console.log('=== Testing Notion Skill System ===\n');

  // Test 1: scanSkills()
  console.log('1. scanSkills():');
  const skills = await scanSkills();
  console.log(`   Found ${skills.length} skill(s):`);
  skills.forEach((s) => console.log(`   - ${s.name}: ${s.description}`));
  console.log();

  // Test 2: getSkillList()
  console.log('2. getSkillList():');
  console.log(await getSkillList());
  console.log();

  // Test 3: Notion read commands
  console.log('3. Notion read commands:');
  const commands = createNotionCommands();

  console.log('   notion list:');
  const listResult = await commands['notion list']('');
  console.log('   ' + listResult.replace(/\n/g, ', '));

  if (skills.length > 0) {
    const testSkill = skills[0].name;

    console.log(`\n   notion read ${testSkill}:`);
    const content = await commands['notion read'](testSkill);
    console.log(`   [OK] Content loaded (${content.length} chars)`);
  }

  // Test 4: notion help command
  console.log('\n4. Notion help command:');
  const helpOutput = await commands['notion help']('');
  const hasReadCommands = helpOutput.includes('notion list') && helpOutput.includes('notion read');
  const hasWriteCommands = helpOutput.includes('notion draft') && helpOutput.includes('notion commit');
  console.log(`   notion help (read):  ${hasReadCommands ? '[OK]' : '[FAIL] Missing read commands'}`);
  console.log(`   notion help (write): ${hasWriteCommands ? '[OK]' : '[FAIL] Missing write commands'}`);

  // Test 5: Quoted arguments (via executor)
  console.log('\n5. Quoted argument handling:');
  const exec = createCommandExecutor(commands);

  if (skills.length > 0) {
    const testSkillName = skills[0].name;
    const unquoted = await exec(`notion read ${testSkillName}`);
    const doubleQuoted = await exec(`notion read "${testSkillName}"`);
    const singleQuoted = await exec(`notion read '${testSkillName}'`);

    // notion read returns content (not an error)
    const isValid = (result: string) => !result.startsWith('Error:');

    console.log(`   Unquoted:      ${isValid(unquoted) ? '[OK]' : '[FAIL] ' + unquoted}`);
    console.log(`   Double-quoted: ${isValid(doubleQuoted) ? '[OK]' : '[FAIL] ' + doubleQuoted}`);
    console.log(`   Single-quoted: ${isValid(singleQuoted) ? '[OK]' : '[FAIL] ' + singleQuoted}`);
  } else {
    console.log('   [SKIP] No skills available to test');
  }

  // Test 6: Draft skill commands
  console.log('\n6. Notion draft commands:');

  const testContent = `---
name: Test Database
description: Test skill for validation
---

Default status to "Active".
Always require a title.
`;

  // Test draft with valid content
  const draftResult = await exec(`notion draft "Test Database" "${testContent}"`);
  console.log(`   notion draft (valid):    ${draftResult.includes('Draft saved') ? '[OK]' : '[FAIL] ' + draftResult}`);

  // Test draft with missing frontmatter
  const invalidContent = `No frontmatter here`;
  const invalidDraftResult = await exec(`notion draft "Invalid Skill" "${invalidContent}"`);
  console.log(`   notion draft (invalid):  ${invalidDraftResult.includes('Missing required') ? '[OK]' : '[FAIL] ' + invalidDraftResult}`);

  // Test 7: Show draft
  console.log('\n7. Show draft:');
  const showResult = await exec('notion show-draft "Test Database"');
  console.log(`   notion show-draft (exists):     ${showResult.includes('Default status') ? '[OK]' : '[FAIL] ' + showResult}`);

  const showMissingResult = await exec('notion show-draft "Nonexistent"');
  console.log(`   notion show-draft (missing):    ${showMissingResult.includes('No draft found') ? '[OK]' : '[FAIL] ' + showMissingResult}`);

  // Test 8: Commit skill
  console.log('\n8. Commit skill:');

  // First test committing non-existent draft
  const commitMissingResult = await exec('notion commit "Nonexistent"');
  console.log(`   notion commit (missing draft):  ${commitMissingResult.includes('No draft found') ? '[OK]' : '[FAIL] ' + commitMissingResult}`);

  // Commit the test skill
  const commitResult = await exec('notion commit "Test Database"');
  console.log(`   notion commit (exists):         ${commitResult.includes('committed successfully') ? '[OK]' : '[FAIL] ' + commitResult}`);

  // Verify skill now exists in the active skills (use notion list)
  const verifyResult = await exec('notion list');
  console.log(`   skill exists after commit:     ${verifyResult.includes('Test Database') ? '[OK]' : '[FAIL] ' + verifyResult}`);

  // Test 9: Discard draft
  console.log('\n9. Discard draft:');

  // Create a new draft to discard
  await exec(`notion draft "Discard Test" "---\nname: Discard Test\ndescription: To be discarded\n---\nContent"`);

  const discardResult = await exec('notion discard "Discard Test"');
  console.log(`   notion discard (exists):        ${discardResult.includes('discarded') ? '[OK]' : '[FAIL] ' + discardResult}`);

  const discardMissingResult = await exec('notion discard "Nonexistent"');
  console.log(`   notion discard (missing):       ${discardMissingResult.includes('No draft found') ? '[OK]' : '[FAIL] ' + discardMissingResult}`);

  // Test 10: Notion check (datasource schema)
  console.log('\n10. Notion check:');
  const checkResult = await exec('notion check "Nonexistent Database"');
  console.log(`   notion check (not cached):      ${checkResult.includes('No cached datasource') ? '[OK]' : '[FAIL] ' + checkResult}`);

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
}

runTests().catch(console.error);
