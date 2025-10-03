export function clampNumber(v: number, min: number, max: number): number {
    const n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
}

export function getAnimated<T extends number | string | boolean>(
    animated: Record<string, any> | undefined,
    key: string,
    fallback: T
): T {
    if (!animated) return fallback;
    const value = (animated as any)[key];
    if (typeof fallback === 'number') {
        const n = Number(value);
        return (Number.isFinite(n) ? (n as any as T) : fallback);
    }
    if (typeof fallback === 'boolean') {
        return (typeof value === 'boolean' ? (value as any as T) : fallback);
    }
    if (typeof fallback === 'string') {
        return (typeof value === 'string' ? (value as any as T) : fallback);
    }
    return fallback;
}


