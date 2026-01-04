import { WebSocketServer, WebSocket } from 'ws';
import { MediaMessage } from "../types";

export class LivechatWebSocketServer {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();

    constructor(port: number) {
        this.wss = new WebSocketServer({
            port: port,
            host: '0.0.0.0' // Listen on all network interfaces
        });
        this.setupEventHandlers();
        console.log(`✅ WebSocket server running on 0.0.0.0:${port}`);
        console.log(`📡 External access: ws://YOUR_VPS_IP:${port}`);
    }

    private setupEventHandlers(): void {
        this.wss.on('connection', (ws: WebSocket) => {
            console.log('🔗 New client connected');
            this.clients.add(ws);

            ws.on('close', () => {
                console.log('❌ Client disconnected');
                this.clients.delete(ws);
            });

            ws.on('error', (err: Error) => {
                console.error('WebSocket error:', err);
                this.clients.delete(ws);
            });

            ws.send(JSON.stringify({ type: 'connected', message: 'Connected to Livechat server!' }));
        });
    }

    public broadcast(message: MediaMessage): void {
        const payload = JSON.stringify(message);

        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });

        console.log(`📤 Broadcasted ${message.type} to ${this.clients.size} client(s)`);
    }

    public close(): void {
        this.wss.close();
    }
}
