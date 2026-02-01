#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { mailCommand } from './commands/mail.js';

const program = new Command();

program
  .name('agora')
  .description('AGORA - Agent Group Orchestration and Runtime Architecture')
  .version('0.1.0');

program
  .command('init')
  .description('Scaffold a .agora/ folder in the current directory')
  .option('--force', 'Overwrite existing .agora/ directory')
  .action(initCommand);

program
  .command('start')
  .description('Start the AGORA email server')
  .option('-p, --port <number>', 'Port to listen on', '60061')
  .option('-d, --detach', 'Run in background')
  .option('--data-dir <path>', 'Data directory path')
  .action(startCommand);

program
  .command('stop')
  .description('Stop a detached AGORA server')
  .action(stopCommand);

program
  .command('status')
  .description('Check server health')
  .option('-p, --port <number>', 'Server port', '60061')
  .action(statusCommand);

program
  .command('mail')
  .description('Launch the email client TUI dashboard')
  .option('-p, --port <number>', 'Server port')
  .action(mailCommand);

program.parse();
