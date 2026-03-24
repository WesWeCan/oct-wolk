import type { LyricTrack } from '@/types/project_types';

export const isCloudSupportedSourceTrack = (track: LyricTrack | null | undefined): boolean => {
    return !!track && track.kind === 'word';
};

export const listCloudSupportedSourceTracks = (tracks: LyricTrack[]): LyricTrack[] => {
    return tracks.filter((track) => isCloudSupportedSourceTrack(track));
};

export const pickPreferredCloudSourceTrack = (
    selectedTrack: LyricTrack | null,
    tracks: LyricTrack[],
): LyricTrack | null => {
    if (isCloudSupportedSourceTrack(selectedTrack)) return selectedTrack;

    const firstWordTrack = tracks.find((track) => isCloudSupportedSourceTrack(track));
    if (firstWordTrack) return firstWordTrack;

    return selectedTrack || tracks[0] || null;
};
