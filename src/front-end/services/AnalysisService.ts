import type { AnalysisCache } from '@/types/analysis_types';

export const AnalysisService = {
    async analyzeBufferToCache(buffer: AudioBuffer, fps: number): Promise<AnalysisCache> {
        const durationSec = buffer.duration;
        const totalFrames = Math.max(1, Math.floor(durationSec * Math.max(1, fps)));
        // Build ~60 Hz RMS envelope first
        const channel = buffer.getChannelData(0);
        const sampleRate = buffer.sampleRate;
        const envRate = 60; // Hz
        const hop = Math.max(1, Math.floor(sampleRate / envRate));
        const win = Math.max(1, Math.floor(sampleRate * 0.05)); // 50ms window
        const envelope: number[] = [];
        for (let i = 0; i < channel.length; i += hop) {
            const start = Math.max(0, i - Math.floor(win / 2));
            const end = Math.min(channel.length, start + win);
            let sum = 0;
            for (let j = start; j < end; j++) sum += channel[j] * channel[j];
            const rms = Math.sqrt(sum / Math.max(1, (end - start)));
            envelope.push(rms);
        }
        // Normalize to 0..1
        const max = envelope.reduce((a, b) => Math.max(a, b), 1e-6);
        for (let i = 0; i < envelope.length; i++) envelope[i] = envelope[i] / max;
        // Map envelope to per-frame energy by sampling nearest env index
        const energyPerFrame: number[] = new Array(totalFrames);
        for (let f = 0; f < totalFrames; f++) {
            const t = f / Math.max(1, fps);
            const envIndex = Math.min(envelope.length - 1, Math.floor(t * envRate));
            energyPerFrame[f] = envelope[envIndex] || 0;
        }
        // Onset detection: simple threshold with hysteresis over envelope
        const threshold = 0.07;
        const isOnsetPerFrame: boolean[] = new Array(totalFrames).fill(false);
        let lastAbove = (envelope[0] || 0) > threshold;
        for (let f = 1; f < totalFrames; f++) {
            const e = energyPerFrame[f];
            const above = e > threshold;
            const onset = above && !lastAbove;
            isOnsetPerFrame[f] = onset;
            lastAbove = above;
        }
        const onsetIndexPerFrame: number[] = new Array(totalFrames);
        let count = 0;
        for (let f = 0; f < totalFrames; f++) {
            if (isOnsetPerFrame[f]) count++;
            onsetIndexPerFrame[f] = count;
        }
        return { fps, durationSec, totalFrames, energyPerFrame, isOnsetPerFrame, onsetIndexPerFrame };
    }
};


