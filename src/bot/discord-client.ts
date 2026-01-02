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

        this.setupEvenHandlers(token);
    }

    private setupEvenHandlers(token: string): void {
        this.client.on("ready", () => {
            console.log(`Discord bot logged in as ${this.client.user?.tag})`);
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
                const mediaMessage = this.processAttachment(attachment, message.author.username);
                if (mediaMessage && this.onMediaCallBack) {
                    this.onMediaCallBack(mediaMessage);
                }
            });
        }

        // Handle text messages (optional)
        if (message.content && this.onMediaCallBack) {
            const textMessage: MediaMessage = {
                type: 'text',
                content: message.content,
                author: message.author.username,
                timestamp: Date.now(),
            };
            this.onMediaCallBack(textMessage);
        }
    }

    private processAttachment(attachment: Attachment, author: string): MediaMessage | null {
        const imageExtensions = ["png", "jpg", "jpeg", "gif", "webp"];
        const videoExtensions = ["mp4", "webm", "mov", "avi"];

        const extension = attachment.name?.split('.').pop()?.toLowerCase() || '';

        if (imageExtensions.includes(extension)) {
            return {
                type: 'image',
                url: attachment.url,
                author,
                timestamp: Date.now(),
                filename: attachment.name,
            };
        } else if (videoExtensions.includes(extension)) {
            return {
                type: 'video',
                url: attachment.url,
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
