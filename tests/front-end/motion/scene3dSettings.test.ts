import { describe, expect, it } from 'vitest';
import { normalizeScene3DSettings } from '@/front-end/utils/projectScene3D';

describe('scene3d settings normalization', () => {
    it('fills missing values from defaults', () => {
        const normalized = normalizeScene3DSettings(undefined);

        expect(normalized.enabled).toBe(false);
        expect(normalized.globalLighting.ambientIntensity).toBe(0.45);
        expect(normalized.globalLighting.directionalAzimuth).toBe(35);
    });

    it('clamps numeric values to safe bounds', () => {
        const normalized = normalizeScene3DSettings({
            enabled: true,
            globalLighting: {
                ambientIntensity: -5,
                directionalIntensity: 999,
                directionalAzimuth: 999,
                directionalElevation: -999,
            } as any,
        });

        expect(normalized.enabled).toBe(true);
        expect(normalized.globalLighting.ambientIntensity).toBe(0);
        expect(normalized.globalLighting.directionalIntensity).toBe(20);
        expect(normalized.globalLighting.directionalAzimuth).toBe(180);
        expect(normalized.globalLighting.directionalElevation).toBe(-89);
    });
});
