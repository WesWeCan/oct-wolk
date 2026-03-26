export const RENDER_DIMENSION_BOUNDS = { min: 64, max: 8192 } as const;

export const CANVAS_DIMENSION_PRESETS: readonly { value: string; label: string }[] = [
    { value: '1920x1080', label: '1920 × 1080' },
    { value: '1280x720', label: '1280 × 720' },
    { value: '3840x2160', label: '3840 × 2160 (4K)' },
    { value: '2560x1440', label: '2560 × 1440 (2K)' },
    { value: '1080x1920', label: '1080 × 1920 (Vertical)' },
] as const;

const PRESET_VALUES = new Set(CANVAS_DIMENSION_PRESETS.map((p) => p.value));

/** Select `value` for the dimension preset dropdown, or `custom` when W×H is not a known preset. */
export function dimensionPresetSelectValue(width: number, height: number): string {
    const key = `${width}x${height}`;
    return PRESET_VALUES.has(key) ? key : 'custom';
}

export function clampRenderDimension(n: number, fallback: number): number {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v)) return fallback;
    return Math.min(RENDER_DIMENSION_BOUNDS.max, Math.max(RENDER_DIMENSION_BOUNDS.min, v));
}
