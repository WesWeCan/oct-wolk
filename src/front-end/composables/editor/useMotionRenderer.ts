import { ref } from 'vue';
import type { Ref } from 'vue';
import type { MotionBlockType, WolkProject } from '@/types/project_types';
import { createBlockRenderer, hasBlockType, registerBlockType } from '@/front-end/motion/MotionBlockRegistry';
import type { MotionBlockRenderer } from '@/front-end/motion/types';
import { msToFrame } from '@/front-end/utils/motion/enterExitAnimation';
import { resolveActiveItems, resolveBlockItems } from '@/front-end/utils/motion/resolveMotionItems';
import { SubtitleRenderer } from '@/front-end/motion/renderers/SubtitleRenderer';

import { evalInterpolatedAtFrame } from '@/front-end/utils/tracks';

export function useMotionRenderer(renderCanvas: Ref<HTMLCanvasElement | null>) {
    const rendererByTrackId = ref<Map<string, { type: MotionBlockType; renderer: MotionBlockRenderer }>>(new Map());
    const bgImageCache = new Map<string, HTMLImageElement>();
    const bgImageFailed = new Set<string>();

    if (!hasBlockType('subtitle')) {
        registerBlockType('subtitle', () => new SubtitleRenderer());
    }


    const ensureRenderer = (trackId: string, type: MotionBlockType): MotionBlockRenderer => {
        const existing = rendererByTrackId.value.get(trackId);
        if (existing && existing.type === type) return existing.renderer;
        if (existing && existing.type !== type) {
            existing.renderer.dispose();
            rendererByTrackId.value.delete(trackId);
        }
        const renderer = createBlockRenderer(type);
        rendererByTrackId.value.set(trackId, { type, renderer });
        return renderer;
    };

    const renderMotionFrame = (project: WolkProject, currentMs: number): void => {
        const canvas = renderCanvas.value;
        if (!canvas) return;

        const width = project.settings.renderWidth || 1920;
        const height = project.settings.renderHeight || 1080;
        const fps = Math.max(1, project.settings.fps || 60);

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);
        if (project.backgroundColor && project.backgroundColor !== 'transparent') {
            ctx.fillStyle = project.backgroundColor;
            ctx.fillRect(0, 0, width, height);
        }
        if (project.backgroundImage) {
            const src = project.backgroundImage;
            let img = bgImageCache.get(src);
            if (!img && !bgImageFailed.has(src)) {
                img = new Image();
                img.src = src;
                img.onload = () => bgImageCache.set(src, img!);
                img.onerror = () => bgImageFailed.add(src);
            }
            if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
                const fit = project.backgroundImageFit || 'cover';
                if (fit === 'stretch') {
                    ctx.drawImage(img, 0, 0, width, height);
                } else {
                    const scale = fit === 'contain'
                        ? Math.min(width / img.naturalWidth, height / img.naturalHeight)
                        : Math.max(width / img.naturalWidth, height / img.naturalHeight);
                    const drawWidth = img.naturalWidth * scale;
                    const drawHeight = img.naturalHeight * scale;
                    const dx = (width - drawWidth) / 2;
                    const dy = (height - drawHeight) / 2;
                    ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
                }
            }
        }

        const currentFrame = msToFrame(currentMs, fps);
        const lyricTrackById = new Map(project.lyricTracks.map((track) => [track.id, track]));

        const aliveTrackIds = new Set(project.motionTracks.map((track) => track.id));
        for (const [trackId, rendererEntry] of rendererByTrackId.value.entries()) {
            if (!aliveTrackIds.has(trackId)) {
                rendererEntry.renderer.dispose();
                rendererByTrackId.value.delete(trackId);
            }
        }

        const anySoloed = project.motionTracks.some((track) => track.solo && !track.muted && track.enabled);
        for (const track of project.motionTracks) {
            if (!track.enabled) continue;
            if (anySoloed) {
                if (!track.solo || track.muted) continue;
            } else if (track.muted) {
                continue;
            }
            const block = track.block;
            const blockStart = msToFrame(block.startMs, fps);
            const blockEnd = msToFrame(block.endMs, fps);
            if (currentFrame < blockStart || currentFrame > blockEnd) continue;

            const sourceTrack = lyricTrackById.get(block.sourceTrackId);
            const activeItems = resolveActiveItems(block, sourceTrack, currentFrame, fps);
            const allItems = resolveBlockItems(block, sourceTrack, currentFrame, fps);
            const animatedProps: Record<string, any> = {};
            for (const propertyTrack of block.propertyTracks || []) {
                if (!propertyTrack?.propertyPath) continue;
                if (propertyTrack.enabled === false) continue;
                if (!propertyTrack.keyframes?.length) continue;
                const last = propertyTrack.keyframes.at(-1);
                animatedProps[propertyTrack.propertyPath] = evalInterpolatedAtFrame(
                    propertyTrack as any,
                    currentFrame,
                    last?.value,
                );
            }
            const renderer = ensureRenderer(track.id, block.type);
            renderer.prepare(block);
            renderer.render(ctx, activeItems, {
                project,
                track,
                block,
                currentFrame,
                fps,
                canvasSize: { width, height },
                allItems,
            }, animatedProps);
        }
    };

    const dispose = (): void => {
        for (const renderer of rendererByTrackId.value.values()) renderer.renderer.dispose();
        rendererByTrackId.value.clear();
        bgImageCache.clear();
        bgImageFailed.clear();
    };

    const getRendererBounds = (trackId: string) => {
        const entry = rendererByTrackId.value.get(trackId);
        return entry?.renderer.getLastBounds?.() ?? null;
    };

    return {
        renderMotionFrame,
        getRendererBounds,
        dispose,
    };
}
