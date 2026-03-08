/**
 * LEGACY SCAFFOLD: declarative animatable metadata for future advanced motion
 * modules.
 *
 * Why this file exists:
 * - The old scene editor had a richer animatable-property manifest than the
 *   current motion-block system.
 * - We want to preserve that idea without keeping scene docs or scene UI.
 *
 * Current status:
 * - This file is documentation-grade infrastructure.
 * - It is intentionally conservative and not wired into the inspector yet.
 *
 * Non-goals:
 * - Do not couple this manifest to legacy SceneRef or SceneDocumentBase.
 * - Do not assume worker execution.
 * - Do not replace the current motion keyframe property list yet.
 */

export type LegacyAnimatableValueType =
    | 'number'
    | 'boolean'
    | 'color'
    | 'vec2'
    | 'vec3'
    | 'select';

export interface LegacyAnimatableManifestEntry {
    path: string;
    label: string;
    type: LegacyAnimatableValueType;
    defaultValue: any;
    group?: string;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
    notes?: string;
}

export interface LegacyModuleManifestScaffold {
    id: string;
    label: string;
    status: 'scaffold';
    executionMode: 'canvas2d' | 'worker2d' | 'workerWebGL';
    notes: string;
    animatables: LegacyAnimatableManifestEntry[];
}

export const createLegacyModuleManifestScaffold = (
    manifest: Omit<LegacyModuleManifestScaffold, 'status'>,
): LegacyModuleManifestScaffold => {
    return {
        ...manifest,
        status: 'scaffold',
    };
};
