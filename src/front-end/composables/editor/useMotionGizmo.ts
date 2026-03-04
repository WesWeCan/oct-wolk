import { watch, onUnmounted, type Ref, type ComputedRef } from 'vue';
import type { MotionTrack } from '@/types/project_types';
import type { RendererBounds } from '@/front-end/motion/types';

export interface GizmoCallbacks {
    onTransformDelta: (mode: 'move' | 'scale' | 'rotate', dx: number, dy: number) => void;
    onDragStart: () => void;
    onDragEnd: () => void;
}

export function useMotionGizmo(
    overlayCanvas: Ref<HTMLCanvasElement | null>,
    previewCanvas: Ref<HTMLCanvasElement | null>,
    selectedTrack: ComputedRef<MotionTrack | null>,
    enabled: Ref<boolean>,
    renderWidth: ComputedRef<number>,
    renderHeight: ComputedRef<number>,
    callbacks: GizmoCallbacks,
    getBoundsForTrack?: (trackId: string) => RendererBounds | null,
    showSafeArea?: Ref<boolean>,
) {
    const HANDLE_SIZE = 8;
    const ROTATION_OFFSET = 30;
    let activeHandle: 'move' | 'scale-tl' | 'scale-tr' | 'scale-bl' | 'scale-br' | 'rotate' | null = null;
    let dragStartX = 0;
    let dragStartY = 0;

    const getScaleFactor = (): number => {
        const canvas = previewCanvas.value;
        if (!canvas) return 1;
        return canvas.width / renderWidth.value;
    };

    const getBoundingBox = () => {
        const track = selectedTrack.value;
        if (!track) return null;
        const scale = getScaleFactor();

        const reported = getBoundsForTrack?.(track.id);
        if (reported) {
            let hw = (reported.width * scale) / 2;
            let hh = (reported.height * scale) / 2;

            const anchorX = reported.anchorX ?? 'center';
            let cx = reported.x * scale;
            let cy = reported.y * scale;
            if (anchorX === 'left') cx += hw;
            else if (anchorX === 'right') cx -= hw;

            const rotation = (reported.rotation * Math.PI) / 180;
            return { cx, cy, hw, hh, rotation };
        }

        const t = track.block.transform;
        const s = track.block.style;
        const rw = renderWidth.value;
        const rh = renderHeight.value;

        let ax = rw / 2;
        let ay = rh / 2;
        if (t.anchorX === 'left') ax = 0;
        if (t.anchorX === 'right') ax = rw;
        if (t.anchorY === 'top') ay = 0;
        if (t.anchorY === 'bottom') ay = rh;

        const cx = (ax + t.offsetX) * scale;
        const cy = (ay + t.offsetY) * scale;
        const textWidth = s.fontSize * 8 * t.scale;
        const textHeight = s.fontSize * s.lineHeight * t.scale;
        const hw = (textWidth * scale) / 2;
        const hh = (textHeight * scale) / 2;
        const rotation = (t.rotation * Math.PI) / 180;

        return { cx, cy, hw, hh, rotation };
    };

    const drawSafeAreaGuide = (ctx: CanvasRenderingContext2D) => {
        if (showSafeArea && !showSafeArea.value) return;
        const track = selectedTrack.value;
        if (!track) return;
        const style = track.block.style;
        if ((style.boundsMode ?? 'safeArea') !== 'safeArea') return;

        const scale = getScaleFactor();
        const padding = (style.safeAreaPadding ?? 40) * scale;
        const w = renderWidth.value * scale;
        const h = renderHeight.value * scale;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 200, 50, 0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(padding, padding, w - padding * 2, h - padding * 2);
        ctx.setLineDash([]);
        ctx.restore();
    };

    const drawGizmo = () => {
        const canvas = overlayCanvas.value;
        const preview = previewCanvas.value;
        if (!canvas || !preview) return;

        canvas.width = preview.width;
        canvas.height = preview.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (selectedTrack.value) {
            drawSafeAreaGuide(ctx);
        }

        if (!enabled.value || !selectedTrack.value) return;

        const bb = getBoundingBox();
        if (!bb) return;

        ctx.save();
        ctx.translate(bb.cx, bb.cy);
        ctx.rotate(bb.rotation);

        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-bb.hw, -bb.hh, bb.hw * 2, bb.hh * 2);
        ctx.setLineDash([]);

        const corners = [
            { x: -bb.hw, y: -bb.hh },
            { x: bb.hw, y: -bb.hh },
            { x: -bb.hw, y: bb.hh },
            { x: bb.hw, y: bb.hh },
        ];
        ctx.fillStyle = '#00d4ff';
        for (const c of corners) {
            ctx.fillRect(c.x - HANDLE_SIZE / 2, c.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        }

        ctx.beginPath();
        ctx.moveTo(0, -bb.hh);
        ctx.lineTo(0, -bb.hh - ROTATION_OFFSET);
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -bb.hh - ROTATION_OFFSET, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#00d4ff';
        ctx.fill();

        ctx.restore();
    };

    const hitTest = (px: number, py: number): typeof activeHandle => {
        const bb = getBoundingBox();
        if (!bb) return null;

        const cos = Math.cos(-bb.rotation);
        const sin = Math.sin(-bb.rotation);
        const dx = px - bb.cx;
        const dy = py - bb.cy;
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;

        const rotDist = Math.sqrt(lx * lx + (ly + bb.hh + ROTATION_OFFSET) ** 2);
        if (rotDist < 12) return 'rotate';

        const hs = HANDLE_SIZE + 4;
        if (Math.abs(lx + bb.hw) < hs && Math.abs(ly + bb.hh) < hs) return 'scale-tl';
        if (Math.abs(lx - bb.hw) < hs && Math.abs(ly + bb.hh) < hs) return 'scale-tr';
        if (Math.abs(lx + bb.hw) < hs && Math.abs(ly - bb.hh) < hs) return 'scale-bl';
        if (Math.abs(lx - bb.hw) < hs && Math.abs(ly - bb.hh) < hs) return 'scale-br';

        if (Math.abs(lx) <= bb.hw && Math.abs(ly) <= bb.hh) return 'move';

        return null;
    };

    const onPointerDown = (e: PointerEvent) => {
        if (!enabled.value || !selectedTrack.value) return;
        const canvas = overlayCanvas.value;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;

        const handle = hitTest(px, py);
        if (!handle) return;

        e.preventDefault();
        e.stopPropagation();
        activeHandle = handle;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        callbacks.onDragStart();

        const onMove = (ev: PointerEvent) => {
            const dx = ev.clientX - dragStartX;
            const dy = ev.clientY - dragStartY;
            dragStartX = ev.clientX;
            dragStartY = ev.clientY;

            if (activeHandle === 'move') {
                const scale = getScaleFactor();
                callbacks.onTransformDelta('move', dx / scale, dy / scale);
            } else if (activeHandle?.startsWith('scale')) {
                callbacks.onTransformDelta('scale', dx, dy);
            } else if (activeHandle === 'rotate') {
                callbacks.onTransformDelta('rotate', dx, dy);
            }
        };

        const onUp = () => {
            activeHandle = null;
            callbacks.onDragEnd();
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    };

    const onPointerMove = (e: PointerEvent) => {
        if (!enabled.value || !selectedTrack.value || activeHandle) return;
        const canvas = overlayCanvas.value;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const handle = hitTest(e.clientX - rect.left, e.clientY - rect.top);

        if (handle === 'move') canvas.style.cursor = 'move';
        else if (handle === 'rotate') canvas.style.cursor = 'crosshair';
        else if (handle?.startsWith('scale')) canvas.style.cursor = 'nwse-resize';
        else canvas.style.cursor = '';
    };

    const attach = () => {
        const canvas = overlayCanvas.value;
        if (!canvas) return;
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointermove', onPointerMove);
    };

    const detach = () => {
        const canvas = overlayCanvas.value;
        if (!canvas) return;
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.style.cursor = '';
    };

    watch(overlayCanvas, (canvas, old) => {
        if (old) detach();
        if (canvas) attach();
    });

    watch(enabled, (val) => {
        const canvas = overlayCanvas.value;
        if (canvas) {
            canvas.style.pointerEvents = val ? 'auto' : 'none';
        }
    });

    onUnmounted(detach);

    return { drawGizmo };
}
