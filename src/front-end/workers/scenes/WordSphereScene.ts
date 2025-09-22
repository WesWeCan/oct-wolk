import type { SceneContext, WorkerScene } from '../engine/types';
import * as THREE from 'three';

export class WordSphereScene implements WorkerScene {
    private width = 0;
    private height = 0;
    private fontFamilyChain: string = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    private words: string[] = [];
    private renderer: any = null; // THREE.WebGLRenderer
    private scene: any = null; // THREE.Scene
    private camera: any = null; // THREE.PerspectiveCamera
    private labelGroup: any = null; // THREE.Group
    private plexusGroup: any = null; // THREE.Group
    private sphereMesh: any = null; // THREE.Mesh
    private rootGroup: any = null; // THREE.Group
    private glCanvas: OffscreenCanvas | null = null;
    private initialized = false;
    // params
    private showSphere = true;
    private sphereWireframe = false;
    private rotationSpeed = 0.2; // radians/sec (legacy; use rotationRpm if provided)
    private rotationRpm: number | null = null; // human-friendly: rotations per minute
    private energyResponse = 0.25; // 0..1 scale
    private rotationFpsOverride: number | null = null; // if set, use this for deterministic rotation mapping
    private plexusNeighbors = 3; // number of nearest neighbors per node
    private plexusMaxDistScale = 1.6; // max chord distance relative to radius

