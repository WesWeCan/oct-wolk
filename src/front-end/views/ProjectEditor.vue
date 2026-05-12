<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import SvgIcon from '@jamescoyle/vue-icon';
import {
    mdiArrowDown,
    mdiArrowUp,
    mdiCheck,
    mdiContentCopy,
    mdiCrosshairs,
    mdiDiamond,
    mdiDiamondOutline,
    mdiLock,
    mdiMagnet,
    mdiMusicNote,
    mdiEye,
    mdiEyeOff,
    mdiHomeVariantOutline,
    mdiLoading,
    mdiPause,
    mdiPencil,
    mdiPlay,
    mdiSkipNext,
    mdiSkipPrevious,
    mdiStop,
} from '@mdi/js';
import {
    TRACK_COLORS,
    type MotionTrack,
    type WolkProject,
    type LyricTrack,
    type TimelineItem,
} from '@/types/project_types';
import { ProjectService } from '@/front-end/services/ProjectService';
import { useAudioPlayer } from '@/front-end/composables/editor/useAudioPlayer';
import { useAudioAnalysis } from '@/front-end/composables/editor/useAudioAnalysis';
import { useTimelineViewport } from '@/front-end/components/timeline/useTimelineViewport';
import { usePreviewCanvas } from '@/front-end/composables/editor/usePreviewCanvas';
import { useMotionRenderer } from '@/front-end/composables/editor/useMotionRenderer';
import { useSnapEngine, type SnapTarget } from '@/front-end/composables/timeline/useSnapEngine';
import { randomUUID } from '@/front-end/utils/uuid';
import RulerLane from '@/front-end/components/timeline/lanes/RulerLane.vue';
import WaveformLane from '@/front-end/components/timeline/lanes/WaveformLane.vue';
import EnergyLane from '@/front-end/components/timeline/lanes/EnergyLane.vue';
import BeatsLane from '@/front-end/components/timeline/lanes/BeatsLane.vue';
import BandsLane from '@/front-end/components/timeline/lanes/BandsLane.vue';
import BeatStrengthLane from '@/front-end/components/timeline/lanes/BeatStrengthLane.vue';
import LyricTrackLane from '@/front-end/components/timeline/lanes/LyricTrackLane.vue';
import MotionTrackLane from '@/front-end/components/timeline/lanes/MotionTrackLane.vue';
import PropertyKeyframeLane from '@/front-end/components/timeline/lanes/PropertyKeyframeLane.vue';
import { useMotionGizmo } from '@/front-end/composables/editor/useMotionGizmo';
import { ensureMotionBlockPluginsRegistered } from '@/front-end/motion-blocks';
import { getMotionBlockPlugin, getMotionTrackPlugin, listMotionBlockPlugins } from '@/front-end/motion-blocks/core/registry';
import { pickPreferredCloudSourceTrack } from '@/front-end/motion-blocks/cloud/source-tracks';
import SnapOverlay from '@/front-end/components/timeline/SnapOverlay.vue';
import RawLyricsPanel from '@/front-end/components/editor/RawLyricsPanel.vue';
import TrackListPanel from '@/front-end/components/editor/TrackListPanel.vue';
import MotionTrackListPanel from '@/front-end/components/editor/MotionTrackListPanel.vue';
import MotionInspectorHost from '@/front-end/components/editor/MotionInspectorHost.vue';
import BackgroundInspector from '@/front-end/components/editor/BackgroundInspector.vue';
import AnalysisOverlaysSection from '@/front-end/components/editor/AnalysisOverlaysSection.vue';
import ProjectInspector from '@/front-end/components/editor/ProjectInspector.vue';
import ExportModal from '@/front-end/components/editor/ExportModal.vue';
import { useUndoRedo } from '@/front-end/composables/editor/useUndoRedo';
import { useTimelineSelection } from '@/front-end/composables/timeline/useTimelineSelection';
import { useVideoExport } from '@/front-end/composables/editor/useVideoExport';
import { enforceNoOverlap, generateLineTrackFromVerseTrack, generateWordTrackFromLineTrack } from '@/front-end/utils/lyricTrackGenerators';
import { cleanOrphanedOverrides } from '@/front-end/utils/motion/resolveMotionItems';
import { getMotionBlockPropertyValue } from '@/front-end/utils/motion/blockPropertyPaths';
import { upsertKeyframe } from '@/front-end/utils/tracks';
import { getPropertyDef } from '@/front-end/utils/motion/keyframeProperties';
import type { ExportDocument } from '@/types/export_types';
import { buildFontFamilyChain, fontDescriptorFromProjectFont } from '@/front-end/utils/fonts/fontUtils';
import { primeDocumentFont } from '@/front-end/utils/fonts/fontLoader';
import { buildLegacyAudioModulationFrame } from '@/front-end/motion/legacy/legacy_audio_modulation_scaffold';
import {
    CANVAS_DIMENSION_PRESETS,
    clampRenderDimension,
    dimensionPresetSelectValue,
    RENDER_DIMENSION_BOUNDS,
} from '@/front-end/utils/dimensionPresets';
import { normalizeScene3DSettings } from '@/front-end/utils/projectScene3D';
import {
    executeProjectEditorCommand,
    getProjectEditorCommandIdFromKeydown,
    RENDERER_MENU_COMMAND_EVENT,
    type ProjectEditorCommandId,
} from '@/shared/projectEditorCommands';
import { buildAppTitle } from '@/shared/branding';

const props = defineProps<{ projectId: string }>();
const router = useRouter();
ensureMotionBlockPluginsRegistered();

const project = ref<WolkProject | null>(null);
const loading = ref(true);
const mode = ref<'lyric' | 'motion'>('lyric');
type EditorLayoutMode = 'full' | 'stacked';
type EditorPanelKey = 'preview' | 'sidebar' | 'inspector' | 'timeline';
const STACKED_LAYOUT_BREAKPOINT = 900;
const STACKED_PANEL_DEFAULTS: Record<EditorPanelKey, boolean> = {
    preview: true,
    sidebar: true,
    inspector: true,
    timeline: true,
};
const PANEL_STORAGE_KEYS = {
    stackedPanels: 'pe-stacked-panels',
    fullSidebarWidth: 'pe-full-sidebar-width',
    fullInspectorWidth: 'pe-full-inspector-width',
    fullTimelineHeight: 'pe-full-timeline-height',
    stackedPreviewHeight: 'pe-stacked-preview-height',
    stackedTimelineHeight: 'pe-stacked-timeline-height',
} as const;
const editorRootRef = ref<HTMLElement | null>(null);
const layoutMode = ref<EditorLayoutMode>('full');
const stackedPanels = ref<Record<EditorPanelKey, boolean>>({ ...STACKED_PANEL_DEFAULTS });
const fps = ref(60);

const restoreStackedPanels = () => {
    try {
        const raw = localStorage.getItem(PANEL_STORAGE_KEYS.stackedPanels);
        if (!raw) {
            stackedPanels.value = { ...STACKED_PANEL_DEFAULTS };
            return;
        }
        const parsed = JSON.parse(raw) as Partial<Record<EditorPanelKey, boolean>>;
        stackedPanels.value = {
            ...STACKED_PANEL_DEFAULTS,
            ...parsed,
        };
    } catch {
        stackedPanels.value = { ...STACKED_PANEL_DEFAULTS };
    }
};

const persistStackedPanels = () => {
    localStorage.setItem(PANEL_STORAGE_KEYS.stackedPanels, JSON.stringify(stackedPanels.value));
};

const syncLayoutMode = () => {
    const nextMode: EditorLayoutMode = window.innerWidth <= STACKED_LAYOUT_BREAKPOINT ? 'stacked' : 'full';
    const changed = layoutMode.value !== nextMode;
    layoutMode.value = nextMode;
    nextTick(() => {
        if (changed) {
            markDirty();
        }
        // Nudge the ruler to recompute labels after responsive resizes.
        vp.setStart(viewport.value.startSec);
    });
};

const toggleStackedPanel = (panel: EditorPanelKey) => {
    if (layoutMode.value !== 'stacked') return;
    stackedPanels.value = {
        ...stackedPanels.value,
        [panel]: !stackedPanels.value[panel],
    };
    persistStackedPanels();
};

const isPanelExpanded = (panel: EditorPanelKey) => layoutMode.value === 'full' || stackedPanels.value[panel];

// Audio
const audio = useAudioPlayer();
const analysis = useAudioAnalysis(fps);

// Timeline viewport
const vp = useTimelineViewport({ fps: 60 });
const viewport = vp.viewport;
const playhead = vp.playhead;

// Snap engine
const timelineContainerWidth = ref(800);
const snapEngine = useSnapEngine({
    viewport: viewport as any,
    containerWidth: timelineContainerWidth,
});

const lyricSnapTargets = computed<SnapTarget[]>(() => {
    if (!project.value) return [];
    const targets: SnapTarget[] = [];
    for (const track of project.value.lyricTracks) {
        for (const item of track.items) {
            targets.push(
                { timeSec: item.startMs / 1000, label: 'edge', sourceId: item.id },
                { timeSec: item.endMs / 1000, label: 'edge', sourceId: item.id },
            );
        }
    }
    return targets;
});

const playheadSnapTarget = computed<SnapTarget[]>(() => {
    const phSec = playhead.value.frame / Math.max(1, fps.value);
    return [{ timeSec: phSec, label: 'playhead' }];
});

snapEngine.registerTargets(lyricSnapTargets);
snapEngine.registerTargets(playheadSnapTarget);

// Undo/redo
const undoRedo = useUndoRedo<WolkProject>();

const pushUndo = () => {
    if (project.value) undoRedo.pushSnapshot(project.value);
};

const performUndo = () => {
    const snapshot = undoRedo.undo();
    if (snapshot) {
        project.value = snapshot;
        scheduleSave();
    }
};

const performRedo = () => {
    const snapshot = undoRedo.redo();
    if (snapshot) {
        project.value = snapshot;
        scheduleSave();
    }
};

// Autosave debounce
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleSave = () => {
    if (project.value) {
        // Capture post-mutation state immediately so undo/redo works right after edits.
        undoRedo.pushSnapshot(project.value);
    }
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        if (project.value) {
            await ProjectService.save(project.value);
        }
    }, 1000);
};

// Monitor settings toggle
const isEditingSettings = ref(false);
const toggleEditSettings = () => { isEditingSettings.value = !isEditingSettings.value; };

const dimensionSelectValue = computed(() => {
    if (!project.value) return 'custom';
    return dimensionPresetSelectValue(
        project.value.settings.renderWidth,
        project.value.settings.renderHeight,
    );
});

const updateDimensions = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    if (!project.value || value === 'custom') return;
    const [width, height] = value.split('x').map(Number);
    project.value.settings.renderWidth = clampRenderDimension(width, 1920);
    project.value.settings.renderHeight = clampRenderDimension(height, 1080);
    scheduleSave();
};

const updateRenderWidth = (e: Event) => {
    if (!project.value) return;
    const raw = Number((e.target as HTMLInputElement).value);
    const fb = project.value.settings.renderWidth || 1920;
    project.value.settings.renderWidth = clampRenderDimension(raw, fb);
    scheduleSave();
};

const updateRenderHeight = (e: Event) => {
    if (!project.value) return;
    const raw = Number((e.target as HTMLInputElement).value);
    const fb = project.value.settings.renderHeight || 1080;
    project.value.settings.renderHeight = clampRenderDimension(raw, fb);
    scheduleSave();
};

const updateFps = (e: Event) => {
    if (!project.value) return;
    const v = Math.max(1, Number((e.target as HTMLInputElement).value) | 0);
    project.value.settings.fps = v;
    fps.value = v;
    scheduleSave();
};

const updateBitrate = (e: Event) => {
    if (!project.value) return;
    const v = Math.max(1, Number((e.target as HTMLInputElement).value) || 8);
    project.value.settings.exportBitrateMbps = v;
    scheduleSave();
};

// Overlay toggles for analysis lanes
const overlayOpts = ref<{ showEnergy: boolean; showBeats: boolean; showBands: boolean; showBeatStrength: boolean }>({
    showEnergy: false,
    showBeats: false,
    showBands: false,
    showBeatStrength: false,
});
const updateOverlayOpts = (value: typeof overlayOpts.value) => {
    overlayOpts.value = value;
};
const uiNotice = ref<string | null>(null);
let uiNoticeTimer: ReturnType<typeof setTimeout> | null = null;
const showNotice = (message: string) => {
    uiNotice.value = message;
    if (uiNoticeTimer) clearTimeout(uiNoticeTimer);
    uiNoticeTimer = setTimeout(() => { uiNotice.value = null; }, 3500);
};

// Preview canvas — reuse usePreviewCanvas for proper scaling
const renderCanvas = ref<HTMLCanvasElement | null>(null);
const previewCanvas = ref<HTMLCanvasElement | null>(null);
const previewOverlay = ref<HTMLCanvasElement | null>(null);
const targetWidth = computed(() => project.value?.settings.renderWidth || 1920);
const targetHeight = computed(() => project.value?.settings.renderHeight || 1080);
const previewCanvasComposable = usePreviewCanvas(renderCanvas, previewCanvas, targetWidth, targetHeight, () => markDirty());
const motionRenderer = useMotionRenderer(renderCanvas);
const exportMode = ref<'realtime' | 'frames'>('frames');
const exportDocument = computed<ExportDocument | null>(() => {
    if (!project.value) return null;
    return {
        id: project.value.id,
        title: project.value.song.title || 'Untitled',
        audioSrc: project.value.song.audioSrc || null,
        settings: {
            fps: project.value.settings.fps || 60,
            renderWidth: project.value.settings.renderWidth || 1920,
            renderHeight: project.value.settings.renderHeight || 1080,
            fontFamily: project.value.font.family,
            fontFallbacks: project.value.font.fallbacks,
            fontStyle: project.value.font.style,
            fontWeight: project.value.font.weight,
            fontName: project.value.font.name,
            fontLocalPath: project.value.font.localPath,
            includeAudio: project.value.settings.includeAudio ?? true,
            exportBitrateMbps: project.value.settings.exportBitrateMbps || 8,
            exportMode: exportMode.value,
            keepRawPngFrames: project.value.settings.keepRawPngFrames ?? false,
            exportAlphaMov: project.value.settings.exportAlphaMov ?? false,
        },
    };
});
const videoExport = useVideoExport(
    renderCanvas,
    audio.audioEl,
    exportDocument,
    computed(() => project.value?.id || ''),
    ref(false),
    ref(true),
    previewCanvas,
);

const currentFrame = computed(() => playhead.value.frame);

const wrapTextLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [''];
    const lines: string[] = [];
    let current = words[0];

    for (let i = 1; i < words.length; i++) {
        const candidate = `${current} ${words[i]}`;
        if (ctx.measureText(candidate).width <= maxWidth) {
            current = candidate;
        } else {
            lines.push(current);
            current = words[i];
        }
    }
    lines.push(current);
    return lines;
};

