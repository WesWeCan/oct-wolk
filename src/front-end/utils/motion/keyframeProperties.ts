import type { KeyframePropertyDef } from '@/front-end/motion-blocks/core/keyframes';
import { ensureMotionBlockPluginsRegistered } from '@/front-end/motion-blocks';
import { listMotionBlockPlugins } from '@/front-end/motion-blocks/core/registry';

let cachedProperties: KeyframePropertyDef[] | null = null;
let cachedMap: Map<string, KeyframePropertyDef> | null = null;

function buildPropertyList(): KeyframePropertyDef[] {
    ensureMotionBlockPluginsRegistered();
    const deduped = new Map<string, KeyframePropertyDef>();
    for (const plugin of listMotionBlockPlugins()) {
        for (const property of plugin.getKeyframeProperties?.() || []) {
            deduped.set(property.path, property);
        }
    }
    return [...deduped.values()];
}

function ensureBuilt(): void {
    if (!cachedProperties) {
        cachedProperties = buildPropertyList();
        cachedMap = new Map(cachedProperties.map((property) => [property.path, property]));
    }
}

export function getKeyframeableProperties(): KeyframePropertyDef[] {
    ensureBuilt();
    return cachedProperties!;
}

export function getPropertyDef(path: string): KeyframePropertyDef | undefined {
    ensureBuilt();
    return cachedMap!.get(path);
}

export function isPropertyKeyframeable(path: string): boolean {
    return !!getPropertyDef(path);
}
