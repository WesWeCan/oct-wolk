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

    // Minimal doc map for inspector: animatable keys per scene type
    static getAnimatableParams(sceneType: string): string[] {
        switch (sceneType) {
            case 'model3d':
                return [
                    'camera.yaw','camera.pitch','camera.distance','camera.fov','camera.targetX','camera.targetY','camera.targetZ',
                    'model.scale','model.scaleX','model.scaleY','model.scaleZ','model.positionX','model.positionY','model.positionZ',
                    'model.rotationX','model.rotationY','model.rotationZ',
                    'labels.size','labels.opacity','labels.pulseAmount','labels.bgHue','labels.bgSat','labels.bgLight','labels.textHue','labels.textSat','labels.textLight',
                    'plexus.opacityMin','plexus.opacityMax','plexus.kNeighbors','plexus.maxDistance',
                    'spokes.opacity','spokes.lengthFactor',
                    'background.hue','background.sat','background.light','background.opacity',
                    'reactivity.model','reactivity.labels'
                ];
            case 'wordSphere':
                return [
                    'rotationX','rotationY','rotationZ',
                    'camera.yaw','camera.pitch','camera.distance','camera.fov','camera.targetX','camera.targetY','camera.targetZ',
                    'labels.size','labels.opacity','labels.pulseAmount','labels.bgHue','labels.bgSat','labels.bgLight',
                    'plexus.opacityMin','plexus.opacityMax','plexus.kNeighbors','plexus.maxDistance',
                    'spokes.opacity','spokes.lengthFactor',
                    'background.hue','background.sat','background.light','background.opacity'
                ];
            case 'singleWord':
                return [
                    'background.hue','background.sat','background.light',
                    'word.scale','word.opacity','word.rotationDeg','word.offsetX','word.offsetY'
                ];
            case 'wordcloud':
                return [
                    'background.hue','background.sat','background.light',
                    'word.scale','word.opacity','word.globalHueShift',
                    'cloud.scale','cloud.rotationDeg','cloud.jitter'
                ];
            default:
                return [];
        }
    }
}


