export interface MediaMessage {
    type: 'image' | 'video' | 'gif';
    url?: string;
    content?: string;
    author: string;
    timestamp: number;
    filename?: string;
    id?: number; // Assigned by the server when an item is dispatched from the queue
    metadata?: {
        gifUrl?: string;
        thumbnailUrl?: string;
    }
}

// Messages sent from clients back to the server
export interface ClientMessage {
    type: 'media-done';
    id: number;
}

export interface Config {
    discordBotToken: string;
    discordChannelId: string;
    websocketPort: number;
}