const truncateLinesToFit = (
    ctx: CanvasRenderingContext2D,
    lines: string[],
    maxLines: number,
    maxWidth: number,
): string[] => {
    if (lines.length <= maxLines) return lines;
    const out = lines.slice(0, Math.max(1, maxLines));
    const lastIdx = out.length - 1;
    let candidate = out[lastIdx];
    while (candidate.length > 0 && ctx.measureText(`${candidate}…`).width > maxWidth) {
        candidate = candidate.slice(0, -1);
    }
    out[lastIdx] = candidate.length > 0 ? `${candidate}…` : '…';
    return out;
};

const drawLyricPreview = () => {
    const canvas = renderCanvas.value;
    if (!canvas || !project.value) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = targetWidth.value;
    const h = targetHeight.value;
    canvas.width = w;
    canvas.height = h;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const currentMs = (playhead.value.frame / Math.max(1, fps.value)) * 1000;

    const anySoloed = project.value.lyricTracks.some(t => t.solo);
    const tracks = project.value.lyricTracks.filter((t) => {
        if (anySoloed) return t.solo && !t.muted;
        return !t.muted;
    });
    const activeTexts: { text: string; color: string; trackIndex: number }[] = [];

    for (let ti = 0; ti < tracks.length; ti++) {
        const track = tracks[ti];
        for (const item of track.items) {
            if (currentMs >= item.startMs && currentMs < item.endMs) {
                activeTexts.push({ text: item.text, color: track.color, trackIndex: ti });
            }
        }
    }

    if (activeTexts.length === 0) {
        previewCanvasComposable.drawPreview();
        return;
    }

    const projectFontDescriptor = fontDescriptorFromProjectFont(project.value.font);
    primeDocumentFont(projectFontDescriptor);
    const fontChain = buildFontFamilyChain(projectFontDescriptor);
    const totalTracks = tracks.length;
    const slotHeight = h / Math.max(1, totalTracks);

    for (const at of activeTexts) {
        const slotTop = slotHeight * at.trackIndex;
        const slotBottom = slotTop + slotHeight;
        const slotCenterY = slotTop + slotHeight / 2;
        const slotPaddingY = Math.max(8, slotHeight * 0.08);
        const availableHeight = Math.max(16, slotHeight - slotPaddingY * 2);
        const maxTextWidth = w - 80;
        const lineGap = 1.2;
        let fontSize = Math.min(slotHeight * 0.5, w * 0.06);
        let lines: string[] = [];
        let ascent = fontSize * 0.8;
        let descent = fontSize * 0.2;
        let lineAdvance = fontSize * lineGap;
        let blockHeight = 0;

        // Fit text by wrapping + shrinking first.
        for (let attempts = 0; attempts < 36; attempts++) {
            ctx.font = `bold ${fontSize}px ${fontChain}`;
            lines = wrapTextLines(ctx, at.text, maxTextWidth);
            const metrics = ctx.measureText('Mg');
            ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
            descent = metrics.actualBoundingBoxDescent || fontSize * 0.2;
            lineAdvance = fontSize * lineGap;
            blockHeight = ascent + descent + Math.max(0, lines.length - 1) * lineAdvance;
            if (blockHeight <= availableHeight || fontSize <= 12) break;
            fontSize = Math.max(12, fontSize - 2);
        }

        ctx.font = `bold ${fontSize}px ${fontChain}`;
        const metrics = ctx.measureText('Mg');
        ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
        descent = metrics.actualBoundingBoxDescent || fontSize * 0.2;
        lineAdvance = fontSize * lineGap;

        // If still too tall at min font, cap lines and ellipsize.
        const maxLines = Math.max(1, Math.floor((availableHeight - ascent - descent) / Math.max(1, lineAdvance)) + 1);
        lines = truncateLinesToFit(ctx, lines, maxLines, maxTextWidth);
        blockHeight = ascent + descent + Math.max(0, lines.length - 1) * lineAdvance;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        let lineY = slotCenterY - blockHeight / 2 + ascent;

        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#fff';

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, slotTop + 1, w, Math.max(1, slotBottom - slotTop - 2));
        ctx.clip();
        for (const line of lines) {
            ctx.fillText(line, w / 2, lineY);
            lineY += fontSize * lineGap;
        }
        ctx.restore();
        ctx.shadowBlur = 0;
    }

    previewCanvasComposable.drawPreview();
};

const drawMotionPreview = () => {
    if (!project.value) return;
    motionRenderer.primeProjectFonts(project.value);
    const currentMs = (playhead.value.frame / Math.max(1, fps.value)) * 1000;
    motionRenderer.renderMotionFrame(project.value, currentMs, {
        legacyModulation: buildLegacyAudioModulationFrame({
            frame: playhead.value.frame,
            fps: fps.value,
            energyPerFrame: analysis.analysisCache.value?.energyPerFrame,
            beatStrengthPerFrame: analysis.beatStrengthPerFrame.value,
            bandsLowPerFrame: analysis.bandsLowPerFrame.value,
            bandsMidPerFrame: analysis.bandsMidPerFrame.value,
            bandsHighPerFrame: analysis.bandsHighPerFrame.value,
            beatTimesSec: analysis.beatTimesSec.value,
        }),
    });
    previewCanvasComposable.drawPreview();
    if (videoExport.showExportModal.value) {
        const oc = previewOverlay.value;
        if (oc) {
            const ctx = oc.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, oc.width, oc.height);
        }
    } else {
        motionGizmo.drawGizmo();
    }
};

const drawCurrentPreview = () => {
    if (mode.value === 'motion') drawMotionPreview();
    else drawLyricPreview();
};

// Playback animation frame loop
let playbackRaf: number | null = null;
let previewDirty = true;
const playbackIntent = ref(false);

const startRafLoop = () => {
    if (playbackRaf !== null) return;
    const tick = () => {
        const el = audio.audioEl.value;
        if (audio.isPlaying.value && el) {
            const t = el.currentTime;
            const frame = Math.round(t * fps.value);
            vp.setPlayhead(frame);

            if (el.ended || t >= (el.duration || Infinity)) {
                stopPlayback();
                return;
            }
            previewDirty = true;
        }

        if (previewDirty) {
            drawCurrentPreview();
            previewDirty = false;
        }

        if (playbackIntent.value && audio.isPlaying.value) {
            playbackRaf = requestAnimationFrame(tick);
        } else {
            playbackRaf = null;
        }
    };
    playbackRaf = requestAnimationFrame(tick);
};

const stopRafLoop = () => {
    if (playbackRaf !== null) {
        cancelAnimationFrame(playbackRaf);
        playbackRaf = null;
    }
};

const markDirty = () => {
    previewDirty = true;
    if (playbackRaf === null) {
        requestAnimationFrame(() => {
            if (previewDirty) {
                drawCurrentPreview();
                previewDirty = false;
            }
        });
    }
};

const togglePlay = async () => {
    if (audio.isPlaying.value) {
        playbackIntent.value = false;
        audio.pause();
        stopRafLoop();
        markDirty();
    } else {
        playbackIntent.value = true;
        await audio.play();
        if (audio.isPlaying.value) {
            startRafLoop();
        } else {
            playbackIntent.value = false;
        }
    }
};

const stopPlayback = () => {
    playbackIntent.value = false;
    audio.stop();
    stopRafLoop();
    vp.setPlayhead(0);
    markDirty();
};

const startExportProcess = async () => {
    if (!project.value) return;
    await motionRenderer.ensureProjectFonts(project.value);
    const fpsValue = Math.max(1, project.value.settings.fps || 60);
    if (exportMode.value === 'frames') {
        const durationSec = Math.max(
            0.05,
            (audio.duration.value > 0 ? audio.duration.value : (resolvedProjectDurationMs.value / 1000)),
        );
        const totalFrames = Math.max(1, Math.ceil(durationSec * fpsValue));
        await videoExport.startCanvasFrameExport({
            fps: fpsValue,
            totalFrames,
            includeAudio: project.value.settings.includeAudio ?? true,
            audioPath: project.value.song.audioSrc || null,
            keepRawPngFrames: project.value.settings.keepRawPngFrames ?? false,
            exportAlphaMov: project.value.settings.exportAlphaMov ?? false,
            drawFrame: (frame: number) => {
                const currentMs = (frame * 1000) / fpsValue;
                motionRenderer.renderMotionFrame(project.value!, currentMs, {
                    legacyModulation: buildLegacyAudioModulationFrame({
                        frame,
                        fps: fpsValue,
                        energyPerFrame: analysis.analysisCache.value?.energyPerFrame,
                        beatStrengthPerFrame: analysis.beatStrengthPerFrame.value,
                        bandsLowPerFrame: analysis.bandsLowPerFrame.value,
                        bandsMidPerFrame: analysis.bandsMidPerFrame.value,
                        bandsHighPerFrame: analysis.bandsHighPerFrame.value,
                        beatTimesSec: analysis.beatTimesSec.value,
                    }),
                });
                previewCanvasComposable.drawPreview();
            },
        });
        return;
    }

    await videoExport.startExport(async () => {
        await audio.seekTo(0);
        vp.setPlayhead(0);
        await audio.play();
        startRafLoop();
    });
};

const openExportModal = () => {
    videoExport.openExportModal();
};

const handleExportCancel = () => {
    videoExport.stopExport();
    videoExport.closeExportModal();
};

const handleExportStop = () => {
    videoExport.stopExport();
};

const handleExportRetry = async () => {
    videoExport.resetExport();
    await startExportProcess();
};

const handleExportStart = async () => {
    await startExportProcess();
};

const handleExportOpenFolder = async () => {
    if (!videoExport.exportState.value.folderPath) return;
    await (window as any).electronAPI.export.openFolder(videoExport.exportState.value.folderPath);
};

const handleExportClose = () => {
    videoExport.closeExportModal();
};

const handleUpdateExportMode = (mode: 'realtime' | 'frames') => {
    exportMode.value = mode;
};

const handleUpdateIncludeAudio = (include: boolean) => {
    if (!project.value) return;
    project.value.settings.includeAudio = include;
    scheduleSave();
};

const handleUpdateKeepRawPngFrames = (keepRawPngFrames: boolean) => {
    if (!project.value) return;
    project.value.settings.keepRawPngFrames = keepRawPngFrames;
    scheduleSave();
};

const handleUpdateExportAlphaMov = (exportAlphaMov: boolean) => {
    if (!project.value) return;
    project.value.settings.exportAlphaMov = exportAlphaMov;
    scheduleSave();
};

const onSeekToMs = async (ms: number) => {
    const timeSec = Math.max(0, ms / 1000);
    const frame = Math.round(timeSec * fps.value);
    await onScrub({ timeSec, frame });
};

let scrubSeq = 0;
const onScrub = async (payload: { timeSec: number; frame: number }) => {
    scrubSeq += 1;
    const seq = scrubSeq;
    await audio.seekTo(payload.timeSec);
    if (seq !== scrubSeq) {
        return;
    }
    vp.setPlayhead(payload.frame);
    markDirty();
};

const onPan = (secDelta: number) => {
    vp.panBy(secDelta);
};

const onZoom = (payload: { timeSec: number; factor: number }) => {
    vp.setZoomAround(payload.timeSec, payload.factor);
};

const audioDurationMs = computed(() => {
    const dur = audio.duration.value * 1000;
    return dur > 0 ? dur : 180_000;
});

const resolvedProjectDurationMs = computed(() => {
    const audioMs = audio.duration.value * 1000;
    if (audioMs > 0) return audioMs;
    return project.value?.settings.durationMs || 30_000;
});

// Playhead X position as CSS variable
const playheadX = computed(() => {
    const phSec = playhead.value.frame / Math.max(1, fps.value);
    const clamped = Math.max(0, Math.min(phSec - viewport.value.startSec, viewport.value.durationSec));
    return `${(clamped / Math.max(1e-6, viewport.value.durationSec)) * 100}%`;
});
const miniItemStyle = (item: TimelineItem, track: LyricTrack) => {
    const startSec = item.startMs / 1000;
    const endSec = item.endMs / 1000;
    const leftPct = ((startSec - viewport.value.startSec) / viewport.value.durationSec) * 100;
    const widthPct = ((endSec - startSec) / viewport.value.durationSec) * 100;
    return {
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        backgroundColor: track.color,
    };
};

// Auto-scroll viewport to follow playhead during playback
watch(() => playhead.value.frame, (frame) => {
    if (!playbackIntent.value || !audio.isPlaying.value) return;
    const phSec = frame / Math.max(1, fps.value);
    const rightThreshold = viewport.value.startSec + viewport.value.durationSec * 0.8;
    const leftEdge = viewport.value.startSec;

    if (phSec > rightThreshold) {
        const desired = Math.max(0, Math.min(
            viewport.value.totalSec - viewport.value.durationSec,
            phSec - viewport.value.durationSec * 0.6,
        ));
        if (Math.abs(desired - viewport.value.startSec) > 1e-3) {
            vp.setStart(desired);
        }
    } else if (phSec < leftEdge) {
        vp.setStart(Math.max(0, phSec - viewport.value.durationSec * 0.4));
    }
});

watch(mode, () => {
    if (mode.value === 'motion' && project.value) {
        const removed = cleanOrphanedOverrides(project.value).removedCount;
        if (removed > 0) {
            showNotice(`${removed} item override(s) removed because source lyrics changed.`);
            scheduleSave();
        }
    }
    if (mode.value === 'motion' && !selectedMotionTrackId.value) {
        selectedMotionTrackId.value = project.value?.motionTracks[0]?.id || null;
    }
    markDirty();
});

const onSongProjectUpdated = async ({ project: updated, kind }: { project: WolkProject; kind: 'audio' | 'cover' }) => {
    project.value = updated;
    if (kind === 'audio' && updated.song.audioSrc) {
        await loadAudio(updated.song.audioSrc);
    }
};

const audioDurationFallback = ref(0);

const loadAudio = async (src: string) => {
    if (!src) return;
    await audio.load(src);

    try {
        const arrayBuf = await (await fetch(src)).arrayBuffer();

        // Two-pass decode: detect native sample rate to avoid resampling artifacts
        const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const tempBuf = await tempCtx.decodeAudioData(arrayBuf.slice(0));
        const nativeSampleRate = tempBuf.sampleRate;
        await tempCtx.close();

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: nativeSampleRate });
        const buffer = await audioCtx.decodeAudioData(arrayBuf.slice(0));
        audioDurationFallback.value = buffer.duration;
        await analysis.analyzeBuffer(buffer);
        await audioCtx.close();
    } catch (err) {
        console.error('Audio analysis failed:', err);
    }

    const dur = audio.duration.value > 0 ? audio.duration.value : audioDurationFallback.value;
    if (dur > 0) {
        vp.setTotal(dur);
    }
};

