/**
 * Sound utility for playing notification sounds
 */

import { exec } from 'child_process';
import { platform } from 'os';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Resolve path relative to compiled module location
const __dirname = dirname(fileURLToPath(import.meta.url));
const SOUND_FILE = resolve(__dirname, '../../assets/notification.mp3');
const VOLUME = 30; // 0-100

// Track if sound is currently playing to prevent overlapping
let isPlaying = false;

/**
 * Play the notification sound at configured volume
 * Skips if a sound is already playing to prevent overlap
 */
export function playNotificationSound(): void {
  // Skip if already playing
  if (isPlaying) return;

  if (!existsSync(SOUND_FILE)) {
    return;
  }

  isPlaying = true;

  const os = platform();
  // Normalize path for the current OS
  const soundPath = SOUND_FILE.replace(/\\/g, '/');

  const onComplete = () => {
    isPlaying = false;
  };

  if (os === 'win32') {
    // Use PowerShell with Windows Media Player - wait for sound to finish
    const script = `
      $player = New-Object System.Windows.Media.MediaPlayer;
      $player.Open('${soundPath.replace(/'/g, "''")}');
      $player.Volume = ${VOLUME / 100};
      Start-Sleep -Milliseconds 500;
      $player.Play();
      while ($player.Position -lt $player.NaturalDuration.TimeSpan) {
        Start-Sleep -Milliseconds 100;
      }
      $player.Close();
    `.replace(/\n/g, ' ');

    exec(`powershell -Command "Add-Type -AssemblyName PresentationCore; ${script}"`, { windowsHide: true }, onComplete);
  } else if (os === 'darwin') {
    // macOS - use afplay with volume (0-100 maps to 0-1)
    exec(`afplay -v ${VOLUME / 100} "${soundPath}"`, onComplete);
  } else {
    // Linux - try mpg123 or paplay
    exec(`mpg123 -f ${VOLUME * 327.67} "${soundPath}" 2>/dev/null || paplay --volume=${VOLUME * 655} "${soundPath}"`, onComplete);
  }
}
