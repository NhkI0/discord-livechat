import { Client, GatewayIntentBits, Message, Attachment } from "discord.js";
import { MediaMessage } from "../types";

export class DiscordBot {
    private client: Client;
    private channelId: string;
    private onMediaCallBack?: (message: MediaMessage) => void;

    constructor(token: string, channelId: string) {
        this.channelId = channelId;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
        });

        this.setupEventHandlers(token);
    }

    private setupEventHandlers(token: string): void {
        this.client.on("ready", () => {
            console.log(`Discord bot logged in as ${this.client.user?.tag}`);
        });

        this.client.on('messageCreate', (message) => {
            this.handleMessage(message);
        });

        this.client.login(token);
    }

    private handleMessage(message: Message): void {
        // Ignore messages from other channels or bots
        if (message.channelId !== this.channelId || message.author.bot) {
            return;
        }

        // Handle attachments (images/videos)
        if (message.attachments.size > 0) {
            message.attachments.forEach((attachment: Attachment) => {
                const mediaMessage = this.processAttachment(
                    attachment,
                    message.author.username,
                    message.content // Include text content with media
                );
                if (mediaMessage && this.onMediaCallBack) {
                    this.onMediaCallBack(mediaMessage);
                }
            });
        } else if (message.content && this.onMediaCallBack) {
            // Only send standalone text if there are no attachments
            const textMessage: MediaMessage = {
                type: 'text',
                content: message.content,
                author: message.author.username,
                timestamp: Date.now(),
            };
            this.onMediaCallBack(textMessage);
        }
    }

    private processAttachment(attachment: Attachment, author: string, content?: string): MediaMessage | null {
        const imageExtensions = ["png", "jpg", "jpeg", "gif", "webp"];
        const videoExtensions = ["mp4", "webm", "mov", "avi"];

        const extension = attachment.name?.split('.').pop()?.toLowerCase() || '';

        if (imageExtensions.includes(extension)) {
            return {
                type: 'image',
                url: attachment.url,
                content: content || undefined, // Include text if present
                author,
                timestamp: Date.now(),
                filename: attachment.name,
            };
        } else if (videoExtensions.includes(extension)) {
            return {
                type: 'video',
                url: attachment.url,
                content: content || undefined, // Include text if present
                author,
                timestamp: Date.now(),
                filename: attachment.name,
            };
        }

        return null;
    }

    public onMedia(callback: (message: MediaMessage) => void): void {
        this.onMediaCallBack = callback;
    }

    public disconnect(): void {
        this.client.destroy();
    }
}
