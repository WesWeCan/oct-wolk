import { ref } from 'vue';
import type { Ref } from 'vue';
import type { MotionBlockType, WolkProject } from '@/types/project_types';
import type { MotionBlockRenderer, MotionFrameRuntimeScaffolds } from '@/front-end/motion-blocks/core/types';
import { createDeterministicRandomness } from '@/front-end/motion/deterministicRandomness';
import { msToFrame } from '@/front-end/utils/motion/enterExitAnimation';
import { ensureMotionBlockPluginsRegistered } from '@/front-end/motion-blocks';
import { getMotionBlockPlugin, getMotionTrackPlugin, requireMotionBlockPlugin } from '@/front-end/motion-blocks/core/registry';

import { evalInterpolatedAtFrame } from '@/front-end/utils/tracks';
import { ensureDocumentFont, primeDocumentFont } from '@/front-end/utils/fonts/fontLoader';
import { fontDescriptorFromProjectFont } from '@/front-end/utils/fonts/fontUtils';

const getProjectMotionFonts = (project: WolkProject) => {
    const fonts = [fontDescriptorFromProjectFont(project.font)];

    for (const track of project.motionTracks) {
        const plugin = getMotionTrackPlugin(track);
        if (plugin.collectFonts) fonts.push(...plugin.collectFonts(project, track));
    }

    return fonts.filter((font, index, list) => (
        list.findIndex((candidate) => (
            candidate.family === font.family &&
            candidate.localPath === font.localPath &&
            candidate.style === font.style &&
            candidate.weight === font.weight
        )) === index
    ));
};

export function useMotionRenderer(renderCanvas: Ref<HTMLCanvasElement | null>) {
    ensureMotionBlockPluginsRegistered();
    const rendererByTrackId = ref<Map<string, { type: MotionBlockType; renderer: MotionBlockRenderer }>>(new Map());
    const bgImageCache = new Map<string, HTMLImageElement>();
    const bgImageFailed = new Set<string>();


    const ensureRenderer = (trackId: string, type: MotionBlockType): MotionBlockRenderer => {
        const existing = rendererByTrackId.value.get(trackId);
        if (existing && existing.type === type) return existing.renderer;
        if (existing && existing.type !== type) {
            existing.renderer.dispose();
            rendererByTrackId.value.delete(trackId);
        }
        const renderer = requireMotionBlockPlugin(type).createRenderer();
        rendererByTrackId.value.set(trackId, { type, renderer });
        return renderer;
    };

    const primeProjectFonts = (project: WolkProject): void => {
        for (const font of getProjectMotionFonts(project)) primeDocumentFont(font);
    };

    const ensureProjectFonts = async (project: WolkProject): Promise<void> => {
        await Promise.all(getProjectMotionFonts(project).map((font) => ensureDocumentFont(font)));
    };

    const renderMotionFrame = (
        project: WolkProject,
        currentMs: number,
        runtimeScaffolds?: MotionFrameRuntimeScaffolds,
    ): void => {
        primeProjectFonts(project);
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
        const backgroundVisible = project.backgroundVisible !== false;
        const backgroundImageVisible = project.backgroundImageVisible !== false;
        const backgroundColorOpacity = Number.isFinite(project.backgroundColorOpacity as number)
            ? Math.max(0, Math.min(1, project.backgroundColorOpacity as number))
            : 1;
        const backgroundUseGradient = !!project.backgroundUseGradient;
        const backgroundGradientColor = typeof project.backgroundGradientColor === 'string'
            ? project.backgroundGradientColor
            : '#222222';
        const backgroundGradientAngle = Number.isFinite(project.backgroundGradientAngle as number)
            ? Number(project.backgroundGradientAngle)
            : 90;
        const backgroundImageX = Number.isFinite(project.backgroundImageX as number) ? (project.backgroundImageX as number) : 0;
        const backgroundImageY = Number.isFinite(project.backgroundImageY as number) ? (project.backgroundImageY as number) : 0;
        const backgroundImageScale = Number.isFinite(project.backgroundImageScale as number)
            ? Math.max(0.05, project.backgroundImageScale as number)
            : 1;
        const backgroundImageOpacity = Number.isFinite(project.backgroundImageOpacity as number)
            ? Math.max(0, Math.min(1, project.backgroundImageOpacity as number))
            : 1;

        if (backgroundVisible && project.backgroundColor && project.backgroundColor !== 'transparent' && backgroundColorOpacity > 0) {
            ctx.save();
            ctx.globalAlpha = backgroundColorOpacity;
            if (backgroundUseGradient) {
                const angleRad = (backgroundGradientAngle * Math.PI) / 180;
                const halfDiag = Math.sqrt(width * width + height * height) / 2;
                const cx = width / 2;
                const cy = height / 2;
                const x0 = cx - Math.cos(angleRad) * halfDiag;
                const y0 = cy - Math.sin(angleRad) * halfDiag;
                const x1 = cx + Math.cos(angleRad) * halfDiag;
                const y1 = cy + Math.sin(angleRad) * halfDiag;
                const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
                gradient.addColorStop(0, project.backgroundColor);
                gradient.addColorStop(1, backgroundGradientColor);
                ctx.fillStyle = gradient;
            } else {
                ctx.fillStyle = project.backgroundColor;
            }
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        }
        if (backgroundVisible && backgroundImageVisible && project.backgroundImage) {
            const src = project.backgroundImage;
            let img = bgImageCache.get(src);
            if (!img && !bgImageFailed.has(src)) {
                img = new Image();
                img.src = src;
                img.onload = () => bgImageCache.set(src, img!);
                img.onerror = () => bgImageFailed.add(src);
            }
            if (img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
                ctx.save();
                ctx.globalAlpha = backgroundImageOpacity;
                const fit = project.backgroundImageFit || 'cover';
                if (fit === 'stretch') {
                    const drawWidth = width * backgroundImageScale;
                    const drawHeight = height * backgroundImageScale;
                    const dx = ((width - drawWidth) / 2) + backgroundImageX;
                    const dy = ((height - drawHeight) / 2) + backgroundImageY;
                    ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
                } else {
                    const scale = fit === 'contain'
                        ? Math.min(width / img.naturalWidth, height / img.naturalHeight)
                        : Math.max(width / img.naturalWidth, height / img.naturalHeight);
                    const finalScale = scale * backgroundImageScale;
                    const drawWidth = img.naturalWidth * finalScale;
                    const drawHeight = img.naturalHeight * finalScale;
                    const dx = ((width - drawWidth) / 2) + backgroundImageX;
                    const dy = ((height - drawHeight) / 2) + backgroundImageY;
                    ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
                }
                ctx.restore();
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
            const plugin = getMotionBlockPlugin(block.type);
            if (!plugin) continue;
            const blockStart = msToFrame(block.startMs, fps);
            const blockEnd = msToFrame(block.endMs, fps);
            if (currentFrame < blockStart || currentFrame > blockEnd) continue;

            const sourceTrack = lyricTrackById.get(block.sourceTrackId);
            const activeItems = plugin.resolveActiveItems(block, sourceTrack, currentFrame, fps);
            const allItems = plugin.resolveBlockItems(block, sourceTrack, currentFrame, fps);
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
                legacyModulation: runtimeScaffolds?.legacyModulation ?? null,
                deterministicRandomness: createDeterministicRandomness(
                    project.settings.seed || 'wolk-default',
                    `${track.id}:${block.id}`,
                ),
                legacyManifestId: runtimeScaffolds?.legacyManifestId ?? null,
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
        primeProjectFonts,
        ensureProjectFonts,
        renderMotionFrame,
        getRendererBounds,
        dispose,
    };
}
