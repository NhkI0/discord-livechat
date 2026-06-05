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
    private expectedAcks: Set<WebSocket> = new Set();
    private ackedClients: Set<WebSocket> = new Set();
    private advanceTimer: NodeJS.Timeout | null = null;
    private nextId = 0;

    // Safety backstop: advance the queue even if a client never acks (e.g. it crashed).
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
                this.handleClientMessage(ws, data.toString());
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
        // If we were waiting on this client to finish the current item, stop waiting
        // so a viewer leaving mid-item can't wedge the queue.
        this.expectedAcks.delete(ws);
        this.ackedClients.delete(ws);
        this.maybeAdvance();
    }

    private handleClientMessage(ws: WebSocket, raw: string): void {
        let msg: ClientMessage;
        try {
            msg = JSON.parse(raw);
        } catch {
            return; // ignore non-JSON
        }

        if (msg.type === 'media-done') {
            // Ignore acks for items that are no longer current (stale/late acks) and
            // acks from clients that weren't sent the current item (late joiners).
            if (msg.id !== this.currentItemId || !this.expectedAcks.has(ws)) {
                return;
            }
            this.ackedClients.add(ws);
            this.maybeAdvance();
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

        // Snapshot the viewers that receive this item; only they need to ack it.
        this.expectedAcks = new Set();
        this.ackedClients = new Set();
        const payload = JSON.stringify(next);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
                this.expectedAcks.add(client);
            }
        });

        console.log(`📤 Dispatched ${next.type} (#${next.id}) to ${this.expectedAcks.size} client(s); ${this.queue.length} waiting`);

        if (this.expectedAcks.size === 0) {
            // No viewers to ack — drain harmlessly (same as broadcasting to nobody).
            setImmediate(() => this.completeCurrent());
            return;
        }

        this.advanceTimer = setTimeout(() => {
            console.log(`⏱️ Item #${this.currentItemId} timed out waiting for acks; advancing`);
            this.completeCurrent();
        }, this.MAX_ITEM_DURATION);
    }

    // Advance once every still-connected viewer that received the item has acked it.
    private maybeAdvance(): void {
        if (this.currentItem === null) return;
        for (const client of this.expectedAcks) {
            if (client.readyState === WebSocket.OPEN && !this.ackedClients.has(client)) {
                return; // still waiting on someone
            }
        }
        this.completeCurrent();
    }

    private completeCurrent(): void {
        if (this.advanceTimer) {
            clearTimeout(this.advanceTimer);
            this.advanceTimer = null;
        }
        this.currentItem = null;
        this.currentItemId = null;
        this.expectedAcks.clear();
        this.ackedClients.clear();
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
