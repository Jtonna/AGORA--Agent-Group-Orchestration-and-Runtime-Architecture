import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startServer } from '../../server/app.js';

interface StartOptions {
  port: string;
  detach?: boolean;
  dataDir?: string;
}

export async function startCommand(options: StartOptions): Promise<void> {
  const port = parseInt(options.port, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${options.port}`);
    process.exit(1);
  }

  // Try to read config from .agora/config.json
  const configPath = path.join(process.cwd(), '.agora', 'config.json');
  let dataDir = options.dataDir;
  if (!dataDir && fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      dataDir = config.dataDir || path.join(process.cwd(), '.agora', 'data');
    } catch {
      // Use default
    }
  }
  if (!dataDir) {
    dataDir = path.join(process.cwd(), '.agora', 'data');
  }

  if (options.detach) {
    // Spawn detached process
    const child = spawn(process.execPath, [process.argv[1], 'start', '--port', String(port), '--data-dir', dataDir], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    // Write PID file
    const pidPath = path.join(process.cwd(), '.agora', '.server.pid');
    fs.writeFileSync(pidPath, String(child.pid));
    console.log(`AGORA server started in background (PID: ${child.pid})`);
    process.exit(0);
  }

  // Start in foreground
  try {
    await startServer({ port, dataDir });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}
