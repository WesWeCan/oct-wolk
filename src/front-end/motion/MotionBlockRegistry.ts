import type { MotionBlockType } from '@/types/project_types';
import type { MotionBlockRenderer } from '@/front-end/motion/types';

type RendererFactory = () => MotionBlockRenderer;

const registry = new Map<MotionBlockType, RendererFactory>();

export function registerBlockType(type: MotionBlockType, factory: RendererFactory): void {
    registry.set(type, factory);
}

export function unregisterBlockType(type: MotionBlockType): void {
    registry.delete(type);
}

export function createBlockRenderer(type: MotionBlockType): MotionBlockRenderer {
    const factory = registry.get(type);
    if (!factory) {
        throw new Error(`Unknown motion block type: ${type}`);
    }
    return factory();
}

export function hasBlockType(type: MotionBlockType): boolean {
    return registry.has(type);
}
