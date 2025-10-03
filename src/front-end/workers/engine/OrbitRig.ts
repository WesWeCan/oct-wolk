import * as THREE from 'three';

export interface OrbitParams {
    yawDeg?: number; // -180..180
    pitchDeg?: number; // -89..89
    distance?: number; // 0..20
    fovDeg?: number; // 10..120
    targetX?: number; // -5..5
    targetY?: number; // -5..5
    targetZ?: number; // -5..5
}

export class OrbitRig {
    yawDeg: number = 0;
    pitchDeg: number = 0;
    distance: number = 6;
    fovDeg: number = 45;
    target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

    setFromParams(p: OrbitParams) {
        if (Number.isFinite(p.yawDeg as any)) this.yawDeg = Number(p.yawDeg);
        if (Number.isFinite(p.pitchDeg as any)) this.pitchDeg = Number(p.pitchDeg);
        if (Number.isFinite(p.distance as any)) this.distance = Math.max(0, Number(p.distance));
        if (Number.isFinite(p.fovDeg as any)) this.fovDeg = Math.max(1, Math.min(170, Number(p.fovDeg)));
        const tx = Number.isFinite(p.targetX as any) ? Number(p.targetX) : this.target.x;
        const ty = Number.isFinite(p.targetY as any) ? Number(p.targetY) : this.target.y;
        const tz = Number.isFinite(p.targetZ as any) ? Number(p.targetZ) : this.target.z;
        this.target.set(tx, ty, tz);
    }

    applyTo(camera: THREE.PerspectiveCamera) {
        const yaw = THREE.MathUtils.degToRad(this.yawDeg);
        const pitch = THREE.MathUtils.degToRad(Math.max(-89, Math.min(89, this.pitchDeg)));
        const d = Math.max(0, this.distance);
        const cp = Math.cos(pitch);
        const sp = Math.sin(pitch);
        const cy = Math.cos(yaw);
        const sy = Math.sin(yaw);
        const eye = new THREE.Vector3(
            this.target.x + d * cp * sy,
            this.target.y + d * sp,
            this.target.z + d * cp * cy,
        );
        camera.position.copy(eye);
        try { camera.fov = Math.max(1, Math.min(170, this.fovDeg)); camera.updateProjectionMatrix(); } catch {}
        camera.lookAt(this.target);
    }
}


