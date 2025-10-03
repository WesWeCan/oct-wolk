import type { SceneContext, WorkerScene } from '../engine/types';
import * as THREE from 'three';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitRig } from '../engine/OrbitRig';

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
    private modelScale: number = 10; // user scale multiplier
    private words: string[] = [];
    private fontFamilyChain: string = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    private connectToModelOnBeat = false;
    private beatThreshold = 0.07;
    private lastBeatVal = 0;
    private lastWordIndex = -1;
    // spokes are static now (toward center, halfway)

    // Smoothed feature values
    private smLow = 0;
    private smMid = 0;
    private smHigh = 0;
    private smHue = 210;
    private smSat = 30;
    private smLight = 12;

    // New: orbit camera and rotation accumulator
    private orbit: OrbitRig = new OrbitRig();
    private accumulatedRotation = new THREE.Vector3(); // radians

    // New: parameters (0-safe)
    private camYaw = 0; private camPitch = 0; private camDistance = 6; private camFov = 45;
    private camTargetX = 0; private camTargetY = 0; private camTargetZ = 0;
    private posX = 0; private posY = 0; private posZ = 0;
    private scaleX = 1; private scaleY = 1; private scaleZ = 1;
    private rotXDeg = 0; private rotYDeg = 0; private rotZDeg = 0;
    private rpmX = 0; private rpmY = 0; private rpmZ = 0; // per-axis rpm
    private labelsSize = 1; private labelsOpacity = 1; private labelsPulseAmount = 1;
    private labelsBgHue = 0; private labelsBgSat = 0; private labelsBgLight = 100; // white background
    private labelsTextHue = 0; private labelsTextSat = 0; private labelsTextLight = 0; // black text
    private plexusOpacityMin = 0.08; private plexusOpacityMax = 0.7; private plexusK = 3; private plexusMaxDist = 4;
    private spokesOpacity = 0.35; private spokesLengthFactor = 0.5; private lastSpokesLengthFactor = 0.5;
    private bgHue = 210; private bgSat = 30; private bgLight = 12; private bgOpacity = 1; // manual override when animated present
    private reactModel = 1; private reactLabels = 1;

    initialize(context: SceneContext): void {
        this.width = context.resolution.width;
        this.height = context.resolution.height;
        this.fontFamilyChain = context.fontFamilyChain || this.fontFamilyChain;
        this.setupThree();
        this.initialized = true;
        // Initialize smoothing state
        this.smLow = 0; this.smMid = 0; this.smHigh = 0;
        this.smHue = 210; this.smSat = 30; this.smLight = 12;
    }

    configure(params: Record<string, any>): void {
        const p = (params && typeof params === 'object') ? params : {};
        const nextObj = typeof p.modelObjUrl === 'string' ? p.modelObjUrl : null;
        const nextMtl = typeof p.modelMtlUrl === 'string' ? p.modelMtlUrl : null;
        const nextDiffuse = typeof p.diffuseMapUrl === 'string' ? p.diffuseMapUrl : null;
        const nextNormal = typeof p.normalMapUrl === 'string' ? p.normalMapUrl : null;
        const nextScale = Number(p.modelScale);
        const nextWords = Array.isArray((p as any).words) ? (p as any).words.map((w: any) => String(w)) : null;
        const nextFont = typeof p.fontFamilyChain === 'string' ? String(p.fontFamilyChain) : null;
        if (typeof (p as any).connectToModelOnBeat === 'boolean') this.connectToModelOnBeat = !!(p as any).connectToModelOnBeat;
        if (Number.isFinite((p as any).beatThreshold)) this.beatThreshold = Math.max(0, Math.min(1, Number((p as any).beatThreshold)));

        const urlsChanged = (this.objUrl !== nextObj) || (this.mtlUrl !== nextMtl) || (this.diffuseMapUrl !== nextDiffuse) || (this.normalMapUrl !== nextNormal);
        if (Number.isFinite(nextScale)) this.modelScale = Math.max(0.001, Number(nextScale));
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
                console.log('[ModelScene] Loading model with params', { obj: this.objUrl, mtl: this.mtlUrl, diffuse: this.diffuseMapUrl, normal: this.normalMapUrl, scale: this.modelScale });
            } catch {}
            this.loadModel().catch((e) => { try { console.error('[ModelScene] loadModel error', e); } catch {} });
        } else {
            // apply scale change immediately
            try { if (this.modelGroup) this.modelGroup.scale.set(this.modelScale, this.modelScale, this.modelScale); } catch {}
        }

        // Read additional params (persist for defaults)
        if (Number.isFinite((p as any)['camera.yaw'])) this.camYaw = Number((p as any)['camera.yaw']);
        if (Number.isFinite((p as any)['camera.pitch'])) this.camPitch = Number((p as any)['camera.pitch']);
        if (Number.isFinite((p as any)['camera.distance'])) this.camDistance = Math.max(0, Number((p as any)['camera.distance']));
        if (Number.isFinite((p as any)['camera.fov'])) this.camFov = Math.max(1, Math.min(170, Number((p as any)['camera.fov'])));
        if (Number.isFinite((p as any)['camera.targetX'])) this.camTargetX = Number((p as any)['camera.targetX']);
        if (Number.isFinite((p as any)['camera.targetY'])) this.camTargetY = Number((p as any)['camera.targetY']);
        if (Number.isFinite((p as any)['camera.targetZ'])) this.camTargetZ = Number((p as any)['camera.targetZ']);
        if (Number.isFinite((p as any)['model.positionX'])) this.posX = Number((p as any)['model.positionX']);
        if (Number.isFinite((p as any)['model.positionY'])) this.posY = Number((p as any)['model.positionY']);
        if (Number.isFinite((p as any)['model.positionZ'])) this.posZ = Number((p as any)['model.positionZ']);
        if (Number.isFinite((p as any)['model.scaleX'])) this.scaleX = Math.max(0, Number((p as any)['model.scaleX']));
        if (Number.isFinite((p as any)['model.scaleY'])) this.scaleY = Math.max(0, Number((p as any)['model.scaleY']));
        if (Number.isFinite((p as any)['model.scaleZ'])) this.scaleZ = Math.max(0, Number((p as any)['model.scaleZ']));
        if (Number.isFinite((p as any)['model.rotationX'])) this.rotXDeg = Number((p as any)['model.rotationX']);
        if (Number.isFinite((p as any)['model.rotationY'])) this.rotYDeg = Number((p as any)['model.rotationY']);
        if (Number.isFinite((p as any)['model.rotationZ'])) this.rotZDeg = Number((p as any)['model.rotationZ']);
        if (Number.isFinite((p as any)['model.rotationRPMX'])) this.rpmX = Number((p as any)['model.rotationRPMX']);
        if (Number.isFinite((p as any)['model.rotationRPMY'])) this.rpmY = Number((p as any)['model.rotationRPMY']);
        if (Number.isFinite((p as any)['model.rotationRPMZ'])) this.rpmZ = Number((p as any)['model.rotationRPMZ']);
        if (Number.isFinite((p as any)['labels.size'])) this.labelsSize = Math.max(0, Number((p as any)['labels.size']));
        if (Number.isFinite((p as any)['labels.opacity'])) this.labelsOpacity = Math.max(0, Math.min(1, Number((p as any)['labels.opacity'])));
        if (Number.isFinite((p as any)['labels.pulseAmount'])) this.labelsPulseAmount = Math.max(0, Math.min(1, Number((p as any)['labels.pulseAmount'])));
        // Label colors (now dynamic via material.color - no rebuild needed)
        if (Number.isFinite((p as any)['labels.bgHue'])) this.labelsBgHue = Math.max(0, Math.min(360, Number((p as any)['labels.bgHue'])));
        if (Number.isFinite((p as any)['labels.bgSat'])) this.labelsBgSat = Math.max(0, Math.min(100, Number((p as any)['labels.bgSat'])));
        if (Number.isFinite((p as any)['labels.bgLight'])) this.labelsBgLight = Math.max(0, Math.min(100, Number((p as any)['labels.bgLight'])));
        if (Number.isFinite((p as any)['labels.textHue'])) this.labelsTextHue = Math.max(0, Math.min(360, Number((p as any)['labels.textHue'])));
        if (Number.isFinite((p as any)['labels.textSat'])) this.labelsTextSat = Math.max(0, Math.min(100, Number((p as any)['labels.textSat'])));
        if (Number.isFinite((p as any)['labels.textLight'])) this.labelsTextLight = Math.max(0, Math.min(100, Number((p as any)['labels.textLight'])));
        if (Number.isFinite((p as any)['plexus.opacityMin'])) this.plexusOpacityMin = Math.max(0, Math.min(1, Number((p as any)['plexus.opacityMin'])));
        if (Number.isFinite((p as any)['plexus.opacityMax'])) this.plexusOpacityMax = Math.max(0, Math.min(1, Number((p as any)['plexus.opacityMax'])));
        if (Number.isFinite((p as any)['plexus.kNeighbors'])) this.plexusK = Math.max(1, Math.min(8, Number((p as any)['plexus.kNeighbors']) | 0));
        if (Number.isFinite((p as any)['plexus.maxDistance'])) this.plexusMaxDist = Math.max(0, Number((p as any)['plexus.maxDistance']));
        if (Number.isFinite((p as any)['spokes.opacity'])) this.spokesOpacity = Math.max(0, Math.min(1, Number((p as any)['spokes.opacity'])));
        if (Number.isFinite((p as any)['spokes.lengthFactor'])) this.spokesLengthFactor = Math.max(0, Math.min(1, Number((p as any)['spokes.lengthFactor'])));
        if (Number.isFinite((p as any)['background.hue'])) this.bgHue = Math.max(0, Math.min(360, Number((p as any)['background.hue'])));
        if (Number.isFinite((p as any)['background.sat'])) this.bgSat = Math.max(0, Math.min(100, Number((p as any)['background.sat'])));
        if (Number.isFinite((p as any)['background.light'])) this.bgLight = Math.max(0, Math.min(100, Number((p as any)['background.light'])));
        if (Number.isFinite((p as any)['background.opacity'])) this.bgOpacity = Math.max(0, Math.min(1, Number((p as any)['background.opacity'])));
        if (Number.isFinite((p as any)['reactivity.model'])) this.reactModel = Math.max(0, Math.min(1, Number((p as any)['reactivity.model'])));
        if (Number.isFinite((p as any)['reactivity.labels'])) this.reactLabels = Math.max(0, Math.min(1, Number((p as any)['reactivity.labels'])));

        // Rebuild overlays if words or font changed (colors are now dynamic)
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
        // Absolute Euler-only rotation (deterministic)
        const absX = (animated && Number.isFinite(animated['model.rotationX'])) ? Number(animated['model.rotationX']) : this.rotXDeg;
        const absY = (animated && Number.isFinite(animated['model.rotationY'])) ? Number(animated['model.rotationY']) : this.rotYDeg;
        const absZ = (animated && Number.isFinite(animated['model.rotationZ'])) ? Number(animated['model.rotationZ']) : this.rotZDeg;
        const rx = THREE.MathUtils.degToRad(absX);
        const ry = THREE.MathUtils.degToRad(absY);
        const rz = THREE.MathUtils.degToRad(absZ);
        if (this.rootGroup) {
            this.rootGroup.rotation.set(rx, ry, rz);
        }

        // Smooth band-driven parameters
        const beat = Math.max(0, Math.min(1, Number(context.extras?.beat || 0)));
        // Track word index for beat detection (if connectToModelOnBeat is enabled)
        const wi = (typeof context.extras?.wordIndex === 'number') ? Math.max(0, (context.extras!.wordIndex as number) | 0) : null;
        if (this.connectToModelOnBeat && wi != null) {
            this.lastWordIndex = wi;
        } else {
            // Fallback to envelope threshold when wordIndex not available
            const thr = this.beatThreshold;
            if (beat > thr && this.lastBeatVal <= thr) {
                // Beat detected (reserved for future use)
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
        // Background color: use animated manual HSL if provided, else energy tint
        const bgHueAnim = (animated && Number.isFinite(animated['background.hue'])) ? Number(animated['background.hue']) : null;
        const bgSatAnim = (animated && Number.isFinite(animated['background.sat'])) ? Number(animated['background.sat']) : null;
        const bgLightAnim = (animated && Number.isFinite(animated['background.light'])) ? Number(animated['background.light']) : null;
        const bgOpacityAnim = (animated && Number.isFinite(animated['background.opacity'])) ? Math.max(0, Math.min(1, Number(animated['background.opacity']))) : this.bgOpacity;
        
        if (bgHueAnim != null || bgSatAnim != null || bgLightAnim != null) {
            const h = (bgHueAnim != null ? bgHueAnim : this.bgHue) % 360;
            const s = Math.max(0, Math.min(100, bgSatAnim != null ? bgSatAnim : this.bgSat));
            const l = Math.max(0, Math.min(100, bgLightAnim != null ? bgLightAnim : this.bgLight));
            try { 
                if (this.scene && this.renderer) {
                    // If opacity < 1, use clear color instead of scene.background for transparency
                    if (bgOpacityAnim < 1) {
                        this.scene.background = null;
                        const color = new THREE.Color().setHSL(h / 360, s / 100, l / 100);
                        this.renderer.setClearColor(color, bgOpacityAnim);
                    } else {
                        // Opaque: use scene.background for better quality
                        if (!this.scene.background) this.scene.background = new THREE.Color();
                        this.scene.background.setHSL(h / 360, s / 100, l / 100);
                        this.renderer.setClearAlpha(1);
                    }
                }
            } catch {}
        } else {
            const targetHue = (210 + 80 * (this.smHigh - this.smLow) + 360) % 360;
            const targetSat = Math.max(20, Math.min(65, 30 + 35 * this.smHigh));
            const targetLight = Math.max(10, Math.min(30, 12 + 12 * this.smHigh + 6 * this.smMid));
            const dh = ((targetHue - this.smHue + 540) % 360) - 180;
            this.smHue = (this.smHue + a * dh + 360) % 360;
            this.smSat += a * (targetSat - this.smSat);
            this.smLight += a * (targetLight - this.smLight);
            try { 
                if (this.scene && this.renderer) {
                    // If opacity < 1, use clear color instead of scene.background for transparency
                    if (bgOpacityAnim < 1) {
                        this.scene.background = null;
                        const color = new THREE.Color().setHSL((this.smHue % 360) / 360, Math.max(0, Math.min(1, this.smSat / 100)), Math.max(0, Math.min(1, this.smLight / 100)));
                        this.renderer.setClearColor(color, bgOpacityAnim);
                    } else {
                        // Opaque: use scene.background for better quality
                        if (!this.scene.background) this.scene.background = new THREE.Color();
                        this.scene.background.setHSL((this.smHue % 360) / 360, Math.max(0, Math.min(1, this.smSat / 100)), Math.max(0, Math.min(1, this.smLight / 100)));
                        this.renderer.setClearAlpha(1);
                    }
                }
            } catch {}
        }

        // Pulse labels with energy, scaled by reactivity
        const reactLabels = (animated && Number.isFinite(animated['reactivity.labels'])) 
            ? Math.max(0, Math.min(1, Number(animated['reactivity.labels']))) 
            : this.reactLabels;
        const labelsPulseAmount = (animated && Number.isFinite(animated['labels.pulseAmount'])) 
            ? Math.max(0, Math.min(1, Number(animated['labels.pulseAmount']))) 
            : this.labelsPulseAmount;
        const labelsSize = (animated && Number.isFinite(animated['labels.size'])) 
            ? Math.max(0, Number(animated['labels.size'])) 
            : this.labelsSize;
        const labelsOpacity = (animated && Number.isFinite(animated['labels.opacity'])) 
            ? Math.max(0, Math.min(1, Number(animated['labels.opacity']))) 
            : this.labelsOpacity;
        const pulse = 1 + (0.18 * beat + 0.10 * this.smLow) * reactLabels * labelsPulseAmount;
        
        // Get label color (animated or default)
        const labelBgHue = (animated && Number.isFinite(animated['labels.bgHue'])) 
            ? Math.max(0, Math.min(360, Number(animated['labels.bgHue']))) 
            : this.labelsBgHue;
        const labelBgSat = (animated && Number.isFinite(animated['labels.bgSat'])) 
            ? Math.max(0, Math.min(100, Number(animated['labels.bgSat']))) 
            : this.labelsBgSat;
        const labelBgLight = (animated && Number.isFinite(animated['labels.bgLight'])) 
            ? Math.max(0, Math.min(100, Number(animated['labels.bgLight']))) 
            : this.labelsBgLight;
        
        if (this.labelGroup && Array.isArray((this.labelGroup as any).children)) {
            const children = (this.labelGroup as any).children as any[];
            for (const child of children) {
                const baseX = child?.userData?.baseScaleX ?? child?.scale?.x ?? 1;
                const baseY = child?.userData?.baseScaleY ?? child?.scale?.y ?? 1;
                try { child.scale.set(baseX * labelsSize * pulse, baseY * labelsSize * pulse, 1); } catch {}
                
                // Update material opacity and color
                try { 
                    const mat: any = child.material; 
                    if (mat) {
                        if ('opacity' in mat) { 
                            mat.opacity = labelsOpacity; 
                            mat.transparent = mat.opacity < 1; 
                        }
                        // Dynamically tint sprite with current color
                        if (mat.color) {
                            mat.color.setHSL(labelBgHue / 360, labelBgSat / 100, labelBgLight / 100);
                        }
                    }
                } catch {}
            }
        }

        // Modulate plexus opacity (clamped to min/max)
        const plexusOpacityMin = (animated && Number.isFinite(animated['plexus.opacityMin'])) 
            ? Math.max(0, Math.min(1, Number(animated['plexus.opacityMin']))) 
            : this.plexusOpacityMin;
        const plexusOpacityMax = (animated && Number.isFinite(animated['plexus.opacityMax'])) 
            ? Math.max(0, Math.min(1, Number(animated['plexus.opacityMax']))) 
            : this.plexusOpacityMax;
        if (this.plexusGroup && Array.isArray((this.plexusGroup as any).children)) {
            const raw = 0.12 + 0.28 * this.smMid + 0.24 * beat;
            const minA = Math.max(0, Math.min(1, plexusOpacityMin));
            const maxA = Math.max(minA, Math.min(1, plexusOpacityMax));
            const alpha = Math.max(minA, Math.min(maxA, raw));
            const children = (this.plexusGroup as any).children as any[];
            for (const child of children) {
                const mat: any = (child as any).material;
                if (mat && 'opacity' in mat) { mat.opacity = alpha; }
            }
        }

        // Update spokes opacity per-frame
        const spokesOpacity = (animated && Number.isFinite(animated['spokes.opacity'])) 
            ? Math.max(0, Math.min(1, Number(animated['spokes.opacity']))) 
            : this.spokesOpacity;
        if (this.spokeGroup && Array.isArray((this.spokeGroup as any).children)) {
            const children = (this.spokeGroup as any).children as any[];
            for (const child of children) {
                const mat: any = (child as any).material;
                if (mat && 'opacity' in mat) { mat.opacity = spokesOpacity; }
            }
        }

        // Model transform and subtle pulse
        try {
            if (this.modelGroup) {
                // Priority: 1) animated keyframe value, 2) inspector param (this.modelScale), 3) registry default
                const baseScale = (animated && Number.isFinite(animated['model.scale'])) 
                    ? Math.max(0.001, Number(animated['model.scale'])) 
                    : this.modelScale; // Falls back to class property (set by configure() from inspector)
                const reactModel = (animated && Number.isFinite(animated['reactivity.model'])) 
                    ? Math.max(0, Math.min(1, Number(animated['reactivity.model']))) 
                    : this.reactModel;
                const pulseAmt = (0.6 * this.smLow + 0.4 * beat) * reactModel;
                const s = baseScale * (1 + 0.03 * pulseAmt);
                const sx = (animated && Number.isFinite(animated['model.scaleX'])) ? Math.max(0, Number(animated['model.scaleX'])) : this.scaleX;
                const sy = (animated && Number.isFinite(animated['model.scaleY'])) ? Math.max(0, Number(animated['model.scaleY'])) : this.scaleY;
                const sz = (animated && Number.isFinite(animated['model.scaleZ'])) ? Math.max(0, Number(animated['model.scaleZ'])) : this.scaleZ;
                this.modelGroup.scale.set(s * sx, s * sy, s * sz);
                const px = (animated && Number.isFinite(animated['model.positionX'])) ? Number(animated['model.positionX']) : this.posX;
                const py = (animated && Number.isFinite(animated['model.positionY'])) ? Number(animated['model.positionY']) : this.posY;
                const pz = (animated && Number.isFinite(animated['model.positionZ'])) ? Number(animated['model.positionZ']) : this.posZ;
                this.modelGroup.position.set(px, py, pz);
                
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

        // Camera orbit application (after transforms)
        try {
            const yaw = (animated && Number.isFinite(animated['camera.yaw'])) ? Number(animated['camera.yaw']) : this.camYaw;
            const pitch = (animated && Number.isFinite(animated['camera.pitch'])) ? Number(animated['camera.pitch']) : this.camPitch;
            const dist = (animated && Number.isFinite(animated['camera.distance'])) ? Number(animated['camera.distance']) : this.camDistance;
            const fov = (animated && Number.isFinite(animated['camera.fov'])) ? Number(animated['camera.fov']) : this.camFov;
            const tx = (animated && Number.isFinite(animated['camera.targetX'])) ? Number(animated['camera.targetX']) : this.camTargetX;
            const ty = (animated && Number.isFinite(animated['camera.targetY'])) ? Number(animated['camera.targetY']) : this.camTargetY;
            const tz = (animated && Number.isFinite(animated['camera.targetZ'])) ? Number(animated['camera.targetZ']) : this.camTargetZ;
            this.orbit.setFromParams({ yawDeg: yaw, pitchDeg: pitch, distance: dist, fovDeg: fov, targetX: tx, targetY: ty, targetZ: tz });
            if (this.camera) this.orbit.applyTo(this.camera as any);
        } catch {}

        // Rebuild spokes if length factor changed
        const lf = (animated && Number.isFinite(animated['spokes.lengthFactor'])) ? Number(animated['spokes.lengthFactor']) : this.spokesLengthFactor;
        if (Math.abs(lf - this.lastSpokesLengthFactor) > 1e-4) {
            this.spokesLengthFactor = Math.max(0, Math.min(1, lf));
            this.lastSpokesLengthFactor = this.spokesLengthFactor;
            this.buildSpokes();
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
            camera: { yaw: this.camYaw, pitch: this.camPitch, distance: this.camDistance, fov: this.camFov, targetX: this.camTargetX, targetY: this.camTargetY, targetZ: this.camTargetZ },
            model: { positionX: this.posX, positionY: this.posY, positionZ: this.posZ, scaleX: this.scaleX, scaleY: this.scaleY, scaleZ: this.scaleZ, rotationX: this.rotXDeg, rotationY: this.rotYDeg, rotationZ: this.rotZDeg, rotationRPMX: this.rpmX, rotationRPMY: this.rpmY, rotationRPMZ: this.rpmZ },
            background: { hue: this.bgHue, sat: this.bgSat, light: this.bgLight, opacity: this.bgOpacity },
            labels: { size: this.labelsSize, opacity: this.labelsOpacity, pulseAmount: this.labelsPulseAmount, bgHue: this.labelsBgHue, bgSat: this.labelsBgSat, bgLight: this.labelsBgLight, textHue: this.labelsTextHue, textSat: this.labelsTextSat, textLight: this.labelsTextLight },
            plexus: { opacityMin: this.plexusOpacityMin, opacityMax: this.plexusOpacityMax, kNeighbors: this.plexusK, maxDistance: this.plexusMaxDist },
            spokes: { opacity: this.spokesOpacity, lengthFactor: this.spokesLengthFactor },
            reactivity: { model: this.reactModel, labels: this.reactLabels },
        };
    }

    deserialize(data: any): void {
        try {
            if (typeof data?.modelObjUrl === 'string') this.objUrl = data.modelObjUrl;
            if (typeof data?.modelMtlUrl === 'string') this.mtlUrl = data.modelMtlUrl;
            if (typeof data?.diffuseMapUrl === 'string') this.diffuseMapUrl = data.diffuseMapUrl;
            if (typeof data?.normalMapUrl === 'string') this.normalMapUrl = data.normalMapUrl;
            if (Number.isFinite(data?.modelScale)) this.modelScale = Math.max(0.001, Number(data.modelScale));
            const c = data?.camera || {};
            if (Number.isFinite(c.yaw)) this.camYaw = Number(c.yaw);
            if (Number.isFinite(c.pitch)) this.camPitch = Number(c.pitch);
            if (Number.isFinite(c.distance)) this.camDistance = Math.max(0, Number(c.distance));
            if (Number.isFinite(c.fov)) this.camFov = Math.max(1, Math.min(170, Number(c.fov)));
            if (Number.isFinite(c.targetX)) this.camTargetX = Number(c.targetX);
            if (Number.isFinite(c.targetY)) this.camTargetY = Number(c.targetY);
            if (Number.isFinite(c.targetZ)) this.camTargetZ = Number(c.targetZ);
            const m = data?.model || {};
            if (Number.isFinite(m.positionX)) this.posX = Number(m.positionX);
            if (Number.isFinite(m.positionY)) this.posY = Number(m.positionY);
            if (Number.isFinite(m.positionZ)) this.posZ = Number(m.positionZ);
            if (Number.isFinite(m.scaleX)) this.scaleX = Math.max(0, Number(m.scaleX));
            if (Number.isFinite(m.scaleY)) this.scaleY = Math.max(0, Number(m.scaleY));
            if (Number.isFinite(m.scaleZ)) this.scaleZ = Math.max(0, Number(m.scaleZ));
            if (Number.isFinite(m.rotationX)) this.rotXDeg = Number(m.rotationX);
            if (Number.isFinite(m.rotationY)) this.rotYDeg = Number(m.rotationY);
            if (Number.isFinite(m.rotationZ)) this.rotZDeg = Number(m.rotationZ);
            if (Number.isFinite(m.rotationRPMX)) this.rpmX = Number(m.rotationRPMX);
            if (Number.isFinite(m.rotationRPMY)) this.rpmY = Number(m.rotationRPMY);
            if (Number.isFinite(m.rotationRPMZ)) this.rpmZ = Number(m.rotationRPMZ);
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
            if (Number.isFinite(px.kNeighbors)) this.plexusK = Math.max(1, Math.min(8, Number(px.kNeighbors) | 0));
            if (Number.isFinite(px.maxDistance)) this.plexusMaxDist = Math.max(0, Number(px.maxDistance));
            const sp = data?.spokes || {};
            if (Number.isFinite(sp.opacity)) this.spokesOpacity = Math.max(0, Math.min(1, Number(sp.opacity)));
            if (Number.isFinite(sp.lengthFactor)) this.spokesLengthFactor = Math.max(0, Math.min(1, Number(sp.lengthFactor)));
            const r = data?.reactivity || {};
            if (Number.isFinite(r.model)) this.reactModel = Math.max(0, Math.min(1, Number(r.model)));
            if (Number.isFinite(r.labels)) this.reactLabels = Math.max(0, Math.min(1, Number(r.labels)));
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
            const textHeight = Math.ceil(fontSize * 1.2);
            const w = Math.max(1, textW + padding * 2);
            const h = Math.max(1, textHeight + padding * 2);
            const canvas = new OffscreenCanvas(w, h);
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            
            // Draw white background and black text - we'll tint dynamically with material.color
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#000';
            ctx.font = `${fontSize}px ${this.fontFamilyChain}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, Math.floor(w / 2), Math.floor(h / 2));

            const tex = new THREE.CanvasTexture(canvas as any);
            tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
            
            // Create material with initial color from HSL properties
            const bgColor = new THREE.Color().setHSL(
                this.labelsBgHue / 360, 
                this.labelsBgSat / 100, 
                this.labelsBgLight / 100
            );
            const mat = new THREE.SpriteMaterial({ 
                map: tex, 
                transparent: true, 
                depthTest: true,
                color: bgColor // This will tint the entire sprite
            });
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
        const k = Math.max(1, Math.min(8, this.plexusK | 0));
        const maxDist = Math.max(0, this.plexusMaxDist || 0);
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
        const mat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: Math.max(0, Math.min(1, this.plexusOpacityMax)), transparent: true, depthTest: false });
        const lines = new THREE.LineSegments(geo, mat);
        (lines as any).renderOrder = 1;
        this.plexusGroup.add(lines);
    }

    private buildSpokes() {
        if (!this.spokeGroup || !this.labelGroup) return;
        // Clear existing spokes
        try { this.disposeGroup(this.spokeGroup); } catch {}
        const children = this.labelGroup.children as any[];
        if (!children || !children.length) return;
        const positions = new Float32Array(children.length * 2 * 3);
        // Static spokes: from label toward center, ending at configurable fraction
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


