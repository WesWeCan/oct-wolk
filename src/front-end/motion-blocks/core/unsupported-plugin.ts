import type { MotionBlockPlugin } from '@/front-end/motion-blocks/core/plugin-types';

const unsupportedRenderer = () => ({
    prepare() {
        return;
    },
    render() {
        return;
    },
    dispose() {
        return;
    },
});

export const unsupportedMotionBlockPlugin: MotionBlockPlugin = {
    type: '__unsupported__',
    meta: {
        label: 'Unsupported',
        description: 'Fallback motion block used when a saved block type is unknown to the current app version.',
        authorable: false,
        order: 999,
    },
    createTrack() {
        throw new Error('Unsupported motion block plugin cannot create new tracks.');
    },
    normalizeTrack(track) {
        return {
            ...track,
            enabled: track.enabled !== false,
            muted: !!track.muted,
            solo: !!track.solo,
            locked: !!track.locked,
            block: {
                ...track.block,
                type: track.block.type,
            },
        };
    },
    createRenderer: unsupportedRenderer,
    resolveActiveItems() {
        return [];
    },
    resolveBlockItems() {
        return [];
    },
    getKeyframeProperties() {
        return [];
    },
};
