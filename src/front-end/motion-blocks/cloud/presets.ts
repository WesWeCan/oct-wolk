import type { MotionBlockPresetAdapter } from '@/front-end/motion-blocks/core/plugin-types';
import { normalizeCloudTrack } from '@/front-end/motion-blocks/cloud/normalize';
import type { CloudMotionPresetDocument, CloudMotionPresetPayload } from '@/types/motion_preset_types';

export const CLOUD_MOTION_PRESET_VERSION = 1;

const clonePayload = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const cloudMotionPresetAdapter: MotionBlockPresetAdapter<CloudMotionPresetPayload, CloudMotionPresetDocument> = {
    version: CLOUD_MOTION_PRESET_VERSION,
    extractPayload(track, args) {
        const normalized = normalizeCloudTrack(track, args);
        return clonePayload({
            startMs: normalized.block.startMs,
            endMs: normalized.block.endMs,
            style: normalized.block.style,
            transform: normalized.block.transform,
            enter: normalized.block.enter,
            exit: normalized.block.exit,
            params: normalized.block.params,
        });
    },
    applyPreset(track, document, args) {
        if (document.version !== CLOUD_MOTION_PRESET_VERSION) {
            throw new Error(`Unsupported cloud preset version: ${document.version}`);
        }

        const payload = clonePayload(document.payload);
        const startMs = Math.max(0, Math.round(Number(payload.startMs) || 0));
        const rawEndMs = Math.round(Number(payload.endMs) || 0);
        const endMs = Math.max(startMs + 100, rawEndMs);

        const updatedTrack = {
            ...track,
            block: {
                ...track.block,
                startMs,
                endMs,
                style: payload.style,
                transform: payload.transform,
                enter: payload.enter,
                exit: payload.exit,
                params: payload.params,
            },
        };

        return normalizeCloudTrack(updatedTrack, args);
    },
};
