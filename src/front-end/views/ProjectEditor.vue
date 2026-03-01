<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import type { WolkProject, LyricTrack, TimelineItem } from '@/types/project_types';
import { ProjectService } from '@/front-end/services/ProjectService';
import { useAudioPlayer } from '@/front-end/composables/editor/useAudioPlayer';
import { useAudioAnalysis } from '@/front-end/composables/editor/useAudioAnalysis';
import { useTimelineViewport } from '@/front-end/components/timeline/useTimelineViewport';
import { usePreviewCanvas } from '@/front-end/composables/editor/usePreviewCanvas';
import { randomUUID } from '@/front-end/utils/uuid';
import RulerLane from '@/front-end/components/timeline/lanes/RulerLane.vue';
import WaveformLane from '@/front-end/components/timeline/lanes/WaveformLane.vue';
import EnergyLane from '@/front-end/components/timeline/lanes/EnergyLane.vue';
import BeatsLane from '@/front-end/components/timeline/lanes/BeatsLane.vue';
import BandsLane from '@/front-end/components/timeline/lanes/BandsLane.vue';
import BeatStrengthLane from '@/front-end/components/timeline/lanes/BeatStrengthLane.vue';
import LyricTrackLane from '@/front-end/components/timeline/lanes/LyricTrackLane.vue';
import RawLyricsPanel from '@/front-end/components/editor/RawLyricsPanel.vue';
import TrackListPanel from '@/front-end/components/editor/TrackListPanel.vue';
import ProjectInspector from '@/front-end/components/editor/ProjectInspector.vue';
import { useUndoRedo } from '@/front-end/composables/editor/useUndoRedo';
import { generateLineTrackFromVerseTrack, generateWordTrackFromLineTrack } from '@/front-end/utils/lyricTrackGenerators';

const props = defineProps<{ projectId: string }>();
const router = useRouter();

const project = ref<WolkProject | null>(null);
const loading = ref(true);
const mode = ref<'lyric' | 'motion'>('lyric');
const fps = ref(60);

// Editable title
const editingTitle = ref(false);
const titleInput = ref('');

const startEditTitle = () => {
    if (!project.value) return;
    titleInput.value = project.value.song.title || '';
    editingTitle.value = true;
    nextTick(() => {
        const el = document.querySelector('.toolbar-title-input') as HTMLInputElement;
        el?.focus();
        el?.select();
    });
};

const commitTitle = () => {
    if (project.value && titleInput.value.trim()) {
        project.value.song.title = titleInput.value.trim();
        document.title = `${project.value.song.title} - W.O.L.K.`;
        scheduleSave();
    }
    editingTitle.value = false;
};

// Audio
const audio = useAudioPlayer();
const analysis = useAudioAnalysis(fps);

// Timeline viewport
const vp = useTimelineViewport({ fps: 60 });
const viewport = vp.viewport;
const playhead = vp.playhead;

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

const updateDimensions = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    if (!project.value || value === 'custom') return;
    const [width, height] = value.split('x').map(Number);
    project.value.settings.renderWidth = width;
    project.value.settings.renderHeight = height;
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

const toggleIncludeAudio = () => {
    if (!project.value) return;
    project.value.settings.includeAudio = !project.value.settings.includeAudio;
    scheduleSave();
};

// Overlay toggles for analysis lanes
const overlayOpts = ref<{ showEnergy: boolean; showBeats: boolean; showBands: boolean; showBeatStrength: boolean }>({
    showEnergy: false,
    showBeats: false,
    showBands: false,
    showBeatStrength: false,
});

