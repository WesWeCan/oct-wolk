import type { MotionEnterExit, MotionStyle, MotionTransform } from '@/types/project_types';

export interface MotionPresetSummary {
    id: string;
    blockType: string;
    version: number;
    name: string;
    createdAt: number;
    updatedAt: number;
}

export interface MotionPresetDocument<TPayload = unknown> extends MotionPresetSummary {
    payload: TPayload;
}

export interface MotionPresetSaveInput<TPayload = unknown> {
    id?: string;
    blockType: string;
    version: number;
    name: string;
    payload: TPayload;
}

export interface SubtitleMotionPresetPayload {
    startMs: number;
    endMs: number;
    style: MotionStyle;
    transform: MotionTransform;
    enter: MotionEnterExit;
    exit: MotionEnterExit;
}

export type SubtitleMotionPresetDocument = MotionPresetDocument<SubtitleMotionPresetPayload>;
