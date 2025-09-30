/**
 * Easing functions for animations and transitions.
 * 
 * All functions take a normalized time value (0-1) and return
 * an eased value (0-1). Values outside 0-1 are clamped.
 */

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

/**
 * Applies easing function to normalized time value (0-1).
 * 
 * Easing functions control the rate of change during animations:
 * - `linear`: Constant speed (no easing)
 * - `easeIn`: Starts slow, accelerates (quadratic)
 * - `easeOut`: Starts fast, decelerates (quadratic)
 * - `easeInOut`: Slow start and end, fast middle (cubic)
 * 
 * @param t - Time value (will be clamped to 0-1)
 * @param type - Easing function type
 * @returns Eased value (0-1)
 * 
 * @example
 * ```typescript
 * // Animate opacity from 0 to 1 with ease-in
 * const progress = currentTime / duration;
 * const opacity = ease(progress, 'easeIn');
 * ```
 */
export function ease(t: number, type: EasingType = 'linear'): number {
    // Clamp input to [0, 1] range
    const clamped = Math.min(1, Math.max(0, t));
    
    switch (type) {
        case 'easeIn':
            // Quadratic ease-in: accelerate from zero
            // Formula: t²
            return clamped * clamped;
            
        case 'easeOut':
            // Quadratic ease-out: decelerate to zero
            // Formula: 1 - (1-t)²
            return 1 - (1 - clamped) * (1 - clamped);
            
        case 'easeInOut':
            // Cubic ease-in-out: accelerate then decelerate
            // Formula: t < 0.5 ? 2t² : 1 - (-2t+2)²/2
            return clamped < 0.5
                ? 2 * clamped * clamped
                : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
            
        case 'linear':
        default:
            // No easing: constant speed
            return clamped;
    }
}
