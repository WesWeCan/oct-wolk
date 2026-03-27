---
name: motion-block-plugins
description: Build and extend in-repo motion block plugins for WOLK using the shared plugin registry, subtitle-first architecture, and required renderer/inspector/keyframe/gizmo/test hooks. Use when adding a new motion block, refactoring subtitle behavior, wiring plugin metadata into Motion Mode, or generating the full file set for a motion block plugin in this repository.
---

# Motion Block Plugins

## Use This Skill When
- The user wants a new motion block/plugin in WOLK.
- The user wants to refactor subtitle or another block into the plugin architecture.
- A motion feature touches renderer registration, keyframes, gizmo behavior, inspector integration, or saved block normalization.

## Source Of Truth
- Plugin contract: `src/front-end/motion-blocks/core/plugin-types.ts`
- Core rendering types: `src/front-end/motion-blocks/core/types.ts`
- Registry: `src/front-end/motion-blocks/core/registry.ts`
- Bootstrap: `src/front-end/motion-blocks/index.ts`
- Shared keyframe lookup: `src/front-end/utils/motion/keyframeProperties.ts`
- Shared resolver compatibility layer: `src/front-end/utils/motion/resolveMotionItems.ts`
- Inspector host: `src/front-end/components/editor/MotionInspectorHost.vue`
- Background inspector: `src/front-end/components/editor/BackgroundInspector.vue` (project-level, not plugin-owned)
- Current reference plugin: `src/front-end/motion-blocks/subtitle/`

## Architecture

### Rendering Model
Each motion block has its own `MotionBlockRenderer` instance. The compositor (`useMotionRenderer.ts`) iterates tracks in array order, calling each renderer's `render()` on a shared 2D canvas. Tracks are composited with painter's algorithm (later tracks on top). A future 3D block would internally manage a WebGL context and blit via `ctx.drawImage()` -- the compositor does not need to change.

### Inspector Architecture
Background editing is a project-level concern handled by `BackgroundInspector.vue`, rendered as a sibling to the block inspector host. Block editing is handled by `MotionInspectorHost.vue`, which resolves the plugin and renders the plugin's `inspectorComponent` with standard props and emits. The plugin owns its entire inspector UI.

Standard inspector props (all plugin inspectors receive these):
- `motionTrack`, `lyricTracks`, `playheadMs`, `fps`, `projectFont`, `renderWidth`, `renderHeight`, `rendererBounds`

Standard inspector emits:
- `update-track`, `seek-to-ms`

## Non-Negotiables
- Keep plugins in-repo under `src/front-end/motion-blocks/<plugin-name>/`.
- Do not break existing saved subtitle tracks while adding a new plugin.
- Unknown block types must degrade safely, not crash the editor.
- Keyframe and gizmo behavior must be owned by the plugin when semantics differ.
- Add or update motion tests for every plugin change.
- Shared UI primitives (e.g. `AnimatableNumberField.vue`) stay in `components/editor/motion/`.

## Required Plugin Files

```text
src/front-end/motion-blocks/<plugin-name>/
├── plugin.ts
├── defaults.ts
├── keyframes.ts
├── item-resolvers.ts
├── gizmo.ts
├── fonts.ts
├── renderer/
│   └── <PluginRenderer>.ts
└── inspector/
    ├── <PluginInspector>.vue
    └── tabs/
        └── (plugin-specific tab components)
```

Optional:
- `normalize.ts` if normalization grows large
- `params.ts` if plugin-specific params need explicit typing

## Required Plugin Contract
Implement a `MotionBlockPlugin` with:
- `type`
- `meta`
- `inspectorComponent` -- a Vue component that receives the standard inspector props/emits
- `createTrack()`
- `normalizeTrack()`
- `createRenderer()`
- `resolveActiveItems()`
- `resolveBlockItems()`
- `cleanOrphanedOverrides()` when the plugin stores source-linked overrides
- `collectFonts()` when the plugin depends on project/item/word font variants
- `getKeyframeProperties()` when the plugin has animatable properties
- `gizmo.getFallbackBounds()` and `gizmo.applyDelta()` when the block supports monitor manipulation

## Workflow
Copy this checklist and keep it current:

```text
Motion Plugin Progress
- [ ] Step 1: Define plugin defaults and params in defaults.ts
- [ ] Step 2: Implement plugin manifest in plugin.ts (with inspectorComponent)
- [ ] Step 3: Register plugin in src/front-end/motion-blocks/index.ts
- [ ] Step 4: Add renderer in renderer/<PluginRenderer>.ts
- [ ] Step 5: Add item resolvers or reuse shared semantics
- [ ] Step 6: Add keyframe definitions in keyframes.ts
- [ ] Step 7: Add gizmo behavior in gizmo.ts if the block is manipulable
- [ ] Step 8: Create inspector component in inspector/<PluginInspector>.vue
- [ ] Step 9: Add normalization and unknown-type safety
- [ ] Step 10: Add tests and run the motion test slice
```

## Implementation Rules

### 1. Defaults
- Put plugin defaults in `defaults.ts`.
- If the plugin inherits project font or timing defaults, do that in `createTrack()` and `normalizeTrack()`, not in `ProjectEditor.vue`.
- Do not introduce block-specific defaults into `src/types/project_types.ts`.