// Raw lyrics sync
const rawLyrics = computed({
    get: () => project.value?.rawLyrics ?? '',
    set: (val: string) => {
        if (project.value) {
            project.value.rawLyrics = val;
            scheduleSave();
        }
    },
});

// Track management — multi-selection
const selection = useTimelineSelection();
const selectedItemId = computed<string | null>(() => {
    const arr = selection.selectedArray.value;
    return arr.length === 1 ? arr[0] : (arr.length > 0 ? arr[0] : null);
});
type LyricClipboardItem = {
    text: string;
    startOffsetMs: number;
    endOffsetMs: number;
    sourceTrackId: string;
    sourceTrackKind: LyricTrack['kind'];
};
const lyricClipboard = ref<{ items: LyricClipboardItem[] } | null>(null);

// Cross-track marquee state
const marquee = ref<{
    active: boolean;
    startClientX: number;
    startClientY: number;
    currentClientX: number;
    currentClientY: number;
} | null>(null);
const lanesColumnRef = ref<HTMLElement | null>(null);
const timelineContextMenu = ref<{
    type: 'lyric' | 'motion';
    itemId?: string;
    trackId?: string;
    x: number;
    y: number;
} | null>(null);

const marqueeStyle = computed(() => {
    if (!marquee.value || !lanesColumnRef.value) return null;
    const col = lanesColumnRef.value.getBoundingClientRect();
    const x1 = Math.max(0, Math.min(marquee.value.startClientX, marquee.value.currentClientX) - col.left);
    const x2 = Math.min(col.width, Math.max(marquee.value.startClientX, marquee.value.currentClientX) - col.left);
    const y1 = Math.max(0, Math.min(marquee.value.startClientY, marquee.value.currentClientY) - col.top);
    const y2 = Math.min(col.height, Math.max(marquee.value.startClientY, marquee.value.currentClientY) - col.top);
    return { left: `${x1}px`, top: `${y1}px`, width: `${x2 - x1}px`, height: `${y2 - y1}px` };
});

/** All selected items across all tracks — passed to lanes for cross-track group move */
const allSelectedItems = computed(() => {
    if (!project.value || selection.selectedIds.value.size === 0) return [];
    const items: { id: string; startMs: number; endMs: number }[] = [];
    for (const track of project.value.lyricTracks) {
        for (const item of track.items) {
            if (selection.selectedIds.value.has(item.id)) {
                items.push({ id: item.id, startMs: item.startMs, endMs: item.endMs });
            }
        }
    }
    return items;
});

const playheadMs = computed(() => (playhead.value.frame / Math.max(1, fps.value)) * 1000);
const selectedMotionTrackId = ref<string | null>(null);
watch(() => selectedMotionTrackId.value, () => {
    markDirty();
});
const motionClipboard = ref<MotionTrack | null>(null);
const availableMotionPlugins = computed(() => listMotionBlockPlugins({ authorableOnly: true }).map((plugin) => ({
    type: plugin.type,
    label: plugin.meta.label,
    requiresSourceTrack: plugin.meta.requiresSourceTrack !== false,
})));
const selectedMotionTrack = computed<MotionTrack | null>(() => {
    if (!project.value || !selectedMotionTrackId.value) return null;
    return project.value.motionTracks.find((track) => track.id === selectedMotionTrackId.value) || null;
});

const syncProjectEditorMenuContext = () => {
    void window.electronAPI.setMenuContext({
        hasProjectRoute: true,
        mode: mode.value,
        hasSelection: selection.hasSelection.value,
        selectedMotionTrackId: selectedMotionTrackId.value,
        hasLyricClipboard: !!lyricClipboard.value?.items.length,
        hasMotionClipboard: !!motionClipboard.value,
    });
};

watch(
    () => [
        mode.value,
        selection.hasSelection.value,
        selectedMotionTrackId.value,
        !!lyricClipboard.value?.items.length,
        !!motionClipboard.value,
    ],
    syncProjectEditorMenuContext,
    { immediate: true },
);

const selectedMotionPlugin = computed(() => (
    selectedMotionTrack.value ? getMotionTrackPlugin(selectedMotionTrack.value) : null
));
const monitorManipulationEnabled = ref(true);
const selectedTrackSupportsMonitorGizmo = computed(() => (
    selectedMotionPlugin.value?.meta.supportsMonitorGizmo !== false
));
const selectedMotionTrackAtPlayhead = computed(() => {
    const track = selectedMotionTrack.value;
    if (!track) return false;
    const currentMs = (playhead.value.frame / Math.max(1, fps.value)) * 1000;
    return currentMs >= track.block.startMs && currentMs < track.block.endMs;
});
const enableMonitorGizmo = computed(() => (
    monitorManipulationEnabled.value
    && selectedTrackSupportsMonitorGizmo.value
    && selectedMotionTrackAtPlayhead.value
));
const normalizedScene3D = computed(() => normalizeScene3DSettings(project.value?.scene3d));

const kfLabel = (path: string): string => {
    const def = getPropertyDef(path);
    return def?.label ?? path.split('.').pop() ?? '?';
};

const ensureMotionTrackDefaults = (track: MotionTrack, projectFont = project.value?.font): MotionTrack => {
    if (!project.value) return track;
    const plugin = getMotionBlockPlugin(track.block.type);
    if (!plugin) {
        return {
            ...track,
            enabled: track.enabled !== false,
            muted: !!track.muted,
            solo: !!track.solo,
            locked: !!track.locked,
        };
    }
    return plugin.normalizeTrack(track, { project: project.value, projectFont });
};

const toggleLyricMute = (track: LyricTrack) => onUpdateTrack({ ...track, muted: !track.muted });
const toggleLyricSolo = (track: LyricTrack) => onUpdateTrack({ ...track, solo: !track.solo });
const toggleLyricLock = (track: LyricTrack) => onUpdateTrack({ ...track, locked: !track.locked });
const moveLyricTrack = (trackId: string, direction: -1 | 1) => {
    if (!project.value) return;
    const ids = project.value.lyricTracks.map((track) => track.id);
    const idx = ids.indexOf(trackId);
    if (idx < 0) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= ids.length) return;
    [ids[idx], ids[nextIdx]] = [ids[nextIdx], ids[idx]];
    onReorderTracks(ids);
};

const toggleMotionMute = (track: MotionTrack) => onUpdateMotionTrack({ ...track, muted: !track.muted, enabled: track.muted });
const toggleMotionSolo = (track: MotionTrack) => onUpdateMotionTrack({ ...track, solo: !track.solo });
const toggleMotionLock = (track: MotionTrack) => onUpdateMotionTrack({ ...track, locked: !track.locked });
const moveMotionTrack = (trackId: string, direction: -1 | 1) => {
    if (!project.value) return;
    const ids = project.value.motionTracks.map((track) => track.id);
    const idx = ids.indexOf(trackId);
    if (idx < 0) return;
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= ids.length) return;
    [ids[idx], ids[nextIdx]] = [ids[nextIdx], ids[idx]];
    onReorderMotionTracks(ids);
};

const jumpToPropertyKeyframe = (trackId: string, propertyPath: string, direction: 'prev' | 'next') => {
    if (!project.value) return;
    const track = project.value.motionTracks.find((item) => item.id === trackId);
    if (!track) return;
    const pt = (track.block.propertyTracks || []).find((item) => item.propertyPath === propertyPath);
    const frames = (pt?.keyframes || []).map((kf) => kf.frame).sort((a, b) => a - b);
    if (frames.length === 0) return;
    const current = playhead.value.frame;
    const target = direction === 'prev'
        ? [...frames].reverse().find((frame) => frame < current)
        : frames.find((frame) => frame > current);
    if (target === undefined) return;
    onScrub({ timeSec: target / Math.max(1, fps.value), frame: target });
};

const setPropertyKeyframeAtPlayhead = (trackId: string, propertyPath: string) => {
    if (!project.value) return;
    const track = project.value.motionTracks.find((item) => item.id === trackId);
    if (!track || track.locked) return;
    const ptIdx = (track.block.propertyTracks || []).findIndex((item) => item.propertyPath === propertyPath);
    if (ptIdx < 0) return;
    const def = getPropertyDef(propertyPath);
    if (!def) return;
    const value = def.getValue(track.block);
    const interp = def.defaultInterpolation ?? 'linear';
    const pts = [...(track.block.propertyTracks || [])];
    pushUndo();
    pts[ptIdx] = upsertKeyframe(pts[ptIdx] as any, playhead.value.frame, value, interp) as any;
    onUpdateMotionTrack({ ...track, block: { ...track.block, propertyTracks: pts } });
};

const gizmoAutoKeyframe = (track: MotionTrack, path: string, value: any) => {
    const pts = track.block.propertyTracks;
    if (!pts) return;
    const ptIdx = pts.findIndex((pt) => pt.propertyPath === path);
    if (ptIdx < 0 || pts[ptIdx].enabled === false) return;
    if (!pts[ptIdx].keyframes?.length) return;
    const def = getPropertyDef(path);
    const interp = def?.defaultInterpolation ?? 'linear';
    const frame = playhead.value.frame;
    pts[ptIdx] = upsertKeyframe(pts[ptIdx] as any, frame, value, interp) as any;
};

const applyGizmoMutation = (track: MotionTrack, gizmoMode: 'move' | 'scale' | 'rotate', dx: number, dy: number) => {
    if (track.locked) return;
    const plugin = getMotionTrackPlugin(track);
    const result = plugin.gizmo?.applyDelta?.(track, gizmoMode, dx, dy, {
        renderWidth: targetWidth.value,
        renderHeight: targetHeight.value,
        currentBounds: motionRenderer.getRendererBounds(track.id),
        currentFrame: playhead.value.frame,
    });
    if (!result) return;
    const idx = project.value?.motionTracks.findIndex((item) => item.id === track.id) ?? -1;
    if (idx >= 0 && project.value) {
        project.value.motionTracks[idx] = result.track;
        for (const path of result.autoKeyframePaths || []) {
            gizmoAutoKeyframe(
                project.value.motionTracks[idx],
                path,
                getMotionBlockPropertyValue(result.track.block, path),
            );
        }
    }
    markDirty();
};

const clampOffsetToConstraintRegion = (
    offset: number,
    anchor: 'left' | 'center' | 'right' | 'top' | 'bottom',
    padding: number,
    canvasSize: number,
    regionOffset: number = 0,
): number => {
    const min = padding + regionOffset;
    const max = canvasSize - padding + regionOffset;

    let anchorPos: number;
    if (anchor === 'left' || anchor === 'top') anchorPos = min;
    else if (anchor === 'right' || anchor === 'bottom') anchorPos = max;
    else anchorPos = (min + max) / 2;

    return Math.max(min - anchorPos, Math.min(max - anchorPos, offset));
};

const motionGizmo = useMotionGizmo(
    previewOverlay,
    previewCanvas,
    selectedMotionTrack,
    enableMonitorGizmo as any,
    targetWidth,
    targetHeight,
    {
        onTransformDelta(gizmoMode, dx, dy) {
            const track = selectedMotionTrack.value;
            if (!track) return;
            applyGizmoMutation(track, gizmoMode, dx, dy);
        },
        onDragStart() { pushUndo(); },
        onDragEnd() { scheduleSave(); },
    },
    (trackId) => motionRenderer.getRendererBounds(trackId),
    enableMonitorGizmo as any,
);

const selectedTrack = computed<LyricTrack | null>(() => {
    if (!project.value || !selectedItemId.value) return null;
    for (const track of project.value.lyricTracks) {
        if (track.items.some(i => i.id === selectedItemId.value)) return track;
    }
    return null;
});
const getTrackAndItemById = (itemId: string): { track: LyricTrack; item: TimelineItem } | null => {
    if (!project.value) return null;
    for (const track of project.value.lyricTracks) {
        const item = track.items.find(i => i.id === itemId);
        if (item) return { track, item };
    }
    return null;
};
const selectedVerseTrackId = computed<string | null>(() => {
    const track = selectedTrack.value;
    return track?.kind === 'verse' ? track.id : null;
});
const selectedLineTrackId = computed<string | null>(() => {
    const track = selectedTrack.value;
    return track?.kind === 'sentence' ? track.id : null;
});

const onAddTrack = (track: LyricTrack) => {
    if (!project.value) return;
    pushUndo();
    project.value.lyricTracks.push(track);
    scheduleSave();
};

const onDeleteTrack = (trackId: string) => {
    if (!project.value) return;
    pushUndo();
    project.value.lyricTracks = project.value.lyricTracks.filter(t => t.id !== trackId);
    scheduleSave();
};

const onUpdateTrack = (track: LyricTrack) => {
    if (!project.value) return;
    const idx = project.value.lyricTracks.findIndex(t => t.id === track.id);
    if (idx >= 0) {
        project.value.lyricTracks[idx] = track;
        scheduleSave();
    }
};

const onDuplicateTrack = (trackId: string) => {
    if (!project.value) return;
    pushUndo();
    const src = project.value.lyricTracks.find(t => t.id === trackId);
    if (!src) return;
    const dup: LyricTrack = {
        ...JSON.parse(JSON.stringify(src)),
        id: randomUUID(),
        name: `${src.name} (Copy)`,
    };
    dup.items = dup.items.map((item: TimelineItem) => ({ ...item, id: randomUUID() }));
    project.value.lyricTracks.push(dup);
    scheduleSave();
};

const onReorderTracks = (trackIds: string[]) => {
    if (!project.value) return;
    const byId = new Map(project.value.lyricTracks.map(t => [t.id, t]));
    const reordered = trackIds.map(id => byId.get(id)).filter((t): t is LyricTrack => !!t);
    if (reordered.length !== project.value.lyricTracks.length) return;
    pushUndo();
    project.value.lyricTracks = reordered;
    scheduleSave();
};

const onGenerateLines = () => {
    if (!project.value) return;
    if (!selectedVerseTrackId.value) return;
    const sourceVerseTrack = project.value.lyricTracks.find(
        t => t.id === selectedVerseTrackId.value && t.kind === 'verse',
    );
    if (!sourceVerseTrack) return;

    const lineTrack = generateLineTrackFromVerseTrack(
        project.value.rawLyrics,
        sourceVerseTrack,
        project.value.lyricTracks.length,
    );
    if (lineTrack.items.length === 0) return;

    pushUndo();
    project.value.lyricTracks.push(lineTrack);
    scheduleSave();
};

const onGenerateWords = () => {
    if (!project.value) return;
    if (!selectedLineTrackId.value) return;
    const sourceLineTrack = project.value.lyricTracks.find(
        t => t.id === selectedLineTrackId.value && t.kind === 'sentence',
    );
    if (!sourceLineTrack) return;

    const wordTrack = generateWordTrackFromLineTrack(
        project.value.rawLyrics,
        sourceLineTrack,
        project.value.lyricTracks.length,
    );
    if (wordTrack.items.length === 0) return;

    pushUndo();
    project.value.lyricTracks.push(wordTrack);
    scheduleSave();
};

