import {
    MathUtils,
    Vector3,
} from 'three';
import { samplePrimitive3DGeometryVertices } from '@/front-end/motion-blocks/primitive3d/geometry';
import type { Primitive3DParams } from '@/front-end/motion-blocks/primitive3d/params';

const TWO_PI = Math.PI * 2;

const fibonacciSphere = (count: number, radius = 1): Vector3[] => {
    if (count <= 1) return [new Vector3(0, 0, radius)];
    const points: Vector3[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let index = 0; index < count; index += 1) {
        const y = 1 - ((index / Math.max(1, count - 1)) * 2);
        const r = Math.sqrt(Math.max(0, 1 - (y * y)));
        const theta = goldenAngle * index;
        points.push(new Vector3(
            Math.cos(theta) * r * radius,
            y * radius,
            Math.sin(theta) * r * radius,
        ));
    }
    return points;
};

const projectDirectionToBox = (direction: Vector3): Vector3 => {
    const maxAxis = Math.max(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z), 0.0001);
    return direction.clone().divideScalar(maxAxis);
};

const sortAnchorPoints = (points: Vector3[]): Vector3[] => {
    return points
        .map((point) => point.clone())
        .sort((a, b) => {
            if (Math.abs(a.y - b.y) > 0.0001) return b.y - a.y;
            const angleA = Math.atan2(a.z, a.x);
            const angleB = Math.atan2(b.z, b.x);
            if (Math.abs(angleA - angleB) > 0.0001) return angleA - angleB;
            return a.x - b.x;
        });
};

const buildGeometryAnchorPoints = (params: Primitive3DParams): Vector3[] => {
    return samplePrimitive3DGeometryVertices(params.primitive);
};

export const getPrimitive3DAnchorPoints = (params: Primitive3DParams): Vector3[] => {
    const rawPoints = buildGeometryAnchorPoints(params);
    if (rawPoints.length > 0) return sortAnchorPoints(rawPoints);

    switch (params.primitive.type) {
    case 'box':
        return fibonacciSphere(8, 1).map(projectDirectionToBox);
    case 'capsule':
        return fibonacciSphere(Math.max(24, params.primitive.capsuleRadialSegments * 2), params.primitive.capsuleRadius).map((point) => {
            const next = point.clone();
            next.y += Math.sign(next.y || 1) * (params.primitive.capsuleLength / 2);
            return next;
        });
    case 'tetrahedron':
    case 'octahedron':
    case 'dodecahedron':
    case 'icosahedron':
        return samplePrimitive3DGeometryVertices(params.primitive);
    case 'sphere':
    default:
        return fibonacciSphere(
            Math.max(8, Math.round((params.primitive.sphereWidthSegments + params.primitive.sphereHeightSegments))),
            1,
        );
    }
};

export const getPrimitive3DAnchorCapacity = (params: Primitive3DParams): number => {
    return Math.max(1, getPrimitive3DAnchorPoints(params).length);
};
