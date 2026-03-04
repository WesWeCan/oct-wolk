export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'easeInCubic' | 'easeOutCubic';

export function ease(t: number, type: EasingType = 'linear'): number {
    const c = Math.min(1, Math.max(0, t));

    switch (type) {
        case 'easeIn':
            return c * c;
        case 'easeOut':
            return 1 - (1 - c) * (1 - c);
        case 'easeInOut':
            return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
        case 'easeInCubic':
            return c * c * c;
        case 'easeOutCubic':
            return 1 - Math.pow(1 - c, 3);
        case 'linear':
        default:
            return c;
    }
}
