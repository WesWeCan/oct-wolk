import type { MotionTrack } from '@/types/project_types';
import type { MotionBlockPlugin } from '@/front-end/motion-blocks/core/plugin-types';

const registry = new Map<string, MotionBlockPlugin>();
let fallbackPlugin: MotionBlockPlugin | null = null;

export function registerMotionBlockPlugin(plugin: MotionBlockPlugin): void {
    registry.set(plugin.type, plugin);
}

export function unregisterMotionBlockPlugin(type: string): void {
    registry.delete(type);
}

export function setFallbackMotionBlockPlugin(plugin: MotionBlockPlugin): void {
    fallbackPlugin = plugin;
}

export function getFallbackMotionBlockPlugin(): MotionBlockPlugin {
    if (!fallbackPlugin) {
        throw new Error('No fallback motion block plugin registered.');
    }
    return fallbackPlugin;
}

export function getMotionBlockPlugin(type: string): MotionBlockPlugin | null {
    return registry.get(type) ?? null;
}

export function requireMotionBlockPlugin(type: string): MotionBlockPlugin {
    return getMotionBlockPlugin(type) ?? getFallbackMotionBlockPlugin();
}

export function hasMotionBlockPlugin(type: string): boolean {
    return registry.has(type);
}

export function listMotionBlockPlugins(options: { authorableOnly?: boolean } = {}): MotionBlockPlugin[] {
    const plugins = [...registry.values()];
    const filtered = options.authorableOnly
        ? plugins.filter((plugin) => plugin.meta.authorable !== false)
        : plugins;
    return filtered.sort((a, b) => (a.meta.order ?? 999) - (b.meta.order ?? 999) || a.meta.label.localeCompare(b.meta.label));
}

export function getMotionTrackPlugin(track: MotionTrack): MotionBlockPlugin {
    return requireMotionBlockPlugin(track.block.type);
}
