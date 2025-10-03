import type { SceneContext, WorkerScene } from '../engine/types';
import * as THREE from 'three';
import { OrbitRig } from '../engine/OrbitRig';
import { getAnimated } from '../engine/params';
import { disposeGroup, makeLabelSprite, setBackground } from '../engine/graphics';
import { buildPlexusFromPoints, updatePlexusOpacity } from '../engine/plexus';

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
    private spokeGroup: any = null; // THREE.Group
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
    private plexusOpacityMin = 0.08;
    private plexusOpacityMax = 0.7;
    private labelsSize = 1; private labelsOpacity = 1; private labelsPulseAmount = 1;
    private labelsBgHue = 0; private labelsBgSat = 0; private labelsBgLight = 100; // white bg
    private labelsTextHue = 0; private labelsTextSat = 0; private labelsTextLight = 0; // black text
    private bgHue = 210; private bgSat = 30; private bgLight = 12; private bgOpacity = 1;
    private spokesOpacity = 0.35; private spokesLengthFactor = 0.5; private lastSpokesLengthFactor = 0.5;

    // Smoothed feature values to avoid flicker (match SingleWordScene behavior)
    private smLow = 0;
    private smMid = 0;
    private smHigh = 0;
    private smHue = 210;
    private smSat = 30;
    private smLight = 12;

    // Orbit and rotation accumulators
    private orbit: OrbitRig = new OrbitRig();
    private accumulatedRotation = new THREE.Vector3();
    private rotXDeg = 0; private rotYDeg = 0; private rotZDeg = 0;

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
        // UI params similar to ModelScene
        if (Number.isFinite((params as any)['labels.size'])) this.labelsSize = Math.max(0, Number((params as any)['labels.size']));
        if (Number.isFinite((params as any)['labels.opacity'])) this.labelsOpacity = Math.max(0, Math.min(1, Number((params as any)['labels.opacity'])));
        if (Number.isFinite((params as any)['labels.pulseAmount'])) this.labelsPulseAmount = Math.max(0, Math.min(1, Number((params as any)['labels.pulseAmount'])));
        if (Number.isFinite((params as any)['labels.bgHue'])) this.labelsBgHue = Math.max(0, Math.min(360, Number((params as any)['labels.bgHue'])));
        if (Number.isFinite((params as any)['labels.bgSat'])) this.labelsBgSat = Math.max(0, Math.min(100, Number((params as any)['labels.bgSat'])));
        if (Number.isFinite((params as any)['labels.bgLight'])) this.labelsBgLight = Math.max(0, Math.min(100, Number((params as any)['labels.bgLight'])));
        if (Number.isFinite((params as any)['labels.textHue'])) this.labelsTextHue = Math.max(0, Math.min(360, Number((params as any)['labels.textHue'])));
        if (Number.isFinite((params as any)['labels.textSat'])) this.labelsTextSat = Math.max(0, Math.min(100, Number((params as any)['labels.textSat'])));
        if (Number.isFinite((params as any)['labels.textLight'])) this.labelsTextLight = Math.max(0, Math.min(100, Number((params as any)['labels.textLight'])));
        if (Number.isFinite((params as any)['background.hue'])) this.bgHue = Math.max(0, Math.min(360, Number((params as any)['background.hue'])));
        if (Number.isFinite((params as any)['background.sat'])) this.bgSat = Math.max(0, Math.min(100, Number((params as any)['background.sat'])));
        if (Number.isFinite((params as any)['background.light'])) this.bgLight = Math.max(0, Math.min(100, Number((params as any)['background.light'])));
        if (Number.isFinite((params as any)['background.opacity'])) this.bgOpacity = Math.max(0, Math.min(1, Number((params as any)['background.opacity'])));
        if (Number.isFinite((params as any)['plexus.opacityMin'])) this.plexusOpacityMin = Math.max(0, Math.min(1, Number((params as any)['plexus.opacityMin'])));
        if (Number.isFinite((params as any)['plexus.opacityMax'])) this.plexusOpacityMax = Math.max(0, Math.min(1, Number((params as any)['plexus.opacityMax'])));
        if (Number.isFinite((params as any)['spokes.opacity'])) this.spokesOpacity = Math.max(0, Math.min(1, Number((params as any)['spokes.opacity'])));
        if (Number.isFinite((params as any)['spokes.lengthFactor'])) this.spokesLengthFactor = Math.max(0, Math.min(1, Number((params as any)['spokes.lengthFactor'])));

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
        const animated = (context.extras && (context.extras as any).animated) ? (context.extras as any).animated : undefined;
        // Absolute Euler-only rotation for determinism (read animated if present)
        const rxDeg = (animated && Number.isFinite(animated['rotationX'])) ? Number(animated['rotationX']) : this.rotXDeg;
        const ryDeg = (animated && Number.isFinite(animated['rotationY'])) ? Number(animated['rotationY']) : this.rotYDeg;
        const rzDeg = (animated && Number.isFinite(animated['rotationZ'])) ? Number(animated['rotationZ']) : this.rotZDeg;
        const rx = THREE.MathUtils.degToRad(rxDeg);
        const ry = THREE.MathUtils.degToRad(ryDeg);
        const rz = THREE.MathUtils.degToRad(rzDeg);
        if (this.rootGroup) {
            this.rootGroup.rotation.set(rx, ry, rz);
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
        // Background: allow animated override with opacity; else use smoothed HSL
        try {
            if (this.scene && this.renderer) {
                const h = getAnimated(animated, 'background.hue', this.bgHue);
                const s = getAnimated(animated, 'background.sat', this.bgSat);
                const l = getAnimated(animated, 'background.light', this.bgLight);
                const aBg = getAnimated(animated, 'background.opacity', this.bgOpacity);
                if (animated && (Number.isFinite(animated['background.hue']) || Number.isFinite(animated['background.sat']) || Number.isFinite(animated['background.light']))) {
                    setBackground(this.scene, this.renderer, h as number, s as number, l as number, aBg as number);
                } else {
                    setBackground(this.scene, this.renderer, this.smHue, this.smSat, this.smLight, aBg as number);
                }
            }
        } catch {}

        // Pulse labels with energy (beat + low band) and animatable params
        const labelsPulseAmount = getAnimated(animated, 'labels.pulseAmount', this.labelsPulseAmount) as number;
        const labelsSize = getAnimated(animated, 'labels.size', this.labelsSize) as number;
        const labelsOpacity = getAnimated(animated, 'labels.opacity', this.labelsOpacity) as number;
        const labelBgHue = getAnimated(animated, 'labels.bgHue', this.labelsBgHue) as number;
        const labelBgSat = getAnimated(animated, 'labels.bgSat', this.labelsBgSat) as number;
        const labelBgLight = getAnimated(animated, 'labels.bgLight', this.labelsBgLight) as number;
        const pulse = 1 + (0.18 * beat + 0.10 * this.smLow) * labelsPulseAmount;
        if (this.labelGroup && Array.isArray((this.labelGroup as any).children)) {
            const children = (this.labelGroup as any).children as any[];
            for (const child of children) {
                const baseX = child?.userData?.baseScaleX ?? child?.scale?.x ?? 1;
                const baseY = child?.userData?.baseScaleY ?? child?.scale?.y ?? 1;
                try { child.scale.set(baseX * labelsSize * pulse, baseY * labelsSize * pulse, 1); } catch {}
                try {
                    const mat: any = child.material;
                    if (mat) {
                        if ('opacity' in mat) { mat.opacity = Math.max(0, Math.min(1, labelsOpacity)); mat.transparent = mat.opacity < 1; }
                        if (mat.color) { mat.color.setHSL((labelBgHue % 360) / 360, Math.max(0, Math.min(1, labelBgSat / 100)), Math.max(0, Math.min(1, labelBgLight / 100))); }
                    }
                } catch {}
            }
        }

        // Modulate plexus opacity with min/max clamp
        if (this.plexusGroup && Array.isArray((this.plexusGroup as any).children)) {
            const minA = Math.max(0, Math.min(1, getAnimated(animated, 'plexus.opacityMin', this.plexusOpacityMin) as number));
            const maxA = Math.max(minA, Math.min(1, getAnimated(animated, 'plexus.opacityMax', this.plexusOpacityMax) as number));
            const raw = 0.12 + 0.28 * this.smMid + 0.24 * beat;
            const alpha = Math.max(minA, Math.min(maxA, raw));
            updatePlexusOpacity(this.plexusGroup, alpha);
        }

        // Apply orbit camera (animated overrides defaults)
        try {
            const yaw = (animated && Number.isFinite(animated['camera.yaw'])) ? Number(animated['camera.yaw']) : 0;
            const pitch = (animated && Number.isFinite(animated['camera.pitch'])) ? Number(animated['camera.pitch']) : 0;
            const dist = (animated && Number.isFinite(animated['camera.distance'])) ? Number(animated['camera.distance']) : 6;
            const fov = (animated && Number.isFinite(animated['camera.fov'])) ? Number(animated['camera.fov']) : 45;
            const tx = (animated && Number.isFinite(animated['camera.targetX'])) ? Number(animated['camera.targetX']) : 0;
            const ty = (animated && Number.isFinite(animated['camera.targetY'])) ? Number(animated['camera.targetY']) : 0;
            const tz = (animated && Number.isFinite(animated['camera.targetZ'])) ? Number(animated['camera.targetZ']) : 0;
            this.orbit.setFromParams({ yawDeg: yaw, pitchDeg: pitch, distance: dist, fovDeg: fov, targetX: tx, targetY: ty, targetZ: tz });
            if (this.camera) this.orbit.applyTo(this.camera as any);
        } catch {}

        // Update spokes opacity and rebuild when length factor changes
        const lf = (animated && Number.isFinite(animated['spokes.lengthFactor'])) ? Number(animated['spokes.lengthFactor']) : this.spokesLengthFactor;
        if (Math.abs(lf - this.lastSpokesLengthFactor) > 1e-4) {
            this.spokesLengthFactor = Math.max(0, Math.min(1, lf));
            this.lastSpokesLengthFactor = this.spokesLengthFactor;
            this.buildSpokes();
        }
        const spokesOpacity = (animated && Number.isFinite(animated['spokes.opacity'])) ? Math.max(0, Math.min(1, Number(animated['spokes.opacity']))) : this.spokesOpacity;
        if (this.spokeGroup && Array.isArray((this.spokeGroup as any).children)) {
            const children = (this.spokeGroup as any).children as any[];
            for (const child of children) {
                const mat: any = (child as any).material;
                if (mat && 'opacity' in mat) { mat.opacity = spokesOpacity; }
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
        return {
            words: this.words,
            fontFamilyChain: this.fontFamilyChain,
            background: { hue: this.bgHue, sat: this.bgSat, light: this.bgLight, opacity: this.bgOpacity },
            labels: { size: this.labelsSize, opacity: this.labelsOpacity, pulseAmount: this.labelsPulseAmount, bgHue: this.labelsBgHue, bgSat: this.labelsBgSat, bgLight: this.labelsBgLight, textHue: this.labelsTextHue, textSat: this.labelsTextSat, textLight: this.labelsTextLight },
            plexus: { opacityMin: this.plexusOpacityMin, opacityMax: this.plexusOpacityMax, kNeighbors: this.plexusNeighbors, maxDistScale: this.plexusMaxDistScale },
            spokes: { opacity: this.spokesOpacity, lengthFactor: this.spokesLengthFactor },
        };
    }

    deserialize(data: any): void {
        try {
            if (Array.isArray(data?.words)) this.words = data.words.map((w: any) => String(w));
            if (typeof data?.fontFamilyChain === 'string') this.fontFamilyChain = data.fontFamilyChain;
            const b = data?.background || {};
            if (Number.isFinite(b.hue)) this.bgHue = Math.max(0, Math.min(360, Number(b.hue)));
            if (Number.isFinite(b.sat)) this.bgSat = Math.max(0, Math.min(100, Number(b.sat)));
            if (Number.isFinite(b.light)) this.bgLight = Math.max(0, Math.min(100, Number(b.light)));
            if (Number.isFinite(b.opacity)) this.bgOpacity = Math.max(0, Math.min(1, Number(b.opacity)));
            const l = data?.labels || {};
            if (Number.isFinite(l.size)) this.labelsSize = Math.max(0, Number(l.size));
            if (Number.isFinite(l.opacity)) this.labelsOpacity = Math.max(0, Math.min(1, Number(l.opacity)));
            if (Number.isFinite(l.pulseAmount)) this.labelsPulseAmount = Math.max(0, Math.min(1, Number(l.pulseAmount)));
            if (Number.isFinite(l.bgHue)) this.labelsBgHue = Math.max(0, Math.min(360, Number(l.bgHue)));
            if (Number.isFinite(l.bgSat)) this.labelsBgSat = Math.max(0, Math.min(100, Number(l.bgSat)));
            if (Number.isFinite(l.bgLight)) this.labelsBgLight = Math.max(0, Math.min(100, Number(l.bgLight)));
            if (Number.isFinite(l.textHue)) this.labelsTextHue = Math.max(0, Math.min(360, Number(l.textHue)));
            if (Number.isFinite(l.textSat)) this.labelsTextSat = Math.max(0, Math.min(100, Number(l.textSat)));
            if (Number.isFinite(l.textLight)) this.labelsTextLight = Math.max(0, Math.min(100, Number(l.textLight)));
            const px = data?.plexus || {};
            if (Number.isFinite(px.opacityMin)) this.plexusOpacityMin = Math.max(0, Math.min(1, Number(px.opacityMin)));
            if (Number.isFinite(px.opacityMax)) this.plexusOpacityMax = Math.max(0, Math.min(1, Number(px.opacityMax)));
            if (Number.isFinite(px.kNeighbors)) this.plexusNeighbors = Math.max(1, Math.min(8, Number(px.kNeighbors) | 0));
            if (Number.isFinite(px.maxDistScale)) this.plexusMaxDistScale = Math.max(0.5, Math.min(3, Number(px.maxDistScale)));
            const sp = data?.spokes || {};
            if (Number.isFinite(sp.opacity)) this.spokesOpacity = Math.max(0, Math.min(1, Number(sp.opacity)));
            if (Number.isFinite(sp.lengthFactor)) this.spokesLengthFactor = Math.max(0, Math.min(1, Number(sp.lengthFactor)));
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
        this.spokeGroup = new THREE.Group();
        this.rootGroup.add(this.plexusGroup);
        this.rootGroup.add(this.labelGroup);
        this.rootGroup.add(this.spokeGroup);
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
        disposeGroup(this.labelGroup);

        const words = (this.words && this.words.length ? this.words : ['WOLK']).slice(0, 250);
        const radius = 2.5;
        const count = words.length;
        if (count === 0) return;

        // Use shared sprite factory; tint adjusted dynamically per frame
        const makeSprite = (text: string) => makeLabelSprite(text, this.fontFamilyChain);

        for (let i = 0; i < count; i++) {
            const word = String(words[i]).toUpperCase();
            const phi = Math.acos(-1 + (2 * i) / count); // spherical Fibonacci-like distribution
            const theta = Math.sqrt(count * Math.PI) * phi;
            const x = radius * Math.cos(theta) * Math.sin(phi);
            const y = radius * Math.sin(theta) * Math.sin(phi);
            const z = radius * Math.cos(phi);
            const sprite = makeSprite(word);
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
        disposeGroup(this.plexusGroup);

        // Build a plexus: connect k-nearest neighbors with a dynamic distance cap
        const children = this.labelGroup.children as any[];
        const points = children.map(c => (c.position as THREE.Vector3).clone());
        const radius = 2.5;
        const k = Math.max(1, Math.min(8, this.plexusNeighbors | 0));
        const maxDist = Math.max(0.1, this.plexusMaxDistScale * radius);
        const lines = buildPlexusFromPoints(points, k, maxDist);
        if (!lines) return;
        this.plexusGroup.add(lines);
        // Ensure plexus group local rotation is reset; rootGroup holds global rotation
        try { if (this.plexusGroup && this.plexusGroup.rotation) { this.plexusGroup.rotation.set(0, 0, 0); } } catch {}
    }

    private buildSpokes() {
        if (!this.spokeGroup || !this.labelGroup) return;
        try { disposeGroup(this.spokeGroup); } catch {}
        const children = this.labelGroup.children as any[];
        if (!children || !children.length) return;
        const positions = new Float32Array(children.length * 2 * 3);
        for (let i = 0; i < children.length; i++) {
            const lbl = children[i];
            const p = lbl.position as THREE.Vector3;
            const center = new THREE.Vector3(0, 0, 0);
            const end = new THREE.Vector3().copy(p).lerp(center, Math.max(0, Math.min(1, this.spokesLengthFactor)));
            const offset = i * 6;
            positions[offset + 0] = p.x; positions[offset + 1] = p.y; positions[offset + 2] = p.z;
            positions[offset + 3] = end.x; positions[offset + 4] = end.y; positions[offset + 5] = end.z;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const mat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: Math.max(0, Math.min(1, this.spokesOpacity)), transparent: true, depthTest: true });
        const lines = new THREE.LineSegments(geo, mat);
        (lines as any).renderOrder = 2;
        this.spokeGroup.add(lines);
    }
}