// Preview canvas — reuse usePreviewCanvas for proper scaling
const renderCanvas = ref<HTMLCanvasElement | null>(null);
const previewCanvas = ref<HTMLCanvasElement | null>(null);
const previewOverlay = ref<HTMLCanvasElement | null>(null);
const targetWidth = computed(() => project.value?.settings.renderWidth || 1920);
const targetHeight = computed(() => project.value?.settings.renderHeight || 1080);
const previewCanvasComposable = usePreviewCanvas(renderCanvas, previewCanvas, targetWidth, targetHeight);

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

    const tracks = project.value.lyricTracks.filter(t => !t.muted);
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

    const fontFamily = project.value.font?.family || 'system-ui';
    const fallbacks = project.value.font?.fallbacks?.join(', ') || 'sans-serif';
    const fontChain = project.value.font?.localPath ? `ProjectFont, ${fontFamily}, ${fallbacks}` : `${fontFamily}, ${fallbacks}`;
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

// Playback animation frame loop
let playbackRaf: number | null = null;
let previewDirty = true;

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
            drawLyricPreview();
            previewDirty = false;
        }

        if (audio.isPlaying.value) {
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
                drawLyricPreview();
                previewDirty = false;
            }
        });
    }
};

const togglePlay = async () => {
    if (audio.isPlaying.value) {
        audio.pause();
        stopRafLoop();
        markDirty();
    } else {
        await audio.play();
        startRafLoop();
    }
};

const stopPlayback = () => {
    audio.stop();
    stopRafLoop();
    vp.setPlayhead(0);
    markDirty();
};

const onScrub = async (payload: { timeSec: number; frame: number }) => {
    await audio.seekTo(payload.timeSec);
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

// Playhead X position as CSS variable
const playheadX = computed(() => {
    const phSec = playhead.value.frame / Math.max(1, fps.value);
    const clamped = Math.max(0, Math.min(phSec - viewport.value.startSec, viewport.value.durationSec));
    return `${(clamped / Math.max(1e-6, viewport.value.durationSec)) * 100}%`;
});

// Auto-scroll viewport to follow playhead during playback
watch(() => playhead.value.frame, (frame) => {
    if (!audio.isPlaying.value) return;
    const phSec = frame / Math.max(1, fps.value);
    const rightThreshold = viewport.value.startSec + viewport.value.durationSec * 0.8;
    const leftEdge = viewport.value.startSec;

    if (phSec > rightThreshold) {
        const desired = Math.max(0, Math.min(
            viewport.value.totalSec - viewport.value.durationSec,
            phSec - viewport.value.durationSec * 0.6,
        ));
        if (Math.abs(desired - viewport.value.startSec) > 1e-3) vp.setStart(desired);
    } else if (phSec < leftEdge) {
        vp.setStart(Math.max(0, phSec - viewport.value.durationSec * 0.4));
    }
});

// Upload audio handler
const audioInputRef = ref<HTMLInputElement | null>(null);
const audioDragOver = ref(false);

const handleAudioFile = async (file: File) => {
    if (!project.value) return;
    const updated = await ProjectService.uploadAudio(project.value.id, file);
    project.value = updated;
    await loadAudio(updated.song.audioSrc);
};

const onAudioUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await handleAudioFile(file);
    input.value = '';
};

const onAudioDrop = async (e: DragEvent) => {
    e.preventDefault();
    audioDragOver.value = false;
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|flac|aac|m4a)$/i))) {
        await handleAudioFile(file);
    }
};

const onAudioDragOver = (e: DragEvent) => {
    e.preventDefault();
    audioDragOver.value = true;
};

const onAudioDragLeave = () => {
    audioDragOver.value = false;
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

// Track management
const selectedItemId = ref<string | null>(null);
const NUDGE_MS = 50;

const playheadMs = computed(() => (playhead.value.frame / Math.max(1, fps.value)) * 1000);
const selectedTrack = computed<LyricTrack | null>(() => {
    if (!project.value || !selectedItemId.value) return null;
    for (const track of project.value.lyricTracks) {
        if (track.items.some(i => i.id === selectedItemId.value)) return track;
    }
    return null;
});
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
            track.items.sort((a, b) => a.startMs - b.startMs);
            scheduleSave();
            return;
        }
    }
};

