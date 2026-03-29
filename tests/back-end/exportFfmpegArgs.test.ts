import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import { buildAlphaMovFrameAssemblyArgs, buildMp4FrameAssemblyArgs } from '@/back-end/internal-processes/exportFfmpegArgs';

describe('frame export ffmpeg args', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('keeps the existing opaque MP4 profile for standard frame exports', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);

        const args = buildMp4FrameAssemblyArgs('/tmp/frames', 60, '/tmp/audio.wav', '/tmp/export.mp4');

        expect(args).toContain('libx264');
        expect(args).toContain('yuv420p');
        expect(args).toContain('+faststart');
        expect(args).toContain('/tmp/audio.wav');
        expect(args.at(-1)).toBe('/tmp/export.mp4');
    });

    it('builds a ProRes 4444 profile for alpha MOV exports', () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(true);

        const args = buildAlphaMovFrameAssemblyArgs('/tmp/frames', 60, '/tmp/audio.wav', '/tmp/export_alpha.mov');

        expect(args).toContain('prores_ks');
        expect(args).toContain('4');
        expect(args).toContain('yuva444p10le');
        expect(args).not.toContain('libx264');
        expect(args).not.toContain('yuv420p');
        expect(args.at(-1)).toBe('/tmp/export_alpha.mov');
    });
});
