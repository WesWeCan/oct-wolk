import { MotionPresetService } from '@/front-end/services/MotionPresetService';
import { ProjectService } from '@/front-end/services/ProjectService';
import type { MotionPresetArchiveDialogResult, ProjectArchiveDialogResult } from '@/types/archive_types';

export const ArchiveService = {
    async exportProject(projectId: string): Promise<ProjectArchiveDialogResult> {
        return await ProjectService.exportWolk(projectId);
    },

    async importProject(): Promise<ProjectArchiveDialogResult> {
        return await ProjectService.importWolk();
    },

    async importPresets(): Promise<MotionPresetArchiveDialogResult> {
        return await MotionPresetService.importBundle();
    },

    async exportPresetBundle(): Promise<MotionPresetArchiveDialogResult> {
        return await MotionPresetService.exportBundle();
    },
};
