interface MediaMessage {
  type: 'image' | 'video' | 'gif';
  url?: string;
  content?: string;
  author: string;
  timestamp: number;
  filename?: string;
  metadata?: {
    gifUrl?: string;
    thumbnailUrl?: string;
  };
}

interface MediaRegionSettings {
  x: number;
  y: number;
  width: number;
  height: number;
}

class LivechatRenderer {
  private mediaElement: HTMLImageElement | HTMLVideoElement | null = null;
  private textOverlay: HTMLDivElement;
  private hideMediaTimeout: number | null = null;

  private readonly IMAGE_DISPLAY_DURATION = 6000;

  // This display's screen-absolute offset (from URL query params)
  private displayOffset: MediaRegionSettings;

  // Current media region in screen-absolute coordinates
  private currentSettings: MediaRegionSettings;

  // Edit mode
  private editModeActive = false;
  private editOverlay: HTMLDivElement | null = null;
  private editKeyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.displayOffset = {
      x: parseInt(params.get('dx') || '0'),
      y: parseInt(params.get('dy') || '0'),
      width: parseInt(params.get('dw') || String(window.innerWidth)),
      height: parseInt(params.get('dh') || String(window.innerHeight)),
    };

    this.currentSettings = { ...this.displayOffset };

    this.textOverlay = document.getElementById('text-overlay') as HTMLDivElement;
    this.setupMediaListener();
    this.setupKeyboardShortcuts();
    this.loadAndApplySettings();
    this.setupSettingsListeners();
  }

  private toLocal(settings: MediaRegionSettings): MediaRegionSettings {
    return {
      x: settings.x - this.displayOffset.x,
      y: settings.y - this.displayOffset.y,
      width: settings.width,
      height: settings.height,
    };
  }
  private toScreenX(clientX: number): number {
    return clientX + this.displayOffset.x;
  }
  private toScreenY(clientY: number): number {
    return clientY + this.displayOffset.y;
  }

  private async loadAndApplySettings(): Promise<void> {
    const api = (window as any).electronAPI;
    if (api?.getMediaSettings) {
      const settings = await api.getMediaSettings();
      this.applyRegionSettings(settings);
    }
  }

  private setupSettingsListeners(): void {
    const api = (window as any).electronAPI;
    if (!api) return;

    if (api.onMediaSettingsChanged) {
      api.onMediaSettingsChanged((settings: MediaRegionSettings) => {
        this.applyRegionSettings(settings);
      });
    }

    if (api.onEnterEditMode) {
      api.onEnterEditMode((region: MediaRegionSettings) => {
        this.startEditMode(region);
      });
    }

    if (api.onExitEditMode) {
      api.onExitEditMode(() => {
        this.stopEditMode();
      });
    }

    if (api.onUpdateEditRegion) {
      api.onUpdateEditRegion((region: MediaRegionSettings) => {
        this.updateEditRegionVisual(region);
      });
    }
  }

  private applyRegionSettings(settings: MediaRegionSettings): void {
    this.currentSettings = { ...settings };
    const local = this.toLocal(settings);
    const container = document.getElementById('media-container')!;

    container.style.position = 'absolute';
    container.style.flex = 'none';
    container.style.left = local.x + 'px';
    container.style.top = local.y + 'px';
    container.style.width = local.width + 'px';
    container.style.height = local.height + 'px';
  }

  private startEditMode(region: MediaRegionSettings): void {
    if (this.editModeActive) return;
    this.editModeActive = true;

    const local = this.toLocal(region);

    // Dark backdrop covering this display
    this.editOverlay = document.createElement('div');
    this.editOverlay.id = 'edit-overlay';
    Object.assign(this.editOverlay.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      zIndex: '10000', cursor: 'default', pointerEvents: 'auto',
      background: 'rgba(0, 0, 0, 0.3)',
    });

    const regionBox = document.createElement('div');
    regionBox.id = 'edit-region';
    Object.assign(regionBox.style, {
      position: 'absolute',
      left: local.x + 'px',
      top: local.y + 'px',
      width: local.width + 'px',
      height: local.height + 'px',
      border: '3px dashed #00ff88',
      background: 'rgba(0, 255, 136, 0.1)',
      cursor: 'move',
      boxSizing: 'border-box',
    });

    const corners: { id: string; cursor: string; pos: Record<string, string> }[] = [
      { id: 'nw', cursor: 'nw-resize', pos: { top: '-6px', left: '-6px' } },
      { id: 'ne', cursor: 'ne-resize', pos: { top: '-6px', right: '-6px' } },
      { id: 'sw', cursor: 'sw-resize', pos: { bottom: '-6px', left: '-6px' } },
      { id: 'se', cursor: 'se-resize', pos: { bottom: '-6px', right: '-6px' } },
    ];

    for (const corner of corners) {
      const handle = document.createElement('div');
      handle.dataset.handle = corner.id;
      Object.assign(handle.style, {
        position: 'absolute',
        width: '14px', height: '14px',
        background: '#00ff88', border: '2px solid #fff',
        cursor: corner.cursor, zIndex: '1', borderRadius: '2px',
        ...corner.pos,
      });
      regionBox.appendChild(handle);
    }

    const label = document.createElement('div');
    label.id = 'edit-label';
    Object.assign(label.style, {
      position: 'absolute', top: '-30px', left: '0',
      background: 'rgba(0,0,0,0.85)', color: '#00ff88',
      padding: '3px 10px', fontSize: '13px', fontFamily: 'Consolas, monospace',
      borderRadius: '3px', whiteSpace: 'nowrap', pointerEvents: 'none',
    });
    label.textContent = this.formatLabel(region);
    regionBox.appendChild(label);

    this.editOverlay.appendChild(regionBox);

    const doneBtn = document.createElement('button');
    doneBtn.textContent = 'Done (ESC)';
    Object.assign(doneBtn.style, {
      position: 'fixed', bottom: '30px', left: '50%',
      transform: 'translateX(-50%)',
      padding: '12px 36px', fontSize: '16px',
      background: '#00ff88', color: '#000', border: 'none',
      borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold',
      zIndex: '10001', fontFamily: "'Segoe UI', sans-serif",
    });
    doneBtn.addEventListener('click', () => {
      (window as any).electronAPI?.finishEditMode();
    });
    this.editOverlay.appendChild(doneBtn);

    document.body.appendChild(this.editOverlay);

    this.editOverlay.addEventListener('mousedown', (e) => this.onEditMouseDown(e));
    document.addEventListener('mousemove', (e) => this.onEditMouseMove(e));
    document.addEventListener('mouseup', () => this.onEditMouseUp());

    // ESC to finish
    this.editKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        (window as any).electronAPI?.finishEditMode();
      }
    };
    document.addEventListener('keydown', this.editKeyHandler);
  }

  private onEditMouseDown(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const api = (window as any).electronAPI;
    if (!api) return;

    if (target.dataset.handle) {
      api.sendEditMouseDown({
        screenX: this.toScreenX(e.clientX),
        screenY: this.toScreenY(e.clientY),
        action: 'resize',
        handle: target.dataset.handle,
      });
      e.preventDefault();
      return;
    }

    if (target.id === 'edit-region' || target.id === 'edit-label') {
      api.sendEditMouseDown({
        screenX: this.toScreenX(e.clientX),
        screenY: this.toScreenY(e.clientY),
        action: 'drag',
        handle: '',
      });
      e.preventDefault();
      return;
    }
  }

  private onEditMouseMove(e: MouseEvent): void {
    if (!this.editModeActive) return;
    (window as any).electronAPI?.sendEditMouseMove({
      screenX: this.toScreenX(e.clientX),
      screenY: this.toScreenY(e.clientY),
    });
  }

  private onEditMouseUp(): void {
    if (!this.editModeActive) return;
    (window as any).electronAPI?.sendEditMouseUp();
  }

  private updateEditRegionVisual(region: MediaRegionSettings): void {
    const regionBox = document.getElementById('edit-region');
    const label = document.getElementById('edit-label');
    if (!regionBox) return;

    const local = this.toLocal(region);
    regionBox.style.left = local.x + 'px';
    regionBox.style.top = local.y + 'px';
    regionBox.style.width = local.width + 'px';
    regionBox.style.height = local.height + 'px';

    if (label) label.textContent = this.formatLabel(region);
  }

  private formatLabel(r: MediaRegionSettings): string {
    return `${Math.round(r.width)} x ${Math.round(r.height)} @ (${Math.round(r.x)}, ${Math.round(r.y)})`;
  }

  private stopEditMode(): void {
    this.editModeActive = false;

    if (this.editOverlay) {
      this.editOverlay.remove();
      this.editOverlay = null;
    }

    if (this.editKeyHandler) {
      document.removeEventListener('keydown', this.editKeyHandler);
      this.editKeyHandler = null;
    }
  }

  private setupKeyboardShortcuts(): void {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.onSkipMedia(() => {
        console.log('Received skip-media IPC event');
        if (this.mediaElement) {
          console.log('Skipping current media via global keyboard shortcut');
          this.hideMedia();
        } else {
          console.log('No media currently playing to skip');
        }
      });
      console.log('Keyboard shortcut listener registered in renderer');
    } else {
      console.error('electronAPI not available - shortcuts will not work');
    }
  }

  private setupMediaListener(): void {
    const api = (window as any).electronAPI;
    if (!api?.onMediaMessage) {
      console.error('onMediaMessage not available in electronAPI');
      return;
    }
    api.onMediaMessage((message: MediaMessage) => {
      this.handleMessage(message);
    });
  }

  private handleMessage(message: MediaMessage): void {
    if (message.type === 'image') {
      this.displayImage(message);
    } else if (message.type === 'video') {
      this.displayVideo(message);
    } else if (message.type === 'gif') {
      this.displayGif(message);
    }
  }

  private displayImage(message: MediaMessage): void {
    this.clearCurrentMedia();

    const img = document.createElement('img');
    img.id = 'current-media';
    img.src = message.url!;
    img.alt = message.filename || 'Discord image';

    const container = document.getElementById('media-container')!;
    container.appendChild(img);
    this.mediaElement = img;

    if (message.content) {
      this.showText(message.content);
    }

    this.hideMediaTimeout = window.setTimeout(() => {
      this.hideMedia();
    }, this.IMAGE_DISPLAY_DURATION);
  }

  private displayVideo(message: MediaMessage): void {
    this.clearCurrentMedia();

    const video = document.createElement('video');
    video.id = 'current-media';
    video.src = message.url!;
    video.controls = false;
    video.autoplay = true;
    video.loop = false;

    video.addEventListener('ended', () => {
      this.hideMedia();
    });

    const container = document.getElementById('media-container')!;
    container.appendChild(video);
    this.mediaElement = video;

    if (message.content) {
      this.showText(message.content);
    }
  }

  private displayGif(message: MediaMessage): void {
    this.clearCurrentMedia();

    const img = document.createElement('img');
    img.id = 'current-media';
    img.src = message.url!;
    img.alt = message.filename || 'Tenor GIF';

    const container = document.getElementById('media-container')!;
    container.appendChild(img);
    this.mediaElement = img;

    if (message.content) {
      this.showText(message.content);
    }

    this.hideMediaTimeout = window.setTimeout(() => {
      this.hideMedia();
    }, this.IMAGE_DISPLAY_DURATION);
  }

  private showText(content: string): void {
    this.textOverlay.textContent = content;
    this.textOverlay.style.display = 'block';
  }

  private hideText(): void {
    this.textOverlay.style.display = 'none';
    this.textOverlay.textContent = '';
  }

  private hideMedia(): void {
    if (!this.mediaElement) return;

    this.clearCurrentMedia();
    this.hideText();
  }

  private clearCurrentMedia(): void {
    if (this.hideMediaTimeout) {
      clearTimeout(this.hideMediaTimeout);
      this.hideMediaTimeout = null;
    }

    if (this.mediaElement) {
      if (this.mediaElement instanceof HTMLVideoElement) {
        this.mediaElement.pause();
        this.mediaElement.src = '';
        this.mediaElement.load();
      }
      this.mediaElement.remove();
      this.mediaElement = null;
    }
  }

}

document.addEventListener('DOMContentLoaded', () => {
  new LivechatRenderer();
});
