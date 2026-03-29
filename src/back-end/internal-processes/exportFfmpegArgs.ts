import fs from 'fs';
import path from 'path';

const getFrameInputPattern = (framesDir: string) => path.join(framesDir, 'frame_%06d.png');

const appendAudioInput = (args: string[], audioPath: string | null) => {
    if (!audioPath) return false;
    if (!fs.existsSync(audioPath)) return false;

    args.push('-i', audioPath);
    return true;
};

export const buildMp4FrameAssemblyArgs = (
    framesDir: string,
    fps: number,
    audioPath: string | null,
    outputPath: string,
) => {
    const args = [
        '-y',
        '-framerate', String(fps),
        '-i', getFrameInputPattern(framesDir),
    ];

    const hasAudio = appendAudioInput(args, audioPath);

    args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2');
    args.push('-c:v', 'libx264');
    args.push('-pix_fmt', 'yuv420p');
    args.push('-preset', 'medium');
    args.push('-crf', '18');
    args.push('-movflags', '+faststart');

    if (hasAudio) {
        args.push('-c:a', 'aac');
        args.push('-b:a', '192k');
        args.push('-shortest');
    }

    args.push(outputPath);

    return args;
};

export const buildAlphaMovFrameAssemblyArgs = (
    framesDir: string,
    fps: number,
    audioPath: string | null,
    outputPath: string,
) => {
    const args = [
        '-y',
        '-framerate', String(fps),
        '-i', getFrameInputPattern(framesDir),
    ];

    const hasAudio = appendAudioInput(args, audioPath);

    args.push('-c:v', 'prores_ks');
    args.push('-profile:v', '4');
    args.push('-pix_fmt', 'yuva444p10le');

    if (hasAudio) {
        args.push('-c:a', 'aac');
        args.push('-b:a', '192k');
        args.push('-shortest');
    }

    args.push(outputPath);

    return args;
};
