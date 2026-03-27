import { SUBTITLE_KEYFRAME_PROPERTIES } from '@/front-end/motion-blocks/subtitle/keyframes';

const EXCLUDED_TRANSFORM_PATHS = new Set([
    'transform.offsetX',
    'transform.offsetY',
    'transform.scale',
    'transform.rotation',
]);

export const CLOUD_KEYFRAME_PROPERTIES = SUBTITLE_KEYFRAME_PROPERTIES.filter(
    (prop) => !EXCLUDED_TRANSFORM_PATHS.has(prop.path),
);
