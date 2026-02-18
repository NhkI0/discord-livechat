import * as fs from 'fs';
import * as path from 'path';
import { app, screen } from 'electron';

export interface MediaRegionSettings {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getScreenSize(): { width: number; height: number } {
  const primary = screen.getPrimaryDisplay();
  return primary.bounds;
}

export function getDefaultSettings(): MediaRegionSettings {
  const { width, height } = getScreenSize();
  return { x: 0, y: 0, width, height };
}

export class SettingsManager {
  private filePath: string;
  private settings: MediaRegionSettings;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'media-settings.json');
    this.settings = this.load();
  }

  private load(): MediaRegionSettings {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (
          typeof parsed.x === 'number' &&
          typeof parsed.y === 'number' &&
          typeof parsed.width === 'number' &&
          typeof parsed.height === 'number'
        ) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to load media settings:', err);
    }
    return getDefaultSettings();
  }

  getSettings(): MediaRegionSettings {
    return { ...this.settings };
  }

  saveSettings(settings: MediaRegionSettings): void {
    this.settings = {
      x: Math.round(settings.x),
      y: Math.round(settings.y),
      width: Math.max(50, Math.round(settings.width)),
      height: Math.max(50, Math.round(settings.height)),
    };
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save media settings:', err);
    }
  }

  resetToDefault(): void {
    this.settings = getDefaultSettings();
    this.saveSettings(this.settings);
  }
}
