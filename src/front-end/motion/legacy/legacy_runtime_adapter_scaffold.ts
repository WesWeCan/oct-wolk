import type { LegacyAudioModulationFrame } from './legacy_audio_modulation_scaffold';
import type { LegacyDeterministicRandomness } from './legacy_seed_scaffold';

/**
 * LEGACY SCAFFOLD: adapter contract for future advanced runtime modules.
 *
 * Why this file exists:
 * - The old editor had worker-based 2D and WebGL scene runtimes.
 * - The new motion-block system currently renders on the main thread.
 * - Future advanced modules, especially 3D, will need a clearly documented
 *   adapter seam before they can be implemented safely.
 *
 * Current status:
 * - Pure scaffold. No integration. No live module registration.
 *
 * Future intent:
 * - A future adapter can bridge a MotionBlock-like input model to a worker,
 *   WebGL runtime, or another execution environment without reviving scenes.
 */

export type LegacyRuntimeExecutionMode = 'canvas2d' | 'worker2d' | 'workerWebGL';

export interface LegacyRuntimeAdapterFrameContext {
    frame: number;
    fps: number;
    deterministicRandomness?: LegacyDeterministicRandomness;
    modulation?: LegacyAudioModulationFrame | null;
    animatedProps?: Record<string, any>;
}

export interface LegacyRuntimeAdapterScaffold {
    id: string;
    label: string;
    executionMode: LegacyRuntimeExecutionMode;
    status: 'scaffold';
    notes: string;
    configure?: (params: Record<string, any>) => void | Promise<void>;
    render?: (context: LegacyRuntimeAdapterFrameContext) => void | Promise<void>;
    dispose?: () => void | Promise<void>;
}
