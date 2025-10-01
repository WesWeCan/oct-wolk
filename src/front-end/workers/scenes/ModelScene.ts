import type { SceneContext, WorkerScene } from '../engine/types';
import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

export const MODEL_SCENE_ANIMATABLES = [
    { path: 'model.scale', label: 'Scale', type: 'number', min: 0.001, max: 10, default: 1 },
    { path: 'model.rotationRPM', label: 'Rotation RPM', type: 'vec3', default: [0, 15, 0], perAxis: true }
];

export class ModelScene implements WorkerScene {
    private width = 0;
    private height = 0;
    private renderer: any = null; // THREE.WebGLRenderer
    private scene: any = null; // THREE.Scene
    private camera: any = null; // THREE.PerspectiveCamera
    private rootGroup: any = null; // THREE.Group
    private modelGroup: any = null; // THREE.Group
    private overlayGroup: any = null; // THREE.Group (labels + plexus)
    private labelGroup: any = null; // THREE.Group
    private plexusGroup: any = null; // THREE.Group
    private spokeGroup: any = null; // THREE.Group (label -> model spokes)
    private glCanvas: OffscreenCanvas | null = null;
    private initialized = false;

    // params
    private objUrl: string | null = null;
    private mtlUrl: string | null = null; // kept optional but UI can restrict; we don't require it
    private diffuseMapUrl: string | null = null;
    private normalMapUrl: string | null = null;
    private rotationRpm: number = 3; // default gentle spin
    private modelScale: number = 10; // user scale multiplier
    private words: string[] = [];
    private fontFamilyChain: string = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    private connectToModelOnBeat = false;
    private beatThreshold = 0.07;
    private lastBeatVal = 0;
    private beatIndex = 0;
    private modelAnchors: THREE.Vector3[] = [];
    private spokesGeo: THREE.BufferGeometry | null = null;
    private scopedRng: ((key: string) => (() => number)) | null = null;
    private lastWordIndex = -1;
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private bboxCache: THREE.Box3 = new THREE.Box3();
    // spokes are static now (toward center, halfway)

    // Smoothed feature values
    private smLow = 0;
    private smMid = 0;
    private smHigh = 0;
    private smHue = 210;
    private smSat = 30;
    private smLight = 12;

    initialize(context: SceneContext): void {
        this.width = context.resolution.width;
        this.height = context.resolution.height;
        this.fontFamilyChain = context.fontFamilyChain || this.fontFamilyChain;
        this.setupThree();
        this.initialized = true;
        // Initialize smoothing state
        this.smLow = 0; this.smMid = 0; this.smHigh = 0;
        this.smHue = 210; this.smSat = 30; this.smLight = 12;
        this.scopedRng = context.createScopedRng;
    }

    configure(params: Record<string, any>): void {
        const p = (params && typeof params === 'object') ? params : {};
        const nextObj = typeof p.modelObjUrl === 'string' ? p.modelObjUrl : null;
        const nextMtl = typeof p.modelMtlUrl === 'string' ? p.modelMtlUrl : null;
        const nextDiffuse = typeof p.diffuseMapUrl === 'string' ? p.diffuseMapUrl : null;
        const nextNormal = typeof p.normalMapUrl === 'string' ? p.normalMapUrl : null;
        const nextScale = Number(p.modelScale);
        const nextRpm = Number(p.rotationRpm);
        const nextWords = Array.isArray((p as any).words) ? (p as any).words.map((w: any) => String(w)) : null;
        const nextFont = typeof p.fontFamilyChain === 'string' ? String(p.fontFamilyChain) : null;
        if (typeof (p as any).connectToModelOnBeat === 'boolean') this.connectToModelOnBeat = !!(p as any).connectToModelOnBeat;
        if (Number.isFinite((p as any).beatThreshold)) this.beatThreshold = Math.max(0, Math.min(1, Number((p as any).beatThreshold)));

        const urlsChanged = (this.objUrl !== nextObj) || (this.mtlUrl !== nextMtl) || (this.diffuseMapUrl !== nextDiffuse) || (this.normalMapUrl !== nextNormal);
        if (Number.isFinite(nextScale)) this.modelScale = Math.max(0.001, Number(nextScale));
        if (Number.isFinite(nextRpm)) this.rotationRpm = Math.max(0, Number(nextRpm));
        let wordsChanged = false;
        if (Array.isArray(nextWords)) {
            wordsChanged = (this.words.length !== nextWords.length) || nextWords.some((w, i) => w !== this.words[i]);
            if (wordsChanged) this.words = nextWords;
        }
        if (nextFont && nextFont !== this.fontFamilyChain) {
            this.fontFamilyChain = nextFont;
            wordsChanged = true; // need rebuild for text font
        }

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

        // Rebuild overlays if words or font changed
        if (!urlsChanged && wordsChanged) {
            this.buildLabelsAroundModel();
            this.buildPlexus();
            this.buildSpokes();
        }
    }

