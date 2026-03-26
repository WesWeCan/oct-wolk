import type { MotionBlockPresetAdapter } from '@/front-end/motion-blocks/core/plugin-types';
import type { SubtitleMotionPresetDocument, SubtitleMotionPresetPayload } from '@/types/motion_preset_types';

export const SUBTITLE_MOTION_PRESET_VERSION = 1;

const clonePayload = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const subtitleMotionPresetAdapter: MotionBlockPresetAdapter<SubtitleMotionPresetPayload, SubtitleMotionPresetDocument> = {
    version: SUBTITLE_MOTION_PRESET_VERSION,
    extractPayload(track) {
        return clonePayload({
            startMs: track.block.startMs,
            endMs: track.block.endMs,
            style: track.block.style,
            transform: track.block.transform,
            enter: track.block.enter,
            exit: track.block.exit,
        });
    },
    applyPreset(track, document, args) {
        if (document.version !== SUBTITLE_MOTION_PRESET_VERSION) {
            throw new Error(`Unsupported subtitle preset version: ${document.version}`);
        }

        const payload = clonePayload(document.payload);
        const startMs = Math.max(0, Math.round(Number(payload.startMs) || 0));
        const rawEndMs = Math.round(Number(payload.endMs) || 0);
        const endMs = Math.max(startMs + 100, rawEndMs);

        return {
            ...track,
            block: {
                ...track.block,
                startMs,
                endMs,
                style: payload.style,
                transform: payload.transform,
                enter: payload.enter,
                exit: payload.exit,
            },
        };
    },
};