const onSelectItem = (itemId: string | null) => {
    selectedItemId.value = itemId;
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
            if (selectedItemId.value === itemId) selectedItemId.value = null;
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
            selectedItemId.value = right.id;
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
            selectedItemId.value = merged.id;
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
    track.items.sort((a, b) => a.startMs - b.startMs);
    selectedItemId.value = newItem.id;
    scheduleSave();
};

const nudgeSelectedItem = (deltaMs: number) => {
    if (!project.value || !selectedItemId.value) return;
    for (const track of project.value.lyricTracks) {
        if (track.locked) continue;
        const idx = track.items.findIndex(i => i.id === selectedItemId.value);
        if (idx >= 0) {
            pushUndo();
            const item = track.items[idx];
            const dur = item.endMs - item.startMs;
            const newStart = Math.max(0, item.startMs + deltaMs);
            track.items[idx] = { ...item, startMs: newStart, endMs: newStart + dur };
            track.items.sort((a, b) => a.startMs - b.startMs);
            scheduleSave();
            return;
        }
    }
};

const splitSelectedAtPlayhead = () => {
    if (selectedItemId.value) onSplitItem(selectedItemId.value, playheadMs.value);
};

const deleteSelectedItem = () => {
    if (selectedItemId.value) onDeleteItem(selectedItemId.value);
};

// Project settings update handler (from inspector)
const onUpdateProject = (updated: WolkProject) => {
    pushUndo();
    project.value = updated;
    fps.value = updated.settings.fps || 60;
    scheduleSave();
};

const loadProject = async () => {
    loading.value = true;
    try {
        project.value = await ProjectService.load(props.projectId);
        if (!project.value) {
            router.push({ name: 'ProjectList' });
            return;
        }
        fps.value = project.value.settings.fps || 60;
        document.title = `${project.value.song.title || 'Untitled'} - W.O.L.K.`;
        undoRedo.clear();
        undoRedo.pushSnapshot(project.value, true);

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
// Dynamic lane heights + collapse — same pattern as TimelineRoot.vue

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
// Sidebar + inspector resize (same pattern as Editor.vue)
// Timeline top-edge resize (same pattern as TimelineRoot.vue)

const setupResizeHandles = () => {
    const editorEl = document.querySelector('.project-editor') as HTMLElement;
    if (!editorEl) return;

    const savedSW = localStorage.getItem('pe-sidebar-width');
    const savedIW = localStorage.getItem('pe-inspector-width');
    if (savedSW) editorEl.style.setProperty('--sidebar-width', savedSW + 'px');
    if (savedIW) editorEl.style.setProperty('--inspector-width', savedIW + 'px');

    // Sidebar resize
    const sidebar = editorEl.querySelector('.editor__sidebar') as HTMLElement;
    if (sidebar) {
        sidebar.addEventListener('pointerdown', (e: PointerEvent) => {
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
                localStorage.setItem('pe-sidebar-width', sidebar.offsetWidth.toString());
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
                localStorage.setItem('pe-inspector-width', inspector.offsetWidth.toString());
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
        const savedTH = localStorage.getItem('pe-timeline-height');
        if (savedTH) editorEl.style.setProperty('--timeline-height', savedTH + 'px');

        timelineHost.addEventListener('pointerdown', (e: PointerEvent) => {
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
                localStorage.setItem('pe-timeline-height', timelineHost.offsetHeight.toString());
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        });
    }
};

// Keyboard shortcuts
const onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const tag = (e.target as HTMLElement)?.closest?.('.ProseMirror');
    if (tag) return;

    const isMeta = e.metaKey || e.ctrlKey;

    if (e.code === 'Escape') { selectedItemId.value = null; return; }
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); return; }
    if (isMeta && !e.shiftKey && e.code === 'KeyZ') { e.preventDefault(); performUndo(); return; }
    if (isMeta && e.shiftKey && e.code === 'KeyZ') { e.preventDefault(); performRedo(); return; }
    if (e.code === 'Delete' || e.code === 'Backspace') { e.preventDefault(); deleteSelectedItem(); return; }
    if (e.code === 'KeyS' && !isMeta) { e.preventDefault(); splitSelectedAtPlayhead(); return; }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
        const dir = e.code === 'ArrowLeft' ? -1 : 1;
        if (selectedItemId.value) {
            nudgeSelectedItem(dir * NUDGE_MS);
            markDirty();
        } else {
            const newFrame = Math.max(0, playhead.value.frame + dir);
            vp.setPlayhead(newFrame);
            audio.seekTo(newFrame / fps.value);
            markDirty();
        }
        return;
    }
};

