import * as THREE from 'three';

export function buildPlexusFromPoints(points: THREE.Vector3[], kNeighbors: number, maxDistance: number): THREE.LineSegments | null {
    const k = Math.max(1, Math.min(8, kNeighbors | 0));
    const maxDist = Math.max(0.1, maxDistance);
    const positions: number[] = [];
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const neighbors: { j: number; d2: number }[] = [];
        for (let j = i + 1; j < points.length; j++) {
            const b = points[j];
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
                const b = points[nb.j];
                positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
                added++;
            }
        }
    }
    if (!positions.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.28, transparent: true, depthTest: false });
    const lines = new THREE.LineSegments(geo, mat);
    (lines as any).renderOrder = 1;
    return lines;
}

export function updatePlexusOpacity(group: any, alpha: number) {
    if (!group || !Array.isArray((group as any).children)) return;
    const children = (group as any).children as any[];
    const a = Math.max(0, Math.min(1, alpha));
    for (const child of children) {
        const mat: any = (child as any).material;
        if (mat && 'opacity' in mat) { mat.opacity = a; }
    }
}


