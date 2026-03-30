import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const documentsRoot = '/tmp/test-wolk-documents';
const userDataRoot = '/tmp/test-wolk-userData';

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => name === 'documents' ? documentsRoot : userDataRoot),
  },
  shell: { openPath: vi.fn() },
}));

import {
    deleteMotionPreset,
    listMotionPresets,
    loadMotionPreset,
    saveMotionPreset,
} from '@/back-end/internal-processes/motion-preset-storage';

const presetsRoot = path.join(documentsRoot, 'WOLK', 'presets');

describe('motion preset storage', () => {
    beforeEach(() => {
        fs.rmSync(documentsRoot, { recursive: true, force: true });
        fs.rmSync(userDataRoot, { recursive: true, force: true });
    });

    it('saves, lists, loads, and deletes subtitle presets', () => {
        const saved = saveMotionPreset({
            blockType: 'subtitle',
            version: 1,
            name: 'Hero Subtitle',
            payload: {
                startMs: 100,
                endMs: 1200,
                style: { fontFamily: 'system-ui' },
            },
        });

        expect(saved.id).toBeTruthy();
        expect(fs.existsSync(path.join(presetsRoot, 'subtitle', `${saved.id}.json`))).toBe(true);

        const list = listMotionPresets('subtitle');
        expect(list).toHaveLength(1);
        expect(list[0].name).toBe('Hero Subtitle');

        const loaded = loadMotionPreset('subtitle', saved.id);
        expect(loaded?.payload).toEqual(saved.payload);

        expect(deleteMotionPreset('subtitle', saved.id)).toBe(true);
        expect(listMotionPresets('subtitle')).toEqual([]);
    });

    it('overwrites an existing preset while preserving its original creation timestamp', () => {
        const first = saveMotionPreset({
            blockType: 'subtitle',
            version: 1,
            name: 'First Name',
            payload: { startMs: 0, endMs: 1000 },
        });

        const updated = saveMotionPreset({
            id: first.id,
            blockType: 'subtitle',
            version: 1,
            name: 'Updated Name',
            payload: { startMs: 50, endMs: 800 },
        });

        expect(updated.id).toBe(first.id);
        expect(updated.createdAt).toBe(first.createdAt);
        expect(updated.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);
        expect(listMotionPresets('subtitle')).toHaveLength(1);
        expect(loadMotionPreset('subtitle', first.id)?.name).toBe('Updated Name');
    });

    it('rejects invalid block types and ids', () => {
        expect(() => saveMotionPreset({
            blockType: '../subtitle',
            version: 1,
            name: 'Bad',
            payload: {},
        })).toThrow();

        expect(() => loadMotionPreset('subtitle', '../bad')).toThrow();
    });
});
