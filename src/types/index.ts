export interface MediaMessage {
    type: 'image' | 'video' | 'text';
    url?: string;
    content?: string;
    author: string;
    timestamp: number;
    filename?: string;
}

export interface Config {
    discordBotToken: string;
    discordChannelId: string;
    websocketPort: number;
}
