import type { SceneContext, WorkerScene } from '../engine/types';
import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

export class ModelScene implements WorkerScene {
    private width = 0;
    private height = 0;
    private renderer: any = null; // THREE.WebGLRenderer
    private scene: any = null; // THREE.Scene
    private camera: any = null; // THREE.PerspectiveCamera
    private rootGroup: any = null; // THREE.Group
    private modelGroup: any = null; // THREE.Group
    private glCanvas: OffscreenCanvas | null = null;
    private initialized = false;

    // params
    private objUrl: string | null = null;
    private mtlUrl: string | null = null; // kept optional but UI can restrict; we don't require it
    private diffuseMapUrl: string | null = null;
    private normalMapUrl: string | null = null;
    private rotationRpm: number = 3; // default gentle spin
    private modelScale: number = 1; // user scale multiplier

    initialize(context: SceneContext): void {
        this.width = context.resolution.width;
        this.height = context.resolution.height;
        this.setupThree();
        this.initialized = true;
    }

    configure(params: Record<string, any>): void {
        const p = (params && typeof params === 'object') ? params : {};
        const nextObj = typeof p.modelObjUrl === 'string' ? p.modelObjUrl : null;
        const nextMtl = typeof p.modelMtlUrl === 'string' ? p.modelMtlUrl : null;
        const nextDiffuse = typeof p.diffuseMapUrl === 'string' ? p.diffuseMapUrl : null;
        const nextNormal = typeof p.normalMapUrl === 'string' ? p.normalMapUrl : null;
        const nextScale = Number(p.modelScale);
        const nextRpm = Number(p.rotationRpm);

        const urlsChanged = (this.objUrl !== nextObj) || (this.mtlUrl !== nextMtl) || (this.diffuseMapUrl !== nextDiffuse) || (this.normalMapUrl !== nextNormal);
        if (Number.isFinite(nextScale)) this.modelScale = Math.max(0.001, Number(nextScale));
        if (Number.isFinite(nextRpm)) this.rotationRpm = Math.max(0, Number(nextRpm));

        if (urlsChanged) {
            this.objUrl = nextObj;
            this.mtlUrl = nextMtl;
            this.diffuseMapUrl = nextDiffuse;
            this.normalMapUrl = nextNormal;
            try {
                // Helpful logs to trace param issues
                console.log('[ModelScene] Loading model with params', { obj: this.objUrl, mtl: this.mtlUrl, diffuse: this.diffuseMapUrl, normal: this.normalMapUrl, scale: this.modelScale, rpm: this.rotationRpm });
            } catch {}
            this.loadModel().catch((e) => { try { console.error('[ModelScene] loadModel error', e); } catch {} });
        } else {
            // apply scale change immediately
            try { if (this.modelGroup) this.modelGroup.scale.set(this.modelScale, this.modelScale, this.modelScale); } catch {}
        }
    }

    update(_frame: number, _dt: number, context: SceneContext): void {
        const f = Math.max(0, (context.time?.frame as number) | 0);
        const fps = Math.max(1, (context.time?.fps as number) | 0) || 60;
        const t = f / fps;
        const omega = (this.rotationRpm * Math.PI * 2) / 60; // rad/s
        const angle = omega * t;
        const twoPi = Math.PI * 2;
        if (this.rootGroup) {
            this.rootGroup.rotation.y = angle % twoPi;
        }
    }

    render(target: OffscreenCanvasRenderingContext2D, _context: SceneContext): void {
        if (!this.initialized || !this.renderer || !this.scene || !this.camera) return;
        this.renderer.render(this.scene, this.camera);
        try {
            const src = (this.renderer.domElement as OffscreenCanvas);
            target.drawImage(src, 0, 0, this.width, this.height, 0, 0, this.width, this.height);
        } catch {}
    }

    dispose(): void {
        try { this.disposeGroup(this.modelGroup); } catch {}
        try {
            if (this.renderer) {
                if (typeof this.renderer.dispose === 'function') this.renderer.dispose();
                if (typeof this.renderer.forceContextLoss === 'function') this.renderer.forceContextLoss();
            }
        } catch {}
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.rootGroup = null;
        this.modelGroup = null;
        try { if (this.glCanvas) { (this.glCanvas as any).width = 0; (this.glCanvas as any).height = 0; } } catch {}
        this.glCanvas = null;
        this.initialized = false;
    }

    serialize(): any {
        return {
            modelObjUrl: this.objUrl,
            modelMtlUrl: this.mtlUrl,
            diffuseMapUrl: this.diffuseMapUrl,
            normalMapUrl: this.normalMapUrl,
            modelScale: this.modelScale,
            rotationRpm: this.rotationRpm,
        };
    }

    deserialize(data: any): void {
        try {
            if (typeof data?.modelObjUrl === 'string') this.objUrl = data.modelObjUrl;
            if (typeof data?.modelMtlUrl === 'string') this.mtlUrl = data.modelMtlUrl;
            if (typeof data?.diffuseMapUrl === 'string') this.diffuseMapUrl = data.diffuseMapUrl;
            if (typeof data?.normalMapUrl === 'string') this.normalMapUrl = data.normalMapUrl;
            if (Number.isFinite(data?.modelScale)) this.modelScale = Math.max(0.001, Number(data.modelScale));
            if (Number.isFinite(data?.rotationRpm)) this.rotationRpm = Math.max(0, Number(data.rotationRpm));
        } catch {}
    }