    // Smoothed feature values to avoid flicker (match SingleWordScene behavior)
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
        // Initialize smoothing state
        this.smLow = 0; this.smMid = 0; this.smHigh = 0;
        this.smHue = 210; this.smSat = 30; this.smLight = 12;
        this.initialized = true;
    }

    configure(params: Record<string, any>): void {
        // Determine what actually changed so we only rebuild what is necessary
        const incomingWords = Array.isArray(params.words) ? params.words.map((w: any) => String(w)) : null;
        const wordsChanged = Array.isArray(incomingWords)
            ? (incomingWords.length !== this.words.length || incomingWords.some((w, i) => w !== this.words[i]))
            : false;

        const fontChanged = typeof params.fontFamilyChain === 'string' && params.fontFamilyChain !== this.fontFamilyChain;
        const showSphereChanged = typeof params.showSphere === 'boolean' && !!params.showSphere !== this.showSphere;
        const wireframeChanged = typeof params.sphereWireframe === 'boolean' && !!params.sphereWireframe !== this.sphereWireframe;

        // Apply scalar params
        if ('rotationRpm' in params) {
            const v = Number((params as any).rotationRpm);
            this.rotationRpm = Number.isFinite(v) ? v : null;
        }
        if (Number.isFinite(params.rotationSpeed)) this.rotationSpeed = Number(params.rotationSpeed);
        if (Number.isFinite(params.energyResponse)) this.energyResponse = Math.max(0, Math.min(1, Number(params.energyResponse)));
        if (Number.isFinite(params.plexusNeighbors)) this.plexusNeighbors = Math.max(1, Math.min(8, Number(params.plexusNeighbors)) | 0);
        if (Number.isFinite(params.plexusMaxDistScale)) this.plexusMaxDistScale = Math.max(0.5, Math.min(3, Number(params.plexusMaxDistScale)));
        if ('rotationFps' in params) {
            const rf = Number((params as any).rotationFps);
            this.rotationFpsOverride = Number.isFinite(rf) ? Math.max(1, rf) : null;
        }

        // Apply text/sizing params and selectively rebuild
        if (wordsChanged) this.words = incomingWords as string[];
        if (fontChanged) this.fontFamilyChain = params.fontFamilyChain as string;
        if (wordsChanged || fontChanged) {
            this.buildLabelsOnSphere();
            this.buildPlexus();
        }

        // Apply sphere-related params and rebuild sphere only if necessary
        if (showSphereChanged) this.showSphere = !!params.showSphere;
        if (wireframeChanged) this.sphereWireframe = !!params.sphereWireframe;
        if (showSphereChanged || wireframeChanged) {
            this.buildSphereMesh();
        }
    }

    update(_frame: number, dt: number, context: SceneContext): void {
        // Deterministic rotation based on frame index (no per-frame accumulation)
        const f = Math.max(0, (context.time?.frame as number) | 0);
        const fps = Math.max(1, ((this.rotationFpsOverride ?? (context.time?.fps as number)) | 0) || 60);
        const t = f / fps; // seconds since frame 0
        if (this.rootGroup) {
            // Prefer human-friendly RPM if provided; otherwise fall back to rad/s
            const omega = (this.rotationRpm != null)
                ? (this.rotationRpm * Math.PI * 2) / 60 // rad/s
                : this.rotationSpeed; // rad/s
            const angle = omega * t;
            const twoPi = Math.PI * 2;
            this.rootGroup.rotation.y = angle % twoPi;
            this.rootGroup.rotation.x = (0.15 * angle) % twoPi;
        }

        // Smooth band-driven parameters (low-pass ~250ms) like SingleWordScene
        const beat = Math.max(0, Math.min(1, Number(context.extras?.beat || 0)));
        const low = (Number.isFinite(context.extras?.lowBand as any) ? Number((context.extras as any).lowBand) : 0) || 0;
        const mid = (Number.isFinite(context.extras?.midBand as any) ? Number((context.extras as any).midBand) : 0) || 0;
        const high = (Number.isFinite(context.extras?.highBand as any) ? Number((context.extras as any).highBand) : 0) || 0;
        const tau = 0.25; // seconds
        const a = 1 - Math.exp(-Math.max(0, dt) / tau);
        const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
        this.smLow += a * (clamp01(low) - this.smLow);
        this.smMid += a * (clamp01(mid) - this.smMid);
        this.smHigh += a * (clamp01(high) - this.smHigh);
        // Target background HSL from smoothed bands (reduced amplitudes)
        const targetHue = (210 + 80 * (this.smHigh - this.smLow) + 360) % 360;
        const targetSat = Math.max(20, Math.min(65, 30 + 35 * this.smHigh));
        const targetLight = Math.max(10, Math.min(30, 12 + 12 * this.smHigh + 6 * this.smMid));
        // Shortest path hue interpolation
        const dh = ((targetHue - this.smHue + 540) % 360) - 180;
        this.smHue = (this.smHue + a * dh + 360) % 360;
        this.smSat += a * (targetSat - this.smSat);
        this.smLight += a * (targetLight - this.smLight);
        // Apply background tint
        try {
            if (this.scene && (this.scene as any).background && (this.scene as any).background.setHSL) {
                (this.scene as any).background.setHSL((this.smHue % 360) / 360, Math.max(0, Math.min(1, this.smSat / 100)), Math.max(0, Math.min(1, this.smLight / 100)));
            }
        } catch {}

        // Pulse labels with energy (beat + low band)
        const pulse = 1 + 0.18 * beat + 0.10 * this.smLow;
        if (this.labelGroup && Array.isArray((this.labelGroup as any).children)) {
            const children = (this.labelGroup as any).children as any[];
            for (const child of children) {
                const baseX = child?.userData?.baseScaleX ?? child?.scale?.x ?? 1;
                const baseY = child?.userData?.baseScaleY ?? child?.scale?.y ?? 1;
                try { child.scale.set(baseX * pulse, baseY * pulse, 1); } catch {}
            }
        }

        // Modulate plexus opacity with mid band + beat
        if (this.plexusGroup && Array.isArray((this.plexusGroup as any).children)) {
            const alpha = Math.max(0.08, Math.min(0.7, 0.12 + 0.28 * this.smMid + 0.24 * beat));
            const children = (this.plexusGroup as any).children as any[];
            for (const child of children) {
                const mat: any = (child as any).material;
                if (mat && 'opacity' in mat) { mat.opacity = alpha; }
            }
        }
    }

    render(target: OffscreenCanvasRenderingContext2D, _context: SceneContext): void {
        if (!this.initialized || !this.renderer || !this.scene || !this.camera) return;
        // Render 3D to internal WebGL offscreen canvas
        this.renderer.render(this.scene, this.camera);
        // Blit to provided 2D target
        try {
            const src = (this.renderer.domElement as OffscreenCanvas);
            target.drawImage(src, 0, 0, this.width, this.height, 0, 0, this.width, this.height);
        } catch {}
    }

    dispose(): void {
        // Dispose GPU resources (labels, plexus, sphere)
        try { this.disposeGroup(this.labelGroup); } catch {}
        try { this.disposeGroup(this.plexusGroup); } catch {}
        try {
            if (this.sphereMesh) {
                const m: any = this.sphereMesh as any;
                if (m.geometry && m.geometry.dispose) m.geometry.dispose();
                if (m.material && m.material.dispose) m.material.dispose();
                if (this.rootGroup) this.rootGroup.remove(this.sphereMesh); else if (this.scene) this.scene.remove(this.sphereMesh);
            }
        } catch {}
        // Remove root group from scene
        try {
            if (this.rootGroup && this.scene) this.scene.remove(this.rootGroup);
        } catch {}
        // Dispose renderer and force context loss
        try {
            if (this.renderer) {
                if (typeof this.renderer.dispose === 'function') this.renderer.dispose();
                if (typeof this.renderer.forceContextLoss === 'function') this.renderer.forceContextLoss();
            }
        } catch {}
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.labelGroup = null;
        this.plexusGroup = null;
        this.sphereMesh = null;
        this.rootGroup = null;
        try {
            if (this.glCanvas) { (this.glCanvas as any).width = 0; (this.glCanvas as any).height = 0; }
        } catch {}
        this.glCanvas = null;
        this.initialized = false;
    }

    serialize(): any {
        return { words: this.words, fontFamilyChain: this.fontFamilyChain };
    }

    deserialize(data: any): void {
        try {
            if (Array.isArray(data?.words)) this.words = data.words.map((w: any) => String(w));
            if (typeof data?.fontFamilyChain === 'string') this.fontFamilyChain = data.fontFamilyChain;
        } catch {}
    }

    // --- internals ---
    private setupThree() {
        // Create an OffscreenCanvas-backed WebGLRenderer
        this.glCanvas = new OffscreenCanvas(Math.max(1, this.width), Math.max(1, this.height));
        const renderer = new THREE.WebGLRenderer({ canvas: this.glCanvas as any, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
        renderer.setSize(this.width, this.height, false);
        renderer.setPixelRatio(1);
        renderer.setClearColor(0x000000, 0);
        this.renderer = renderer;

        // Scene and camera
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, Math.max(1, this.width) / Math.max(1, this.height), 0.1, 100);
        camera.position.set(0, 0, 6);
        camera.lookAt(0, 0, 0);
        this.scene = scene;
        this.camera = camera;

        // Lighting (flat neutral)
        const ambient = new THREE.AmbientLight(0xffffff, 1.0);
        scene.add(ambient);

        // Groups
        this.rootGroup = new THREE.Group();
        this.labelGroup = new THREE.Group();
        this.plexusGroup = new THREE.Group();
        this.rootGroup.add(this.plexusGroup);
        this.rootGroup.add(this.labelGroup);
        scene.add(this.rootGroup);

        // A neutral background so black text is visible if target clears to black
        const bg = new THREE.Color(0x111111);
        scene.background = bg;
    }

    private buildSphereMesh() {
        if (!this.scene) return;
        // remove existing
        if (this.sphereMesh) {
            try {
                const m: any = this.sphereMesh as any;
                if (m.geometry && m.geometry.dispose) m.geometry.dispose();
                if (m.material && m.material.dispose) m.material.dispose();
                if (this.rootGroup) this.rootGroup.remove(this.sphereMesh); else if (this.scene) this.scene.remove(this.sphereMesh);
            } catch {}
            this.sphereMesh = null;
        }
        if (!this.showSphere) return;
        const radius = 2.25;
        const geo = new THREE.SphereGeometry(radius, 32, 20);
        const mat = new THREE.MeshBasicMaterial({ color: 0x444444, wireframe: !!this.sphereWireframe, transparent: true, opacity: this.sphereWireframe ? 0.6 : 0.15 });
        this.sphereMesh = new THREE.Mesh(geo, mat);
        if (this.rootGroup) this.rootGroup.add(this.sphereMesh); else if (this.scene) this.scene.add(this.sphereMesh);
    }

    private buildLabelsOnSphere() {
        if (!this.scene || !this.labelGroup) return;
        this.disposeGroup(this.labelGroup);

        const words = (this.words && this.words.length ? this.words : ['WOLK']).slice(0, 250);
        const radius = 2.5;
        const count = words.length;
        if (count === 0) return;

        // Canvas-based sprite for each word: white rounded rectangle with black text
        const makeLabelSprite = (text: string) => {
            const padding = 12;
            const fontSize = 48;
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
            // white rectangular background
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
            // text in black
            ctx.fillStyle = '#000';
            ctx.font = `${fontSize}px ${this.fontFamilyChain}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, Math.floor(w / 2), Math.floor(h / 2));

            const tex = new THREE.CanvasTexture(canvas as any);
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.needsUpdate = true;
            const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
            const sprite = new THREE.Sprite(mat);
            // scale roughly by canvas aspect to keep labels readable
            const base = 0.9;
            const scaleX = base * (w / 256);
            const scaleY = base * (h / 256);
            sprite.scale.set(scaleX, scaleY, 1);
            // store base scale for energy pulsing
            (sprite as any).userData = (sprite as any).userData || {};
            (sprite as any).userData.baseScaleX = scaleX;
            (sprite as any).userData.baseScaleY = scaleY;
            return sprite;
        };

        for (let i = 0; i < count; i++) {
            const word = String(words[i]).toUpperCase();
            const phi = Math.acos(-1 + (2 * i) / count); // spherical Fibonacci-like distribution
            const theta = Math.sqrt(count * Math.PI) * phi;
            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(phi);
            const sprite = makeLabelSprite(word);
            if (!sprite) continue;
            sprite.position.set(x, y, z);
            // Face camera: always look at camera origin by making it billboard via Sprite
            this.labelGroup.add(sprite);
        }
        // Ensure label group local rotation is reset; rootGroup holds global rotation
        try { if (this.labelGroup && this.labelGroup.rotation) { this.labelGroup.rotation.set(0, 0, 0); } } catch {}
    }

    private buildPlexus() {
        if (!this.scene || !this.plexusGroup || !this.labelGroup) return;
        this.disposeGroup(this.plexusGroup);

        // Build a plexus: connect k-nearest neighbors with a dynamic distance cap
        const positions: number[] = [];
        const children = this.labelGroup.children as any[];
        const radius = 2.5;
        const k = Math.max(1, Math.min(8, this.plexusNeighbors | 0));
        const maxDist = Math.max(0.1, this.plexusMaxDistScale * radius);
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
        // Render on top of sphere
        (lines as any).renderOrder = 1;
        this.plexusGroup.add(lines);
        // Ensure plexus group local rotation is reset; rootGroup holds global rotation
        try { if (this.plexusGroup && this.plexusGroup.rotation) { this.plexusGroup.rotation.set(0, 0, 0); } } catch {}
    }

    private disposeGroup(group: any) {
        if (!group) return;
        const children = [...group.children];
        for (const obj of children) {
            try {
                if ((obj as any).material && (obj as any).material.dispose) (obj as any).material.dispose();
            } catch {}
            try {
                // Dispose textures in sprite materials
                const mat: any = (obj as any).material;
                if (mat && mat.map && typeof mat.map.dispose === 'function') mat.map.dispose();
            } catch {}
            try { if ((obj as any).geometry && (obj as any).geometry.dispose) (obj as any).geometry.dispose(); } catch {}
            try { group.remove(obj); } catch {}
        }
    }
}