### 2. Registry
- Register the plugin in `src/front-end/motion-blocks/index.ts`.
- Mark `meta.authorable` correctly. Unsupported/internal plugins should not appear in add-track UI.

### 3. Renderer
- The renderer must satisfy `MotionBlockRenderer` from `motion-blocks/core/types.ts`.
- Each block instance gets its own renderer. Renderers draw onto the shared compositor canvas.
- If the plugin supports the monitor gizmo, expose meaningful bounds via `getLastBounds()`.
- If the plugin can safely no-op on unsupported data, do that instead of throwing during render.

### 4. Inspector
- The plugin provides its inspector UI via `inspectorComponent` on the plugin contract.
- The host (`MotionInspectorHost.vue`) renders it with standard props/emits.
- Plugin inspectors can import shared UI primitives from `components/editor/motion/` (e.g. `AnimatableNumberField.vue`).
- Plugin-specific tabs live in `inspector/tabs/` inside the plugin folder.
- Background editing is separate from block editing. Do not add background controls to plugin inspectors.
- For text-based blocks, keep one `Animation` section in the UI but separate the concerns clearly:
  - `Text Reveal` for character visibility (shared text-block behavior like typewriter)
  - `Motion` for fade / move / scale / easing (shared `MotionEnterExit` behavior)
  - `Lifecycle` for plugin-owned timing semantics (for example cloud `exitMode` / `exitDelayMs`)
- Do not stuff text-reveal fields into `MotionEnterExit` just because they appear near each other in the UI.

### 5. Keyframes
- Put plugin-owned keyframe definitions in `keyframes.ts`.
- Expose them through `getKeyframeProperties()`.
- Reuse shared keyframe lane infrastructure; do not fork `PropertyKeyframeLane.vue` unless absolutely necessary.

### 6. Gizmo
- Put plugin-owned geometry and delta logic in `gizmo.ts`.
- Core owns pointer plumbing in `useMotionGizmo.ts`.
- Plugin owns manipulation semantics and clamping rules.
- Return `autoKeyframePaths` from gizmo mutations when motion edits should write keys automatically.

### 7. Item Resolution
- If the plugin is lyric-backed, implement item resolution clearly in `item-resolvers.ts`.
- If the plugin stores overrides, implement orphan cleanup scoped only to that plugin type.
- Never let one plugin's cleanup mutate another plugin's tracks.
- Plugin-owned lifecycle rules belong in the resolver layer. The resolver should decide the effective timing window for an item before shared animation helpers run.
- If a text-based block needs content reveal, keep reveal timing explicit and separate from transform-channel enablement. Do not make typewriter depend on fade / move / scale being switched on.

### 8. Migration Safety
- `normalizeTrack()` must preserve compatible saved data.
- Unknown `block.type` values must not be coerced into a different plugin silently.
- If a plugin is removed, the fallback path should remain safe and visible.
- Shared text-reveal params should normalize in one shared helper so subtitle, cloud, and future text blocks do not drift in saved data shape.

### 9. Circular Dependency Prevention
- `keyframeProperties.ts` builds its lookup lazily (not at module load time) to avoid circular imports.
- If your plugin imports from shared utils that call `ensureMotionBlockPluginsRegistered()`, the lazy pattern prevents the circle.

## Tests
Add targeted tests in `tests/front-end/motion/`.

Minimum expectations:
- registry/bootstrap test
- plugin create/normalize test
- keyframe definition lookup test if new properties were added
- gizmo delta test if the plugin is manipulable
- renderer behavior/bounds test if rendering changed
- For text-based reveal changes, add tests at three layers:
  - shared reveal utility/config tests
  - inspector tests for mode-aware visibility
  - renderer/resolver tests that prove reveal still works when motion channels are disabled

Preferred command:

```bash
yarn vitest run tests/front-end/motion/<your-test-file>.test.ts
```

For broader motion verification:

```bash
yarn vitest run tests/front-end/motion/
```

## Pitfalls To Avoid
- Do not hardcode plugin creation defaults back into `ProjectEditor.vue`.
- Do not add global keyframe definitions for plugin-specific behavior.
- Do not let subtitle cleanup/normalization touch every motion track blindly.
- Do not assume unknown block types can be rendered as subtitle.
- Do not skip tests after touching registry, normalization, or gizmo logic.
- Do not add background controls to plugin inspectors (background is project-level).
- Do not couple text reveal to motion easing or transform-channel enablement unless that relationship is an intentional product decision.

## Reference Pattern
Use `src/front-end/motion-blocks/subtitle/` as the first-class example for:
- plugin defaults (`defaults.ts`)
- renderer implementation (`renderer/SubtitleRenderer.ts`)
- inspector component (`inspector/SubtitleInspector.vue`)
- inspector tabs (`inspector/tabs/`)
- item resolution (`item-resolvers.ts`)
- font collection (`fonts.ts`)
- keyframe contributions (`keyframes.ts`)
- gizmo fallback bounds and delta application (`gizmo.ts`)
- registry metadata (`plugin.ts`)
