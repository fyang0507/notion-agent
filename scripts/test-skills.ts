/**
 * Test script to validate the skill system
 * Run with: pnpm tsx scripts/test-skills.ts
 */

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
console.log('3. Skill commands:');
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

console.log('\n=== All tests completed ===');
