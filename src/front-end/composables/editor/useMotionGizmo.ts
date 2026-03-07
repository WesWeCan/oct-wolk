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
    let dragStartAngle = 0;

    const rotateScalePoint = (x: number, y: number, rotationDeg: number, scale: number) => {
        const rad = (rotationDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return {
            x: (x * cos - y * sin) * scale,
            y: (x * sin + y * cos) * scale,
        };
    };

    const getScaleFactor = (): number => {
        const canvas = previewCanvas.value;
        if (!canvas) return 1;
        return canvas.width / renderWidth.value;
    };

    const getBoundingBox = () => {
        const track = selectedTrack.value;
        if (!track) return null;
        const previewScale = getScaleFactor();

        const reported = getBoundsForTrack?.(track.id);
        if (reported) {
            return {
                referenceX: reported.referenceX * previewScale,
                referenceY: reported.referenceY * previewScale,
                localBoxX: reported.localBoxX,
                localBoxY: reported.localBoxY,
                localBoxWidth: reported.localBoxWidth,
                localBoxHeight: reported.localBoxHeight,
                rotationDeg: reported.rotation,
                totalScale: reported.scale * previewScale,
                aabbX: reported.x * previewScale,
                aabbY: reported.y * previewScale,
                aabbWidth: reported.width * previewScale,
                aabbHeight: reported.height * previewScale,
            };
        }

        const t = track.block.transform;
        const s = track.block.style;
        const rw = renderWidth.value;
        const rh = renderHeight.value;

        const left = (s.boundsMode ?? 'safeArea') === 'safeArea' ? (s.safeAreaPadding ?? 40) + (s.safeAreaOffsetX ?? 0) : 0;
        const right = (s.boundsMode ?? 'safeArea') === 'safeArea' ? rw - (s.safeAreaPadding ?? 40) + (s.safeAreaOffsetX ?? 0) : rw;
        const top = (s.boundsMode ?? 'safeArea') === 'safeArea' ? (s.safeAreaPadding ?? 40) + (s.safeAreaOffsetY ?? 0) : 0;
        const bottom = (s.boundsMode ?? 'safeArea') === 'safeArea' ? rh - (s.safeAreaPadding ?? 40) + (s.safeAreaOffsetY ?? 0) : rh;

        let referenceX = (left + right) / 2;
        let referenceY = (top + bottom) / 2;
        if (t.anchorX === 'left') referenceX = left;
        if (t.anchorX === 'right') referenceX = right;
        if (t.anchorY === 'top') referenceY = top;
        if (t.anchorY === 'bottom') referenceY = bottom;
        referenceX += t.offsetX;
        referenceY += t.offsetY;

        const approxWidth = Math.max(40, s.fontSize * 8);
        const approxHeight = Math.max(s.fontSize, s.fontSize * s.lineHeight);
        const pad = Math.max(0, s.backgroundPadding ?? 0);
        const localBoxX = t.anchorX === 'left' ? 0 : t.anchorX === 'right' ? -approxWidth - pad * 2 : -((approxWidth + pad * 2) / 2);
        const localBoxY = t.anchorY === 'top' ? 0 : t.anchorY === 'bottom' ? -approxHeight - pad * 2 : -((approxHeight + pad * 2) / 2);

        return {
            referenceX: referenceX * previewScale,
            referenceY: referenceY * previewScale,
            localBoxX,
            localBoxY,
            localBoxWidth: approxWidth + pad * 2,
            localBoxHeight: approxHeight + pad * 2,
            rotationDeg: t.rotation,
            totalScale: t.scale * previewScale,
            aabbX: (referenceX + localBoxX * t.scale) * previewScale,
            aabbY: (referenceY + localBoxY * t.scale) * previewScale,
            aabbWidth: (approxWidth + pad * 2) * t.scale * previewScale,
            aabbHeight: (approxHeight + pad * 2) * t.scale * previewScale,
        };
    };

    const getBoxCorners = (bb: NonNullable<ReturnType<typeof getBoundingBox>>) => {
        const corners = [
            { x: bb.localBoxX, y: bb.localBoxY },
            { x: bb.localBoxX + bb.localBoxWidth, y: bb.localBoxY },
            { x: bb.localBoxX + bb.localBoxWidth, y: bb.localBoxY + bb.localBoxHeight },
            { x: bb.localBoxX, y: bb.localBoxY + bb.localBoxHeight },
        ];
        return corners.map((corner) => {
            const p = rotateScalePoint(corner.x, corner.y, bb.rotationDeg, bb.totalScale);
            return { x: bb.referenceX + p.x, y: bb.referenceY + p.y };
        });
    };

    const localToScreen = (
        bb: NonNullable<ReturnType<typeof getBoundingBox>>,
        x: number,
        y: number,
    ) => {
        const p = rotateScalePoint(x, y, bb.rotationDeg, bb.totalScale);
        return { x: bb.referenceX + p.x, y: bb.referenceY + p.y };
    };

    const screenToLocal = (
        bb: NonNullable<ReturnType<typeof getBoundingBox>>,
        x: number,
        y: number,
    ) => {
        const rad = (-bb.rotationDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const dx = x - bb.referenceX;
        const dy = y - bb.referenceY;
        const rx = dx * cos - dy * sin;
        const ry = dx * sin + dy * cos;
        const safeScale = Math.abs(bb.totalScale) > 0.000001 ? bb.totalScale : 0.000001;
        return { x: rx / safeScale, y: ry / safeScale };
    };

    const drawSafeAreaGuide = (ctx: CanvasRenderingContext2D) => {
        if (showSafeArea && !showSafeArea.value) return;
        const track = selectedTrack.value;
        if (!track) return;
        const style = track.block.style;
        if ((style.boundsMode ?? 'safeArea') !== 'safeArea') return;

        const scale = getScaleFactor();
        const padding = (style.safeAreaPadding ?? 40) * scale;
        const ox = (style.safeAreaOffsetX ?? 0) * scale;
        const oy = (style.safeAreaOffsetY ?? 0) * scale;
        const w = renderWidth.value * scale;
        const h = renderHeight.value * scale;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 200, 50, 0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(padding + ox, padding + oy, w - padding * 2, h - padding * 2);
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
        const corners = getBoxCorners(bb);
        const topCenter = localToScreen(bb, bb.localBoxX + (bb.localBoxWidth / 2), bb.localBoxY);
        const rotationHandle = localToScreen(
            bb,
            bb.localBoxX + (bb.localBoxWidth / 2),
            bb.localBoxY - (ROTATION_OFFSET / Math.max(bb.totalScale, 0.000001)),
        );

        ctx.save();
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(bb.aabbX, bb.aabbY, bb.aabbWidth, bb.aabbHeight);
        ctx.setLineDash([]);

        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#00d4ff';
        for (const corner of corners) {
            ctx.fillRect(corner.x - HANDLE_SIZE / 2, corner.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
        }

        ctx.beginPath();
        ctx.moveTo(topCenter.x, topCenter.y);
        ctx.lineTo(rotationHandle.x, rotationHandle.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(rotationHandle.x, rotationHandle.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(bb.referenceX, bb.referenceY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd166';
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bb.referenceX - 8, bb.referenceY);
        ctx.lineTo(bb.referenceX + 8, bb.referenceY);
        ctx.moveTo(bb.referenceX, bb.referenceY - 8);
        ctx.lineTo(bb.referenceX, bb.referenceY + 8);
        ctx.strokeStyle = '#ffd166';
        ctx.stroke();
        ctx.restore();
    };

    const hitTest = (px: number, py: number): typeof activeHandle => {
        const bb = getBoundingBox();
        if (!bb) return null;

        const corners = getBoxCorners(bb);
        const rotationHandle = localToScreen(
            bb,
            bb.localBoxX + (bb.localBoxWidth / 2),
            bb.localBoxY - (ROTATION_OFFSET / Math.max(bb.totalScale, 0.000001)),
        );
        const rotDist = Math.hypot(px - rotationHandle.x, py - rotationHandle.y);
        if (rotDist < 12) return 'rotate';

        const hs = HANDLE_SIZE + 4;
        if (Math.hypot(px - corners[0].x, py - corners[0].y) < hs) return 'scale-tl';
        if (Math.hypot(px - corners[1].x, py - corners[1].y) < hs) return 'scale-tr';
        if (Math.hypot(px - corners[3].x, py - corners[3].y) < hs) return 'scale-bl';
        if (Math.hypot(px - corners[2].x, py - corners[2].y) < hs) return 'scale-br';

        const local = screenToLocal(bb, px, py);
        if (
            local.x >= bb.localBoxX
            && local.x <= bb.localBoxX + bb.localBoxWidth
            && local.y >= bb.localBoxY
            && local.y <= bb.localBoxY + bb.localBoxHeight
        ) {
            return 'move';
        }

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
        if (handle === 'rotate') {
            const bb = getBoundingBox();
            if (bb) {
                dragStartAngle = Math.atan2(py - bb.referenceY, px - bb.referenceX);
            }
        }
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
                const canvasRect = canvas.getBoundingClientRect();
                const currentPx = ev.clientX - canvasRect.left;
                const currentPy = ev.clientY - canvasRect.top;
                const bb = getBoundingBox();
                if (!bb) return;
                const nextAngle = Math.atan2(currentPy - bb.referenceY, currentPx - bb.referenceX);
                let angleDeltaDeg = ((nextAngle - dragStartAngle) * 180) / Math.PI;
                if (angleDeltaDeg > 180) angleDeltaDeg -= 360;
                if (angleDeltaDeg < -180) angleDeltaDeg += 360;
                dragStartAngle = nextAngle;
                callbacks.onTransformDelta('rotate', angleDeltaDeg, 0);
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
        canvas.style.pointerEvents = enabled.value ? 'auto' : 'none';
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
