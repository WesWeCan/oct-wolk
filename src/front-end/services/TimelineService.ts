import type { TimelineDocument, SceneDocumentBase } from '@/types/timeline_types';

export const TimelineService = {
    async createOrLoad(songId: string): Promise<TimelineDocument> {
        const doc = await window.electronAPI.timeline.createOrLoad(songId);
        return doc as TimelineDocument;
    },
    async save(songId: string, timeline: TimelineDocument): Promise<TimelineDocument> {
        const payload = JSON.parse(JSON.stringify(timeline));
        const saved = await window.electronAPI.timeline.save(songId, payload);
        return saved as TimelineDocument;
    },
    async listScenes(songId: string): Promise<string[]> {
        const list = await window.electronAPI.timeline.listScenes(songId);
        return Array.isArray(list) ? list as string[] : [];
    },
    async saveScene(songId: string, scene: SceneDocumentBase): Promise<SceneDocumentBase> {
        const payload = JSON.parse(JSON.stringify(scene));
        const saved = await window.electronAPI.timeline.saveScene(songId, payload);
        return saved as SceneDocumentBase;
    },
    async loadScene(songId: string, sceneId: string): Promise<SceneDocumentBase | null> {
        const scene = await window.electronAPI.timeline.loadScene(songId, sceneId);
        return (scene || null) as SceneDocumentBase | null;
    },
};


