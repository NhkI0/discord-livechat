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

class LivechatRenderer {
  private ws: WebSocket | null = null;
  private mediaElement: HTMLImageElement | HTMLVideoElement | null = null;
  private textOverlay: HTMLDivElement;
  private hideMediaTimeout: number | null = null;

  private readonly IMAGE_DISPLAY_DURATION = 6000;
  // Read WebSocket URL from config or use default
  private readonly WS_URL = (window as any).WEBSOCKET_SERVER_URL || 'ws://localhost:8080';

  constructor() {
    this.textOverlay = document.getElementById('text-overlay') as HTMLDivElement;
    this.connectWebSocket();
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts(): void {
    // Listen for skip-media IPC event from main process (global shortcuts)
    if ((window as any).electronAPI) {
      (window as any).electronAPI.onSkipMedia(() => {
        console.log('📨 Received skip-media IPC event');
        if (this.mediaElement) {
          console.log('⏭️ Skipping current media via global keyboard shortcut');
          this.hideMedia();
        } else {
          console.log('ℹ️ No media currently playing to skip');
        }
      });
      console.log('✅ Keyboard shortcut listener registered in renderer');
    } else {
      console.error('❌ electronAPI not available - shortcuts will not work');
    }
  }

  private connectWebSocket(): void {
    console.log(`Connecting to WebSocket server: ${this.WS_URL}`);
    this.ws = new WebSocket(this.WS_URL);

    this.ws.onopen = () => {
      console.log('✅ Connected to WebSocket server');
      this.updateStatus('Connected', true);
    };

    this.ws.onmessage = (event) => {
      const message: MediaMessage = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.updateStatus('Error', false);
    };

    this.ws.onclose = () => {
      console.log('❌ Disconnected from WebSocket');
      this.updateStatus('Disconnected', false);
      // Attempt reconnection after 3 seconds
      setTimeout(() => this.connectWebSocket(), 3000);
    };
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
      this.mediaElement.remove();
      this.mediaElement = null;
    }
  }

  private updateStatus(text: string, connected: boolean): void {
    console.log(`WebSocket status: ${text}`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new LivechatRenderer();
});
