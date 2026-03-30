import type { MotionPresetDocument, MotionPresetSaveInput, MotionPresetSummary } from '@/types/motion_preset_types';
import type { MotionPresetArchiveDialogResult } from '@/types/archive_types';

export const MotionPresetService = {
    async list(blockType: string): Promise<MotionPresetSummary[]> {
        const presets = await window.electronAPI.motionPresets.list(blockType);
        return Array.isArray(presets) ? presets as MotionPresetSummary[] : [];
    },

    async load(blockType: string, presetId: string): Promise<MotionPresetDocument | null> {
        const preset = await window.electronAPI.motionPresets.load(blockType, presetId);
        return (preset || null) as MotionPresetDocument | null;
    },

    async save<TPayload>(preset: MotionPresetSaveInput<TPayload>): Promise<MotionPresetDocument<TPayload>> {
        const saved = await window.electronAPI.motionPresets.save(preset);
        return saved as MotionPresetDocument<TPayload>;
    },

    async delete(blockType: string, presetId: string): Promise<boolean> {
        const ok = await window.electronAPI.motionPresets.delete(blockType, presetId);
        return !!ok;
    },

    async exportOne(blockType: string, presetId: string): Promise<MotionPresetArchiveDialogResult> {
        return await window.electronAPI.motionPresets.exportOne(blockType, presetId);
    },

    async importOne(): Promise<MotionPresetArchiveDialogResult> {
        return await window.electronAPI.motionPresets.importOne();
    },

    async exportBundle(): Promise<MotionPresetArchiveDialogResult> {
        return await window.electronAPI.motionPresets.exportBundle();
    },

    async importBundle(): Promise<MotionPresetArchiveDialogResult> {
        return await window.electronAPI.motionPresets.importBundle();
    },
};