const onUpdateItem = (updated: TimelineItem) => {
    if (!project.value) return;
    for (const track of project.value.lyricTracks) {
        const idx = track.items.findIndex(i => i.id === updated.id);
        if (idx >= 0) {
            track.items[idx] = updated;
            track.items = enforceNoOverlap(track.items);
            scheduleSave();
            return;
        }
    }
};

const onSelectItem = (itemId: string | null) => {
    if (itemId) selection.select(itemId);
    else selection.clearSelection();
};

const onToggleItem = (itemId: string) => {
    selection.toggle(itemId);
};

const onAddToSelection = (itemId: string) => {
    selection.addToSelection(itemId);
};

const onUpdateItems = (items: TimelineItem[]) => {
    if (!project.value) return;
    for (const updated of items) {
        for (const track of project.value.lyricTracks) {
            const idx = track.items.findIndex(i => i.id === updated.id);
            if (idx >= 0) {
                track.items[idx] = updated;
                break;
            }
        }
    }
    for (const track of project.value.lyricTracks) {
        track.items = enforceNoOverlap(track.items);
    }
    scheduleSave();
};

/** Find which track lane DOM elements the marquee rectangle intersects */
const getMarqueeSelectedIds = (): string[] => {
    if (!marquee.value || !project.value || !lanesColumnRef.value) return [];
    const col = lanesColumnRef.value;
    const colRect = col.getBoundingClientRect();

    const mLeft = Math.min(marquee.value.startClientX, marquee.value.currentClientX);
    const mRight = Math.max(marquee.value.startClientX, marquee.value.currentClientX);
    const mTop = Math.min(marquee.value.startClientY, marquee.value.currentClientY);
    const mBottom = Math.max(marquee.value.startClientY, marquee.value.currentClientY);

    // Convert marquee X to time
    const relLeft = (mLeft - colRect.left) / Math.max(1, colRect.width);
    const relRight = (mRight - colRect.left) / Math.max(1, colRect.width);
    const startSec = viewport.value.startSec + relLeft * viewport.value.durationSec;
    const endSec = viewport.value.startSec + relRight * viewport.value.durationSec;
    const startMs = startSec * 1000;
    const endMs = endSec * 1000;

    // Find which .lane elements (lyric tracks) the marquee vertically intersects
    const laneEls = col.querySelectorAll<HTMLElement>('.lane[data-track-id]');
    const ids: string[] = [];

    for (const laneEl of laneEls) {
        const laneRect = laneEl.getBoundingClientRect();
        // Vertical overlap check
        if (laneRect.bottom < mTop || laneRect.top > mBottom) continue;

        const trackId = laneEl.getAttribute('data-track-id');
        if (!trackId) continue;
        const track = project.value!.lyricTracks.find(t => t.id === trackId);
        if (!track) continue;

        for (const item of track.items) {
            if (item.endMs > startMs && item.startMs < endMs) {
                ids.push(item.id);
            }
        }
    }
    return ids;
};

const onMarqueeStart = (payload: { trackId: string; clientX: number; clientY: number; pointerId: number }) => {
    marquee.value = {
        active: true,
        startClientX: payload.clientX,
        startClientY: payload.clientY,
        currentClientX: payload.clientX,
        currentClientY: payload.clientY,
    };

    const onMove = (ev: PointerEvent) => {
        if (!marquee.value) return;
        marquee.value = { ...marquee.value, currentClientX: ev.clientX, currentClientY: ev.clientY };
        const ids = getMarqueeSelectedIds();
        selection.replaceSelection(ids);
    };
    const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        marquee.value = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
};

const onGroupMoveAll = (payload: { anchorId: string; deltaMs: number; updates: { id: string; startMs: number; endMs: number }[] }) => {
    if (!project.value) return;
    const updateMap = new Map(payload.updates.map(u => [u.id, u]));
    for (const track of project.value.lyricTracks) {
        let changed = false;
        for (let i = 0; i < track.items.length; i++) {
            const upd = updateMap.get(track.items[i].id);
            if (!upd) continue;
            track.items[i] = { ...track.items[i], startMs: upd.startMs, endMs: upd.endMs };
            changed = true;
        }
        if (changed) track.items = enforceNoOverlap(track.items);
    }
    scheduleSave();
};

const onPushUndo = () => {
    pushUndo();
};

const onDeleteItem = (itemId: string) => {
    if (!project.value) return;
    pushUndo();
    for (const track of project.value.lyricTracks) {
        const idx = track.items.findIndex(i => i.id === itemId);
        if (idx >= 0) {
            track.items.splice(idx, 1);
            if (selection.isSelected(itemId)) selection.clearSelection();
            scheduleSave();
            return;
        }
    }
};

const onSplitItem = (itemId: string, atMs: number) => {
    if (!project.value) return;
    pushUndo();
    for (const track of project.value.lyricTracks) {
        const idx = track.items.findIndex(i => i.id === itemId);
        if (idx >= 0) {
            const item = track.items[idx];
            if (atMs <= item.startMs || atMs >= item.endMs) return;
            const left: TimelineItem = { id: item.id, text: item.text, startMs: item.startMs, endMs: Math.round(atMs) };
            const right: TimelineItem = { id: randomUUID(), text: item.text, startMs: Math.round(atMs), endMs: item.endMs };
            track.items.splice(idx, 1, left, right);
            track.items = enforceNoOverlap(track.items);
            selection.select(right.id);
            scheduleSave();
            return;
        }
    }
};

const onMergeWithNext = (itemId: string) => {
    if (!project.value) return;
    pushUndo();
    for (const track of project.value.lyricTracks) {
        const idx = track.items.findIndex(i => i.id === itemId);
        if (idx >= 0 && idx < track.items.length - 1) {
            const current = track.items[idx];
            const next = track.items[idx + 1];
            const merged: TimelineItem = { id: current.id, text: `${current.text} ${next.text}`.trim(), startMs: current.startMs, endMs: next.endMs };
            track.items.splice(idx, 2, merged);
            track.items = enforceNoOverlap(track.items);
            selection.select(merged.id);
            scheduleSave();
            return;
        }
    }
};

const onAddItemAtLocation = (payload: { trackId?: string; atMs: number }) => {
    if (!project.value) return;
    const editableTracks = project.value.lyricTracks.filter(t => !t.locked);
    const defaultTrack = (
        editableTracks.find(t => t.kind === 'verse')
        || editableTracks.find(t => t.kind === 'sentence')
        || editableTracks.find(t => t.kind === 'word')
        || editableTracks[0]
    );
    const track = payload.trackId
        ? project.value.lyricTracks.find(t => t.id === payload.trackId)
        : defaultTrack;
    if (!track || track.locked) return;

    const atMs = Math.round(Math.max(0, payload.atMs));
    const sorted = [...track.items].sort((a, b) => a.startMs - b.startMs);
    const overlap = sorted.find(i => atMs >= i.startMs && atMs < i.endMs) || null;

    let startMs = atMs;
    let endMs = 0;

    if (overlap) {
        // Replace the overlapped tail: [playhead .. overlap.end] becomes new item.
        endMs = overlap.endMs;
    } else {
        const prev = [...sorted].reverse().find(i => i.endMs <= atMs) || null;
        const next = sorted.find(i => i.startMs >= atMs) || null;
        const minStart = prev ? prev.endMs : 0;
        const maxEnd = next
            ? next.startMs
            : Math.max(minStart + 10, Math.round(viewport.value.totalSec * 1000));
        startMs = Math.max(minStart, atMs);
        if (startMs >= maxEnd) return;
        endMs = Math.min(maxEnd, startMs + 600);
    }

    if (endMs - startMs < 10) return;

    const newItem: TimelineItem = {
        id: randomUUID(),
        text: '',
        startMs,
        endMs,
    };

    pushUndo();
    if (overlap) {
        const overlapIdx = track.items.findIndex(i => i.id === overlap.id);
        if (overlapIdx >= 0) {
            if (startMs - overlap.startMs < 10) {
                track.items.splice(overlapIdx, 1);
            } else {
                track.items[overlapIdx] = { ...overlap, endMs: startMs };
            }
        }
    }
    track.items.push(newItem);
    track.items = enforceNoOverlap(track.items);
    selection.select(newItem.id);
    scheduleSave();
};

const copySelectedItems = () => {
    if (!project.value) return;
    const ids = selection.selectedArray.value;
    if (ids.length === 0) return;

    const picked: { track: LyricTrack; item: TimelineItem }[] = [];
    for (const id of ids) {
        const found = getTrackAndItemById(id);
        if (found) picked.push(found);
    }
    if (picked.length === 0) return;

    picked.sort((a, b) => a.item.startMs - b.item.startMs);
    const anchorMs = picked[0].item.startMs;

    lyricClipboard.value = {
        items: picked.map(({ track, item }) => ({
            text: item.text,
            startOffsetMs: item.startMs - anchorMs,
            endOffsetMs: item.endMs - anchorMs,
            sourceTrackId: track.id,
            sourceTrackKind: track.kind,
        })),
    };
};

const pasteClipboardItems = () => {
    if (!project.value || !lyricClipboard.value?.items.length) return;
    const copied = lyricClipboard.value.items;

    const selectedTargetTrack = selectedTrack.value;
    const primaryKind = copied[0].sourceTrackKind;

    let targetTrack: LyricTrack | null = null;
    if (selectedTargetTrack && !selectedTargetTrack.locked) {
        targetTrack = selectedTargetTrack;
    } else {
        targetTrack = (
            project.value.lyricTracks.find(t => !t.locked && t.kind === primaryKind)
            || project.value.lyricTracks.find(t => !t.locked && t.id === copied[0].sourceTrackId)
            || project.value.lyricTracks.find(t => !t.locked)
            || null
        );
    }
    if (!targetTrack) return;

    const pasteAnchorMs = Math.round(playheadMs.value);
    const newItems: TimelineItem[] = copied.map((entry) => ({
        id: randomUUID(),
        text: entry.text,
        startMs: Math.max(0, Math.round(pasteAnchorMs + entry.startOffsetMs)),
        endMs: Math.max(0, Math.round(pasteAnchorMs + entry.endOffsetMs)),
    })).filter(item => item.endMs > item.startMs);

    if (newItems.length === 0) return;

    pushUndo();
    targetTrack.items.push(...newItems);
    targetTrack.items = enforceNoOverlap(targetTrack.items);
    selection.replaceSelection(newItems.map(i => i.id));
    scheduleSave();
};

const cutSelectedItems = () => {
    if (!project.value) return;
    const ids = selection.selectedArray.value;
    if (ids.length === 0) return;
    copySelectedItems();
    deleteSelectedItem();
};

const nudgeSelectedItem = (deltaMs: number) => {
    if (!project.value) return;
    const ids = selection.selectedArray.value;
    if (ids.length === 0) return;
    pushUndo();
    for (const id of ids) {
        for (const track of project.value.lyricTracks) {
            if (track.locked) continue;
            const idx = track.items.findIndex(i => i.id === id);
            if (idx >= 0) {
                const item = track.items[idx];
                const dur = item.endMs - item.startMs;
                const newStart = Math.max(0, item.startMs + deltaMs);
                track.items[idx] = { ...item, startMs: newStart, endMs: newStart + dur };
                break;
            }
        }
    }
    for (const track of project.value.lyricTracks) {
        track.items = enforceNoOverlap(track.items);
    }
    scheduleSave();
};

const splitSelectedAtPlayhead = () => {
    if (selectedItemId.value) onSplitItem(selectedItemId.value, playheadMs.value);
};

const deleteSelectedItem = () => {
    const ids = selection.selectedArray.value;
    if (ids.length === 0) return;
    pushUndo();
    if (!project.value) return;
    for (const id of ids) {
        for (const track of project.value.lyricTracks) {
            const idx = track.items.findIndex(i => i.id === id);
            if (idx >= 0) {
                track.items.splice(idx, 1);
                break;
            }
        }
    }
    selection.clearSelection();
    scheduleSave();
};

// Project settings update handler (from inspector)
const onUpdateProject = (updated: WolkProject) => {
    pushUndo();
    project.value = updated;
    fps.value = updated.settings.fps || 60;
    document.title = buildAppTitle(updated.song.title || 'Untitled');
    scheduleSave();
};

const onAddMotionTrack = (payload: { type: MotionTrack['block']['type'] }) => {
    if (!project.value) return;
    const plugin = getMotionBlockPlugin(payload.type);
    if (!plugin) return;
    const requiresSourceTrack = plugin.meta.requiresSourceTrack !== false;
    const sourceTrack = !requiresSourceTrack
        ? null
        : payload.type === 'cloud'
            ? pickPreferredCloudSourceTrack(selectedTrack.value, project.value.lyricTracks)
            : (selectedTrack.value || project.value.lyricTracks[0] || null);
    if (requiresSourceTrack && !sourceTrack) return;

    const startMs = Math.max(0, Math.round(playheadMs.value));
    const defaultEnd = startMs + 10_000;
    const maxEnd = Math.max(startMs + 200, Math.round(resolvedProjectDurationMs.value));
    const endMs = Math.max(startMs + 200, Math.min(defaultEnd, maxEnd));
    const color = TRACK_COLORS[project.value.motionTracks.length % TRACK_COLORS.length];

    const track = plugin.createTrack({
        project: project.value,
        sourceTrack,
        startMs,
        endMs,
        color,
        trackId: randomUUID(),
        blockId: randomUUID(),
    });

    pushUndo();
    project.value.motionTracks.push(track);
    selectedMotionTrackId.value = track.id;
    markDirty();
    scheduleSave();
};

const onUpdateScene3D = (scene3d: typeof normalizedScene3D.value) => {
    if (!project.value) return;
    project.value.scene3d = normalizeScene3DSettings(scene3d);
    markDirty();
    scheduleSave();
};

const onDeleteMotionTrack = (trackId: string) => {
    if (!project.value) return;
    pushUndo();
    project.value.motionTracks = project.value.motionTracks.filter((track) => track.id !== trackId);
    if (selectedMotionTrackId.value === trackId) {
        selectedMotionTrackId.value = project.value.motionTracks[0]?.id || null;
    }
    markDirty();
    scheduleSave();
};

const onSelectMotionTrack = (trackId: string) => {
    selectedMotionTrackId.value = selectedMotionTrackId.value === trackId ? null : trackId;
    selection.clearSelection();
};

