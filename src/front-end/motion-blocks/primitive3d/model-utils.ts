import {
    Box3,
    Group,
    Mesh,
    Vector3,
    type Object3D,
} from 'three';

export interface Primitive3DStoredPoint {
    x: number;
    y: number;
    z: number;
}

export interface Primitive3DModelMetadata {
    boundsWidth: number;
    boundsHeight: number;
    boundsDepth: number;
    anchorPoints: Primitive3DStoredPoint[];
    scaleFactor: number;
    center: Primitive3DStoredPoint;
}

const DEFAULT_MODEL_DIMENSION = 2;
const MODEL_TARGET_MAX_DIMENSION = 2;
const MAX_STORED_ANCHOR_POINTS = 64;

const roundPointValue = (value: number): number => {
    return Math.round(value * 10_000) / 10_000;
};

const toStoredPoint = (point: Vector3): Primitive3DStoredPoint => ({
    x: roundPointValue(point.x),
    y: roundPointValue(point.y),
    z: roundPointValue(point.z),
});

const collectModelVertices = (root: Object3D): Vector3[] => {
    root.updateMatrixWorld(true);
    const unique = new Map<string, Vector3>();

    root.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        const position = child.geometry.attributes?.position;
        if (!position) return;

        const step = Math.max(1, Math.ceil(position.count / MAX_STORED_ANCHOR_POINTS));
        for (let index = 0; index < position.count; index += step) {
            const point = new Vector3(position.getX(index), position.getY(index), position.getZ(index));
            point.applyMatrix4(child.matrixWorld);
            const key = `${point.x.toFixed(4)}:${point.y.toFixed(4)}:${point.z.toFixed(4)}`;
            if (!unique.has(key)) unique.set(key, point);
        }
    });

    return [...unique.values()];
};

export const extractPrimitive3DModelMetadata = (root: Object3D): Primitive3DModelMetadata => {
    const bounds = new Box3().setFromObject(root);
    if (bounds.isEmpty()) {
        return {
            boundsWidth: DEFAULT_MODEL_DIMENSION,
            boundsHeight: DEFAULT_MODEL_DIMENSION,
            boundsDepth: DEFAULT_MODEL_DIMENSION,
            anchorPoints: [],
            scaleFactor: 1,
            center: { x: 0, y: 0, z: 0 },
        };
    }

    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 0.0001);
    const scaleFactor = MODEL_TARGET_MAX_DIMENSION / maxDimension;
    const vertices = collectModelVertices(root)
        .map((point) => point.sub(center).multiplyScalar(scaleFactor))
        .slice(0, MAX_STORED_ANCHOR_POINTS)
        .map(toStoredPoint);

    return {
        boundsWidth: Math.max(0.05, roundPointValue(size.x * scaleFactor)),
        boundsHeight: Math.max(0.05, roundPointValue(size.y * scaleFactor)),
        boundsDepth: Math.max(0.05, roundPointValue(size.z * scaleFactor)),
        anchorPoints: vertices,
        scaleFactor,
        center: toStoredPoint(center),
    };
};

export const createNormalizedPrimitive3DModelGroup = (root: Group): {
    group: Group;
    metadata: Primitive3DModelMetadata;
} => {
    const metadata = extractPrimitive3DModelMetadata(root);
    const container = new Group();
    container.add(root);
    root.position.set(
        -metadata.center.x * metadata.scaleFactor,
        -metadata.center.y * metadata.scaleFactor,
        -metadata.center.z * metadata.scaleFactor,
    );
    root.scale.multiplyScalar(metadata.scaleFactor);
    root.updateMatrixWorld(true);

    return {
        group: container,
        metadata,
    };
};