onMounted(() => {
    loadProject();
    window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
    stopRafLoop();
    if (saveTimer) clearTimeout(saveTimer);
    window.removeEventListener('keydown', onKeyDown);
    audio.dispose();
    previewCanvasComposable.dispose();
});
</script>

<template>
    <div v-if="loading" class="editor-loading">
        <p>Loading project...</p>
    </div>
    <div v-else-if="project" class="editor project-editor">
        <!-- Toolbar -->
        <div class="editor__toolbar">
            <div class="toolbar__left">
                <button class="toolbar-back" @click="router.push({ name: 'ProjectList' })">&larr;</button>

                <input
                    v-if="editingTitle"
                    v-model="titleInput"
                    class="toolbar-title-input"
                    @keydown.enter="commitTitle"
                    @blur="commitTitle"
                    @keydown.escape="editingTitle = false"
                />
                <span v-else class="toolbar-title" @dblclick="startEditTitle" title="Double-click to rename">
                    {{ project.song.title || 'Untitled' }}
                </span>

                <div class="toolbar-mode-toggle">
                    <button :class="{ active: mode === 'lyric' }" @click="mode = 'lyric'">Lyric</button>
                    <button :class="{ active: mode === 'motion' }" @click="mode = 'motion'">Motion</button>
                </div>
            </div>
            <div class="toolbar__right">
                <button @click="togglePlay" class="primary">{{ audio.isPlaying.value ? 'Pause' : 'Play' }}</button>
                <button @click="stopPlayback" :disabled="!audio.isPlaying.value && playhead.frame === 0">Stop</button>
                <span v-if="audio.duration.value > 0" class="toolbar-time">
                    {{ (audio.currentTime.value).toFixed(1) }}s / {{ (audio.duration.value).toFixed(1) }}s
                </span>
            </div>
        </div>

        <!-- Sidebar -->
        <div class="editor__sidebar">
            <template v-if="mode === 'lyric'">
                <div v-if="!project.song.audioSrc" class="sidebar-section">
                    <div
                        class="audio-drop-zone"
                        :class="{ 'drag-over': audioDragOver }"
                        @drop="onAudioDrop"
                        @dragover="onAudioDragOver"
                        @dragleave="onAudioDragLeave"
                        @click="audioInputRef?.click()"
                    >
                        <span class="audio-drop-zone__icon">&#127925;</span>
                        <span class="audio-drop-zone__text">Click or drag audio file here</span>
                        <span class="audio-drop-zone__hint">MP3, WAV, OGG, FLAC, AAC</span>
                    </div>
                    <input ref="audioInputRef" type="file" accept=".mp3,.wav,.ogg,.flac,.aac,.m4a,audio/*" style="display:none" @change="onAudioUpload" />
                </div>
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
                    @duplicate-track="onDuplicateTrack"
                />
                <RawLyricsPanel v-model:rawLyrics="rawLyrics" />
            </template>
            <template v-else>
                <p class="panel-placeholder">Motion layers (Phase 2)</p>
            </template>
        </div>

        <!-- Monitor / Preview — matches Editor.vue monitor pattern -->
        <div class="editor__preview">
            <div class="monitor-container">
                <div class="monitor-header">
                    <div class="monitor-title-section">
                        <h3 class="monitor-title">MONITOR</h3>
                        <span class="monitor-frame">Frame: {{ currentFrame }}</span>
                    </div>
                    <div class="monitor-export-controls">
                        <button class="export success" disabled>Export (Phase 3)</button>
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
                            <select @change="updateDimensions" :value="`${project.settings.renderWidth}x${project.settings.renderHeight}`" class="dimension-preset">
                                <option value="1920x1080">1920 &times; 1080</option>
                                <option value="1280x720">1280 &times; 720</option>
                                <option value="3840x2160">3840 &times; 2160 (4K)</option>
                                <option value="2560x1440">2560 &times; 1440 (2K)</option>
                                <option value="1080x1920">1080 &times; 1920 (Vertical)</option>
                            </select>
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
                            {{ isEditingSettings ? '&#10003; Done' : '&#9998; Edit' }}
                        </button>
                        <button @click="toggleIncludeAudio" :class="['audio-toggle', { active: project.settings.includeAudio }]">
                            <span class="audio-icon">{{ project.settings.includeAudio ? '&#10003;' : '&#10007;' }}</span>
                            Include Audio
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Inspector -->
        <div class="editor__inspector">
            <ProjectInspector
                :project="project"
                :mode="mode"
                :tracks="project.lyricTracks"
                :selected-item-id="selectedItemId"
                :playhead-ms="playheadMs"
                :overlay-opts="overlayOpts"
                @update-project="onUpdateProject"
                @update-item="onUpdateItem"
                @delete-item="onDeleteItem"
                @split-item="onSplitItem"
                @merge-with-next="onMergeWithNext"
                @add-item-at-location="onAddItemAtLocation"
                @update:overlay-opts="(v: any) => overlayOpts = v"
            />
        </div>

        <!-- Timeline — same grid/lane/playhead pattern as TimelineRoot.vue -->
        <div class="editor__timeline">
            <div class="timeline-root" :style="{ '--playhead-x': playheadX } as any">
                <div class="timeline">
                    <div class="grid" style="grid-template-columns: 220px 1fr">
                        <!-- Left column: labels -->
                        <div class="leftcol">
                            <div class="lane-label ruler-label" :style="{ height: `${laneHeights.ruler}px` }">TIME</div>
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
                            <div
                                v-for="track in (project?.lyricTracks ?? [])"
                                :key="'label-' + track.id"
                                class="lane-label"
                                :class="{ collapsed: collapsed[`track-${track.id}`] }"
                                :style="{ height: `${collapsed[`track-${track.id}`] ? 28 : getTrackHeight(track.id)}px` }"
                                :title="track.name"
                                @click="collapsed[`track-${track.id}`] = !collapsed[`track-${track.id}`]"
                            >
                                <span class="pe-track-color" :style="{ backgroundColor: track.color }"></span>
                                {{ track.name }}
                            </div>
                        </div>
                        <!-- Right column: lanes -->
                        <div>
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
                            <!-- Lyric Track lanes -->
                            <div v-for="track in (project?.lyricTracks ?? [])"
                                :key="track.id"
                                class="lane"
                                :style="{ height: `${collapsed[`track-${track.id}`] ? 28 : getTrackHeight(track.id)}px` }">
                                <LyricTrackLane
                                    v-if="!collapsed[`track-${track.id}`]"
                                    :viewport="viewport"
                                    :fps="fps"
                                    :track="track"
                                    :playhead-frame="playhead.frame"
                                    :selected-item-id="selectedItemId"
                                    @select-item="onSelectItem"
                                    @update-item="onUpdateItem"
                                    @push-undo="onPushUndo"
                                    @scrub="onScrub"
                                    @pan="onPan"
                                    @zoom-around="onZoom"
                                />
                                <div class="lane-resizer" @pointerdown="(e: PointerEvent) => startResize(`track-${track.id}`, e)"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
