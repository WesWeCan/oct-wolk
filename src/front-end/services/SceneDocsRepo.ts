import type { SceneDocumentBase } from '@/types/timeline_types';
import { TimelineService } from '@/front-end/services/TimelineService';

export class SceneDocsRepo {
    private cache: Record<string, SceneDocumentBase> = {};
    constructor(private songId: string) {}

    get(id: string): SceneDocumentBase | undefined { return this.cache[id]; }

    async ensure(id: string, fallback?: SceneDocumentBase): Promise<SceneDocumentBase | undefined> {
        if (this.cache[id]) return this.cache[id];
        try {
            const doc = await TimelineService.loadScene(this.songId, id);
            if (doc) { this.cache[id] = doc; return doc; }
        } catch {}
        if (fallback) {
            try { const saved = await TimelineService.saveScene(this.songId, fallback); this.cache[id] = saved; return saved; } catch {}
        }
        return undefined;
    }

    set(doc: SceneDocumentBase) { this.cache[doc.id] = doc; }

    async save(doc: SceneDocumentBase): Promise<SceneDocumentBase> {
        const saved = await TimelineService.saveScene(this.songId, doc);
        this.cache[doc.id] = saved;
        return saved;
    }
}


