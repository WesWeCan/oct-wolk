/**
 * Deterministic JSON stringification with sorted keys.
 * 
 * Used for comparing scene parameters. Standard JSON.stringify
 * doesn't guarantee key order, making comparison unreliable.
 * 
 * @param obj - Object to stringify
 * @param excludeKeys - Set of keys to exclude from stringification
 * @returns Deterministic JSON string
 * 
 * @example
 * ```typescript
 * const obj = { b: 2, a: 1 };
 * stableStringify(obj); // '{"a":1,"b":2}' - always same order
 * 
 * const withExclude = { password: 'secret', name: 'John' };
 * stableStringify(withExclude, new Set(['password'])); // '{"name":"John"}'
 * ```
 */
export function stableStringify(
    obj: any, 
    excludeKeys?: Set<string>
): string {
    // Track visited objects to detect circular references
    const seen = new WeakSet();
    
    const toJSON = (value: any): any => {
        // Handle null and primitives
        if (value === null || typeof value !== 'object') {
            // Replace non-finite numbers with string representation
            // (Infinity, -Infinity, NaN can't be represented in JSON)
            if (typeof value === 'number' && !Number.isFinite(value)) {
                return String(value);
            }
            return value;
        }
        
        // Detect circular references
        if (seen.has(value)) {
            return undefined;
        }
        seen.add(value);
        
        // Handle arrays
        if (Array.isArray(value)) {
            return value.map(v => toJSON(v));
        }
        
        // Handle objects - sort keys for determinism
        const keys = Object.keys(value)
            .filter(k => !excludeKeys?.has(k))
            .sort(); // Alphabetical sort ensures consistent order
        
        const result: any = {};
        for (const key of keys) {
            result[key] = toJSON(value[key]);
        }
        return result;
    };
    
    try {
        return JSON.stringify(toJSON(obj));
    } catch {
        // If stringification fails (e.g., complex objects), return empty string
        return '';
    }
}