    update(_frame: number, dt: number, context: SceneContext): void {
        const f = Math.max(0, (context.time?.frame as number) | 0);
        const fps = Math.max(1, (context.time?.fps as number) | 0) || 60;
        const t = f / fps;
        // Allow animated overrides from timeline tracks (deterministic evaluation)
        const animated = (context.extras && (context.extras as any).animated) ? (context.extras as any).animated : undefined;
        
        // Priority: 1) animated keyframe value, 2) inspector param (this.rotationRpm), 3) registry default
        const rotationRpmVal = (animated && Number.isFinite(animated['model.rotationRPM'])) 
            ? Number(animated['model.rotationRPM']) 
            : this.rotationRpm; // Falls back to class property (set by configure() from inspector)

        const omega = (rotationRpmVal * Math.PI * 2) / 60; // rad/s
        const angle = omega * t;
        const twoPi = Math.PI * 2;
        if (this.rootGroup) {
            this.rootGroup.rotation.y = angle % twoPi;
        }

        // Smooth band-driven parameters
        const beat = Math.max(0, Math.min(1, Number(context.extras?.beat || 0)));
        // Beat index advance if crossing threshold (like SingleWordScene)
        // Prefer purple beat markers: wordIndex increments on each timeline beat
        const wi = (typeof context.extras?.wordIndex === 'number') ? Math.max(0, (context.extras!.wordIndex as number) | 0) : null;
        if (this.connectToModelOnBeat && wi != null) {
            if (wi !== this.lastWordIndex) {
                this.beatIndex = wi;
                // spokes are static now; no per-beat updates
            }
            this.lastWordIndex = wi;
        } else {
            // Fallback to envelope threshold when wordIndex not available
            const thr = this.beatThreshold;
            if (beat > thr && this.lastBeatVal <= thr) {
                this.beatIndex++;
                // spokes are static now; no per-beat updates
            }
            this.lastBeatVal = beat;
        }
        const low = (Number.isFinite(context.extras?.lowBand as any) ? Number((context.extras as any).lowBand) : 0) || 0;
        const mid = (Number.isFinite(context.extras?.midBand as any) ? Number((context.extras as any).midBand) : 0) || 0;
        const high = (Number.isFinite(context.extras?.highBand as any) ? Number((context.extras as any).highBand) : 0) || 0;
        const tau = 0.25; // seconds
        const a = 1 - Math.exp(-Math.max(0, dt) / tau);
        const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
        this.smLow += a * (clamp01(low) - this.smLow);
        this.smMid += a * (clamp01(mid) - this.smMid);
        this.smHigh += a * (clamp01(high) - this.smHigh);
        // Background tint
        const targetHue = (210 + 80 * (this.smHigh - this.smLow) + 360) % 360;
        const targetSat = Math.max(20, Math.min(65, 30 + 35 * this.smHigh));
        const targetLight = Math.max(10, Math.min(30, 12 + 12 * this.smHigh + 6 * this.smMid));
        const dh = ((targetHue - this.smHue + 540) % 360) - 180;
        this.smHue = (this.smHue + a * dh + 360) % 360;
        this.smSat += a * (targetSat - this.smSat);
        this.smLight += a * (targetLight - this.smLight);
        try {
            if (this.scene && (this.scene as any).background && (this.scene as any).background.setHSL) {
                (this.scene as any).background.setHSL((this.smHue % 360) / 360, Math.max(0, Math.min(1, this.smSat / 100)), Math.max(0, Math.min(1, this.smLight / 100)));
            }
        } catch {}

        // Spokes are static now; no per-frame refinement

        // Pulse labels with energy
        const pulse = 1 + 0.18 * beat + 0.10 * this.smLow;
        if (this.labelGroup && Array.isArray((this.labelGroup as any).children)) {
            const children = (this.labelGroup as any).children as any[];
            for (const child of children) {
                const baseX = child?.userData?.baseScaleX ?? child?.scale?.x ?? 1;
                const baseY = child?.userData?.baseScaleY ?? child?.scale?.y ?? 1;
                try { child.scale.set(baseX * pulse, baseY * pulse, 1); } catch {}
            }
        }

        // Modulate plexus opacity
        if (this.plexusGroup && Array.isArray((this.plexusGroup as any).children)) {
            const alpha = Math.max(0.08, Math.min(0.7, 0.12 + 0.28 * this.smMid + 0.24 * beat));
            const children = (this.plexusGroup as any).children as any[];
            for (const child of children) {
                const mat: any = (child as any).material;
                if (mat && 'opacity' in mat) { mat.opacity = alpha; }
            }
        }

        // Model scale with subtle pulse
        try {
            if (this.modelGroup) {
                // Priority: 1) animated keyframe value, 2) inspector param (this.modelScale), 3) registry default
                const baseScale = (animated && Number.isFinite(animated['model.scale'])) 
                    ? Math.max(0.001, Number(animated['model.scale'])) 
                    : this.modelScale; // Falls back to class property (set by configure() from inspector)
                const s = baseScale * (1 + 0.03 * (0.6 * this.smLow + 0.4 * beat));
                this.modelGroup.scale.set(s, s, s);
                
                // Scale overlay group (labels, plexus, spokes) to match model scale and radius multiplier
                const radiusMultiplier = (animated && Number.isFinite(animated['labels.radiusMultiplier'])) 
                    ? Number(animated['labels.radiusMultiplier']) 
                    : 0.5; // Default radius multiplier
                if (this.overlayGroup) {
                    const overlayScale = baseScale * radiusMultiplier;
                    this.overlayGroup.scale.set(overlayScale, overlayScale, overlayScale);
                }
            }
        } catch {}
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
        this.overlayGroup = new THREE.Group();
        this.labelGroup = new THREE.Group();
        this.plexusGroup = new THREE.Group();
        this.spokeGroup = new THREE.Group();
        this.overlayGroup.add(this.plexusGroup);
        this.overlayGroup.add(this.labelGroup);
        this.overlayGroup.add(this.spokeGroup);
        scene.add(this.rootGroup);
        // Attach overlays to rootGroup so they move with the model
        this.rootGroup.add(this.overlayGroup);

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
            // Rebuild overlays now that we have bounds
            this.buildLabelsAroundModel();
            this.buildPlexus();
            this.buildModelAnchors();
            this.buildSpokes();
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
        const target = 1.0; // fit within ~2 units radius
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

    private buildLabelsAroundModel() {
        if (!this.scene || !this.overlayGroup || !this.labelGroup) return;
        this.disposeGroup(this.labelGroup);
        const words = (this.words && this.words.length ? this.words : ['WOLK']).slice(0, 200);
        if (!this.modelGroup) return;
        const bbox = new THREE.Box3().setFromObject(this.modelGroup);
        const size = new THREE.Vector3(); bbox.getSize(size);
        const core = Math.max(size.x, Math.max(size.y, size.z));
        const radius = Math.max(0.6, core * 0.45 + 0.05);
        const count = words.length;
        if (count === 0) return;

        const makeLabelSprite = (text: string) => {
            const padding = 8;
            const fontSize = 40;
            const tmp = new OffscreenCanvas(2, 2);
            const tctx = tmp.getContext('2d');
            if (!tctx) return null;
            tctx.font = `${fontSize}px ${this.fontFamilyChain}`;
            const metrics = tctx.measureText(text);
            const textW = Math.ceil(metrics.width);
            const textH = Math.ceil(fontSize * 1.2);
            const w = Math.max(1, textW + padding * 2);
            const h = Math.max(1, textH + padding * 2);
            const canvas = new OffscreenCanvas(w, h);
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            // white background
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
            // black text
            ctx.fillStyle = '#000';
            ctx.font = `${fontSize}px ${this.fontFamilyChain}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, Math.floor(w / 2), Math.floor(h / 2));

            const tex = new THREE.CanvasTexture(canvas as any);
            tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
            const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
            const sprite = new THREE.Sprite(mat);
            const base = 0.45;
            const scaleX = base * (w / 256);
            const scaleY = base * (h / 256);
            sprite.scale.set(scaleX, scaleY, 1);
            (sprite as any).userData = (sprite as any).userData || {};
            (sprite as any).userData.baseScaleX = scaleX;
            (sprite as any).userData.baseScaleY = scaleY;
            return sprite;
        };

        for (let i = 0; i < count; i++) {
            const word = String(words[i]).toUpperCase();
            const phi = Math.acos(-1 + (2 * i) / count);
            const theta = Math.sqrt(count * Math.PI) * phi;
            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(phi);
            const sprite = makeLabelSprite(word);
            if (!sprite) continue;
            sprite.position.set(x, y, z);
            // make labels gently look at camera for readability
            try { sprite.lookAt(0, 0, 0); } catch {}
            this.labelGroup.add(sprite);
        }
    }

    private buildPlexus() {
        if (!this.scene || !this.plexusGroup || !this.labelGroup) return;
        this.disposeGroup(this.plexusGroup);
        const children = this.labelGroup.children as any[];
        if (!children || !children.length) return;
        const positions: number[] = [];
        const radius = 2.5;
        const k = 3;
        const maxDist = Math.max(0.1, 1.6 * radius);
        for (let i = 0; i < children.length; i++) {
            const a = children[i].position;
            const neighbors: { j: number; d2: number }[] = [];
            for (let j = i + 1; j < children.length; j++) {
                const b = children[j].position;
                const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
                const d2 = dx * dx + dy * dy + dz * dz;
                neighbors.push({ j, d2 });
            }
            neighbors.sort((u, v) => u.d2 - v.d2);
            let added = 0;
            for (const nb of neighbors) {
                if (added >= k) break;
                const d = Math.sqrt(nb.d2);
                if (d <= maxDist) {
                    const b = children[nb.j].position;
                    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
                    added++;
                }
            }
        }
        if (!positions.length) return;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3));
        const mat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.28, transparent: true, depthTest: false });
        const lines = new THREE.LineSegments(geo, mat);
        (lines as any).renderOrder = 1;
        this.plexusGroup.add(lines);
    }

    private buildModelAnchors() {
        this.modelAnchors = [];
        if (!this.modelGroup) return;
        const bbox = new THREE.Box3().setFromObject(this.modelGroup);
        const size = new THREE.Vector3(); bbox.getSize(size);
        const hx = Math.max(1e-4, size.x / 2);
        const hy = Math.max(1e-4, size.y / 2);
        const hz = Math.max(1e-4, size.z / 2);
        const count = 256; // anchor density
        for (let i = 0; i < count; i++) {
            const phi = Math.acos(-1 + (2 * i) / count);
            const theta = Math.sqrt(count * Math.PI) * phi;
            const dx = Math.cos(theta) * Math.sin(phi);
            const dy = Math.sin(theta) * Math.sin(phi);
            const dz = Math.cos(phi);
            const ax = Math.abs(dx) / hx;
            const ay = Math.abs(dy) / hy;
            const az = Math.abs(dz) / hz;
            const s = 1 / Math.max(ax, ay, az);
            this.modelAnchors.push(new THREE.Vector3(dx * s, dy * s, dz * s));
        }
    }

    private buildSpokes() {
        if (!this.spokeGroup || !this.labelGroup) return;
        // Clear existing spokes
        try { this.disposeGroup(this.spokeGroup); } catch {}
        const children = this.labelGroup.children as any[];
        if (!children || !children.length || !this.modelAnchors.length) return;
        const positions = new Float32Array(children.length * 2 * 3);
        if (this.modelGroup) this.bboxCache.setFromObject(this.modelGroup);
        // assign anchors deterministically; target is center; spokes end halfway
        for (let i = 0; i < children.length; i++) {
            const lbl = children[i];
            const p = lbl.position as THREE.Vector3;
            const a = new THREE.Vector3(0, 0, 0);
            const end = new THREE.Vector3().copy(p).lerp(a, 0.5);
            const offset = i * 6;
            positions[offset + 0] = p.x; positions[offset + 1] = p.y; positions[offset + 2] = p.z;
            positions[offset + 3] = end.x; positions[offset + 4] = end.y; positions[offset + 5] = end.z;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.spokesGeo = geo;
        const mat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.35, transparent: true, depthTest: true });
        const lines = new THREE.LineSegments(geo, mat);
        (lines as any).renderOrder = 2;
        this.spokeGroup.add(lines);
    }

    private updateSpokesForBeat() {
        // Static spokes toward center; no updates needed
        return;
    }

    private pickAnchorIndexForLabel(i: number, beatIdx: number): number {
        const n = Math.max(1, this.modelAnchors.length);
        if (!this.scopedRng) return i % n;
        const rng = this.scopedRng(`model.spoke.${i}.${beatIdx}`);
        const r = (rng() || 0) * 4294967296; // widen range
        const idx = Math.floor(r) % n;
        return (idx + n) % n;
    }

    private raycastToModel(from: THREE.Vector3, toward: THREE.Vector3): THREE.Vector3 | null {
        try {
            const dir = new THREE.Vector3().subVectors(toward, from).normalize();
            this.raycaster.set(from, dir);
            const meshes: any[] = [];
            if (this.modelGroup) this.modelGroup.traverse((obj: any) => { if (obj && obj.isMesh) meshes.push(obj); });
            const hits = this.raycaster.intersectObjects(meshes, true);
            if (hits && hits.length) return hits[0].point.clone();
        } catch {}
        return null;
    }

    private intersectRayWithAABB(from: THREE.Vector3, toward: THREE.Vector3, box: THREE.Box3): THREE.Vector3 {
        const dir = new THREE.Vector3().subVectors(toward, from).normalize();
        let tmin = -Infinity, tmax = Infinity;
        const inv = new THREE.Vector3(1 / dir.x, 1 / dir.y, 1 / dir.z);
        const checkAxis = (start: number, invD: number, minB: number, maxB: number) => {
            let t1 = (minB - start) * invD;
            let t2 = (maxB - start) * invD;
            if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
            tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        };
        checkAxis(from.x, inv.x, box.min.x, box.max.x);
        checkAxis(from.y, inv.y, box.min.y, box.max.y);
        checkAxis(from.z, inv.z, box.min.z, box.max.z);
        const t = (tmin > 0 && tmin !== Infinity) ? tmin : (tmax > 0 ? tmax : 0);
        return new THREE.Vector3(from.x + dir.x * t, from.y + dir.y * t, from.z + dir.z * t);
    }
}


