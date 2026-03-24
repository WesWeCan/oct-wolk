import type { MotionEnterExit, MotionStyle, MotionTransform } from '@/types/project_types';
import {
    createDefaultSubtitleEnter,
    createDefaultSubtitleExit,
    DEFAULT_SUBTITLE_ENTER_EXIT,
    DEFAULT_SUBTITLE_STYLE,
    DEFAULT_SUBTITLE_TRANSFORM,
} from '@/front-end/motion-blocks/subtitle/defaults';
import { DEFAULT_CLOUD_LAYOUT_PARAMS } from '@/front-end/motion-blocks/cloud/params';

export const DEFAULT_CLOUD_STYLE: MotionStyle = {
    ...DEFAULT_SUBTITLE_STYLE,
    fontSize: 42,
    lineHeight: 1.1,
    backgroundPadding: 10,
    backgroundOpacity: 0,
};

export const DEFAULT_CLOUD_TRANSFORM: MotionTransform = {
    ...DEFAULT_SUBTITLE_TRANSFORM,
};

export const DEFAULT_CLOUD_ENTER_EXIT: MotionEnterExit = {
    ...DEFAULT_SUBTITLE_ENTER_EXIT,
};

export const createDefaultCloudEnter = createDefaultSubtitleEnter;
export const createDefaultCloudExit = createDefaultSubtitleExit;
export const DEFAULT_CLOUD_PARAMS = DEFAULT_CLOUD_LAYOUT_PARAMS;