const onUpdateMotionTrack = (updated: MotionTrack) => {
    if (!project.value) return;
    const idx = project.value.motionTracks.findIndex((track) => track.id === updated.id);
    if (idx < 0) return;
    const existing = project.value.motionTracks[idx];
    const nextTrack: MotionTrack = {
        ...updated,
        enabled: updated.enabled !== false,
        muted: !!updated.muted,
        solo: !!updated.solo,
        locked: !!updated.locked,
        block: {
            ...updated.block,
            type: existing.block.type,
        },
    };
    const plugin = getMotionBlockPlugin(existing.block.type);
    project.value.motionTracks[idx] = plugin
        ? plugin.normalizeTrack(nextTrack, { project: project.value, projectFont: project.value?.font })
        : nextTrack;
    markDirty();
    scheduleSave();
};

const onSetBackgroundColor = (color: string) => {
    if (!project.value) return;
    project.value.backgroundColor = color;
    markDirty();
    scheduleSave();
};

const onSetBackgroundVisibility = (visible: boolean) => {
    if (!project.value) return;
    project.value.backgroundVisible = visible;
    markDirty();
    scheduleSave();
};

const onSetBackgroundImageVisibility = (visible: boolean) => {
    if (!project.value) return;
    project.value.backgroundImageVisible = visible;
    markDirty();
    scheduleSave();
};

const onSetBackgroundOpacity = (opacity: number) => {
    if (!project.value) return;
    project.value.backgroundColorOpacity = Math.max(0, Math.min(1, opacity));
    markDirty();
    scheduleSave();
};

const onSetBackgroundUseGradient = (enabled: boolean) => {
    if (!project.value) return;
    project.value.backgroundUseGradient = enabled;
    markDirty();
    scheduleSave();
};

const onSetBackgroundGradientColor = (color: string) => {
    if (!project.value) return;
    project.value.backgroundGradientColor = color;
    markDirty();
    scheduleSave();
};

const onSetBackgroundGradientAngle = (angle: number) => {
    if (!project.value) return;
    project.value.backgroundGradientAngle = angle;
    markDirty();
    scheduleSave();
};

const onSetBackgroundFit = (fit: 'cover' | 'contain' | 'stretch') => {
    if (!project.value) return;
    project.value.backgroundImageFit = fit;
    markDirty();
    scheduleSave();
};

const onSetBackgroundImageOffsetX = (offset: number) => {
    if (!project.value) return;
    project.value.backgroundImageX = Number.isFinite(offset) ? offset : 0;
    markDirty();
    scheduleSave();
};

const onSetBackgroundImageOffsetY = (offset: number) => {
    if (!project.value) return;
    project.value.backgroundImageY = Number.isFinite(offset) ? offset : 0;
    markDirty();
    scheduleSave();
};

const onSetBackgroundImageScale = (scale: number) => {
    if (!project.value) return;
    project.value.backgroundImageScale = Math.max(0.05, Number.isFinite(scale) ? scale : 1);
    markDirty();
    scheduleSave();
};

const onSetBackgroundImageOpacity = (opacity: number) => {
    if (!project.value) return;
    project.value.backgroundImageOpacity = Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 1));
    markDirty();
    scheduleSave();
};

const onUploadBackgroundImage = async (file: File) => {
    if (!project.value) return;
    const uploaded = await ProjectService.uploadAsset(project.value.id, file, 'background');
    project.value.backgroundImage = uploaded.url;
    markDirty();
    scheduleSave();
};

const onClearBackgroundImage = () => {
    if (!project.value) return;
    project.value.backgroundImage = undefined;
    markDirty();
    scheduleSave();
};

const onResetBackgroundImageControls = () => {
    if (!project.value) return;
    project.value.backgroundImageX = 0;
    project.value.backgroundImageY = 0;
    project.value.backgroundImageScale = 1;
    project.value.backgroundImageOpacity = 1;
    project.value.backgroundImageFit = 'cover';
    markDirty();
    scheduleSave();
};

const onResetBackground = () => {
    if (!project.value) return;
    project.value.backgroundVisible = true;
    project.value.backgroundImageVisible = true;
    project.value.backgroundColor = '#000000';
    project.value.backgroundColorOpacity = 1;
    project.value.backgroundUseGradient = false;
    project.value.backgroundGradientColor = '#222222';
    project.value.backgroundGradientAngle = 90;
    project.value.backgroundImage = undefined;
    project.value.backgroundImageFit = 'cover';
    project.value.backgroundImageX = 0;
    project.value.backgroundImageY = 0;
    project.value.backgroundImageScale = 1;
    project.value.backgroundImageOpacity = 1;
    markDirty();
    scheduleSave();
};

const onDuplicateMotionTrack = (trackId: string) => {
    if (!project.value) return;
    const src = project.value.motionTracks.find((track) => track.id === trackId);
    if (!src) return;
    pushUndo();
    const dup: MotionTrack = {
        ...JSON.parse(JSON.stringify(src)),
        id: randomUUID(),
        name: `${src.name} (Copy)`,
        block: {
            ...JSON.parse(JSON.stringify(src.block)),
            id: randomUUID(),
        },
    };
    project.value.motionTracks.push(dup);
    selectedMotionTrackId.value = dup.id;
    markDirty();
    scheduleSave();
};

const onReorderMotionTracks = (orderedIds: string[]) => {
    if (!project.value) return;
    const byId = new Map(project.value.motionTracks.map((track) => [track.id, track]));
    const reordered = orderedIds.map((id) => byId.get(id)).filter((track): track is MotionTrack => !!track);
    if (reordered.length !== project.value.motionTracks.length) return;
    pushUndo();
    project.value.motionTracks = reordered;
    markDirty();
    scheduleSave();
};

const deleteSelectedMotionTrack = () => {
    if (!selectedMotionTrackId.value) return;
    onDeleteMotionTrack(selectedMotionTrackId.value);
};

const nudgeSelectedMotionTrack = (deltaMs: number) => {
    if (!project.value || !selectedMotionTrackId.value) return;
    const track = project.value.motionTracks.find((item) => item.id === selectedMotionTrackId.value);
    if (!track || track.locked) return;
    pushUndo();
    const duration = track.block.endMs - track.block.startMs;
    const nextStart = Math.max(0, track.block.startMs + deltaMs);
    track.block.startMs = nextStart;
    track.block.endMs = nextStart + duration;
    markDirty();
    scheduleSave();
};

const copySelectedMotionTrack = () => {
    if (!selectedMotionTrack.value) return;
    motionClipboard.value = JSON.parse(JSON.stringify(selectedMotionTrack.value));
};

const cutSelectedMotionTrack = () => {
    if (!selectedMotionTrack.value) return;
    copySelectedMotionTrack();
    deleteSelectedMotionTrack();
};

const pasteMotionTrack = () => {
    if (!project.value || !motionClipboard.value) return;
    const pasted: MotionTrack = {
        ...JSON.parse(JSON.stringify(motionClipboard.value)),
        id: randomUUID(),
        name: `${motionClipboard.value.name} (Copy)`,
        block: {
            ...JSON.parse(JSON.stringify(motionClipboard.value.block)),
            id: randomUUID(),
        },
    };
    const duration = pasted.block.endMs - pasted.block.startMs;
    pasted.block.startMs = Math.max(0, Math.round(playheadMs.value));
    pasted.block.endMs = pasted.block.startMs + duration;
    pushUndo();
    project.value.motionTracks.push(pasted);
    selectedMotionTrackId.value = pasted.id;
    markDirty();
    scheduleSave();
};

const loadProject = async () => {
    loading.value = true;
    try {
        project.value = await ProjectService.load(props.projectId);
        if (!project.value) {
            router.push({ name: 'Index' });
            return;
        }
        project.value.scene3d = normalizeScene3DSettings(project.value.scene3d);
        fps.value = project.value.settings.fps || 60;
        document.title = buildAppTitle(project.value.song.title || 'Untitled');
        undoRedo.clear();
        undoRedo.pushSnapshot(project.value, true);
        const removedOnLoad = cleanOrphanedOverrides(project.value).removedCount;
        if (removedOnLoad > 0) {
            showNotice(`${removedOnLoad} item override(s) removed because source lyrics changed.`);
        }
        project.value.motionTracks = project.value.motionTracks.map((track) => ensureMotionTrackDefaults(track, project.value?.font));
        selectedMotionTrackId.value = project.value.motionTracks[0]?.id || null;

        await nextTick();
        if (project.value.song.audioSrc) {
            await loadAudio(project.value.song.audioSrc);
        }
    } finally {
        loading.value = false;
        await nextTick();
        setupResizeHandles();
        markDirty();
    }
};

// ===== TIMELINE LANE MANAGEMENT =====
// Dynamic lane heights + collapse for the project timeline lanes.

const laneHeights = ref<Record<string, number>>({
    ruler: 48,
    waveform: 140,
    energy: 70,
    beatstrength: 50,
    beats: 70,
    bands: 70,
});
const collapsed = ref<Record<string, boolean>>({});

const getTrackHeight = (trackId: string) => laneHeights.value[`track-${trackId}`] || 64;

watch(() => project.value?.lyricTracks, (tracks) => {
    if (!tracks) return;
    const newHeights = { ...laneHeights.value };
    for (const t of tracks) {
        const key = `track-${t.id}`;
        if (!(key in newHeights)) newHeights[key] = 64;
    }
    laneHeights.value = newHeights;
}, { immediate: true, deep: true });

const minHeights: Record<string, number> = {
    ruler: 40, waveform: 80, energy: 40, beatstrength: 40, beats: 40, bands: 40,
};
const TRACK_MIN_HEIGHT = 32;

const startResize = (key: string, e: PointerEvent) => {
    const startY = e.clientY;
    const startH = laneHeights.value[key] || 64;
    const minH = key.startsWith('track-') ? TRACK_MIN_HEIGHT : (minHeights[key] || 24);
    const onMove = (ev: PointerEvent) => {
        const dy = ev.clientY - startY;
        laneHeights.value = { ...laneHeights.value, [key]: Math.max(minH, startH + dy) };
    };
    const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
};

// ===== PANEL RESIZE =====
// Sidebar, inspector, and timeline resize behavior for the project editor.

let timelineWidthObserver: ResizeObserver | null = null;

const applyPersistedPanelSizes = (editorEl: HTMLElement) => {
    const savedSW = localStorage.getItem(PANEL_STORAGE_KEYS.fullSidebarWidth);
    const savedIW = localStorage.getItem(PANEL_STORAGE_KEYS.fullInspectorWidth);
    const savedTH = localStorage.getItem(PANEL_STORAGE_KEYS.fullTimelineHeight);
    const savedPreviewH = localStorage.getItem(PANEL_STORAGE_KEYS.stackedPreviewHeight);
    const savedStackedTimelineH = localStorage.getItem(PANEL_STORAGE_KEYS.stackedTimelineHeight);

    if (savedSW) editorEl.style.setProperty('--sidebar-width', `${savedSW}px`);
    if (savedIW) editorEl.style.setProperty('--inspector-width', `${savedIW}px`);
    if (savedTH) editorEl.style.setProperty('--timeline-height', `${savedTH}px`);
    if (savedPreviewH) editorEl.style.setProperty('--stacked-preview-height', `${savedPreviewH}px`);
    if (savedStackedTimelineH) editorEl.style.setProperty('--stacked-timeline-height', `${savedStackedTimelineH}px`);
};

const setupResizeHandles = () => {
    const editorEl = editorRootRef.value;
    if (!editorEl) return;
    applyPersistedPanelSizes(editorEl);

    // Measure the right column width for snap threshold
    const rightCol = editorEl.querySelector('.editor__timeline .grid > div:last-child') as HTMLElement;
    if (rightCol) {
        timelineContainerWidth.value = rightCol.clientWidth;
        timelineWidthObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                timelineContainerWidth.value = entry.contentRect.width;
            }
            vp.setStart(viewport.value.startSec);
        });
        timelineWidthObserver.observe(rightCol);
    }

    // Sidebar resize
    const sidebar = editorEl.querySelector('.editor__sidebar') as HTMLElement;
    if (sidebar) {
        sidebar.addEventListener('pointerdown', (e: PointerEvent) => {
            if (layoutMode.value !== 'full') return;
            const rect = sidebar.getBoundingClientRect();
            if (e.clientX < rect.right - 6) return;
            sidebar.classList.add('is-resizing');
            const startW = sidebar.offsetWidth;
            const startX = e.clientX;
            const onMove = (ev: PointerEvent) => {
                const newW = Math.max(200, Math.min(500, startW + (ev.clientX - startX)));
                editorEl.style.setProperty('--sidebar-width', newW + 'px');
            };
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                sidebar.classList.remove('is-resizing');
                localStorage.setItem(PANEL_STORAGE_KEYS.fullSidebarWidth, sidebar.offsetWidth.toString());
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        });
    }

    // Inspector resize
    const inspector = editorEl.querySelector('.editor__inspector') as HTMLElement;
    if (inspector) {
        inspector.addEventListener('pointerdown', (e: PointerEvent) => {
            if (layoutMode.value !== 'full') return;
            const rect = inspector.getBoundingClientRect();
            if (e.clientX > rect.left + 6) return;
            inspector.classList.add('is-resizing');
            const startW = inspector.offsetWidth;
            const startX = e.clientX;
            const onMove = (ev: PointerEvent) => {
                const newW = Math.max(280, Math.min(600, startW + (startX - ev.clientX)));
                editorEl.style.setProperty('--inspector-width', newW + 'px');
            };
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                inspector.classList.remove('is-resizing');
                localStorage.setItem(PANEL_STORAGE_KEYS.fullInspectorWidth, inspector.offsetWidth.toString());
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        });
    }

    // Timeline top-edge resize — sets --timeline-height on the grid container
    // so the grid row itself changes size (not just max-height on the item).
    const timelineHost = editorEl.querySelector('.editor__timeline') as HTMLElement;
    if (timelineHost) {
        timelineHost.addEventListener('pointerdown', (e: PointerEvent) => {
            if (layoutMode.value !== 'full') return;
            const rect = timelineHost.getBoundingClientRect();
            if (e.clientY > rect.top + 12) return;
            timelineHost.classList.add('is-resizing');
            const startH = timelineHost.offsetHeight;
            const startY = e.clientY;
            const onMove = (ev: PointerEvent) => {
                const newH = Math.max(120, Math.min(600, startH + (startY - ev.clientY)));
                editorEl.style.setProperty('--timeline-height', newH + 'px');
            };
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                timelineHost.classList.remove('is-resizing');
                localStorage.setItem(PANEL_STORAGE_KEYS.fullTimelineHeight, timelineHost.offsetHeight.toString());
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        });
    }

    const previewResizeHandle = editorEl.querySelector('[data-panel-resize="preview"]') as HTMLElement | null;
    const stackedTimelineResizeHandle = editorEl.querySelector('[data-panel-resize="timeline"]') as HTMLElement | null;
    const previewHost = editorEl.querySelector('.editor__preview') as HTMLElement | null;

    if (previewResizeHandle && previewHost) {
        previewResizeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
            if (layoutMode.value !== 'stacked' || !isPanelExpanded('preview')) return;
            e.preventDefault();
            previewHost.classList.add('is-resizing');
            const startH = previewHost.offsetHeight;
            const startY = e.clientY;
            const onMove = (ev: PointerEvent) => {
                const maxH = Math.max(320, window.innerHeight - 180);
                const newH = Math.max(220, Math.min(maxH, startH + (ev.clientY - startY)));
                editorEl.style.setProperty('--stacked-preview-height', `${newH}px`);
            };
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                previewHost.classList.remove('is-resizing');
                localStorage.setItem(PANEL_STORAGE_KEYS.stackedPreviewHeight, previewHost.offsetHeight.toString());
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        });
    }

    if (stackedTimelineResizeHandle && timelineHost) {
        stackedTimelineResizeHandle.addEventListener('pointerdown', (e: PointerEvent) => {
            if (layoutMode.value !== 'stacked' || !isPanelExpanded('timeline')) return;
            e.preventDefault();
            timelineHost.classList.add('is-resizing');
            const startH = timelineHost.offsetHeight;
            const startY = e.clientY;
            const onMove = (ev: PointerEvent) => {
                const maxH = Math.max(300, window.innerHeight - 140);
                const newH = Math.max(200, Math.min(maxH, startH + (ev.clientY - startY)));
                editorEl.style.setProperty('--stacked-timeline-height', `${newH}px`);
            };
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                timelineHost.classList.remove('is-resizing');
                localStorage.setItem(PANEL_STORAGE_KEYS.stackedTimelineHeight, timelineHost.offsetHeight.toString());
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        });
    }
};

