import type { Song } from '@/types/song_types';

declare global {
    interface Window {
        electronAPI: any;
    }
}

export const SongService = {
    async create(initial?: Partial<Song>): Promise<Song> {
        const song = await window.electronAPI.songs.create(initial);
        return song as Song;
    },
    async save(song: Song): Promise<Song> {
        // Ensure it's a plain clone for structured clone algorithm
        const payload = JSON.parse(JSON.stringify(song));
        const saved = await window.electronAPI.songs.save(payload);
        return saved as Song;
    },
    async load(songId: string): Promise<Song | null> {
        const song = await window.electronAPI.songs.load(songId);
        return (song || null) as Song | null;
    },
    async list(): Promise<Song[]> {
        const list = await window.electronAPI.songs.list();
        return (Array.isArray(list) ? list : []) as Song[];
    },
};


