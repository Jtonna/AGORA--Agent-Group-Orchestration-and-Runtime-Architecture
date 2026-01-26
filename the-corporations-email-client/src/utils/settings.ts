/**
 * Settings manager with OS-specific app data paths
 */

import { platform, homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

export interface Settings {
  soundEnabled: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
};

/**
 * Get the OS-specific settings directory
 * - Windows: %APPDATA%\AGORA
 * - macOS: ~/Library/Application Support/AGORA
 * - Linux: ~/.config/AGORA
 */
function getSettingsDir(): string {
  const os = platform();
  if (os === 'win32') {
    return join(process.env.APPDATA || homedir(), 'AGORA');
  } else if (os === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'AGORA');
  } else {
    return join(homedir(), '.config', 'AGORA');
  }
}

function getSettingsPath(): string {
  return join(getSettingsDir(), 'settings.json');
}

/**
 * Load settings from disk, with defaults for missing values
 */
export function loadSettings(): Settings {
  try {
    const path = getSettingsPath();
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf-8'));
      return { ...DEFAULT_SETTINGS, ...data };
    }
  } catch {
    // Ignore errors, use defaults
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to disk
 */
export function saveSettings(settings: Settings): void {
  try {
    const dir = getSettingsDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
  } catch {
    // Ignore errors silently
  }
}
