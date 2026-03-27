import {
    BoxGeometry,
    CapsuleGeometry,
    ConeGeometry,
    CylinderGeometry,
    DodecahedronGeometry,
    IcosahedronGeometry,
    OctahedronGeometry,
    PlaneGeometry,
    SphereGeometry,
    TetrahedronGeometry,
    TorusGeometry,
    type BufferGeometry,
    Vector3,
} from 'three';
import type { Primitive3DGeometryParams, Primitive3DType } from '@/front-end/motion-blocks/primitive3d/params';

export const PRIMITIVE3D_ADVANCED_TYPES = ['icosahedron', 'tetrahedron', 'octahedron', 'dodecahedron'] as const;
export const PRIMITIVE3D_CORE_TYPES = ['sphere', 'box', 'plane', 'cylinder', 'cone', 'capsule', 'torus', 'model'] as const;

const ADVANCED_TYPE_SET = new Set<Primitive3DType>(PRIMITIVE3D_ADVANCED_TYPES);

export const isPrimitive3DAdvancedType = (type: Primitive3DType): boolean => ADVANCED_TYPE_SET.has(type);

export const createPrimitive3DGeometry = (primitive: Primitive3DGeometryParams): BufferGeometry => {
    switch (primitive.type) {
    case 'box':
        return new BoxGeometry(primitive.boxWidth, primitive.boxHeight, primitive.boxDepth);
    case 'plane':
        return new PlaneGeometry(
            primitive.planeWidth,
            primitive.planeHeight,
            primitive.planeWidthSegments,
            primitive.planeHeightSegments,
        );
    case 'cylinder':
        return new CylinderGeometry(
            primitive.cylinderRadiusTop,
            primitive.cylinderRadiusBottom,
            primitive.cylinderHeight,
            primitive.cylinderRadialSegments,
            1,
        );
    case 'cone':
        return new ConeGeometry(
            primitive.coneRadius,
            primitive.coneHeight,
            primitive.coneRadialSegments,
            1,
        );
    case 'torus':
        return new TorusGeometry(
            primitive.torusRadius,
            primitive.torusTube,
            primitive.torusRadialSegments,
            primitive.torusTubularSegments,
        );
    case 'icosahedron':
        return new IcosahedronGeometry(1.25, 0);
    case 'capsule':
        return new CapsuleGeometry(
            primitive.capsuleRadius,
            primitive.capsuleLength,
            primitive.capsuleCapSegments,
            primitive.capsuleRadialSegments,
        );
    case 'tetrahedron':
        return new TetrahedronGeometry(1.4, 0);
    case 'octahedron':
        return new OctahedronGeometry(1.3, 0);
    case 'dodecahedron':
        return new DodecahedronGeometry(1.2, 0);
    case 'model':
        return new BoxGeometry(primitive.modelBoundsWidth, primitive.modelBoundsHeight, primitive.modelBoundsDepth);
    case 'sphere':
    default:
        return new SphereGeometry(1, primitive.sphereWidthSegments, primitive.sphereHeightSegments);
    }
};

export const getPrimitive3DGeometryKey = (primitive: Primitive3DGeometryParams): string => {
    return [
        primitive.type,
        primitive.sphereWidthSegments,
        primitive.sphereHeightSegments,
        primitive.boxWidth,
        primitive.boxHeight,
        primitive.boxDepth,
        primitive.planeWidth,
        primitive.planeHeight,
        primitive.planeWidthSegments,
        primitive.planeHeightSegments,
        primitive.cylinderRadiusTop,
        primitive.cylinderRadiusBottom,
        primitive.cylinderHeight,
        primitive.cylinderRadialSegments,
        primitive.coneRadius,
        primitive.coneHeight,
        primitive.coneRadialSegments,
        primitive.torusRadius,
        primitive.torusTube,
        primitive.torusRadialSegments,
        primitive.torusTubularSegments,
        primitive.capsuleRadius,
        primitive.capsuleLength,
        primitive.capsuleCapSegments,
        primitive.capsuleRadialSegments,
        primitive.modelObjUrl,
        primitive.modelTextureUrl,
        primitive.modelNormalUrl,
        primitive.modelBoundsWidth,
        primitive.modelBoundsHeight,
        primitive.modelBoundsDepth,
        primitive.modelAnchorPoints
            .map((point) => `${point.x},${point.y},${point.z}`)
            .join('|'),
    ].join(':');
};

export const samplePrimitive3DGeometryVertices = (primitive: Primitive3DGeometryParams): Vector3[] => {
    if (primitive.type === 'model' && primitive.modelAnchorPoints.length > 0) {
        return primitive.modelAnchorPoints.map((point) => new Vector3(point.x, point.y, point.z));
    }

    const geometry = createPrimitive3DGeometry(primitive);
    const position = geometry.attributes?.position;
    if (!position) {
        geometry.dispose();
        return [];
    }

    const unique = new Map<string, Vector3>();
    for (let index = 0; index < position.count; index += 1) {
        const point = new Vector3(position.getX(index), position.getY(index), position.getZ(index));
        const key = `${point.x.toFixed(4)}:${point.y.toFixed(4)}:${point.z.toFixed(4)}`;
        if (!unique.has(key)) unique.set(key, point);
    }

    geometry.dispose();
    return [...unique.values()];
};
