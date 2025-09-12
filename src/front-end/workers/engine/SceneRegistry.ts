import type { SceneFactory, SceneType, WorkerScene } from './types';

const registry: Map<SceneType, SceneFactory> = new Map();

export function registerScene(type: SceneType, factory: SceneFactory) {
    registry.set(type, factory);
}

export function createScene(type: SceneType): WorkerScene | null {
    const factory = registry.get(type);
    if (!factory) return null;
    return factory({ type });
}

export function hasScene(type: SceneType): boolean {
    return registry.has(type);
}


