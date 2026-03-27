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

    it('uses stored model anchor points when OBJ metadata exists', () => {
        const params = resolvePrimitive3DParams({
            primitive: {
                type: 'model',
                modelBoundsWidth: 1.5,
                modelBoundsHeight: 2,
                modelBoundsDepth: 0.75,
                modelAnchorPoints: [
                    { x: -0.5, y: 0.25, z: 0.1 },
                    { x: 0.75, y: -0.2, z: -0.3 },
                ],
            },
        });

        const points = getPrimitive3DAnchorPoints(params);

        expect(points).toHaveLength(2);
        expect(points.some((point) => point.x === -0.5 && point.y === 0.25 && point.z === 0.1)).toBe(true);
        expect(points.some((point) => point.x === 0.75 && point.y === -0.2 && point.z === -0.3)).toBe(true);
    });

    it('falls back to normalized model bounds when stored anchors are unavailable', () => {
        const params = resolvePrimitive3DParams({
            primitive: {
                type: 'model',
                modelBoundsWidth: 4,
                modelBoundsHeight: 2,
                modelBoundsDepth: 6,
            },
        });

        const points = getPrimitive3DAnchorPoints(params);
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
});
