import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), '..');
const manifestPath = resolve(repoRoot, 'shared/command-whitelist.json');
const bridgeOutputPath = resolve(repoRoot, 'bridge-server/src/generated/command-whitelist.ts');
const javaOutputPath = resolve(repoRoot, 'src/main/java/com/botpress/command/GeneratedCommandWhitelist.java');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const commands = manifest.commands;

if (!Array.isArray(commands) || commands.length === 0 || commands.some((c) => typeof c !== 'string')) {
  throw new Error('shared/command-whitelist.json must contain a non-empty string array at "commands"');
}

const uniqueCommands = [...new Set(commands)];
if (uniqueCommands.length !== commands.length) {
  throw new Error('shared/command-whitelist.json contains duplicate commands');
}

const sortedCommands = [...commands].sort((a, b) => a.localeCompare(b));

const bridgeEntries = sortedCommands.map((cmd) => `  ${JSON.stringify(cmd)},`).join("\n");
const bridgeContent = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: shared/command-whitelist.json

export const COMMAND_WHITELIST = [
${bridgeEntries}
] as const;
`;

const javaList = sortedCommands.map((cmd) => `\t\t\t"${cmd}"`).join(',\n');
const javaContent = `package com.botpress.command;

import java.util.Set;

// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: shared/command-whitelist.json
public final class GeneratedCommandWhitelist {
\tprivate GeneratedCommandWhitelist() {
\t}

\tpublic static final Set<String> WHITELISTED_COMMANDS = Set.of(
${javaList}
\t);
}
`;

writeFileSync(bridgeOutputPath, bridgeContent);
writeFileSync(javaOutputPath, javaContent);

console.log('Generated command whitelist artifacts.');
