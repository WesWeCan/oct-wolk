import {
    BoxGeometry,
    CapsuleGeometry,
    ConeGeometry,
    CylinderGeometry,
    DodecahedronGeometry,
    IcosahedronGeometry,
    MathUtils,
    OctahedronGeometry,
    PlaneGeometry,
    SphereGeometry,
    TetrahedronGeometry,
    TorusGeometry,
    Vector3,
} from 'three';
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

const sampleGeometryVertices = (geometry: { attributes?: { position?: { count: number; getX: (i: number) => number; getY: (i: number) => number; getZ: (i: number) => number } } }): Vector3[] => {
    const position = geometry.attributes?.position;
    if (!position) return [];
    const unique = new Map<string, Vector3>();
    for (let index = 0; index < position.count; index += 1) {
        const point = new Vector3(position.getX(index), position.getY(index), position.getZ(index));
        const key = `${point.x.toFixed(4)}:${point.y.toFixed(4)}:${point.z.toFixed(4)}`;
        if (!unique.has(key)) unique.set(key, point);
    }
    return [...unique.values()];
};

const buildPlatonicPoints = (type: Primitive3DParams['primitive']['type']): Vector3[] => {
    if (type === 'tetrahedron') return sampleGeometryVertices(new TetrahedronGeometry(1.4, 0));
    if (type === 'octahedron') return sampleGeometryVertices(new OctahedronGeometry(1.3, 0));
    if (type === 'dodecahedron') return sampleGeometryVertices(new DodecahedronGeometry(1.2, 0));
    return sampleGeometryVertices(new IcosahedronGeometry(1.25, 0));
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
    switch (params.primitive.type) {
    case 'box':
        return sampleGeometryVertices(new BoxGeometry(2, 2, 2));
    case 'plane':
        return sampleGeometryVertices(new PlaneGeometry(params.primitive.planeWidth, params.primitive.planeHeight, 1, 1));
    case 'cylinder':
        return sampleGeometryVertices(new CylinderGeometry(1, 1, 2, 48, 1));
    case 'cone':
        return sampleGeometryVertices(new ConeGeometry(1, 2, 48, 1));
    case 'torus':
        return sampleGeometryVertices(new TorusGeometry(1, 0.35, 24, 64));
    case 'capsule':
        return sampleGeometryVertices(new CapsuleGeometry(0.7, 1.4, 8, 16));
    case 'tetrahedron':
    case 'octahedron':
    case 'dodecahedron':
    case 'icosahedron':
        return buildPlatonicPoints(params.primitive.type);
    case 'sphere':
    default:
        return sampleGeometryVertices(new SphereGeometry(1, params.primitive.sphereSegments, params.primitive.sphereSegments));
    }
};

export const getPrimitive3DAnchorPoints = (params: Primitive3DParams): Vector3[] => {
    const rawPoints = buildGeometryAnchorPoints(params);
    if (rawPoints.length > 0) return sortAnchorPoints(rawPoints);

    switch (params.primitive.type) {
    case 'box':
        return fibonacciSphere(8, 1).map(projectDirectionToBox);
    case 'capsule':
        return fibonacciSphere(24, 0.7).map((point) => {
            const next = point.clone();
            next.y += Math.sign(next.y || 1) * 0.7;
            return next;
        });
    case 'tetrahedron':
    case 'octahedron':
    case 'dodecahedron':
    case 'icosahedron':
        return buildPlatonicPoints(params.primitive.type);
    case 'sphere':
    default:
        return fibonacciSphere(Math.max(8, params.primitive.sphereSegments * 2), 1);
    }
};

export const getPrimitive3DAnchorCapacity = (params: Primitive3DParams): number => {
    return Math.max(1, getPrimitive3DAnchorPoints(params).length);
};