// Tab cycling through blocks
const cycleSelection = (forward: boolean) => {
    if (!project.value) return;
    const allItems: TimelineItem[] = [];
    for (const track of project.value.lyricTracks) {
        allItems.push(...track.items);
    }
    allItems.sort((a, b) => a.startMs - b.startMs);
    if (allItems.length === 0) return;

    const currentId = selectedItemId.value;
    const currentIdx = currentId ? allItems.findIndex(i => i.id === currentId) : -1;

    let nextIdx: number;
    if (currentIdx < 0) {
        nextIdx = forward ? 0 : allItems.length - 1;
    } else {
        nextIdx = forward
            ? (currentIdx + 1) % allItems.length
            : (currentIdx - 1 + allItems.length) % allItems.length;
    }
    selection.select(allItems[nextIdx].id);
};

// Jump playhead to selection in/out points
const jumpToSelectionEdge = (edge: 'in' | 'out') => {
    if (!project.value) return;
    const ids = selection.selectedArray.value;
    if (ids.length === 0) return;

    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const track of project.value.lyricTracks) {
        for (const item of track.items) {
            if (ids.includes(item.id)) {
                minStart = Math.min(minStart, item.startMs);
                maxEnd = Math.max(maxEnd, item.endMs);
            }
        }
    }
    if (!Number.isFinite(minStart)) return;
    const targetMs = edge === 'in' ? minStart : maxEnd;
    const targetSec = targetMs / 1000;
    const frame = Math.round(targetSec * fps.value);
    onScrub({ timeSec: targetSec, frame });
};

const onDblClickItem = (itemId: string) => {
    if (!project.value) return;
    for (const track of project.value.lyricTracks) {
        const item = track.items.find(i => i.id === itemId);
        if (item) {
            vp.zoomToRange(item.startMs / 1000, item.endMs / 1000);
            return;
        }
    }
};

const closeTimelineContextMenu = () => {
    timelineContextMenu.value = null;
};

const onLyricItemContextMenu = (payload: { itemId: string; clientX: number; clientY: number }) => {
    if (!selection.selectedIds.value.has(payload.itemId)) {
        selection.select(payload.itemId);
    }

    timelineContextMenu.value = {
        type: 'lyric',
        itemId: payload.itemId,
        x: payload.clientX,
        y: payload.clientY,
    };
};

const onMotionTrackContextMenu = (payload: { trackId: string; clientX: number; clientY: number }) => {
    selectedMotionTrackId.value = payload.trackId;
    timelineContextMenu.value = {
        type: 'motion',
        trackId: payload.trackId,
        x: payload.clientX,
        y: payload.clientY,
    };
};

const runTimelineContextCommand = (commandId: ProjectEditorCommandId) => {
    runProjectEditorCommand(commandId);
    closeTimelineContextMenu();
};

const zoomToSelection = () => {
    if (!project.value) return;
    const ids = selection.selectedArray.value;
    if (ids.length === 0) return;
    let minMs = Infinity;
    let maxMs = -Infinity;
    for (const track of project.value.lyricTracks) {
        for (const item of track.items) {
            if (ids.includes(item.id)) {
                minMs = Math.min(minMs, item.startMs);
                maxMs = Math.max(maxMs, item.endMs);
            }
        }
    }
    if (!Number.isFinite(minMs)) return;
    vp.zoomToRange(minMs / 1000, maxMs / 1000);
};

const isEditableTarget = (target: EventTarget | null): boolean => {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
    return !!(target as HTMLElement | null)?.closest?.('.ProseMirror');
};

const runProjectEditorCommand = (commandId: ProjectEditorCommandId) => {
    executeProjectEditorCommand(commandId, {
        mode: mode.value,
        hasSelection: selection.hasSelection.value,
        selectedMotionTrackId: selectedMotionTrackId.value,
        clearSelection: () => selection.clearSelection(),
        togglePlayback: togglePlay,
        undo: performUndo,
        redo: performRedo,
        copyLyricSelection: copySelectedItems,
        cutLyricSelection: cutSelectedItems,
        pasteLyricSelection: pasteClipboardItems,
        deleteLyricSelection: deleteSelectedItem,
        splitSelectionAtPlayhead: splitSelectedAtPlayhead,
        zoomToFit: () => vp.zoomToFit(),
        zoomToSelection,
        jumpToSelectionEdge,
        cycleSelection,
        nudgeLyricSelection: (deltaMs: number) => {
            nudgeSelectedItem(deltaMs);
            markDirty();
        },
        deleteMotionTrack: deleteSelectedMotionTrack,
        copyMotionTrack: copySelectedMotionTrack,
        cutMotionTrack: cutSelectedMotionTrack,
        pasteMotionTrack,
        nudgeMotionTrack: nudgeSelectedMotionTrack,
        stepPlayhead: (deltaFrames: number) => {
            const newFrame = Math.max(0, playhead.value.frame + deltaFrames);
            vp.setPlayhead(newFrame);
            audio.seekTo(newFrame / fps.value);
            markDirty();
        },
    });
};

const onRendererMenuCommand = (event: Event) => {
    const commandId = (event as CustomEvent<ProjectEditorCommandId>).detail;

    if (!commandId) return;

    runProjectEditorCommand(commandId);
};

// Keyboard shortcuts
const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Alt') snapEngine.setAltSuppressed(true);
    if (e.key === 'Escape') closeTimelineContextMenu();

    if (isEditableTarget(e.target)) return;

    const commandId = getProjectEditorCommandIdFromKeydown(e, { mode: mode.value });
    if (!commandId) return;

    e.preventDefault();
    runProjectEditorCommand(commandId);
};

const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Alt') snapEngine.setAltSuppressed(false);
};

