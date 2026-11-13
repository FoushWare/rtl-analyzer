#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli, type CliIO } from './cli.js';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

async function version(): Promise<string> {
  const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as { version?: string };
  return packageJson.version ?? '0.0.0';
}

function help(): string {
  return `RTL Analyzer — conservative RTL risk scanning\n\nUsage:\n  rtl-analyzer scan [path] [options]\n  rtl-analyzer --help\n  rtl-analyzer --version\n\nOptions:\n  --root <path>                 Scan this project root\n  --format <format>             json, markdown, markdown-structured, or dashboard\n  --output-dir <path>           Write report artifacts to this directory\n  --fail-on-findings            Exit 1 when actionable findings exist\n  --embed-source-snippets       Embed bounded source snippets in dashboard output\n`;
}

const io: CliIO = {
  writeStdout: value => process.stdout.write(value),
  writeStderr: value => process.stderr.write(`${value}\n`),
};

async function main(argv: string[]): Promise<number> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    io.writeStdout(help());
    return 0;
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    io.writeStdout(`${await version()}\n`);
    return 0;
  }
  if (argv[0] !== 'scan') {
    io.writeStderr(`Unknown command: ${argv[0]}. Use --help for usage.`);
    return 2;
  }
  const scanArgs = argv.slice(1);
  const firstPath = scanArgs[0];
  if (firstPath && !firstPath.startsWith('-')) {
    scanArgs.splice(0, 1, '--root', firstPath);
  }
  return runCli(scanArgs, io);
}

process.exitCode = await main(process.argv.slice(2));
