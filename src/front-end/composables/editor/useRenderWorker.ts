import { shallowRef, type Ref, onUnmounted } from 'vue';

/**
 * Message types for worker communication.
 */
interface WorkerInitMessage {
    type: 'init';
    canvas: OffscreenCanvas;
    width: number;
    height: number;
}

interface WorkerFrameMessage {
    type: 'frame';
    frame: number;
    dt: number;
    beat?: number;
    wordIndex?: number;
    alphaA?: number;
    alphaB?: number;
    wordOverride?: string;
    lowBand?: number;
    midBand?: number;
    highBand?: number;
    animated?: Record<string, any>;
}

interface WorkerConfigureMessage {
    type: 'configureMix';
    seed: string;
    fontFamilyChain: string;
    a: {
        sceneType: string;
        params: Record<string, any>;
    };
    b?: {
        sceneType: string;
        params: Record<string, any>;
    };
}

/**
 * Render worker management for the editor.
 * 
 * Responsibilities:
 * - Worker lifecycle (initialization, disposal)
 * - Canvas management (OffscreenCanvas transfer)
 * - Message passing to worker
 * - Render event handling
 * 
 * The worker runs Three.js rendering in a separate thread for better performance.
 * 
 * @param renderCanvas - Canvas element ref to transfer to worker
 * @param targetWidth - Render width in pixels
 * @param targetHeight - Render height in pixels
 * 
 * @example
 * ```typescript
 * const worker = useRenderWorker(canvasRef, width, height);
 * 
 * await worker.start();
 * worker.configureScene({ ... });
 * worker.sendFrame({ frame: 0, dt: 0, beat: 0.5, ... });
 * ```
 */
export function useRenderWorker(
    renderCanvas: Ref<HTMLCanvasElement | null>,
    targetWidth: Ref<number>,
    targetHeight: Ref<number>
) {
    const workerRef = shallowRef<Worker | null>(null);
    const isReady = shallowRef(false);
    const isModelLoading = shallowRef(false);
    const isModelLoaded = shallowRef(false);
    
    /**
     * Callback invoked when worker finishes rendering a frame.
     */
    let onRendered: ((frame: number) => void) | null = null;
    
    /**
     * Initializes and starts the render worker.
     * Transfers canvas control to worker's OffscreenCanvas.
     */
    const start = async () => {
        const canvas = renderCanvas.value;
        if (!canvas) {
            console.warn('Cannot start worker: canvas not available');
            return;
        }
        
        // Set canvas bitmap size
        try {
            canvas.width = targetWidth.value;
            canvas.height = targetHeight.value;
        } catch (e) {
            console.error('Failed to set canvas size:', e);
        }
        
        // Transfer canvas to OffscreenCanvas
        const offscreen = canvas.transferControlToOffscreen();
        
        // Create worker
        const worker = new Worker(
            new URL('../../workers/renderWorker.ts', import.meta.url),
            { type: 'module' }
        );
        
        // Listen for render completion and model loading events
        worker.addEventListener('message', (e: MessageEvent) => {
            const data = e.data;
            if (data?.type === 'rendered') {
                onRendered?.(data.frame);
            } else if (data?.type === 'modelLoadingStarted') {
                isModelLoading.value = true;
                isModelLoaded.value = false;
            } else if (data?.type === 'modelLoadingComplete') {
                isModelLoading.value = false;
                isModelLoaded.value = true;
            } else if (data?.type === 'modelLoadingFailed') {
                isModelLoading.value = false;
                isModelLoaded.value = false;
            }
        });
        
        // Initialize worker with canvas
        const initMessage: WorkerInitMessage = {
            type: 'init',
            canvas: offscreen,
            width: targetWidth.value,
            height: targetHeight.value
        };
        
        worker.postMessage(initMessage, [offscreen]);
        
        workerRef.value = worker;
        isReady.value = true;
    };
    
    /**
     * Configures the scene(s) in the worker.
     * 
     * @param config - Scene configuration (type, params, seed, fonts)
     */
    const configureScene = (config: {
        seed: string;
        fontFamilyChain: string;
        a: { sceneType: string; params: Record<string, any> };
        b?: { sceneType: string; params: Record<string, any> } | null;
    }) => {
        if (!workerRef.value) return;
        
        const message: WorkerConfigureMessage = {
            type: 'configureMix',
            seed: config.seed,
            fontFamilyChain: config.fontFamilyChain,
            a: config.a,
            b: config.b || undefined
        };
        
        // Deep clone to avoid structured clone issues
        const cloned = JSON.parse(JSON.stringify(message));
        workerRef.value.postMessage(cloned);
    };
    
    /**
     * Sends a frame to the worker for rendering.
     * 
     * @param frameData - Frame number, timing, and audio-reactive values
     */
    const sendFrame = (frameData: {
        frame: number;
        dt: number;
        beat?: number;
        wordIndex?: number;
        alphaA?: number;
        alphaB?: number;
        wordOverride?: string;
        lowBand?: number;
        midBand?: number;
        highBand?: number;
        animated?: Record<string, any>;
    }) => {
        if (!workerRef.value) return;
        
        const message: WorkerFrameMessage = {
            type: 'frame',
            ...frameData
        };
        
        workerRef.value.postMessage(message);
    };
    
    /**
     * Sets callback for render completion.
     */
    const onRenderComplete = (callback: (frame: number) => void) => {
        onRendered = callback;
    };
    
    /**
     * Captures the current frame from the worker as a blob.
     * Returns a promise that resolves with the frame blob.
     */
    const captureFrame = (frame: number): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            if (!workerRef.value) {
                reject(new Error('Worker not available'));
                return;
            }
            
            const timeout = setTimeout(() => {
                workerRef.value?.removeEventListener('message', handler);
                reject(new Error(`Frame capture timeout for frame ${frame}`));
            }, 5000);
            
            const handler = (e: MessageEvent) => {
                const data = e.data;
                if (data?.type === 'frameCaptured' && data.frame === frame) {
                    clearTimeout(timeout);
                    workerRef.value?.removeEventListener('message', handler);
                    if (data.error) {
                        reject(new Error(data.error));
                    } else if (data.arrayBuffer) {
                        // Convert ArrayBuffer back to Blob
                        const blob = new Blob([data.arrayBuffer], { type: 'image/png' });
                        resolve(blob);
                    } else if (data.blob) {
                        resolve(data.blob);
                    } else {
                        reject(new Error('No blob or arrayBuffer received'));
                    }
                }
            };
            
            workerRef.value.addEventListener('message', handler);
            try {
                workerRef.value.postMessage({ type: 'captureFrame', frame });
            } catch (error) {
                reject(new Error(`Failed to send capture message: ${error}`));
                return;
            }
        });
    };
    
    /**
     * Disposes the worker and cleans up resources.
     */
    const dispose = () => {
        if (workerRef.value) {
            try {
                workerRef.value.postMessage({ type: 'dispose' });
                workerRef.value.terminate();
            } catch (e) {
                console.warn('Worker disposal warning:', e);
            }
            workerRef.value = null;
        }
        isReady.value = false;
    };
    
    // Cleanup on unmount
    onUnmounted(() => {
        dispose();
    });
    
    return {
        workerRef,
        isReady,
        isModelLoading,
        isModelLoaded,
        start,
        configureScene,
        sendFrame,
        onRenderComplete,
        captureFrame,
        dispose,
    };
}
