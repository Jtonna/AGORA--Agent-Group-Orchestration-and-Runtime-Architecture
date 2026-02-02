import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

interface MailOptions {
  port?: string;
}

export async function mailCommand(options: MailOptions): Promise<void> {
  // Read port from .agora/config.json if available
  let port = options.port;
  if (!port) {
    const configPath = path.join(process.cwd(), '.agora', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        port = String(config.port || 60061);
      } catch {
        port = '60061';
      }
    } else {
      port = '60061';
    }
  }

  // Set the API URL for the client
  const env = {
    ...process.env,
    AGORA_API_URL: `http://localhost:${port}`,
  };

  // Find the compiled client entry point
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientEntry = path.resolve(__dirname, '..', '..', 'client', 'index.js');

  if (!fs.existsSync(clientEntry)) {
    console.error('Email client not found. Package may need to be rebuilt.');
    process.exit(1);
  }

  // Spawn the Ink TUI as a child process with inherited stdio
  const child = spawn(process.execPath, [clientEntry], {
    env,
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}
