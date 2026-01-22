export interface MediaMessage {
    type: 'image' | 'video' | 'gif';
    url?: string;
    content?: string;
    author: string;
    timestamp: number;
    filename?: string;
    metadata?: {
        gifUrl?: string;
        thumbnailUrl?: string;
    }
}

export interface Config {
    discordBotToken: string;
    discordChannelId: string;
    websocketPort: number;
}
