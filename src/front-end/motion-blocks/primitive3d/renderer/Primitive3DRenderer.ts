import {
    AmbientLight,
    Box3,
    CanvasTexture,
    Color,
    Group,
    DirectionalLight,
    DoubleSide,
    Euler,
    FrontSide,
    Mesh,
    LinearFilter,
    MathUtils,
    MeshBasicMaterial,
    MeshStandardMaterial,
    Object3D,
    PerspectiveCamera,
    PlaneGeometry,
    Quaternion,
    Scene,
    Texture,
    TextureLoader,
    Vector3,
    WebGLRenderer,
} from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import type { MotionBlock, MotionStyle } from '@/types/project_types';
import type { MotionBlockRenderer, MotionRenderContext, RendererBounds, ResolvedItem } from '@/front-end/motion-blocks/core/types';
import { getPrimitive3DAnchorPoints } from '@/front-end/motion-blocks/primitive3d/anchor-points';
import { createPrimitive3DGeometry, getPrimitive3DGeometryKey } from '@/front-end/motion-blocks/primitive3d/geometry';
import { DEFAULT_PRIMITIVE3D_PARAMS, resolvePrimitive3DParams } from '@/front-end/motion-blocks/primitive3d/params';
import { createNormalizedPrimitive3DModelGroup } from '@/front-end/motion-blocks/primitive3d/model-utils';
import { applyEnterExitToAlpha, applyEnterExitToTransform } from '@/front-end/utils/motion/enterExitAnimation';
import { buildFont } from '@/front-end/utils/motion/renderTipTapSpans';
import { applyTextRevealToSpans, textRevealConfigFromParams } from '@/front-end/utils/motion/textReveal';
import { normalizeScene3DSettings } from '@/front-end/utils/projectScene3D';

const STATIC_CAMERA_FOV = 36;

const clamp01 = (value: unknown, fallback = 1): number => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(1, numeric));
};

const getFallbackShapeSize = (params: ReturnType<typeof resolvePrimitive3DParams>): { width: number; height: number } => {
    switch (params.primitive.type) {
    case 'box':
        return { width: params.primitive.boxWidth, height: params.primitive.boxHeight };
    case 'plane':
        return { width: params.primitive.planeWidth, height: params.primitive.planeHeight };
    case 'cylinder':
        return {
            width: Math.max(params.primitive.cylinderRadiusTop, params.primitive.cylinderRadiusBottom) * 2,
            height: params.primitive.cylinderHeight,
        };
    case 'cone':
        return { width: params.primitive.coneRadius * 2, height: params.primitive.coneHeight };
    case 'torus':
        return {
            width: (params.primitive.torusRadius * 2) + (params.primitive.torusTube * 2),
            height: (params.primitive.torusRadius * 2) + (params.primitive.torusTube * 2),
        };
    case 'capsule':
        return {
            width: params.primitive.capsuleRadius * 2,
            height: params.primitive.capsuleLength + (params.primitive.capsuleRadius * 2),
        };
    case 'model':
        return {
            width: params.primitive.modelBoundsWidth,
            height: params.primitive.modelBoundsHeight,
        };
    case 'sphere':
    case 'icosahedron':
    case 'tetrahedron':
    case 'octahedron':
    case 'dodecahedron':
    default:
        return { width: 2, height: 2 };
    }
};

const buildRendererBoundsFromRect = (
    x: number,
    y: number,
    width: number,
    height: number,
): RendererBounds => {
    const nextWidth = Math.max(1, width);
    const nextHeight = Math.max(1, height);
    const referenceX = x + (nextWidth / 2);
    const referenceY = y + (nextHeight / 2);

    return {
        x,
        y,
        width: nextWidth,
        height: nextHeight,
        referenceX,
        referenceY,
        localBoxX: -(nextWidth / 2),
        localBoxY: -(nextHeight / 2),
        localBoxWidth: nextWidth,
        localBoxHeight: nextHeight,
        rotation: 0,
        scale: 1,
    };
};

const buildRendererBoundsFromPoints = (points: Array<{ x: number; y: number }>): RendererBounds | null => {
    if (!points.length) return null;
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    return buildRendererBoundsFromRect(minX, minY, maxX - minX, maxY - minY);
};

export class Primitive3DRenderer implements MotionBlockRenderer {
    private scene: Scene | null = null;
    private camera: PerspectiveCamera | null = null;
    private renderer: WebGLRenderer | null = null;
    private mesh: Mesh | null = null;
    private material: MeshStandardMaterial | null = null;
    private wireMesh: Mesh | null = null;
    private wireMaterial: MeshBasicMaterial | null = null;
    private wordGroup: Group | null = null;
    private wordPlanes: Mesh[] = [];
    private ambientLight: AmbientLight | null = null;
    private directionalLight: DirectionalLight | null = null;
    private webglAvailable = true;
    private lastGeometryKey = '';
    private lastBounds: RendererBounds | null = null;
    private textTextureCache = new Map<string, { texture: CanvasTexture; aspect: number }>();
    private smoothedQuaternion: Quaternion | null = null;
    private modelGroup: Group | null = null;
    private modelSolidGroup: Group | null = null;
    private modelWireGroup: Group | null = null;
    private activeModelUrl = '';
    private modelLoadPromise: Promise<void> | null = null;
    private modelAnchorPoints: Vector3[] = [];
    private modelBaseTextureUrl = '';
    private modelBaseTexture: Texture | null = null;
    private modelBaseTexturePromise: Promise<void> | null = null;
    private modelNormalTextureUrl = '';
    private modelNormalTexture: Texture | null = null;
    private modelNormalTexturePromise: Promise<void> | null = null;
    private readonly textureLoader = new TextureLoader();

