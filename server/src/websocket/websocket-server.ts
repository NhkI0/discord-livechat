import { WebSocketServer, WebSocket } from 'ws';
import { MediaMessage, ClientMessage } from "../types";
import { DiscordBot } from '../bot/discord-client';

export class LivechatWebSocketServer {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();
    private bot: DiscordBot = new DiscordBot(process.env.DISCORD_BOT_TOKEN!, process.env.DISCORD_CHANNEL_ID!);

    // Global media queue (waiting list)
    private queue: MediaMessage[] = [];
    private currentItem: MediaMessage | null = null;
    private currentItemId: number | null = null;
    private advanceTimer: NodeJS.Timeout | null = null;
    private nextId = 0;

    // Safety backstop: advance the queue even if no client ever acks (e.g. no
    // viewers connected, or a client crashed mid-display).
    private readonly MAX_ITEM_DURATION = parseInt(process.env.MAX_MEDIA_DURATION_MS || '60000', 10);

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
            this.bot.numberUsers += 1;
            this.bot.setStatus()

            ws.on('message', (data) => {
                this.handleClientMessage(data.toString());
            });

            ws.on('close', () => {
                console.log('❌ Client disconnected');
                this.removeClient(ws);
                this.bot.numberUsers -= 1;
                this.bot.setStatus()
            });

            ws.on('error', (err: Error) => {
                console.error('WebSocket error:', err);
                this.removeClient(ws);
            });

            ws.send(JSON.stringify({ type: 'connected', message: 'Connected to Livechat server!' }));
        });
    }

    private removeClient(ws: WebSocket): void {
        this.clients.delete(ws);
        // If the last viewer leaves mid-item, don't sit on the backstop — drain.
        if (this.currentItem !== null && this.countOpenClients() === 0) {
            this.completeCurrent();
        }
    }

    private countOpenClients(): number {
        let n = 0;
        this.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) n++; });
        return n;
    }

    private handleClientMessage(raw: string): void {
        let msg: ClientMessage;
        try {
            msg = JSON.parse(raw);
        } catch {
            return; // ignore non-JSON
        }

        // Advance on the first ack for the current item. Stale/late acks (for an
        // item that's no longer current) are ignored.
        if (msg.type === 'media-done' && msg.id === this.currentItemId) {
            console.log(`✅ Ack for item #${msg.id}; advancing queue`);
            this.completeCurrent();
        }
    }

    // Public entry point: enqueue media instead of broadcasting immediately.
    public enqueue(message: MediaMessage): void {
        this.queue.push(message);
        if (this.currentItem === null) {
            this.dispatchNext();
        }
    }

    private dispatchNext(): void {
        const next = this.queue.shift();
        if (!next) {
            this.currentItem = null;
            this.currentItemId = null;
            return;
        }

        next.id = ++this.nextId;
        this.currentItem = next;
        this.currentItemId = next.id;

        const payload = JSON.stringify(next);
        let sent = 0;
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
                sent++;
            }
        });

        console.log(`📤 Dispatched ${next.type} (#${next.id}) to ${sent} client(s); ${this.queue.length} waiting`);

        if (sent === 0) {
            // No viewers to ack — drain harmlessly (same as broadcasting to nobody).
            setImmediate(() => this.completeCurrent());
            return;
        }

        this.advanceTimer = setTimeout(() => {
            console.log(`⏱️ Item #${this.currentItemId} timed out waiting for an ack; advancing`);
            this.completeCurrent();
        }, this.MAX_ITEM_DURATION);
    }

    private completeCurrent(): void {
        if (this.advanceTimer) {
            clearTimeout(this.advanceTimer);
            this.advanceTimer = null;
        }
        this.currentItem = null;
        this.currentItemId = null;
        this.dispatchNext();
    }

    public close(): void {
        if (this.advanceTimer) {
            clearTimeout(this.advanceTimer);
            this.advanceTimer = null;
        }
        this.wss.close();
    }
}
