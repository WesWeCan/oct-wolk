import {
    AmbientLight,
    Box3,
    BoxGeometry,
    CapsuleGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DodecahedronGeometry,
    DirectionalLight,
    DoubleSide,
    FrontSide,
    IcosahedronGeometry,
    MathUtils,
    Mesh,
    MeshStandardMaterial,
    OctahedronGeometry,
    PerspectiveCamera,
    PlaneGeometry,
    Scene,
    SphereGeometry,
    TetrahedronGeometry,
    TorusGeometry,
    Vector3,
    WebGLRenderer,
} from 'three';
import type { MotionBlock } from '@/types/project_types';
import type { MotionBlockRenderer, MotionRenderContext, RendererBounds, ResolvedItem } from '@/front-end/motion-blocks/core/types';
import { resolvePrimitive3DParams } from '@/front-end/motion-blocks/primitive3d/params';
import { normalizeScene3DSettings } from '@/front-end/utils/projectScene3D';

const STATIC_CAMERA_FOV = 36;

const clamp01 = (value: unknown, fallback = 1): number => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(1, numeric));
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
    private ambientLight: AmbientLight | null = null;
    private directionalLight: DirectionalLight | null = null;
    private webglAvailable = true;
    private lastGeometryKey = '';
    private lastBounds: RendererBounds | null = null;

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
            this.mesh = new Mesh(new SphereGeometry(1, 48, 48), this.material);
            this.scene.add(this.mesh);

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
        if (!this.mesh) return;

        const nextKey = `${params.primitive.type}:${params.primitive.sphereSegments}:${params.primitive.planeWidth}:${params.primitive.planeHeight}`;
        if (nextKey === this.lastGeometryKey) return;

        const previous = this.mesh.geometry;
        switch (params.primitive.type) {
        case 'box':
            this.mesh.geometry = new BoxGeometry(2, 2, 2);
            break;
        case 'plane':
            this.mesh.geometry = new PlaneGeometry(params.primitive.planeWidth, params.primitive.planeHeight, 1, 1);
            break;
        case 'cylinder':
            this.mesh.geometry = new CylinderGeometry(1, 1, 2, 48, 1);
            break;
        case 'cone':
            this.mesh.geometry = new ConeGeometry(1, 2, 48, 1);
            break;
        case 'torus':
            this.mesh.geometry = new TorusGeometry(1, 0.35, 24, 64);
            break;
        case 'icosahedron':
            this.mesh.geometry = new IcosahedronGeometry(1.25, 0);
            break;
        case 'capsule':
            this.mesh.geometry = new CapsuleGeometry(0.7, 1.4, 8, 16);
            break;
        case 'tetrahedron':
            this.mesh.geometry = new TetrahedronGeometry(1.4, 0);
            break;
        case 'octahedron':
            this.mesh.geometry = new OctahedronGeometry(1.3, 0);
            break;
        case 'dodecahedron':
            this.mesh.geometry = new DodecahedronGeometry(1.2, 0);
            break;
        default:
            this.mesh.geometry = new SphereGeometry(1, params.primitive.sphereSegments, params.primitive.sphereSegments);
            break;
        }
        previous?.dispose();
        this.lastGeometryKey = nextKey;
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

    private applyMesh(params: ReturnType<typeof resolvePrimitive3DParams>): void {
        if (!this.mesh || !this.material) return;

        this.ensureGeometry(params);
        this.mesh.position.set(params.object.positionX, params.object.positionY, params.object.positionZ);
        this.mesh.rotation.set(
            MathUtils.degToRad(params.object.rotationX),
            MathUtils.degToRad(params.object.rotationY),
            MathUtils.degToRad(params.object.rotationZ),
        );
        this.mesh.scale.setScalar(params.object.scale);

        this.material.color = new Color(params.material.color);
        this.material.roughness = params.material.roughness;
        this.material.metalness = params.material.metalness;
        this.material.opacity = params.material.opacity;
        this.material.transparent = params.material.opacity < 1;
        this.material.side = params.primitive.type === 'plane' ? DoubleSide : FrontSide;
        this.material.needsUpdate = true;
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
        const centerX = (viewportWidth / 2) + (params.object.positionX * viewportWidth * 0.08);
        const centerY = (viewportHeight / 2) - (params.object.positionY * viewportHeight * 0.08);

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(MathUtils.degToRad(params.object.rotationZ));
        ctx.globalAlpha = combinedOpacity;
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        if (typeof (ctx as any).ellipse === 'function') {
            (ctx as any).ellipse(0, projectedSize * 0.42, projectedSize * 0.62, projectedSize * 0.22, 0, 0, Math.PI * 2);
        } else {
            ctx.arc(0, projectedSize * 0.42, projectedSize * 0.35, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.fillStyle = fill;

        if (params.primitive.type === 'box') {
            ctx.fillRect(-(projectedSize / 2), -(projectedSize / 2), projectedSize, projectedSize);
        } else if (params.primitive.type === 'plane') {
            ctx.fillRect(-(projectedSize * 0.75), -(projectedSize * 0.5), projectedSize * 1.5, projectedSize);
        } else if (params.primitive.type === 'cylinder' || params.primitive.type === 'capsule') {
            ctx.fillRect(-(projectedSize * 0.32), -(projectedSize * 0.6), projectedSize * 0.64, projectedSize * 1.2);
        } else if (params.primitive.type === 'cone') {
            ctx.beginPath();
            ctx.moveTo(0, -(projectedSize * 0.65));
            ctx.lineTo(projectedSize * 0.55, projectedSize * 0.55);
            ctx.lineTo(-(projectedSize * 0.55), projectedSize * 0.55);
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
                const x = Math.cos(angle) * projectedSize * 0.55;
                const y = Math.sin(angle) * projectedSize * 0.55;
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        } else if (params.primitive.type === 'torus') {
            if (typeof (ctx as any).ellipse === 'function') {
                (ctx as any).ellipse(0, 0, projectedSize * 0.52, projectedSize * 0.52, 0, 0, Math.PI * 2);
                ctx.lineWidth = Math.max(6, projectedSize * 0.18);
                ctx.strokeStyle = fill;
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, projectedSize * 0.42, 0, Math.PI * 2);
                ctx.strokeStyle = fill;
                ctx.lineWidth = Math.max(6, projectedSize * 0.18);
                ctx.stroke();
            }
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, projectedSize / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        return buildRendererBoundsFromRect(
            centerX - (projectedSize / 2),
            centerY - (projectedSize / 2),
            projectedSize,
            projectedSize,
        );
    }

    render(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        activeItems: ResolvedItem[],
        context: MotionRenderContext,
        animatedProps: Record<string, any>,
    ): void {
        const item = activeItems[0];
        if (!item) {
            this.lastBounds = null;
            return;
        }

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
        const combinedOpacity = clamp01(item.style.globalOpacity ?? item.style.opacity ?? 1, 1);

        this.ensureScene();
        let projectedBounds: RendererBounds | null = null;

        if (this.scene && this.camera && this.renderer && this.mesh) {
            try {
                this.applyMesh(params);
                this.applyLighting(context, params);
                this.applyCamera(params, viewportWidth, viewportHeight);
                this.mesh.updateMatrixWorld(true);
                this.camera.updateMatrixWorld(true);
                this.renderer.setClearAlpha(0);
                this.renderer.render(this.scene, this.camera);

                ctx.save();
                ctx.globalAlpha = combinedOpacity;
                ctx.drawImage(this.renderer.domElement, 0, 0, viewportWidth, viewportHeight);
                ctx.restore();

                const worldBounds = new Box3().setFromObject(this.mesh);
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
        this.mesh?.geometry?.dispose();
        this.material?.dispose();
        this.renderer?.dispose();
        this.mesh = null;
        this.material = null;
        this.ambientLight = null;
        this.directionalLight = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.lastBounds = null;
        this.lastGeometryKey = '';
    }
}