onMounted(() => {
    restoreStackedPanels();
    syncLayoutMode();
    loadProject();
    videoExport.checkFfmpegAvailable();
    window.addEventListener('resize', syncLayoutMode);
    window.addEventListener('click', closeTimelineContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener(RENDERER_MENU_COMMAND_EVENT, onRendererMenuCommand as EventListener);
});

onUnmounted(() => {
    stopRafLoop();
    if (saveTimer) clearTimeout(saveTimer);
    if (uiNoticeTimer) clearTimeout(uiNoticeTimer);
    window.removeEventListener('resize', syncLayoutMode);
    window.removeEventListener('click', closeTimelineContextMenu);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener(RENDERER_MENU_COMMAND_EVENT, onRendererMenuCommand as EventListener);
    timelineWidthObserver?.disconnect();
    audio.dispose();
    motionRenderer.dispose();
    previewCanvasComposable.dispose();
});
</script>

<template>
    <div v-if="loading" class="editor-loading">
        <SvgIcon type="mdi" :path="mdiLoading" :size="30" class="editor-loading__icon" />
        <p>Loading project...</p>
    </div>
    <div
        v-else-if="project"
        ref="editorRootRef"
        class="editor project-editor"
        :class="{
            'editor--full': layoutMode === 'full',
            'editor--stacked': layoutMode === 'stacked',
        }"
    >
        <!-- Toolbar -->
        <div class="editor__toolbar">
            <div class="toolbar__left">
                <button class="toolbar-back" @click="router.push({ name: 'Index' })" aria-label="Back to home">
                    <SvgIcon type="mdi" :path="mdiHomeVariantOutline" :size="16" />
                </button>

                <span class="toolbar-title">
                    {{ project.song.title || 'Untitled' }}
                </span>
            </div>

            <div class="toolbar__center">
                <div class="toolbar-mode-toggle">
                    <button :class="{ active: mode === 'lyric' }" @click="mode = 'lyric'">Lyric</button>
                    <button :class="{ active: mode === 'motion' }" @click="mode = 'motion'">Motion</button>
                </div>
            </div>

            <div class="toolbar__right">
                <span v-if="vp.interaction.value.mode !== 'idle'" class="toolbar-mode-indicator">{{ vp.interaction.value.mode }}</span>
                <button
                    @click="togglePlay"
                    class="toolbar-icon-btn"
                    :title="audio.isPlaying.value ? 'Pause playback' : 'Play playback'"
                    :aria-label="audio.isPlaying.value ? 'Pause playback' : 'Play playback'"
                >
                    <SvgIcon type="mdi" :path="audio.isPlaying.value ? mdiPause : mdiPlay" :size="16" />
                </button>
                <button
                    @click="stopPlayback"
                    class="toolbar-icon-btn"
                    title="Stop playback"
                    aria-label="Stop playback"
                    :disabled="!audio.isPlaying.value && playhead.frame === 0"
                >
                    <SvgIcon type="mdi" :path="mdiStop" :size="16" />
                </button>
                <span v-if="audio.duration.value > 0" class="toolbar-time">
                    {{ (audio.currentTime.value).toFixed(1) }}s / {{ (audio.duration.value).toFixed(1) }}s
                </span>
            </div>
        </div>
        <div v-if="uiNotice" class="project-notice">{{ uiNotice }}</div>

        <!-- Sidebar -->
        <div class="editor__sidebar editor-panel" :class="{ 'is-collapsed': layoutMode === 'stacked' && !isPanelExpanded('sidebar') }">
            <button
                v-show="layoutMode === 'stacked'"
                type="button"
                class="editor-panel__toggle"
                @click="toggleStackedPanel('sidebar')"
            >
                <span class="editor-panel__toggle-title">{{ mode === 'lyric' ? 'Lyrics' : 'Motion' }}</span>
                <span class="editor-panel__toggle-meta">{{ mode === 'lyric' ? 'Tracks and raw lyrics' : 'Motion tracks and sources' }}</span>
            </button>
            <div v-show="isPanelExpanded('sidebar')" class="editor-panel__content editor-panel__content--sidebar">
                <template v-if="mode === 'lyric'">
                    <TrackListPanel
                        :tracks="project.lyricTracks"
                        :raw-lyrics="rawLyrics"
                        :audio-duration-ms="audioDurationMs"
                        :selected-verse-track-id="selectedVerseTrackId"
                        :selected-line-track-id="selectedLineTrackId"
                        @add-track="onAddTrack"
                        @generate-lines="onGenerateLines"
                        @generate-words="onGenerateWords"
                        @delete-track="onDeleteTrack"
                        @update-track="onUpdateTrack"
                    />
                    <RawLyricsPanel v-model:rawLyrics="rawLyrics" :tracks="project.lyricTracks" />
                </template>
                <template v-else>
                    <MotionTrackListPanel
                        :lyric-tracks="project.lyricTracks"
                        :motion-tracks="project.motionTracks"
                        :selected-track-id="selectedMotionTrackId"
                        :plugins="availableMotionPlugins"
                        @add-track="onAddMotionTrack"
                        @delete-track="onDeleteMotionTrack"
                        @select-track="onSelectMotionTrack"
                        @update-track="onUpdateMotionTrack"
                    />
                </template>
            </div>
        </div>

        <!-- Monitor / Preview -->
        <div class="editor__preview editor-panel" :class="{ 'is-collapsed': layoutMode === 'stacked' && !isPanelExpanded('preview') }">
            <button
                v-show="layoutMode === 'stacked'"
                type="button"
                class="editor-panel__toggle"
                @click="toggleStackedPanel('preview')"
            >
                <span class="editor-panel__toggle-title">Preview</span>
                <span class="editor-panel__toggle-meta">{{ project.settings.renderWidth }} x {{ project.settings.renderHeight }} at {{ project.settings.fps }} FPS</span>
            </button>
            <div v-show="isPanelExpanded('preview')" class="editor-panel__content editor-panel__content--preview">
                <div class="monitor-container">
                <div class="monitor-header">
                    <div class="monitor-title-section">
                        <h3 class="monitor-title">MONITOR</h3>
                        <span class="monitor-frame">Frame: {{ currentFrame }}</span>
                    </div>
                    <div class="monitor-export-controls">
                        <button
                            v-if="mode === 'motion' && selectedTrackSupportsMonitorGizmo"
                            class="toolbar-toggle gizmo-toggle"
                            :class="{ active: monitorManipulationEnabled }"
                            title="Toggle transform overlay"
                            @click="monitorManipulationEnabled = !monitorManipulationEnabled"
                        >
                            <SvgIcon type="mdi" :path="mdiCrosshairs" :size="16" />
                        </button>
                        <button @click="openExportModal" class="export success">Export</button>
                    </div>
                </div>

                <div class="monitor-display">
                    <canvas ref="renderCanvas" class="preview__canvas-offscreen"></canvas>
                    <div class="preview__canvas-wrapper">
                        <canvas ref="previewCanvas" class="preview__canvas"></canvas>
                        <canvas ref="previewOverlay" class="preview__overlay"></canvas>
                    </div>
                </div>

                <div class="monitor-settings">
                    <div class="monitor-info">
                        <template v-if="!isEditingSettings">
                            <span class="info-item">{{ project.settings.fps }} FPS</span>
                            <span class="info-separator">&middot;</span>
                            <span class="info-item">{{ project.settings.renderWidth }} &times; {{ project.settings.renderHeight }}</span>
                            <span class="info-separator">&middot;</span>
                            <span class="info-item">{{ project.settings.exportBitrateMbps || 8 }} Mbps</span>
                        </template>
                        <template v-else>
                            <input
                                type="number"
                                :value="project.settings.fps"
                                @input="updateFps"
                                class="fps-input"
                                placeholder="FPS"
                                min="1"
                                max="120"
                            />
                            <span class="info-label">FPS</span>
                            <span class="info-separator">&middot;</span>
                            <select @change="updateDimensions" :value="dimensionSelectValue" class="dimension-preset">
                                <option v-for="p in CANVAS_DIMENSION_PRESETS" :key="p.value" :value="p.value">{{ p.label }}</option>
                                <option value="custom">Custom</option>
                            </select>
                            <span class="info-separator">&middot;</span>
                            <input
                                type="number"
                                :value="project.settings.renderWidth"
                                @input="updateRenderWidth"
                                class="fps-input dimension-input"
                                :min="RENDER_DIMENSION_BOUNDS.min"
                                :max="RENDER_DIMENSION_BOUNDS.max"
                            />
                            <span class="info-separator dim-cross">&times;</span>
                            <input
                                type="number"
                                :value="project.settings.renderHeight"
                                @input="updateRenderHeight"
                                class="fps-input dimension-input"
                                :min="RENDER_DIMENSION_BOUNDS.min"
                                :max="RENDER_DIMENSION_BOUNDS.max"
                            />
                            <span class="info-separator">&middot;</span>
                            <input
                                type="number"
                                :value="project.settings.exportBitrateMbps || 8"
                                @input="updateBitrate"
                                class="bitrate-input"
                                placeholder="Mbps"
                                min="1"
                                max="100"
                            />
                            <span class="info-label">Mbps</span>
                        </template>
                    </div>
                    <div class="monitor-controls">
                        <button @click="toggleEditSettings" class="edit-toggle">
                            <template v-if="isEditingSettings">
                                <SvgIcon type="mdi" :path="mdiCheck" :size="12" />
                                <span>Done</span>
                            </template>
                            <template v-else>
                                <SvgIcon type="mdi" :path="mdiPencil" :size="12" />
                                <span>Edit</span>
                            </template>
                        </button>
                    </div>
                </div>
            </div>
            </div>
            <div
                v-show="layoutMode === 'stacked' && isPanelExpanded('preview')"
                class="editor-panel__resize-handle"
                data-panel-resize="preview"
                aria-hidden="true"
            ></div>
        </div>

        <!-- Inspector -->
        <div class="editor__inspector editor-panel" :class="{ 'is-collapsed': layoutMode === 'stacked' && !isPanelExpanded('inspector') }">
            <button
                v-show="layoutMode === 'stacked'"
                type="button"
                class="editor-panel__toggle"
                @click="toggleStackedPanel('inspector')"
            >
                <span class="editor-panel__toggle-title">Inspector</span>
                <span class="editor-panel__toggle-meta">{{ mode === 'motion' ? 'Motion, scene, and background controls' : 'Project and lyric controls' }}</span>
            </button>
            <div v-show="isPanelExpanded('inspector')" class="editor-panel__content editor-panel__content--inspector">
                <template v-if="mode === 'motion'">
                    <MotionInspectorHost
                        v-if="selectedMotionTrack"
                        :motion-track="selectedMotionTrack"
                        :lyric-tracks="project.lyricTracks"
                        :playhead-ms="playheadMs"
                        :fps="fps"
                        :project-font="project.font"
                        :render-width="targetWidth"
                        :render-height="targetHeight"
                        :renderer-bounds="selectedMotionTrackId ? motionRenderer.getRendererBounds(selectedMotionTrackId) : null"
                        :scene3d="normalizedScene3D"
                        @update-track="onUpdateMotionTrack"
                        @seek-to-ms="onSeekToMs"
                        @update-scene3d="onUpdateScene3D"
                    />
                    <BackgroundInspector
                        :background-image="project.backgroundImage"
                        :background-color="project.backgroundColor"
                        :background-visible="project.backgroundVisible !== false"
                        :background-image-visible="project.backgroundImageVisible !== false"
                        :background-opacity="project.backgroundColorOpacity ?? 1"
                        :background-use-gradient="!!project.backgroundUseGradient"
                        :background-gradient-color="project.backgroundGradientColor || '#222222'"
                        :background-gradient-angle="project.backgroundGradientAngle ?? 90"
                        :background-image-fit="project.backgroundImageFit || 'cover'"
                        :background-image-offset-x="project.backgroundImageX ?? 0"
                        :background-image-offset-y="project.backgroundImageY ?? 0"
                        :background-image-scale="project.backgroundImageScale ?? 1"
                        :background-image-opacity="project.backgroundImageOpacity ?? 1"
                        @set-background-color="onSetBackgroundColor"
                        @set-background-visible="onSetBackgroundVisibility"
                        @set-background-image-visible="onSetBackgroundImageVisibility"
                        @set-background-opacity="onSetBackgroundOpacity"
                        @set-background-use-gradient="onSetBackgroundUseGradient"
                        @set-background-gradient-color="onSetBackgroundGradientColor"
                        @set-background-gradient-angle="onSetBackgroundGradientAngle"
                        @set-background-fit="onSetBackgroundFit"
                        @set-background-image-offset-x="onSetBackgroundImageOffsetX"
                        @set-background-image-offset-y="onSetBackgroundImageOffsetY"
                        @set-background-image-scale="onSetBackgroundImageScale"
                        @set-background-image-opacity="onSetBackgroundImageOpacity"
                        @upload-background-image="onUploadBackgroundImage"
                        @clear-background-image="onClearBackgroundImage"
                        @reset-background-image-controls="onResetBackgroundImageControls"
                        @reset-background="onResetBackground"
                    />
                    <AnalysisOverlaysSection
                        :overlay-opts="overlayOpts"
                        @update:overlay-opts="updateOverlayOpts"
                    />
                </template>
                <template v-else>
                    <ProjectInspector
                        :project="project"
                        :mode="mode"
                        :tracks="project.lyricTracks"
                        :selected-item-id="selectedItemId"
                        :playhead-ms="playheadMs"
                        :overlay-opts="overlayOpts"
                        @update-project="onUpdateProject"
                        @project-media-updated="onSongProjectUpdated"
                        @update-item="onUpdateItem"
                        @delete-item="onDeleteItem"
                        @split-item="onSplitItem"
                        @merge-with-next="onMergeWithNext"
                        @add-item-at-location="onAddItemAtLocation"
                        @update:overlay-opts="updateOverlayOpts"
                    />
                </template>
            </div>
        </div>

        <!-- Timeline -->
        <div class="editor__timeline editor-panel" :class="{ 'is-collapsed': layoutMode === 'stacked' && !isPanelExpanded('timeline') }">
            <button
                v-show="layoutMode === 'stacked'"
                type="button"
                class="editor-panel__toggle"
                @click="toggleStackedPanel('timeline')"
            >
                <span class="editor-panel__toggle-title">Timeline</span>
                <span class="editor-panel__toggle-meta">{{ mode === 'motion' ? 'Motion tracks and keyframes' : 'Lyrics, waveform, and analysis' }}</span>
            </button>
            <div v-show="isPanelExpanded('timeline')" class="editor-panel__content editor-panel__content--timeline">
                <div class="timeline-root" :style="{ '--playhead-x': playheadX } as any">
                <div class="timeline">
                    <div class="grid" style="grid-template-columns: 220px 1fr">
                        <!-- Left column: labels -->
                        <div class="leftcol">
                            <div class="lane-label ruler-label" :style="{ height: `${laneHeights.ruler}px` }">
                                <span>TIME</span>
                                <button
                                    class="lane-icon-btn timeline-snap-toggle"
                                    :class="{ active: snapEngine.enabled.value }"
                                    aria-label="Toggle snap"
                                    data-tooltip="Toggle snap"
                                    @click.stop="snapEngine.enabled.value = !snapEngine.enabled.value"
                                >
                                    <SvgIcon type="mdi" :path="mdiMagnet" :size="12" />
                                </button>
                            </div>
                            <div
                                v-for="track in (project?.lyricTracks ?? [])"
                                :key="'label-' + track.id"
                                class="lane-label lane-label--track lane-label--lyric"
                                :class="{ collapsed: collapsed[`track-${track.id}`] }"
                                :style="{ height: `${collapsed[`track-${track.id}`] ? 28 : getTrackHeight(track.id)}px` }"
                                :title="track.name"
                                @click="collapsed[`track-${track.id}`] = !collapsed[`track-${track.id}`]"
                            >
                                <div class="lane-label__content">
                                    <span class="lane-kind-icon lane-kind-icon--lyric" aria-hidden="true">
                                        <SvgIcon type="mdi" :path="mdiMusicNote" :size="10" />
                                    </span>
                                    <span class="pe-track-color" :style="{ backgroundColor: track.color }"></span>
                                    <span class="lane-label__name">{{ track.name }}</span>
                                </div>
                                <div v-if="mode === 'lyric'" class="lane-label__actions" @click.stop>
                                    <button class="lane-icon-btn" :class="{ active: track.muted }" aria-label="Mute track" data-tooltip="Mute track" @click.stop="toggleLyricMute(track)">
                                        <SvgIcon type="mdi" :path="mdiEyeOff" :size="12" />
                                    </button>
                                    <button class="lane-icon-btn" :class="{ active: track.solo }" aria-label="Solo track" data-tooltip="Solo track" @click.stop="toggleLyricSolo(track)">
                                        <SvgIcon type="mdi" :path="mdiEye" :size="12" />
                                    </button>
                                    <button class="lane-icon-btn" :class="{ active: track.locked }" aria-label="Lock track" data-tooltip="Lock track" @click.stop="toggleLyricLock(track)">
                                        <SvgIcon type="mdi" :path="mdiLock" :size="12" />
                                    </button>
                                    <button class="lane-icon-btn" aria-label="Duplicate track" data-tooltip="Duplicate track" @click.stop="onDuplicateTrack(track.id)">
                                        <SvgIcon type="mdi" :path="mdiContentCopy" :size="12" />
                                    </button>
                                    <button
                                        class="lane-icon-btn"
                                        :disabled="project?.lyricTracks?.findIndex((t) => t.id === track.id) === 0"
                                        aria-label="Move track up"
                                        data-tooltip="Move track up"
                                        @click.stop="moveLyricTrack(track.id, -1)"
                                    >
                                        <SvgIcon type="mdi" :path="mdiArrowUp" :size="12" />
                                    </button>
                                    <button
                                        class="lane-icon-btn"
                                        :disabled="project?.lyricTracks?.findIndex((t) => t.id === track.id) === (project?.lyricTracks?.length || 1) - 1"
                                        aria-label="Move track down"
                                        data-tooltip="Move track down"
                                        @click.stop="moveLyricTrack(track.id, 1)"
                                    >
                                        <SvgIcon type="mdi" :path="mdiArrowDown" :size="12" />
                                    </button>
                                </div>
                            </div>
                            <template v-if="mode === 'motion'">
                                <template v-for="track in (project?.motionTracks ?? [])" :key="'motion-label-group-' + track.id">
                                    <div
                                        class="lane-label lane-label--motion lane-label--track"
                                        :class="{ selected: selectedMotionTrackId === track.id, collapsed: collapsed[`motion-${track.id}`] }"
                                        :style="{ height: `${collapsed[`motion-${track.id}`] ? 28 : 58}px` }"
                                        @click="onSelectMotionTrack(track.id)"
                                    >
                                        <div class="lane-label__content">
                                            <span class="lane-kind-icon lane-kind-icon--motion" aria-hidden="true">
                                                <SvgIcon type="mdi" :path="mdiCrosshairs" :size="10" />
                                            </span>
                                            <span class="pe-track-color" :style="{ backgroundColor: track.color }"></span>
                                            <span class="lane-label__name">{{ track.name }}</span>
                                        </div>
                                        <div class="lane-label__actions" @click.stop>
                                            <button
                                                class="lane-icon-btn"
                                                :class="{ active: collapsed[`motion-${track.id}`] }"
                                                aria-label="Collapse motion track"
                                                data-tooltip="Collapse motion track"
                                                @click.stop="collapsed[`motion-${track.id}`] = !collapsed[`motion-${track.id}`]"
                                            >
                                                <SvgIcon type="mdi" :path="mdiArrowDown" :size="12" />
                                            </button>
                                            <button class="lane-icon-btn" :class="{ active: track.muted }" aria-label="Mute track" data-tooltip="Mute track" @click.stop="toggleMotionMute(track)">
                                                <SvgIcon type="mdi" :path="mdiEyeOff" :size="12" />
                                            </button>
                                            <button class="lane-icon-btn" :class="{ active: track.solo }" aria-label="Solo track" data-tooltip="Solo track" @click.stop="toggleMotionSolo(track)">
                                                <SvgIcon type="mdi" :path="mdiEye" :size="12" />
                                            </button>
                                            <button class="lane-icon-btn" :class="{ active: track.locked }" aria-label="Lock track" data-tooltip="Lock track" @click.stop="toggleMotionLock(track)">
                                                <SvgIcon type="mdi" :path="mdiLock" :size="12" />
                                            </button>
                                            <button class="lane-icon-btn" aria-label="Duplicate track" data-tooltip="Duplicate track" @click.stop="onDuplicateMotionTrack(track.id)">
                                                <SvgIcon type="mdi" :path="mdiContentCopy" :size="12" />
                                            </button>
                                            <button
                                                class="lane-icon-btn"
                                                :disabled="project?.motionTracks?.findIndex((t) => t.id === track.id) === 0"
                                                aria-label="Move track up"
                                                data-tooltip="Move track up"
                                                @click.stop="moveMotionTrack(track.id, -1)"
                                            >
                                                <SvgIcon type="mdi" :path="mdiArrowUp" :size="12" />
                                            </button>
                                            <button
                                                class="lane-icon-btn"
                                                :disabled="project?.motionTracks?.findIndex((t) => t.id === track.id) === (project?.motionTracks?.length || 1) - 1"
                                                aria-label="Move track down"
                                                data-tooltip="Move track down"
                                                @click.stop="moveMotionTrack(track.id, 1)"
                                            >
                                                <SvgIcon type="mdi" :path="mdiArrowDown" :size="12" />
                                            </button>
                                        </div>
                                    </div>
                                    <div
                                        v-if="!collapsed[`motion-${track.id}`]"
                                        v-for="pt in (track.block.propertyTracks || []).filter(p => p.enabled !== false && (p.keyframes?.length || 0) > 0)"
                                        :key="'kf-label-' + track.id + '-' + pt.propertyPath"
                                        class="lane-label lane-label--kf"
                                        :style="{ height: '22px' }"
                                    >
                                        <div class="lane-label__content">
                                            <span class="kf-label-diamond" aria-hidden="true">
                                                <SvgIcon type="mdi" :path="mdiDiamond" :size="8" />
                                            </span>
                                            <span class="lane-label__name">{{ kfLabel(pt.propertyPath) }}</span>
                                        </div>
                                        <div class="lane-label__actions" @click.stop>
                                            <button
                                                class="lane-icon-btn"
                                                aria-label="Previous keyframe"
                                                data-tooltip="Previous keyframe"
                                                @click.stop="jumpToPropertyKeyframe(track.id, pt.propertyPath, 'prev')"
                                            >
                                                <SvgIcon type="mdi" :path="mdiSkipPrevious" :size="12" />
                                            </button>
                                            <button
                                                class="lane-icon-btn"
                                                aria-label="Next keyframe"
                                                data-tooltip="Next keyframe"
                                                @click.stop="jumpToPropertyKeyframe(track.id, pt.propertyPath, 'next')"
                                            >
                                                <SvgIcon type="mdi" :path="mdiSkipNext" :size="12" />
                                            </button>
                                            <button
                                                class="lane-icon-btn"
                                                :disabled="track.locked"
                                                aria-label="Set keyframe at playhead"
                                                data-tooltip="Set keyframe at playhead"
                                                @click.stop="setPropertyKeyframeAtPlayhead(track.id, pt.propertyPath)"
                                            >
                                                <SvgIcon type="mdi" :path="mdiDiamondOutline" :size="12" />
                                            </button>
                                        </div>
                                    </div>
                                </template>
                            </template>
                            <template v-if="analysis.waveform.value && analysis.waveform.value.length > 0">
                                <div
                                    class="lane-label"
                                    :class="{ collapsed: collapsed.waveform }"
                                    :style="{ height: `${collapsed.waveform ? 28 : laneHeights.waveform}px` }"
                                    @click="collapsed.waveform = !collapsed.waveform"
                                >WAVEFORM</div>
                            </template>
                            <template v-if="overlayOpts.showEnergy && analysis.analysisCache.value?.energyPerFrame">
                                <div
                                    class="lane-label"
                                    :class="{ collapsed: collapsed.energy }"
                                    :style="{ height: `${collapsed.energy ? 28 : laneHeights.energy}px` }"
                                    @click="collapsed.energy = !collapsed.energy"
                                >ENERGY</div>
                            </template>
                            <template v-if="overlayOpts.showBeatStrength && analysis.beatStrengthPerFrame.value?.length">
                                <div
                                    class="lane-label"
                                    :class="{ collapsed: collapsed.beatstrength }"
                                    :style="{ height: `${collapsed.beatstrength ? 28 : laneHeights.beatstrength}px` }"
                                    @click="collapsed.beatstrength = !collapsed.beatstrength"
                                >BEAT STRENGTH</div>
                            </template>
                            <template v-if="overlayOpts.showBeats && analysis.beatTimesSec.value?.length">
                                <div
                                    class="lane-label"
                                    :class="{ collapsed: collapsed.beats }"
                                    :style="{ height: `${collapsed.beats ? 28 : laneHeights.beats}px` }"
                                    @click="collapsed.beats = !collapsed.beats"
                                >BEATS</div>
                            </template>
                            <template v-if="overlayOpts.showBands && analysis.bandsLowPerFrame.value?.length">
                                <div
                                    class="lane-label"
                                    :class="{ collapsed: collapsed.bands }"
                                    :style="{ height: `${collapsed.bands ? 28 : laneHeights.bands}px` }"
                                    @click="collapsed.bands = !collapsed.bands"
                                >BANDS</div>
                            </template>
                        </div>
                        <!-- Right column: lanes -->
                        <div ref="lanesColumnRef" style="position: relative">
                            <SnapOverlay :snap-lines="snapEngine.activeSnapLines.value" :viewport="viewport" />
                            <div v-if="marqueeStyle" class="timeline-marquee" :style="marqueeStyle"></div>
                            <!-- Ruler -->
                            <div class="lane lane--ruler-sticky lane--no-resize" :style="{ height: `${laneHeights.ruler}px` }">
                                <RulerLane
                                    :viewport="viewport"
                                    :playhead="playhead"
                                    @scrub="onScrub"
                                    @pan="onPan"
                                    @zoom-around="onZoom"
                                />
                            </div>
                            <!-- Lyric Track lanes -->
                            <div v-for="track in (project?.lyricTracks ?? [])"
                                :key="track.id"
                                class="lane"
                                :data-track-id="track.id"
                                :style="{ height: `${collapsed[`track-${track.id}`] ? 28 : getTrackHeight(track.id)}px` }">
                                <LyricTrackLane
                                    v-if="!collapsed[`track-${track.id}`]"
                                    :viewport="viewport"
                                    :fps="fps"
                                    :track="mode === 'motion' ? { ...track, locked: true } : track"
                                    :playhead-frame="playhead.frame"
                                    :selected-item-id="selectedItemId"
                                    :selected-item-ids="selection.selectedIds.value"
                                    :all-selected-items="allSelectedItems"
                                    :snap-find="snapEngine.findSnap"
                                    :snap-clear="snapEngine.clearSnap"
                                    :set-interaction="(mode: string) => vp.setInteraction(mode as any)"
                                    @select-item="onSelectItem"
                                    @toggle-item="onToggleItem"
                                    @add-to-selection="onAddToSelection"
                                    @update-item="onUpdateItem"
                                    @update-items="onUpdateItems"
                                    @group-move-all="onGroupMoveAll"
                                    @marquee-start="onMarqueeStart"
                                    @dblclick-item="onDblClickItem"
                                    @context-menu-item="onLyricItemContextMenu"
                                    @push-undo="onPushUndo"
                                    @scrub="onScrub"
                                    @pan="onPan"
                                    @zoom-around="onZoom"
                                />
                                <div v-else class="lane-mini-blocks">
                                    <div
                                        v-for="item in track.items.filter(i => i.endMs > viewport.startSec * 1000 && i.startMs < (viewport.startSec + viewport.durationSec) * 1000)"
                                        :key="item.id"
                                        class="lane-mini-block"
                                        :style="miniItemStyle(item, track)"
                                    ></div>
                                </div>
                                <div class="lane-resizer" @pointerdown="(e: PointerEvent) => startResize(`track-${track.id}`, e)"></div>
                            </div>
                            <template v-if="mode === 'motion'">
                                <template v-for="track in (project?.motionTracks ?? [])" :key="'motion-group-' + track.id">
                                    <div class="lane" :style="{ height: `${collapsed[`motion-${track.id}`] ? 28 : 58}px` }">
                                        <MotionTrackLane
                                            v-if="!collapsed[`motion-${track.id}`]"
                                            :viewport="viewport"
                                            :fps="fps"
                                            :track="track"
                                            :selected="selectedMotionTrackId === track.id"
                                            :snap-find="snapEngine.findSnap"
                                            :snap-clear="snapEngine.clearSnap"
                                            @select-track="onSelectMotionTrack"
                                            @update-track="onUpdateMotionTrack"
                                            @push-undo="onPushUndo"
                                            @context-menu-track="onMotionTrackContextMenu"
                                            @pan="onPan"
                                            @zoom-around="onZoom"
                                        />
                                        <div v-else class="lane-mini-blocks">
                                            <div
                                                class="lane-mini-block"
                                                :style="{
                                                    left: `${((track.block.startMs / 1000 - viewport.startSec) / viewport.durationSec) * 100}%`,
                                                    width: `${(((track.block.endMs - track.block.startMs) / 1000) / viewport.durationSec) * 100}%`,
                                                    backgroundColor: track.color,
                                                }"
                                            ></div>
                                        </div>
                                    </div>
                                    <div
                                        v-if="!collapsed[`motion-${track.id}`]"
                                        v-for="pt in (track.block.propertyTracks || []).filter(p => p.enabled !== false && (p.keyframes?.length || 0) > 0)"
                                        :key="'kf-' + track.id + '-' + pt.propertyPath"
                                        class="lane"
                                        :style="{ height: '22px' }"
                                    >
                                        <PropertyKeyframeLane
                                            :viewport="viewport"
                                            :fps="fps"
                                            :track="track"
                                            :property-track="pt"
                                            :selected="selectedMotionTrackId === track.id"
                                            :playhead-frame="playhead.frame"
                                            :locked="track.locked"
                                            @update-track="onUpdateMotionTrack"
                                            @push-undo="onPushUndo"
                                            @pan="onPan"
                                            @zoom-around="onZoom"
                                        />
                                    </div>
                                </template>
                            </template>
                            <!-- Waveform -->
                            <template v-if="analysis.waveform.value && analysis.waveform.value.length > 0">
                                <div class="lane" :style="{ height: `${collapsed.waveform ? 28 : laneHeights.waveform}px` }">
                                    <WaveformLane
                                        v-if="!collapsed.waveform"
                                        :viewport="viewport"
                                        :fps="fps"
                                        :waveform="analysis.waveform.value"
                                        :analyzed-duration-sec="audio.duration.value"
                                        @scrub="onScrub"
                                        @pan="onPan"
                                        @zoom-around="onZoom"
                                    />
                                    <div class="lane-resizer" @pointerdown="(e: PointerEvent) => startResize('waveform', e)"></div>
                                </div>
                            </template>
                            <!-- Energy -->
                            <template v-if="overlayOpts.showEnergy && analysis.analysisCache.value?.energyPerFrame">
                                <div class="lane" :style="{ height: `${collapsed.energy ? 28 : laneHeights.energy}px` }">
                                    <EnergyLane
                                        v-if="!collapsed.energy"
                                        :viewport="viewport"
                                        :fps="fps"
                                        :energy-per-frame="analysis.analysisCache.value.energyPerFrame as any"
                                        :analyzed-duration-sec="audio.duration.value"
                                        @scrub="onScrub"
                                        @pan="onPan"
                                        @zoom-around="onZoom"
                                    />
                                    <div class="lane-resizer" @pointerdown="(e: PointerEvent) => startResize('energy', e)"></div>
                                </div>
                            </template>
                            <!-- Beat Strength -->
                            <template v-if="overlayOpts.showBeatStrength && analysis.beatStrengthPerFrame.value?.length">
                                <div class="lane" :style="{ height: `${collapsed.beatstrength ? 28 : laneHeights.beatstrength}px` }">
                                    <BeatStrengthLane
                                        v-if="!collapsed.beatstrength"
                                        :viewport="viewport"
                                        :fps="fps"
                                        :beat-strength-per-frame="analysis.beatStrengthPerFrame.value"
                                        :analyzed-duration-sec="audio.duration.value"
                                        @scrub="onScrub"
                                        @pan="onPan"
                                        @zoom-around="onZoom"
                                    />
                                    <div class="lane-resizer" @pointerdown="(e: PointerEvent) => startResize('beatstrength', e)"></div>
                                </div>
                            </template>
                            <!-- Beats -->
                            <template v-if="overlayOpts.showBeats && analysis.beatTimesSec.value?.length">
                                <div class="lane" :style="{ height: `${collapsed.beats ? 28 : laneHeights.beats}px` }">
                                    <BeatsLane
                                        v-if="!collapsed.beats"
                                        :viewport="viewport"
                                        :fps="fps"
                                        :beats="analysis.beatTimesSec.value"
                                        @scrub="onScrub"
                                        @pan="onPan"
                                        @zoom-around="onZoom"
                                    />
                                    <div class="lane-resizer" @pointerdown="(e: PointerEvent) => startResize('beats', e)"></div>
                                </div>
                            </template>
                            <!-- Bands -->
                            <template v-if="overlayOpts.showBands && analysis.bandsLowPerFrame.value?.length">
                                <div class="lane" :style="{ height: `${collapsed.bands ? 28 : laneHeights.bands}px` }">
                                    <BandsLane
                                        v-if="!collapsed.bands"
                                        :viewport="viewport"
                                        :fps="fps"
                                        :low="analysis.bandsLowPerFrame.value"
                                        :mid="analysis.bandsMidPerFrame.value"
                                        :high="analysis.bandsHighPerFrame.value"
                                        :analyzed-duration-sec="audio.duration.value"
                                        @scrub="onScrub"
                                        @pan="onPan"
                                        @zoom-around="onZoom"
                                    />
                                    <div class="lane-resizer" @pointerdown="(e: PointerEvent) => startResize('bands', e)"></div>
                                </div>
                            </template>
                            <div
                                v-if="timelineContextMenu"
                                class="timeline-context-menu"
                                :style="{ left: `${timelineContextMenu.x}px`, top: `${timelineContextMenu.y}px` }"
                                @click.stop
                            >
                                <template v-if="timelineContextMenu.type === 'lyric'">
                                    <button class="timeline-context-menu__item" @click="runTimelineContextCommand('edit.copy')">Copy Lyric Selection</button>
                                    <button class="timeline-context-menu__item" @click="runTimelineContextCommand('edit.cut')">Cut Lyric Selection</button>
                                    <button class="timeline-context-menu__item" @click="runTimelineContextCommand('edit.split')">Split At Playhead</button>
                                    <div class="timeline-context-menu__divider"></div>
                                    <button class="timeline-context-menu__item danger" @click="runTimelineContextCommand('edit.delete')">Delete Lyric Selection</button>
                                </template>
                                <template v-else>
                                    <button class="timeline-context-menu__item" @click="runTimelineContextCommand('edit.copy')">Copy Motion Track</button>
                                    <button class="timeline-context-menu__item" @click="runTimelineContextCommand('edit.cut')">Cut Motion Track</button>
                                    <button class="timeline-context-menu__item" @click="runTimelineContextCommand('edit.paste')">Paste Motion Track</button>
                                    <div class="timeline-context-menu__divider"></div>
                                    <button class="timeline-context-menu__item danger" @click="runTimelineContextCommand('edit.delete')">Delete Motion Track</button>
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            </div>
            <div
                v-show="layoutMode === 'stacked' && isPanelExpanded('timeline')"
                class="editor-panel__resize-handle"
                data-panel-resize="timeline"
                aria-hidden="true"
            ></div>
        </div>
    </div>
    <ExportModal
        :show="videoExport.showExportModal.value"
        :state="videoExport.exportState.value"
        :export-mode="exportMode"
        :include-audio="project?.settings.includeAudio ?? true"
        :keep-raw-png-frames="project?.settings.keepRawPngFrames ?? false"
        :export-alpha-mov="project?.settings.exportAlphaMov ?? false"
        @cancel="handleExportCancel"
        @stop="handleExportStop"
        @start="handleExportStart"
        @retry="handleExportRetry"
        @openFolder="handleExportOpenFolder"
        @close="handleExportClose"
        @updateExportMode="handleUpdateExportMode"
        @updateIncludeAudio="handleUpdateIncludeAudio"
        @updateKeepRawPngFrames="handleUpdateKeepRawPngFrames"
        @updateExportAlphaMov="handleUpdateExportAlphaMov"
    />
</template>
