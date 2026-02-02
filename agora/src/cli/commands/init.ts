import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function initCommand(options: { force?: boolean }): Promise<void> {
  const targetDir = path.join(process.cwd(), '.agora');

  if (fs.existsSync(targetDir) && !options.force) {
    console.error('.agora/ already exists. Use --force to overwrite.');
    process.exit(1);
  }

  // Find scaffold directory relative to this module
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // dist/cli/commands/ → up 3 levels → package root → scaffold/
  const scaffoldSource = path.resolve(__dirname, '..', '..', '..', 'scaffold');

  if (!fs.existsSync(scaffoldSource)) {
    console.error('Could not find scaffold templates. Package may be corrupted.');
    process.exit(1);
  }

  // Copy scaffold to target
  copyDirRecursive(scaffoldSource, targetDir);

  // Create data directory
  const dataDir = path.join(targetDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // Create empty data files
  fs.writeFileSync(
    path.join(dataDir, 'emails.json'),
    JSON.stringify({ version: 1, emails: [] }, null, 2)
  );
  fs.writeFileSync(
    path.join(dataDir, 'quarantine.json'),
    JSON.stringify({ version: 1, quarantined: [] }, null, 2)
  );

  console.log('Initialized .agora/ directory:');
  console.log('  .agora/config.json     - Configuration');
  console.log('  .agora/agents/         - Agent definitions');
  console.log('  .agora/scripts/        - Shell scripts');
  console.log('  .agora/data/           - Email data storage');
  console.log('');
  console.log('Next steps:');
  console.log('  agora start    - Start the email server');
  console.log('  agora mail     - Launch the email client');
}

function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name === '.gitkeep') continue; // skip placeholders
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
