export function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
}

export function smoothingFactor(dt: number, tauSeconds: number): number {
    const tau = Math.max(1e-6, tauSeconds);
    const dtClamped = Math.max(0, dt);
    return 1 - Math.exp(-dtClamped / tau);
}

export function lowpass(current: number, target: number, dt: number, tauSeconds: number): number {
    const a = smoothingFactor(dt, tauSeconds);
    return current + a * (target - current);
}

export function interpHueShortestPath(currentHueDeg: number, targetHueDeg: number, dt: number, tauSeconds: number): number {
    const a = smoothingFactor(dt, tauSeconds);
    const dh = ((targetHueDeg - currentHueDeg + 540) % 360) - 180;
    return (currentHueDeg + a * dh + 360) % 360;
}


