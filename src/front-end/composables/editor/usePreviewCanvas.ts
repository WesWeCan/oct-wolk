import { watch, nextTick, onUnmounted, type Ref, type ComputedRef } from 'vue';

export function usePreviewCanvas(
  renderCanvas: Ref<HTMLCanvasElement | null>,
  previewCanvas: Ref<HTMLCanvasElement | null>,
  targetWidth: ComputedRef<number>,
  targetHeight: ComputedRef<number>,
  onResize?: () => void,
) {
  let previewResizeObserver: ResizeObserver | null = null;
  let containerResizeObserver: ResizeObserver | null = null;

  const drawPreview = () => {
    const src = renderCanvas.value;
    const dst = previewCanvas.value;
    if (!src || !dst) return;

    const wrapper = dst.parentElement;
    if (!wrapper) return;

    const container = wrapper.parentElement;
    if (!container) return;

    const ctx = dst.getContext('2d');
    if (!ctx) return;

    const rw = targetWidth.value;
    const rh = targetHeight.value;
    const ar = rw / rh;

    const maxW = container.clientWidth - 32;
    const maxH = container.clientHeight - 32;

    let displayW = maxW;
    let displayH = maxW / ar;

    if (displayH > maxH) {
      displayH = maxH;
      displayW = maxH * ar;
    }

    const w = dst.width = Math.floor(displayW);
    const h = dst.height = Math.floor(displayH);

    ctx.clearRect(0, 0, w, h);
    try {
      ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, w, h);
    } catch {}
  };

  watch(previewCanvas, (canvas) => {
    if (previewResizeObserver) {
      previewResizeObserver.disconnect();
      previewResizeObserver = null;
    }

    if (canvas) {
      previewResizeObserver = new ResizeObserver(() => {
        drawPreview();
        onResize?.();
      });
      previewResizeObserver.observe(canvas);

      const wrapper = canvas.parentElement;
      const container = wrapper?.parentElement;
      if (container && !containerResizeObserver) {
        containerResizeObserver = new ResizeObserver(() => {
          drawPreview();
          onResize?.();
        });
        containerResizeObserver.observe(container);
      }

      nextTick(() => drawPreview());
    }
  });

  watch([targetWidth, targetHeight], () => {
    nextTick(() => drawPreview());
  });

  const dispose = () => {
    if (previewResizeObserver) {
      previewResizeObserver.disconnect();
      previewResizeObserver = null;
    }
    if (containerResizeObserver) {
      containerResizeObserver.disconnect();
      containerResizeObserver = null;
    }
  };

  onUnmounted(dispose);

  return {
    drawPreview,
    dispose,
  };
}
