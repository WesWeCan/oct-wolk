import * as THREE from 'three';

export function disposeGroup(group: any) {
    if (!group) return;
    const children = [...group.children];
    for (const obj of children) {
        try {
            const mat: any = (obj as any).material;
            if (mat && typeof mat.dispose === 'function') mat.dispose();
            if (mat && mat.map && typeof mat.map.dispose === 'function') mat.map.dispose();
            if (mat && mat.normalMap && typeof mat.normalMap.dispose === 'function') mat.normalMap.dispose();
        } catch {}
        try { if ((obj as any).geometry && (obj as any).geometry.dispose) (obj as any).geometry.dispose(); } catch {}
        try { group.remove(obj); } catch {}
    }
}

export function setBackground(scene: any, renderer: any, hueDeg: number, satPct: number, lightPct: number, opacity: number) {
    const h = ((hueDeg % 360) + 360) % 360;
    const s = Math.max(0, Math.min(100, satPct));
    const l = Math.max(0, Math.min(100, lightPct));
    const a = Math.max(0, Math.min(1, opacity));
    try {
        if (a < 1) {
            scene.background = null;
            const color = new THREE.Color().setHSL(h / 360, s / 100, l / 100);
            renderer.setClearColor(color, a);
        } else {
            if (!scene.background) scene.background = new THREE.Color();
            scene.background.setHSL(h / 360, s / 100, l / 100);
            if (renderer && renderer.setClearAlpha) renderer.setClearAlpha(1);
        }
    } catch {}
}

export function makeLabelSprite(text: string, fontFamilyChain: string, opts?: { padding?: number; fontSize?: number; tint?: THREE.Color | null }) {
    const padding = Math.max(0, Math.floor(opts?.padding ?? 12));
    const fontSize = Math.max(1, Math.floor(opts?.fontSize ?? 48));
    const tmp = new OffscreenCanvas(2, 2);
    const tctx = tmp.getContext('2d');
    if (!tctx) return null as any;
    tctx.font = `${fontSize}px ${fontFamilyChain}`;
    const metrics = tctx.measureText(text);
    const textW = Math.ceil(metrics.width);
    const textH = Math.ceil(fontSize * 1.2);
    const w = Math.max(1, textW + padding * 2);
    const h = Math.max(1, textH + padding * 2);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null as any;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.font = `${fontSize}px ${fontFamilyChain}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, Math.floor(w / 2), Math.floor(h / 2));
    const tex = new THREE.CanvasTexture(canvas as any);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    if (opts?.tint) mat.color = opts.tint;
    const sprite = new THREE.Sprite(mat);
    const base = 0.9;
    const scaleX = base * (w / 256);
    const scaleY = base * (h / 256);
    sprite.scale.set(scaleX, scaleY, 1);
    (sprite as any).userData = (sprite as any).userData || {};
    (sprite as any).userData.baseScaleX = scaleX;
    (sprite as any).userData.baseScaleY = scaleY;
    return sprite;
}


