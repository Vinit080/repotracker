import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function cleanText(value, maxLength) {
  return String(value ?? '').replace(/[\r\n\t]/g, ' ').slice(0, maxLength);
}

export async function notifyDesktop({ title, message }) {
  const safeTitle = cleanText(title, 80);
  const safeMessage = cleanText(message, 240);

  try {
    if (process.platform === 'win32') {
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $n = New-Object System.Windows.Forms.NotifyIcon
        $n.Icon = [System.Drawing.SystemIcons]::Information
        $n.BalloonTipTitle = $env:RT_NOTIFY_TITLE
        $n.BalloonTipText = $env:RT_NOTIFY_MESSAGE
        $n.Visible = $true
        $n.ShowBalloonTip(5000)
        Start-Sleep -Seconds 6
        $n.Dispose()
      `;
      await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
        env: { ...process.env, RT_NOTIFY_TITLE: safeTitle, RT_NOTIFY_MESSAGE: safeMessage },
        timeout: 10_000,
        windowsHide: true
      });
      return;
    }

    if (process.platform === 'darwin') {
      await execFileAsync('osascript', [
        '-e',
        'on run argv\ndisplay notification (item 2 of argv) with title (item 1 of argv)\nend run',
        safeTitle,
        safeMessage
      ], { timeout: 10_000 });
      return;
    }

    await execFileAsync('notify-send', [safeTitle, safeMessage], { timeout: 10_000 });
  } catch {
    console.log(`${safeTitle}: ${safeMessage}`);
  }
}