    prepare(_block: MotionBlock): void {
        return;
    }

    private ensureScene(): void {
        if (this.scene || !this.webglAvailable || typeof document === 'undefined') return;

        try {
            const renderer = new WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance',
                preserveDrawingBuffer: true,
            });
            renderer.setClearAlpha(0);

            this.scene = new Scene();
            this.camera = new PerspectiveCamera(STATIC_CAMERA_FOV, 1, 0.1, 100);
            this.material = new MeshStandardMaterial({ color: '#9bc8ff', roughness: 0.32, metalness: 0.16, transparent: true });
            this.mesh = new Mesh(createPrimitive3DGeometry(DEFAULT_PRIMITIVE3D_PARAMS.primitive), this.material);
            this.wireMaterial = new MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.7 });
            this.wireMesh = new Mesh(this.mesh.geometry, this.wireMaterial);
            this.modelGroup = new Group();
            this.modelSolidGroup = new Group();
            this.modelWireGroup = new Group();
            this.modelGroup.add(this.modelSolidGroup);
            this.modelGroup.add(this.modelWireGroup);
            this.modelGroup.visible = false;
            this.wordGroup = new Group();
            this.scene.add(this.mesh);
            this.scene.add(this.wireMesh);
            this.scene.add(this.modelGroup);
            this.scene.add(this.wordGroup);

            this.ambientLight = new AmbientLight('#ffffff', 0.45);
            this.directionalLight = new DirectionalLight('#ffffff', 1.2);
            this.scene.add(this.ambientLight);
            this.scene.add(this.directionalLight);
            this.renderer = renderer;
        } catch {
            this.webglAvailable = false;
            this.dispose();
        }
    }

    private ensureGeometry(params: ReturnType<typeof resolvePrimitive3DParams>): void {
        if (!this.mesh || !this.wireMesh) return;

        const nextKey = getPrimitive3DGeometryKey(params.primitive);
        if (nextKey === this.lastGeometryKey) return;

        const previous = this.mesh.geometry;
        const nextGeometry = createPrimitive3DGeometry(params.primitive);
        this.mesh.geometry = nextGeometry;
        this.wireMesh.geometry = nextGeometry;
        previous?.dispose();
        this.lastGeometryKey = nextKey;
    }

    private disposeObjectTree(root: Object3D): void {
        root.traverse((child) => {
            if (!(child instanceof Mesh)) return;
            child.geometry?.dispose();
            if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
            else child.material?.dispose();
        });
    }

    private clearModelGroups(): void {
        if (this.modelSolidGroup) {
            for (const child of [...this.modelSolidGroup.children]) {
                this.disposeObjectTree(child);
                this.modelSolidGroup.remove(child);
            }
        }
        if (this.modelWireGroup) {
            for (const child of [...this.modelWireGroup.children]) {
                this.disposeObjectTree(child);
                this.modelWireGroup.remove(child);
            }
        }
        this.modelAnchorPoints = [];
    }

    private buildModelVariant(source: Group, variant: 'solid' | 'wire'): Group {
        const clone = source.clone(true);
        clone.traverse((child) => {
            if (!(child instanceof Mesh)) return;
            child.geometry = child.geometry.clone();
            if (!child.geometry.getAttribute('normal')) child.geometry.computeVertexNormals();
            child.material = variant === 'solid'
                ? new MeshStandardMaterial({ transparent: true })
                : new MeshBasicMaterial({ wireframe: true, transparent: true });
        });
        return clone;
    }

    private async loadModel(url: string): Promise<void> {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch OBJ: ${response.status}`);
            const text = await response.text();
            if (this.activeModelUrl !== url) return;

            const parsed = new OBJLoader().parse(text);
            const { group, metadata } = createNormalizedPrimitive3DModelGroup(parsed);
            const solidVariant = this.buildModelVariant(group, 'solid');
            const wireVariant = this.buildModelVariant(group, 'wire');
            this.clearModelGroups();
            this.modelSolidGroup?.add(solidVariant);
            this.modelWireGroup?.add(wireVariant);
            this.modelAnchorPoints = metadata.anchorPoints.map((point) => new Vector3(point.x, point.y, point.z));
        } catch {
            if (this.activeModelUrl === url) this.clearModelGroups();
        } finally {
            if (this.activeModelUrl === url) this.modelLoadPromise = null;
        }
    }

    private ensureModel(params: ReturnType<typeof resolvePrimitive3DParams>): void {
        if (!this.modelGroup) return;
        const nextUrl = params.primitive.modelObjUrl;
        if (!nextUrl) {
            if (this.activeModelUrl) this.clearModelGroups();
            this.activeModelUrl = '';
            this.modelGroup.visible = false;
            this.modelLoadPromise = null;
            return;
        }
        if (this.activeModelUrl === nextUrl && (this.modelLoadPromise || this.modelSolidGroup?.children.length)) return;

        this.activeModelUrl = nextUrl;
        this.modelLoadPromise = this.loadModel(nextUrl);
    }

    private async loadTexture(url: string, target: 'base' | 'normal'): Promise<void> {
        try {
            const texture = await this.textureLoader.loadAsync(url);
            if (target === 'base') {
                if (this.modelBaseTextureUrl !== url) {
                    texture.dispose();
                    return;
                }
                this.modelBaseTexture?.dispose();
                this.modelBaseTexture = texture;
                this.modelBaseTexturePromise = null;
                return;
            }

            if (this.modelNormalTextureUrl !== url) {
                texture.dispose();
                return;
            }
            this.modelNormalTexture?.dispose();
            this.modelNormalTexture = texture;
            this.modelNormalTexturePromise = null;
        } catch {
            if (target === 'base' && this.modelBaseTextureUrl === url) this.modelBaseTexturePromise = null;
            if (target === 'normal' && this.modelNormalTextureUrl === url) this.modelNormalTexturePromise = null;
        }
    }

    private ensureModelTextures(params: ReturnType<typeof resolvePrimitive3DParams>): void {
        if (params.primitive.modelTextureUrl !== this.modelBaseTextureUrl) {
            this.modelBaseTextureUrl = params.primitive.modelTextureUrl;
            this.modelBaseTexture?.dispose();
            this.modelBaseTexture = null;
            this.modelBaseTexturePromise = params.primitive.modelTextureUrl
                ? this.loadTexture(params.primitive.modelTextureUrl, 'base')
                : null;
        }

        if (params.primitive.modelNormalUrl !== this.modelNormalTextureUrl) {
            this.modelNormalTextureUrl = params.primitive.modelNormalUrl;
            this.modelNormalTexture?.dispose();
            this.modelNormalTexture = null;
            this.modelNormalTexturePromise = params.primitive.modelNormalUrl
                ? this.loadTexture(params.primitive.modelNormalUrl, 'normal')
                : null;
        }
    }

    private getObjectQuaternion(
        objectPosition: Vector3,
        params: ReturnType<typeof resolvePrimitive3DParams>,
        activeAnchor: Vector3 | null,
    ): Quaternion {
        const baseQuaternion = new Quaternion().setFromEuler(new Euler(
            MathUtils.degToRad(params.object.rotationX),
            MathUtils.degToRad(params.object.rotationY),
            MathUtils.degToRad(params.object.rotationZ),
            'XYZ',
        ));
        let targetQuaternion = baseQuaternion.clone();
        const shouldFollowActiveWord = params.reaction.enabled && activeAnchor && this.camera && activeAnchor.lengthSq() > 0.000001;
        if (shouldFollowActiveWord) {
            const anchorDirection = activeAnchor.clone().normalize();
            const currentWorldDirection = anchorDirection.clone().applyQuaternion(baseQuaternion).normalize();
            const desiredDirection = this.camera.position.clone().sub(objectPosition).normalize();
            if (desiredDirection.lengthSq() > 0.000001) {
                const alignQuaternion = new Quaternion().setFromUnitVectors(currentWorldDirection, desiredDirection);
                targetQuaternion = alignQuaternion.multiply(baseQuaternion);
            }
        }
        targetQuaternion.multiply(new Quaternion().setFromEuler(new Euler(
            MathUtils.degToRad(params.reaction.activePointOffsetX),
            MathUtils.degToRad(params.reaction.activePointOffsetY),
            MathUtils.degToRad(params.reaction.activePointOffsetZ),
            'XYZ',
        )));
        if (params.reaction.enabled && params.reaction.smoothFacing) {
            if (!this.smoothedQuaternion) this.smoothedQuaternion = targetQuaternion.clone();
            else this.smoothedQuaternion.slerp(targetQuaternion, params.reaction.smoothStrength);
            return this.smoothedQuaternion.clone();
        }
        this.smoothedQuaternion = targetQuaternion.clone();
        return targetQuaternion;
    }

    private applyModelMaterials(params: ReturnType<typeof resolvePrimitive3DParams>): void {
        const useTexture = !!this.modelBaseTexture && params.material.textureMode !== 'color-only';
        const effectiveTextureMode = useTexture ? params.material.textureMode : 'color-only';

        this.modelSolidGroup?.traverse((child) => {
            if (!(child instanceof Mesh) || !(child.material instanceof MeshStandardMaterial)) return;
            child.material.color = new Color(
                effectiveTextureMode === 'texture-only'
                    ? '#ffffff'
                    : params.material.color,
            );
            child.material.roughness = params.material.roughness;
            child.material.metalness = params.material.metalness;
            child.material.opacity = params.material.opacity;
            child.material.transparent = params.material.opacity < 1;
            child.material.side = FrontSide;
            child.material.map = useTexture ? this.modelBaseTexture : null;
            child.material.normalMap = this.modelNormalTexture;
            child.material.needsUpdate = true;
            child.visible = params.material.renderMode !== 'wireframe';
        });

        this.modelWireGroup?.traverse((child) => {
            if (!(child instanceof Mesh) || !(child.material instanceof MeshBasicMaterial)) return;
            child.material.color = new Color(params.material.wireColor);
            child.material.opacity = params.material.wireOpacity;
            child.material.transparent = params.material.wireOpacity < 1;
            child.material.side = FrontSide;
            child.material.needsUpdate = true;
            child.visible = params.material.renderMode !== 'solid';
        });
    }

    private applyCamera(
        params: ReturnType<typeof resolvePrimitive3DParams>,
        viewportWidth: number,
        viewportHeight: number,
    ): void {
        if (!this.camera) return;

        this.camera.aspect = Math.max(1, viewportWidth) / Math.max(1, viewportHeight);
        this.camera.fov = STATIC_CAMERA_FOV;
        this.camera.position.set(0, 0, params.camera.distance);
        this.camera.lookAt(0, 0, 0);
        this.camera.updateProjectionMatrix();
        this.renderer?.setSize(viewportWidth, viewportHeight, false);
    }

    private applyMesh(params: ReturnType<typeof resolvePrimitive3DParams>, activeAnchor: Vector3 | null): void {
        if (!this.mesh || !this.material || !this.wireMesh || !this.wireMaterial) return;

        if (params.primitive.type === 'model') {
            this.ensureModel(params);
            this.ensureModelTextures(params);
            if (!this.modelGroup) return;

            this.mesh.visible = false;
            this.wireMesh.visible = false;
            this.modelGroup.visible = !!params.primitive.modelObjUrl;
            this.modelGroup.position.set(params.object.positionX, params.object.positionY, params.object.positionZ);
            this.modelGroup.quaternion.copy(this.getObjectQuaternion(this.modelGroup.position, params, activeAnchor));
            this.modelGroup.scale.setScalar(params.object.scale);
            this.applyModelMaterials(params);
            return;
        }

        this.modelGroup && (this.modelGroup.visible = false);
        this.ensureGeometry(params);
        this.mesh.position.set(params.object.positionX, params.object.positionY, params.object.positionZ);
        this.mesh.quaternion.copy(this.getObjectQuaternion(this.mesh.position, params, activeAnchor));
        this.mesh.scale.setScalar(params.object.scale);
        this.wireMesh.position.copy(this.mesh.position);
        this.wireMesh.quaternion.copy(this.mesh.quaternion);
        this.wireMesh.scale.copy(this.mesh.scale);

        this.material.color = new Color(params.material.color);
        this.material.roughness = params.material.roughness;
        this.material.metalness = params.material.metalness;
        this.material.opacity = params.material.opacity;
        this.material.transparent = params.material.opacity < 1;
        this.material.side = params.primitive.type === 'plane' ? DoubleSide : FrontSide;
        this.material.map = null;
        this.material.normalMap = null;
        this.material.needsUpdate = true;
        this.material.visible = params.material.renderMode !== 'wireframe';

        this.wireMaterial.color = new Color(params.material.wireColor);
        this.wireMaterial.opacity = params.material.wireOpacity;
        this.wireMaterial.transparent = params.material.wireOpacity < 1;
        this.wireMaterial.side = params.primitive.type === 'plane' ? DoubleSide : FrontSide;
        this.wireMaterial.needsUpdate = true;
        this.wireMesh.visible = params.material.renderMode !== 'solid';
    }

    private computeAutoWordHeight(anchors: Vector3[], params: ReturnType<typeof resolvePrimitive3DParams>): number {
        if (anchors.length === 0) return Math.max(0.05, params.object.scale * 0.25);
        const bounds = new Box3().setFromPoints(anchors);
        const maxExtent = Math.max(
            bounds.max.x - bounds.min.x,
            bounds.max.y - bounds.min.y,
            bounds.max.z - bounds.min.z,
            0.25,
        );
        const densityFactor = maxExtent / Math.sqrt(Math.max(1, anchors.length));
        return Math.max(0.04, densityFactor * 0.35 * params.object.scale);
    }

    private applyLighting(context: MotionRenderContext, params: ReturnType<typeof resolvePrimitive3DParams>): void {
        if (!this.ambientLight || !this.directionalLight) return;

        const scene3d = normalizeScene3DSettings(context.project.scene3d);
        const lighting = params.lighting.mode === 'global' ? scene3d.globalLighting : params.lighting;

        this.ambientLight.color = new Color(lighting.ambientColor);
        this.ambientLight.intensity = lighting.ambientIntensity;
        this.directionalLight.color = new Color(lighting.directionalColor);
        this.directionalLight.intensity = lighting.directionalIntensity;

        const azimuth = MathUtils.degToRad(lighting.directionalAzimuth);
        const elevation = MathUtils.degToRad(lighting.directionalElevation);
        const distance = 8;
        this.directionalLight.position.set(
            Math.cos(elevation) * Math.sin(azimuth) * distance,
            Math.sin(elevation) * distance,
            Math.cos(elevation) * Math.cos(azimuth) * distance,
        );
    }

    private ensureWordPlanes(count: number): void {
        if (!this.wordGroup) return;
        while (this.wordPlanes.length < count) {
            const material = new MeshBasicMaterial({ transparent: true, depthTest: true, depthWrite: false, toneMapped: false });
            const plane = new Mesh(new PlaneGeometry(1, 1), material);
            this.wordPlanes.push(plane);
            this.wordGroup.add(plane);
        }
        for (let index = 0; index < this.wordPlanes.length; index += 1) {
            this.wordPlanes[index]!.visible = index < count;
        }
    }

    private applyTextCase(text: string, textCase: MotionStyle['textCase']): string {
        switch (textCase) {
        case 'uppercase':
            return text.toUpperCase();
        case 'lowercase':
            return text.toLowerCase();
        case 'capitalize':
            return text.replace(/\b\w/g, (char) => char.toUpperCase());
        default:
            return text;
        }
    }

    private getTextTexture(text: string, style: MotionStyle) {
        if (typeof document === 'undefined') return null;
        const normalizedText = this.applyTextCase(text, style.textCase);
        const cacheKey = JSON.stringify({
            normalizedText,
            fontFamily: style.fontFamily,
            fontFallbacks: style.fontFallbacks,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            fontSize: style.fontSize,
            color: style.color,
            backgroundColor: style.backgroundColor,
            backgroundOpacity: style.backgroundOpacity,
            backgroundPadding: style.backgroundPadding,
            backgroundBorderRadius: style.backgroundBorderRadius,
            outlineWidth: style.outlineWidth,
            outlineColor: style.outlineColor,
        });
        const cached = this.textTextureCache.get(cacheKey);
        if (cached) return cached;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        const font = buildFont(style, { text: normalizedText });
        ctx.font = font;
        const padding = Number(style.backgroundPadding ?? 0);
        const outlineWidth = Number(style.outlineWidth ?? 0);
        const metrics = ctx.measureText(normalizedText);
        const fontSize = Number(style.fontSize ?? 72);
        const textWidth = Math.max(1, Math.ceil(metrics.width));
        const textHeight = Math.max(1, Math.ceil(fontSize * 1.2));
        const pixelRatio = 2;
        canvas.width = Math.ceil((textWidth + (padding * 2) + (outlineWidth * 2) + 8) * pixelRatio);
        canvas.height = Math.ceil((textHeight + (padding * 2) + (outlineWidth * 2) + 8) * pixelRatio);
        ctx.scale(pixelRatio, pixelRatio);
        ctx.font = font;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        const drawWidth = canvas.width / pixelRatio;
        const drawHeight = canvas.height / pixelRatio;
        const centerX = drawWidth / 2;
        const centerY = drawHeight / 2;
        const bgOpacity = Number(style.backgroundOpacity ?? 0);
        if (style.backgroundColor && bgOpacity > 0) {
            ctx.fillStyle = new Color(style.backgroundColor).getStyle();
            ctx.globalAlpha = bgOpacity;
            const x = outlineWidth;
            const y = outlineWidth;
            const width = drawWidth - (outlineWidth * 2);
            const height = drawHeight - (outlineWidth * 2);
            if (typeof (ctx as any).roundRect === 'function') {
                ctx.beginPath();
                (ctx as any).roundRect(x, y, width, height, Number(style.backgroundBorderRadius ?? 0));
                ctx.fill();
            } else {
                ctx.fillRect(x, y, width, height);
            }
            ctx.globalAlpha = 1;
        }
        if (outlineWidth > 0) {
            ctx.strokeStyle = style.outlineColor || '#000000';
            ctx.lineWidth = outlineWidth;
            ctx.lineJoin = 'round';
            ctx.strokeText(normalizedText, centerX, centerY);
        }
        ctx.fillStyle = style.color || '#ffffff';
        ctx.fillText(normalizedText, centerX, centerY);

        const texture = new CanvasTexture(canvas);
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        texture.needsUpdate = true;
        const result = {
            texture,
            aspect: drawWidth / Math.max(1, drawHeight),
        };
        this.textTextureCache.set(cacheKey, result);
        return result;
    }

    private resolveVisibleWordText(item: ResolvedItem, params: ReturnType<typeof resolvePrimitive3DParams>): string {
        const revealResult = applyTextRevealToSpans(
            [{ text: item.text }],
            item.textRevealEnterProgress ?? item.enterProgress,
            item.textRevealExitProgress ?? item.exitProgress,
            textRevealConfigFromParams(params.textReveal, item.enter, item.exit),
        );
        const visibleText = revealResult.spans.map((span) => span.text).join('');
        if (revealResult.cursorCharIndex !== null) return `${visibleText}|`;
        return visibleText;
    }

    private applyWordPlanes(
        activeItems: ResolvedItem[],
        params: ReturnType<typeof resolvePrimitive3DParams>,
        anchors: Vector3[],
        viewportWidth: number,
        viewportHeight: number,
    ): void {
        const anchorRoot = params.primitive.type === 'model' ? this.modelGroup : this.mesh;
        if (!this.wordGroup || !this.camera || !anchorRoot) return;
        if (!params.words.enabled || activeItems.length === 0) {
            this.ensureWordPlanes(0);
            return;
        }

        const visibleItems = activeItems
            .slice()
            .sort((a, b) => {
                const indexA = Number(a.richText?.primitive3dWord?.sourceIndex ?? 0);
                const indexB = Number(b.richText?.primitive3dWord?.sourceIndex ?? 0);
                return indexA - indexB;
            });
        this.ensureWordPlanes(visibleItems.length);

        const cameraRight = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
        const cameraUp = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();
        const offsetQuaternion = new Quaternion().setFromEuler(new Euler(
            MathUtils.degToRad(params.billboard.rotationOffsetX),
            MathUtils.degToRad(params.billboard.rotationOffsetY),
            MathUtils.degToRad(params.billboard.rotationOffsetZ),
            'XYZ',
        ));
        const autoWordHeight = this.computeAutoWordHeight(anchors, params);

        visibleItems.forEach((item, index) => {
            const plane = this.wordPlanes[index]!;
            const material = plane.material as MeshBasicMaterial;
            const metadata = item.richText?.primitive3dWord || {};
            const slotIndex = Number(metadata.slotIndex ?? index) % Math.max(1, anchors.length);
            const anchor = anchors[slotIndex] ? anchors[slotIndex]!.clone() : new Vector3();
            const normal = anchor.clone().normalize();
            const worldPosition = anchorRoot.localToWorld(anchor.add(normal.multiplyScalar(params.words.radialOffset)));
            const transform = applyEnterExitToTransform(item.enterProgress, item.exitProgress, item.enter, item.exit);
            const distance = this.camera!.position.distanceTo(worldPosition);
            const worldHeight = 2 * Math.tan(MathUtils.degToRad(this.camera!.fov / 2)) * distance;
            const pixelsToWorld = worldHeight / Math.max(1, viewportHeight);
            worldPosition
                .add(cameraRight.clone().multiplyScalar(transform.translateX * pixelsToWorld))
                .add(cameraUp.clone().multiplyScalar(-transform.translateY * pixelsToWorld));

            const visibleText = this.resolveVisibleWordText(item, params);
            const textureEntry = visibleText ? this.getTextTexture(visibleText, item.style) : null;
            if (textureEntry) {
                material.map = textureEntry.texture;
                material.needsUpdate = true;
                plane.position.copy(worldPosition);
                if (params.billboard.enabled) plane.quaternion.copy(this.camera!.quaternion).multiply(offsetQuaternion);
                else plane.quaternion.copy(offsetQuaternion);
                const alpha = clamp01(
                    applyEnterExitToAlpha(item.enterProgress, item.exitProgress, item.enter, item.exit)
                    * Number(item.style.opacity ?? 1)
                    * Number(item.style.globalOpacity ?? 1),
                    1,
                );
                material.opacity = alpha;
                const height = Math.max(0.02, autoWordHeight * params.words.worldSize * transform.scale);
                plane.scale.set(height * textureEntry.aspect, height, 1);
                plane.visible = alpha > 0;
            } else {
                plane.visible = false;
            }
        });
    }

    private drawVisibleFallback(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        params: ReturnType<typeof resolvePrimitive3DParams>,
        viewportWidth: number,
        viewportHeight: number,
        combinedOpacity: number,
    ): RendererBounds {
        const lighting = params.lighting.mode === 'local'
            ? params.lighting
            : normalizeScene3DSettings({}).globalLighting;
        const fill = new Color(params.material.color)
            .multiplyScalar(Math.max(0.35, Math.min(1.5, lighting.ambientIntensity + (lighting.directionalIntensity * 0.25))))
            .getStyle();

        const baseSize = Math.min(viewportWidth, viewportHeight) * 0.45;
        const effectiveDistance = Math.max(1, params.camera.distance - params.object.positionZ);
        const projectedSize = baseSize * params.object.scale * (5.5 / effectiveDistance);
        const shapeSize = getFallbackShapeSize(params);
        const maxShapeDimension = Math.max(shapeSize.width, shapeSize.height, 0.0001);
        const projectedWidth = projectedSize * (shapeSize.width / maxShapeDimension);
        const projectedHeight = projectedSize * (shapeSize.height / maxShapeDimension);
        const centerX = (viewportWidth / 2) + (params.object.positionX * viewportWidth * 0.08);
        const centerY = (viewportHeight / 2) - (params.object.positionY * viewportHeight * 0.08);

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(MathUtils.degToRad(params.object.rotationZ));
        ctx.globalAlpha = combinedOpacity;
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        if (typeof (ctx as any).ellipse === 'function') {
            (ctx as any).ellipse(0, projectedHeight * 0.42, projectedWidth * 0.62, projectedHeight * 0.22, 0, 0, Math.PI * 2);
        } else {
            ctx.arc(0, projectedHeight * 0.42, Math.max(projectedWidth, projectedHeight) * 0.35, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.fillStyle = fill;

        if (params.primitive.type === 'box') {
            ctx.fillRect(-(projectedWidth / 2), -(projectedHeight / 2), projectedWidth, projectedHeight);
        } else if (params.primitive.type === 'plane') {
            ctx.fillRect(-(projectedWidth / 2), -(projectedHeight / 2), projectedWidth, projectedHeight);
        } else if (params.primitive.type === 'cylinder' || params.primitive.type === 'capsule') {
            ctx.fillRect(-(projectedWidth * 0.32), -(projectedHeight * 0.5), projectedWidth * 0.64, projectedHeight);
        } else if (params.primitive.type === 'cone') {
            ctx.beginPath();
            ctx.moveTo(0, -(projectedHeight / 2));
            ctx.lineTo(projectedWidth / 2, projectedHeight / 2);
            ctx.lineTo(-(projectedWidth / 2), projectedHeight / 2);
            ctx.closePath();
            ctx.fill();
        } else if (
            params.primitive.type === 'icosahedron'
            || params.primitive.type === 'tetrahedron'
            || params.primitive.type === 'octahedron'
            || params.primitive.type === 'dodecahedron'
        ) {
            const sides = params.primitive.type === 'tetrahedron'
                ? 3
                : params.primitive.type === 'octahedron'
                    ? 4
                    : params.primitive.type === 'dodecahedron'
                        ? 5
                        : 6;
            ctx.beginPath();
            for (let index = 0; index < sides; index += 1) {
                const angle = ((Math.PI * 2) / sides) * index - (Math.PI / 2);
                const x = Math.cos(angle) * projectedWidth * 0.55;
                const y = Math.sin(angle) * projectedHeight * 0.55;
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        } else if (params.primitive.type === 'torus') {
            if (typeof (ctx as any).ellipse === 'function') {
                (ctx as any).ellipse(0, 0, projectedWidth * 0.5, projectedHeight * 0.5, 0, 0, Math.PI * 2);
                ctx.lineWidth = Math.max(6, Math.min(projectedWidth, projectedHeight) * (params.primitive.torusTube / Math.max(0.01, params.primitive.torusRadius + params.primitive.torusTube)));
                ctx.strokeStyle = fill;
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, Math.min(projectedWidth, projectedHeight) * 0.42, 0, Math.PI * 2);
                ctx.strokeStyle = fill;
                ctx.lineWidth = Math.max(6, Math.min(projectedWidth, projectedHeight) * 0.18);
                ctx.stroke();
            }
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, Math.min(projectedWidth, projectedHeight) / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        return buildRendererBoundsFromRect(
            centerX - (projectedWidth / 2),
            centerY - (projectedHeight / 2),
            projectedWidth,
            projectedHeight,
        );
    }

    render(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        activeItems: ResolvedItem[],
        context: MotionRenderContext,
        animatedProps: Record<string, any>,
    ): void {
        const params = resolvePrimitive3DParams({
            ...context.block.params,
            object: {
                ...(context.block.params?.object || {}),
                positionX: animatedProps['params.object.positionX'] ?? context.block.params?.object?.positionX,
                positionY: animatedProps['params.object.positionY'] ?? context.block.params?.object?.positionY,
                positionZ: animatedProps['params.object.positionZ'] ?? context.block.params?.object?.positionZ,
                rotationX: animatedProps['params.object.rotationX'] ?? context.block.params?.object?.rotationX,
                rotationY: animatedProps['params.object.rotationY'] ?? context.block.params?.object?.rotationY,
                rotationZ: animatedProps['params.object.rotationZ'] ?? context.block.params?.object?.rotationZ,
                scale: animatedProps['params.object.scale'] ?? context.block.params?.object?.scale,
            },
            camera: {
                ...(context.block.params?.camera || {}),
                distance: context.block.params?.camera?.distance,
            },
            material: {
                ...(context.block.params?.material || {}),
                roughness: animatedProps['params.material.roughness'] ?? context.block.params?.material?.roughness,
                metalness: animatedProps['params.material.metalness'] ?? context.block.params?.material?.metalness,
                opacity: animatedProps['params.material.opacity'] ?? context.block.params?.material?.opacity,
            },
            lighting: {
                ...(context.block.params?.lighting || {}),
                directionalIntensity: animatedProps['params.lighting.directionalIntensity'] ?? context.block.params?.lighting?.directionalIntensity,
            },
        });
        const viewportWidth = Math.max(1, context.canvasSize.width);
        const viewportHeight = Math.max(1, context.canvasSize.height);
        const combinedOpacity = clamp01(context.block.style.globalOpacity ?? context.block.style.opacity ?? 1, 1);
        const anchors = params.primitive.type === 'model' && this.modelAnchorPoints.length > 0
            ? this.modelAnchorPoints.map((point) => point.clone())
            : getPrimitive3DAnchorPoints(params);
        const activeSlotIndex = Number(activeItems.at(-1)?.richText?.primitive3dWord?.slotIndex ?? -1);
        const activeAnchor = activeSlotIndex >= 0 && activeSlotIndex < anchors.length ? anchors[activeSlotIndex]! : null;

        this.ensureScene();
        let projectedBounds: RendererBounds | null = null;

        if (this.scene && this.camera && this.renderer && this.mesh) {
            try {
                this.applyLighting(context, params);
                this.applyCamera(params, viewportWidth, viewportHeight);
                this.applyMesh(params, activeAnchor);
                const activeObject = params.primitive.type === 'model' ? this.modelGroup : this.mesh;
                activeObject?.updateMatrixWorld(true);
                if (params.primitive.type === 'model') {
                    this.modelSolidGroup?.updateMatrixWorld(true);
                    this.modelWireGroup?.updateMatrixWorld(true);
                } else {
                    this.wireMesh?.updateMatrixWorld(true);
                }
                this.camera.updateMatrixWorld(true);
                this.applyWordPlanes(activeItems, params, anchors, viewportWidth, viewportHeight);
                this.wordGroup?.updateMatrixWorld(true);
                this.renderer.setClearAlpha(0);
                this.renderer.render(this.scene, this.camera);

                ctx.save();
                ctx.globalAlpha = combinedOpacity;
                ctx.drawImage(this.renderer.domElement, 0, 0, viewportWidth, viewportHeight);
                ctx.restore();

                const worldBounds = activeObject ? new Box3().setFromObject(activeObject) : new Box3();
                if (this.wordGroup && this.wordGroup.children.some((child) => child.visible)) {
                    worldBounds.union(new Box3().setFromObject(this.wordGroup));
                }
                if (!worldBounds.isEmpty()) {
                    const corners = [
                        new Vector3(worldBounds.min.x, worldBounds.min.y, worldBounds.min.z),
                        new Vector3(worldBounds.min.x, worldBounds.min.y, worldBounds.max.z),
                        new Vector3(worldBounds.min.x, worldBounds.max.y, worldBounds.min.z),
                        new Vector3(worldBounds.min.x, worldBounds.max.y, worldBounds.max.z),
                        new Vector3(worldBounds.max.x, worldBounds.min.y, worldBounds.min.z),
                        new Vector3(worldBounds.max.x, worldBounds.min.y, worldBounds.max.z),
                        new Vector3(worldBounds.max.x, worldBounds.max.y, worldBounds.min.z),
                        new Vector3(worldBounds.max.x, worldBounds.max.y, worldBounds.max.z),
                    ].map((corner) => corner.project(this.camera!));

                    projectedBounds = buildRendererBoundsFromPoints(
                        corners
                            .map((corner) => ({
                                x: ((corner.x + 1) * 0.5 * viewportWidth),
                                y: (1 - ((corner.y + 1) * 0.5)) * viewportHeight,
                            }))
                            .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
                    );
                }
            } catch {
                projectedBounds = this.drawVisibleFallback(
                    ctx,
                    params,
                    viewportWidth,
                    viewportHeight,
                    combinedOpacity,
                );
                this.webglAvailable = false;
                this.dispose();
            }
        }

        if (!projectedBounds) {
            projectedBounds = this.drawVisibleFallback(
                ctx,
                params,
                viewportWidth,
                viewportHeight,
                combinedOpacity,
            );
        }

        this.lastBounds = projectedBounds;
    }

    getLastBounds(): RendererBounds | null {
        return this.lastBounds;
    }

    dispose(): void {
        this.clearModelGroups();
        this.mesh?.geometry?.dispose();
        this.material?.dispose();
        this.wireMaterial?.dispose();
        this.modelBaseTexture?.dispose();
        this.modelNormalTexture?.dispose();
        for (const plane of this.wordPlanes) {
            plane.geometry.dispose();
            (plane.material as MeshBasicMaterial).dispose();
        }
        for (const cacheEntry of this.textTextureCache.values()) cacheEntry.texture.dispose();
        this.renderer?.dispose();
        this.mesh = null;
        this.material = null;
        this.wireMesh = null;
        this.wireMaterial = null;
        this.modelGroup = null;
        this.modelSolidGroup = null;
        this.modelWireGroup = null;
        this.wordGroup = null;
        this.wordPlanes = [];
        this.ambientLight = null;
        this.directionalLight = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.lastBounds = null;
        this.lastGeometryKey = '';
        this.textTextureCache.clear();
        this.smoothedQuaternion = null;
        this.activeModelUrl = '';
        this.modelLoadPromise = null;
        this.modelAnchorPoints = [];
        this.modelBaseTextureUrl = '';
        this.modelBaseTexture = null;
        this.modelBaseTexturePromise = null;
        this.modelNormalTextureUrl = '';
        this.modelNormalTexture = null;
        this.modelNormalTexturePromise = null;
    }
}
