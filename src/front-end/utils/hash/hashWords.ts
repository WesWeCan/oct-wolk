/**
 * FNV-1a hash algorithm for string arrays.
 * 
 * Used to detect changes in word pools and trigger worker reconfiguration
 * without deep equality checks. The hash changes whenever the word list
 * or word order changes.
 * 
 * @param words - Array of strings to hash
 * @returns String representation of 32-bit FNV-1a hash
 * @see https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function
 * 
 * @example
 * ```typescript
 * hashWords(['hello', 'world']) // "3826002220"
 * hashWords(['world', 'hello']) // Different hash (order matters)
 * ```
 */
export function hashWords(words: string[]): string {
    // FNV-1a constants
    const FNV_OFFSET_BASIS = 2166136261 >>> 0;
    
    let hash = FNV_OFFSET_BASIS;
    
    for (const word of words) {
        for (let i = 0; i < word.length; i++) {
            // XOR with byte
            hash ^= word.charCodeAt(i);
            
            // Multiply by FNV prime using bit shifts (equivalent to * 16777619)
            // This is faster than direct multiplication
            hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
        }
    }
    
    return String(hash >>> 0);
}
