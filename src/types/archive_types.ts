import type { MotionPresetSummary } from '@/types/motion_preset_types';
import type { WolkProject } from '@/types/project_types';

export const WOLK_PROJECT_EXTENSION = 'wolk';
export const WOLK_PRESET_EXTENSION = 'wolkdpreset';
export const WOLK_PRESET_BUNDLE_EXTENSION = 'wolkpresets';

export const WOLK_PROJECT_ARCHIVE_VERSION = 1;
export const WOLK_PRESET_ARCHIVE_VERSION = 1;
export const WOLK_PRESET_BUNDLE_ARCHIVE_VERSION = 1;

export interface BaseArchiveManifest {
    fileType: 'wolk-project' | 'motion-preset' | 'motion-preset-bundle';
    schemaVersion: number;
    exportedAt: number;
    appVersion: string;
}

export interface WolkProjectArchiveManifest extends BaseArchiveManifest {
    fileType: 'wolk-project';
    schemaVersion: typeof WOLK_PROJECT_ARCHIVE_VERSION;
    projectVersion: number;
}

export interface MotionPresetArchiveManifest extends BaseArchiveManifest {
    fileType: 'motion-preset';
    schemaVersion: typeof WOLK_PRESET_ARCHIVE_VERSION;
    blockType: string;
    presetVersion: number;
}

export interface MotionPresetBundleArchiveManifest extends BaseArchiveManifest {
    fileType: 'motion-preset-bundle';
    schemaVersion: typeof WOLK_PRESET_BUNDLE_ARCHIVE_VERSION;
    presetCount: number;
}

export type SupportedArchiveManifest =
    | WolkProjectArchiveManifest
    | MotionPresetArchiveManifest
    | MotionPresetBundleArchiveManifest;

export interface ProjectArchiveDialogResult {
    canceled: boolean;
    filePath?: string;
    project?: WolkProject;
    error?: string;
}

export interface MotionPresetArchiveDialogResult {
    canceled: boolean;
    filePath?: string;
    imported?: MotionPresetSummary[];
    exportedCount?: number;
    error?: string;
}
