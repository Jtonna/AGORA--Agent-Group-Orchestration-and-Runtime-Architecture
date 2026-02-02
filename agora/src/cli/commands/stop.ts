import fs from 'node:fs';
import path from 'node:path';

export async function stopCommand(): Promise<void> {
  const pidPath = path.join(process.cwd(), '.agora', '.server.pid');

  if (!fs.existsSync(pidPath)) {
    console.error('No running server found (.agora/.server.pid not found)');
    process.exit(1);
  }

  const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10);
  if (isNaN(pid)) {
    console.error('Invalid PID in .agora/.server.pid');
    fs.unlinkSync(pidPath);
    process.exit(1);
  }

  try {
    process.kill(pid, 'SIGTERM');
    console.log(`Sent SIGTERM to server (PID: ${pid})`);
  } catch (err: any) {
    if (err.code === 'ESRCH') {
      console.log(`Server process (PID: ${pid}) not running`);
    } else {
      console.error(`Failed to stop server: ${err.message}`);
    }
  }

  fs.unlinkSync(pidPath);
}
