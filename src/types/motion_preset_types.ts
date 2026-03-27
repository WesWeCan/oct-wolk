import type { CloudLayoutParams } from '@/front-end/motion-blocks/cloud/params';
import type { Primitive3DParams } from '@/front-end/motion-blocks/primitive3d/params';
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

export interface CloudMotionPresetPayload {
    startMs: number;
    endMs: number;
    style: MotionStyle;
    transform: MotionTransform;
    enter: MotionEnterExit;
    exit: MotionEnterExit;
    params: CloudLayoutParams;
}

export type CloudMotionPresetDocument = MotionPresetDocument<CloudMotionPresetPayload>;

export interface Primitive3DMotionPresetPayload {
    startMs: number;
    endMs: number;
    style: MotionStyle;
    transform: MotionTransform;
    enter: MotionEnterExit;
    exit: MotionEnterExit;
    params: Primitive3DParams;
}

export type Primitive3DMotionPresetDocument = MotionPresetDocument<Primitive3DMotionPresetPayload>;
