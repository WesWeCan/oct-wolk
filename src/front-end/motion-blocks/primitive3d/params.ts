import {
    DEFAULT_TEXT_REVEAL_PARAMS,
    resolveTextRevealParams,
    type TextRevealParams,
} from '@/front-end/utils/motion/textReveal';
import type { MotionEnterExit } from '@/types/project_types';

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
export type Primitive3DMaterialRenderMode = 'solid' | 'wireframe' | 'solid-wireframe';
export type Primitive3DWordPunctuationMode = 'keep' | 'strip';

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
    renderMode: Primitive3DMaterialRenderMode;
    wireColor: string;
    wireOpacity: number;
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

export interface Primitive3DWordsParams {
    enabled: boolean;
    windowSize: number;
    punctuationMode: Primitive3DWordPunctuationMode;
    worldSize: number;
    radialOffset: number;
}

export interface Primitive3DBillboardParams {
    enabled: boolean;
    rotationOffsetX: number;
    rotationOffsetY: number;
    rotationOffsetZ: number;
}

export interface Primitive3DReactionParams {
    activePointOffsetX: number;
    activePointOffsetY: number;
    activePointOffsetZ: number;
    smoothFacing: boolean;
    smoothStrength: number;
}

export interface Primitive3DParams {
    primitive: Primitive3DGeometryParams;
    object: Primitive3DObjectParams;
    camera: Primitive3DCameraParams;
    material: Primitive3DMaterialParams;
    lighting: Primitive3DLightingParams;
    words: Primitive3DWordsParams;
    billboard: Primitive3DBillboardParams;
    reaction: Primitive3DReactionParams;
    textReveal: TextRevealParams;
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
        renderMode: 'solid',
        wireColor: '#ffffff',
        wireOpacity: 0.7,
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
    words: {
        enabled: false,
        windowSize: 4,
        punctuationMode: 'keep',
        worldSize: 1,
        radialOffset: 0.35,
    },
    billboard: {
        enabled: true,
        rotationOffsetX: 0,
        rotationOffsetY: 0,
        rotationOffsetZ: 0,
    },
    reaction: {
        activePointOffsetX: 0,
        activePointOffsetY: 0,
        activePointOffsetZ: 0,
        smoothFacing: true,
        smoothStrength: 0.08,
    },
    textReveal: {
        ...DEFAULT_TEXT_REVEAL_PARAMS,
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

export const resolvePrimitive3DParams = (
    params: Record<string, any> | null | undefined,
    enter?: MotionEnterExit | null,
    exit?: MotionEnterExit | null,
): Primitive3DParams => {
    const raw = params || {};
    const primitive = raw.primitive || {};
    const object = raw.object || {};
    const camera = raw.camera || {};
    const material = raw.material || {};
    const lighting = raw.lighting || {};
    const words = raw.words || {};
    const billboard = raw.billboard || {};
    const reaction = raw.reaction || {};
    const textReveal = resolveTextRevealParams(raw.textReveal, enter, exit);

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
    const renderMode: Primitive3DMaterialRenderMode = (
        material.renderMode === 'wireframe'
        || material.renderMode === 'solid-wireframe'
    )
        ? material.renderMode
        : 'solid';
    const punctuationMode: Primitive3DWordPunctuationMode = words.punctuationMode === 'strip' ? 'strip' : 'keep';

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
            renderMode,
            wireColor: normalizeColor(material.wireColor, DEFAULT_PRIMITIVE3D_PARAMS.material.wireColor),
            wireOpacity: clamp(material.wireOpacity, 0, 1, DEFAULT_PRIMITIVE3D_PARAMS.material.wireOpacity),
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
        words: {
            enabled: words.enabled === true,
            windowSize: clamp(words.windowSize, 1, 24, DEFAULT_PRIMITIVE3D_PARAMS.words.windowSize),
            punctuationMode,
            worldSize: clamp(words.worldSize, 0.05, 6, DEFAULT_PRIMITIVE3D_PARAMS.words.worldSize),
            radialOffset: clamp(words.radialOffset, -4, 4, DEFAULT_PRIMITIVE3D_PARAMS.words.radialOffset),
        },
        billboard: {
            enabled: billboard.enabled !== false,
            rotationOffsetX: clamp(billboard.rotationOffsetX, -180, 180, DEFAULT_PRIMITIVE3D_PARAMS.billboard.rotationOffsetX),
            rotationOffsetY: clamp(billboard.rotationOffsetY, -180, 180, DEFAULT_PRIMITIVE3D_PARAMS.billboard.rotationOffsetY),
            rotationOffsetZ: clamp(billboard.rotationOffsetZ, -180, 180, DEFAULT_PRIMITIVE3D_PARAMS.billboard.rotationOffsetZ),
        },
        reaction: {
            activePointOffsetX: clamp(reaction.activePointOffsetX ?? reaction.rotateByWordIndexX, -180, 180, DEFAULT_PRIMITIVE3D_PARAMS.reaction.activePointOffsetX),
            activePointOffsetY: clamp(reaction.activePointOffsetY ?? reaction.rotateByWordIndexY, -180, 180, DEFAULT_PRIMITIVE3D_PARAMS.reaction.activePointOffsetY),
            activePointOffsetZ: clamp(reaction.activePointOffsetZ ?? reaction.rotateByWordIndexZ, -180, 180, DEFAULT_PRIMITIVE3D_PARAMS.reaction.activePointOffsetZ),
            smoothFacing: reaction.smoothFacing !== false,
            smoothStrength: clamp(reaction.smoothStrength, 0.01, 1, DEFAULT_PRIMITIVE3D_PARAMS.reaction.smoothStrength),
        },
        textReveal,
    };
};
