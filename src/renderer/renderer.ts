interface MediaMessage {
  type: 'image' | 'video' | 'text';
  url?: string;
  content?: string;
  author: string;
  timestamp: number;
  filename?: string;
}

class LivechatRenderer {
  private ws: WebSocket | null = null;
  private mediaElement: HTMLImageElement | HTMLVideoElement | null = null;
  private textOverlay: HTMLDivElement;
  private placeholder: HTMLDivElement;
  private statusText: HTMLSpanElement;

  constructor() {
    this.textOverlay = document.getElementById('text-overlay') as HTMLDivElement;
    this.placeholder = document.getElementById('placeholder') as HTMLDivElement;
    this.statusText = document.getElementById('status-text') as HTMLSpanElement;
    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    const wsUrl = 'ws://localhost:8080';
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Connected to WebSocket server');
      this.updateStatus('Connected', true);
    };

    this.ws.onmessage = (event) => {
      const message: MediaMessage = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.updateStatus('Error', false);
    };

    this.ws.onclose = () => {
      console.log('Disconnected from WebSocket');
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
    } else if (message.type === 'text') {
      this.displayText(message);
    }
  }

  private displayImage(message: MediaMessage): void {
    this.clearCurrentMedia();
    this.placeholder.style.display = 'none';

    const img = document.createElement('img');
    img.id = 'current-media';
    img.src = message.url!;
    img.alt = message.filename || 'Discord image';

    const container = document.getElementById('media-container')!;
    container.appendChild(img);
    this.mediaElement = img;

    this.showAuthor(message.author);
  }

  private displayVideo(message: MediaMessage): void {
    this.clearCurrentMedia();
    this.placeholder.style.display = 'none';

    const video = document.createElement('video');
    video.id = 'current-media';
    video.src = message.url!;
    video.controls = true;
    video.autoplay = true;
    video.loop = true;

    const container = document.getElementById('media-container')!;
    container.appendChild(video);
    this.mediaElement = video;

    this.showAuthor(message.author);
  }

  private displayText(message: MediaMessage): void {
    this.textOverlay.innerHTML = `
      <div class="author">${message.author}</div>
      <div>${message.content}</div>
    `;
    this.textOverlay.style.display = 'block';

    // Hide after 10 seconds
    setTimeout(() => {
      this.textOverlay.style.display = 'none';
    }, 10000);
  }

  private showAuthor(author: string): void {
    this.textOverlay.innerHTML = `<div class="author">Posted by ${author}</div>`;
    this.textOverlay.style.display = 'block';

    // Hide after 5 seconds
    setTimeout(() => {
      this.textOverlay.style.display = 'none';
    }, 5000);
  }

  private clearCurrentMedia(): void {
    if (this.mediaElement) {
      this.mediaElement.remove();
      this.mediaElement = null;
    }
  }

  private updateStatus(text: string, connected: boolean): void {
    this.statusText.textContent = text;
    const dot = document.querySelector('.status-dot') as HTMLDivElement;
    dot.style.background = connected ? '#4caf50' : '#f44336';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new LivechatRenderer();
});