    // --- internals ---
    private setupThree() {
        this.glCanvas = new OffscreenCanvas(Math.max(1, this.width), Math.max(1, this.height));
        const renderer = new THREE.WebGLRenderer({ canvas: this.glCanvas as any, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
        renderer.setSize(this.width, this.height, false);
        renderer.setPixelRatio(1);
        renderer.setClearColor(0x000000, 0);
        try { (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace; } catch {}
        this.renderer = renderer;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, Math.max(1, this.width) / Math.max(1, this.height), 0.1, 100);
        camera.position.set(0, 0, 6);
        camera.lookAt(0, 0, 0);
        this.scene = scene;
        this.camera = camera;

        // Lighting: ambient + directional
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dir = new THREE.DirectionalLight(0xffffff, 1.0);
        dir.position.set(3, 5, 4);
        scene.add(dir);

        this.rootGroup = new THREE.Group();
        scene.add(this.rootGroup);

        const bg = new THREE.Color(0x111111);
        scene.background = bg;
    }

    private async loadModel() {
        if (!this.scene || !this.rootGroup) return;
        // Dispose previous
        if (this.modelGroup) {
            try { this.disposeGroup(this.modelGroup); } catch {}
            try { this.rootGroup.remove(this.modelGroup); } catch {}
            this.modelGroup = null;
        }

        // Prefer OBJ+MTL path.
        if (this.objUrl) {
            const modelGroup = new THREE.Group();
            const diffuse = this.diffuseMapUrl ? await this.loadBitmapTexture(this.diffuseMapUrl, 'diffuse') : null;
            const normal = this.normalMapUrl ? await this.loadBitmapTexture(this.normalMapUrl, 'normal') : null;

            let materials: any = null;
            if (this.mtlUrl) {
                try {
                    const mtlLoader = new MTLLoader();
                    materials = await mtlLoader.loadAsync(this.mtlUrl);
                    if (materials && materials.preload) materials.preload();
                } catch {}
            }
            const objLoader = new OBJLoader();
            if (materials) try { objLoader.setMaterials(materials); } catch {}
            let objRoot: any = null;
            try {
                objRoot = await objLoader.loadAsync(this.objUrl);
            } catch (e) {
                try { console.error('[ModelScene] OBJ load failed', e); } catch {}
                return;
            }
            // If custom textures are provided, apply them to materials
            if (diffuse || normal) {
                objRoot.traverse((child: any) => {
                    if (child && child.isMesh && child.material) {
                        const mat: any = child.material;
                        // Ensure a standard material to support normal/roughness/maps
                        if (!('isMeshStandardMaterial' in mat)) {
                        const std = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
                            // Try to preserve basic properties
                            try { if (mat.color) std.color.copy(mat.color); } catch {}
                            try { if (mat.opacity != null) { std.opacity = mat.opacity; std.transparent = mat.transparent || std.opacity < 1; } } catch {}
                            child.material = std;
                        }
                        const stdMat: any = child.material;
                        if (diffuse) { stdMat.map = diffuse; stdMat.needsUpdate = true; }
                        if (normal) { stdMat.normalMap = normal; stdMat.needsUpdate = true; }
                        try { stdMat.roughness = 0.6; stdMat.metalness = 0.0; } catch {}
                    }
                });
            }
            modelGroup.add(objRoot);
            this.centerAndScaleToFit(modelGroup);
            // Improve default orientation: try to align model up-axis to Y if possible
            try {
                // If the model seems very flat on Y, rotate X by -90° (common Z-up OBJ)
                const bbox = new THREE.Box3().setFromObject(modelGroup);
                const size = new THREE.Vector3();
                bbox.getSize(size);
                if (size.y < Math.min(size.x, size.z) * 0.4) {
                    modelGroup.rotation.x = -Math.PI / 2;
                }
            } catch {}
            modelGroup.scale.set(this.modelScale, this.modelScale, this.modelScale);
            this.modelGroup = modelGroup;
            this.rootGroup.add(modelGroup);
            return;
        }
        // Fallback: if no OBJ, nothing to load for now.
    }

    private async loadBitmapTexture(url: string, kind: 'diffuse' | 'normal'): Promise<THREE.Texture | null> {
        try {
            const resp = await fetch(url);
            if (!resp.ok) return null;
            const blob = await resp.blob();
            // flipY here, then set texture.flipY = false to avoid double flip in WebGL
            const bmp = await (globalThis as any).createImageBitmap(blob, { imageOrientation: 'flipY' });
            const tex = new THREE.Texture(bmp as any);
            tex.needsUpdate = true;
            try { (tex as any).colorSpace = kind === 'diffuse' ? (THREE as any).SRGBColorSpace : (THREE as any).NoColorSpace; } catch {}
            tex.flipY = false;
            tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            return tex;
        } catch (e) {
            try { console.error('[ModelScene] loadBitmapTexture failed', kind, url, e); } catch {}
            return null;
        }
    }

    private centerAndScaleToFit(group: THREE.Group) {
        // Compute bounds
        const box = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);
        // Center to origin
        group.position.x -= center.x;
        group.position.y -= center.y;
        group.position.z -= center.z;
        // Scale to fit a target radius
        const maxDim = Math.max(1e-6, Math.max(size.x, Math.max(size.y, size.z)));
        const target = 2.0; // fit within ~2 units radius
        const s = target / maxDim;
        group.scale.setScalar(s);
    }

    private disposeGroup(group: any) {
        if (!group) return;
        const children = [...group.children];
        for (const obj of children) {
            try {
                if ((obj as any).material && (obj as any).material.dispose) (obj as any).material.dispose();
            } catch {}
            try {
                const mat: any = (obj as any).material;
                if (mat && mat.map && typeof mat.map.dispose === 'function') mat.map.dispose();
                if (mat && mat.normalMap && typeof mat.normalMap.dispose === 'function') mat.normalMap.dispose();
            } catch {}
            try { if ((obj as any).geometry && (obj as any).geometry.dispose) (obj as any).geometry.dispose(); } catch {}
            try { group.remove(obj); } catch {}
        }
    }
}


