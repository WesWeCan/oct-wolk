import type { Song } from '@/types/song_types';


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
    async uploadCover(songId: string, file: File): Promise<Song> {
        const arrayBuffer = await file.arrayBuffer();
        const updated = await window.electronAPI.songs.uploadCover(songId, arrayBuffer, file.name);
        return updated as Song;
    },
    async uploadAudio(songId: string, file: File): Promise<Song> {
        const arrayBuffer = await file.arrayBuffer();
        const updated = await window.electronAPI.songs.uploadAudio(songId, arrayBuffer, file.name);
        return updated as Song;
    },
};


