export type Primitive3DType =
    | 'sphere'
    | 'box'
    | 'plane'
    | 'cylinder'
    | 'cone'
    | 'torus'
    | 'icosahedron'
    | 'capsule'
    | 'tetrahedron'
    | 'octahedron'
    | 'dodecahedron';
export type Primitive3DLightingMode = 'global' | 'local';

export interface Primitive3DGeometryParams {
    type: Primitive3DType;
    sphereSegments: number;
    planeWidth: number;
    planeHeight: number;
}

export interface Primitive3DObjectParams {
    positionX: number;
    positionY: number;
    positionZ: number;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
    scale: number;
}

export interface Primitive3DCameraParams {
    distance: number;
}

export interface Primitive3DMaterialParams {
    color: string;
    roughness: number;
    metalness: number;
    opacity: number;
}

export interface Primitive3DLightingParams {
    mode: Primitive3DLightingMode;
    ambientColor: string;
    ambientIntensity: number;
    directionalColor: string;
    directionalIntensity: number;
    directionalAzimuth: number;
    directionalElevation: number;
}

export interface Primitive3DParams {
    primitive: Primitive3DGeometryParams;
    object: Primitive3DObjectParams;
    camera: Primitive3DCameraParams;
    material: Primitive3DMaterialParams;
    lighting: Primitive3DLightingParams;
}

export const DEFAULT_PRIMITIVE3D_PARAMS: Primitive3DParams = {
    primitive: {
        type: 'sphere',
        sphereSegments: 48,
        planeWidth: 2.5,
        planeHeight: 2.5,
    },
    object: {
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        rotationX: 18,
        rotationY: 24,
        rotationZ: 0,
        scale: 1,
    },
    camera: {
        distance: 5.5,
    },
    material: {
        color: '#9bc8ff',
        roughness: 0.32,
        metalness: 0.16,
        opacity: 1,
    },
    lighting: {
        mode: 'global',
        ambientColor: '#ffffff',
        ambientIntensity: 0.45,
        directionalColor: '#ffffff',
        directionalIntensity: 1.2,
        directionalAzimuth: 35,
        directionalElevation: 50,
    },
};

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, numeric));
};

const normalizeColor = (value: unknown, fallback: string): string => {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
};

export const resolvePrimitive3DParams = (params: Record<string, any> | null | undefined): Primitive3DParams => {
    const raw = params || {};
    const primitive = raw.primitive || {};
    const object = raw.object || {};
    const camera = raw.camera || {};
    const material = raw.material || {};
    const lighting = raw.lighting || {};

    const primitiveType: Primitive3DType = (
        primitive.type === 'box'
        || primitive.type === 'plane'
        || primitive.type === 'cylinder'
        || primitive.type === 'cone'
        || primitive.type === 'torus'
        || primitive.type === 'icosahedron'
        || primitive.type === 'capsule'
        || primitive.type === 'tetrahedron'
        || primitive.type === 'octahedron'
        || primitive.type === 'dodecahedron'
    )
        ? primitive.type
        : 'sphere';
    const lightingMode: Primitive3DLightingMode = lighting.mode === 'local' ? 'local' : 'global';

    return {
        primitive: {
            type: primitiveType,
            sphereSegments: clamp(primitive.sphereSegments, 8, 128, DEFAULT_PRIMITIVE3D_PARAMS.primitive.sphereSegments),
            planeWidth: clamp(primitive.planeWidth, 0.25, 10, DEFAULT_PRIMITIVE3D_PARAMS.primitive.planeWidth),
            planeHeight: clamp(primitive.planeHeight, 0.25, 10, DEFAULT_PRIMITIVE3D_PARAMS.primitive.planeHeight),
        },
        object: {
            positionX: clamp(object.positionX, -20, 20, DEFAULT_PRIMITIVE3D_PARAMS.object.positionX),
            positionY: clamp(object.positionY, -20, 20, DEFAULT_PRIMITIVE3D_PARAMS.object.positionY),
            positionZ: clamp(object.positionZ, -20, 20, DEFAULT_PRIMITIVE3D_PARAMS.object.positionZ),
            rotationX: clamp(object.rotationX, -360, 360, DEFAULT_PRIMITIVE3D_PARAMS.object.rotationX),
            rotationY: clamp(object.rotationY, -360, 360, DEFAULT_PRIMITIVE3D_PARAMS.object.rotationY),
            rotationZ: clamp(object.rotationZ, -360, 360, DEFAULT_PRIMITIVE3D_PARAMS.object.rotationZ),
            scale: clamp(object.scale, 0.05, 10, DEFAULT_PRIMITIVE3D_PARAMS.object.scale),
        },
        camera: {
            distance: clamp(camera.distance, 1, 25, DEFAULT_PRIMITIVE3D_PARAMS.camera.distance),
        },
        material: {
            color: normalizeColor(material.color, DEFAULT_PRIMITIVE3D_PARAMS.material.color),
            roughness: clamp(material.roughness, 0, 1, DEFAULT_PRIMITIVE3D_PARAMS.material.roughness),
            metalness: clamp(material.metalness, 0, 1, DEFAULT_PRIMITIVE3D_PARAMS.material.metalness),
            opacity: clamp(material.opacity, 0, 1, DEFAULT_PRIMITIVE3D_PARAMS.material.opacity),
        },
        lighting: {
            mode: lightingMode,
            ambientColor: normalizeColor(lighting.ambientColor, DEFAULT_PRIMITIVE3D_PARAMS.lighting.ambientColor),
            ambientIntensity: clamp(lighting.ambientIntensity, 0, 10, DEFAULT_PRIMITIVE3D_PARAMS.lighting.ambientIntensity),
            directionalColor: normalizeColor(lighting.directionalColor, DEFAULT_PRIMITIVE3D_PARAMS.lighting.directionalColor),
            directionalIntensity: clamp(lighting.directionalIntensity, 0, 20, DEFAULT_PRIMITIVE3D_PARAMS.lighting.directionalIntensity),
            directionalAzimuth: clamp(lighting.directionalAzimuth, -180, 180, DEFAULT_PRIMITIVE3D_PARAMS.lighting.directionalAzimuth),
            directionalElevation: clamp(lighting.directionalElevation, -89, 89, DEFAULT_PRIMITIVE3D_PARAMS.lighting.directionalElevation),
        },
    };
};
