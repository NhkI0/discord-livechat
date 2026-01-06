import { Client, GatewayIntentBits, Message, Attachment, ActivityType } from "discord.js";
import { MediaMessage } from "../types";

export class DiscordBot {
    private client: Client;
    private readonly channelId: string;
    private onMediaCallBack?: (message: MediaMessage) => void;
    public numberUsers: number = 0;

    public setStatus(): void {
        // @ts-ignore
        this.client.user.setPresence({
            activities: [{
                name: `${this.numberUsers} online`,
                type: ActivityType.Watching,
            }],
            status: 'online'
        });
    }

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

    private extractUrls(content: string): string[] {
        const urlRegex = /(https?:\/\/\S+)/g
        const matches = content.match(urlRegex);
        return matches || [];
    }

    private isTenorUrl(url: string): boolean {
        return url.includes('tenor.com');
    }

    private isTenorDirectUrl(url: string): boolean {
        return url.includes('media.tenor.com') && (url.endsWith('.gif') || url.endsWith('.mp4'));
    }

    private async getTenorGifUrl(tenorUrl: string): Promise<string | null> {
        try {
            if (this.isTenorDirectUrl(tenorUrl)) {
                console.log('✅ Direct Tenor media URL:', tenorUrl);
                return tenorUrl;
            }

            // Match the digits at the end of the URL
            // Format: https://tenor.com/view/words-words-gif-DIGITS
            const match = tenorUrl.match(/tenor\.com\/view\/.*-(\d+)$/);
            if (!match) {
                console.log('❌ Could not extract Tenor GIF ID from:', tenorUrl);
                return null;
            }

            const gifId = match[1];
            const apiKey = process.env.TENOR_API_KEY || '';

            if (!apiKey) {
                console.warn('⚠️ TENOR_API_KEY not set in .env file. Cannot fetch Tenor GIFs.');
                return null;
            }

            console.log('📥 Fetching Tenor GIF:', gifId);
            const response = await fetch(
                `https://tenor.googleapis.com/v2/posts?ids=${gifId}&key=${apiKey}`,
            );

            if (!response.ok) {
                console.error('❌ Tenor API error:', response.status, response.statusText);
                return null;
            }

            const data = await response.json() as {
                results?: { media_formats?: { gif?: { url: string } } }[];
            };

            if (data.results && data.results[0] && data.results[0].media_formats?.gif) {
                const gifUrl = data.results[0].media_formats.gif.url;
                console.log('✅ Tenor GIF URL fetched:', gifUrl);
                return gifUrl;
            }

            console.warn('⚠️ No results from Tenor API for ID:', gifId);
            return null;
        } catch (error) {
            console.error('❌ Error fetching Tenor GIF:', error);
            return null;
        }
    }

    private setupEventHandlers(token: string): void {
        this.client.on("ready", () => {
            console.log(`Discord bot logged in as ${this.client.user?.tag}`);
            this.setStatus()
        });

        this.client.on('messageCreate', (message) => {
            this.handleMessage(message);
        });

        this.client.login(token);
    }

    private async handleMessage(message: Message): Promise<void> {
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
            return;
        }
        if (message.content) {
            const urls = this.extractUrls(message.content);

            for (const url of urls) {
                if (this.isTenorUrl(url)) {
                    const gifUrl = await this.getTenorGifUrl(url);
                    if (gifUrl) {
                        const giftMessage: MediaMessage = {
                            type: 'gif',
                            url: gifUrl,
                            content: message.content.replace(url, '').trim(),
                            author: message.author.username,
                            timestamp: Date.now(),
                            metadata: {
                                gifUrl: gifUrl,
                            },
                        };
                        if (this.onMediaCallBack) {
                            this.onMediaCallBack(giftMessage);
                        }
                        return;
                    }
                }
            }
        }
    }

    private processAttachment(attachment: Attachment, author: string, content?: string): MediaMessage | null {
        const imageExtensions = ["png", "jpg", "jpeg", "gif", "webp", "jfif", "jpe"];
        const videoExtensions = ["mp4", "webm", "mov", "avi"];

        const extension = attachment.name?.split('.').pop()?.toLowerCase() || '';

        if (extension === 'jfif' || attachment.name?.toLowerCase().includes('jfif')) {
            console.log('📸 JFIF file detected:', {
                filename: attachment.name,
                extension: extension,
                url: attachment.url,
                contentType: attachment.contentType
            });
        }

        if (imageExtensions.includes(extension)) {
            return {
                type: 'image',
                url: attachment.url,
                content: content || undefined, // Include text if present
                author,
                timestamp: Date.now(),
                filename: attachment.name,
            };
        }

        if (attachment.contentType?.startsWith('image/')) {
            console.log('✨ Image detected by MIME type:', {
                filename: attachment.name,
                contentType: attachment.contentType,
                extension: extension
            });
            return {
                type: 'image',
                url: attachment.url,
                content: content || undefined,
                author,
                timestamp: Date.now(),
                filename: attachment.name,
            };
        }

        if (videoExtensions.includes(extension)) {
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
