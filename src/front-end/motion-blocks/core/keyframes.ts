import type { MotionBlock } from '@/types/project_types';

export type KeyframeKind = 'moving' | 'stationary';

export interface KeyframePropertyDef {
    path: string;
    label: string;
    shortLabel: string;
    kind: KeyframeKind;
    defaultInterpolation: 'linear' | 'step';
    getValue: (block: MotionBlock) => any;
    min?: number;
    max?: number;
    step?: number;
}

export function styleGetter(key: string) {
    return (block: MotionBlock) => (block.style as any)[key];
}

export function transformGetter(key: string) {
    return (block: MotionBlock) => (block.transform as any)[key];
}
