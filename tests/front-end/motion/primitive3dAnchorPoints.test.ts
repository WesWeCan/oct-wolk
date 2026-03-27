import { describe, expect, it } from 'vitest';
import { getPrimitive3DAnchorCapacity, getPrimitive3DAnchorPoints } from '@/front-end/motion-blocks/primitive3d/anchor-points';
import { resolvePrimitive3DParams } from '@/front-end/motion-blocks/primitive3d/params';

describe('primitive3d anchor points', () => {
    it('uses expanded box geometry dimensions when sampling anchors', () => {
        const points = getPrimitive3DAnchorPoints(resolvePrimitive3DParams({
            primitive: {
                type: 'box',
                boxWidth: 4,
                boxHeight: 2,
                boxDepth: 6,
            },
        }));

        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        const zs = points.map((point) => point.z);

        expect(Math.max(...xs)).toBeCloseTo(2);
        expect(Math.min(...xs)).toBeCloseTo(-2);
        expect(Math.max(...ys)).toBeCloseTo(1);
        expect(Math.min(...ys)).toBeCloseTo(-1);
        expect(Math.max(...zs)).toBeCloseTo(3);
        expect(Math.min(...zs)).toBeCloseTo(-3);
    });

    it('keeps legacy sphere segment data compatible with anchor capacity', () => {
        const params = resolvePrimitive3DParams({
            primitive: {
                type: 'sphere',
                sphereSegments: 20,
            },
        });

        expect(params.primitive.sphereWidthSegments).toBe(20);
        expect(params.primitive.sphereHeightSegments).toBe(20);
        expect(getPrimitive3DAnchorCapacity(params)).toBeGreaterThan(20);
    });
});
