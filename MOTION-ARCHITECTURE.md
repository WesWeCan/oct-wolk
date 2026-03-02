# WOLK Motion Architecture — Phase 2 Redesign

> Last updated: 2026-03-02
> Status: Design document — awaiting approval before implementation
> Context: This supersedes the original PRD Section 4.2 for Motion Mode.

---

## 0) Context & State of the Codebase

### What exists and is STABLE (Layer A — Lyric Mode)

Phase 1 is complete. The lyric timeline system is fully functional:

- `src/types/project_types.ts` — `WolkProject`, `LyricTrack`, `TimelineItem` types
- `src/front-end/views/ProjectEditor.vue` — full editor with mode toggle (`lyric | motion`)
- `src/front-end/components/timeline/lanes/LyricTrackLane.vue` — drag/trim/snap timeline items
- `src/front-end/components/editor/ItemInspector.vue` — item text/timing editing
- `src/front-end/components/editor/TrackListPanel.vue` — track CRUD + generators
- `src/front-end/components/editor/RawLyricsPanel.vue` — TipTap raw lyrics editing
- `src/front-end/utils/lyricTrackGenerators.ts` — verse → line → word generation
- `src/front-end/composables/editor/useUndoRedo.ts` — snapshot undo/redo
- Full keyboard shortcuts, autosave, copy/cut/paste

**Lyric tracks are the source of truth. Nothing in Motion Mode mutates them.**

### What exists but is DEPRECATED (Old Scene Engine)

The v1 editor had a Three.js-based scene engine with word clouds, word spheres, 3D models, and portrait masks. This code **still exists** and **should not be deleted**, but it is not part of the Motion Mode MVP. It will be adapted later (Phase 4+) to consume lyric track data instead of the old word bank system.

**Deprecated files (keep, do not use for Motion MVP):**

| File | What it does | Future potential |
|------|-------------|-----------------|
| `src/front-end/workers/engine/SceneEngine.ts` | OffscreenCanvas scene renderer in Web Worker | Could host 3D motion block types later |
| `src/front-end/workers/engine/SceneRegistry.ts` | Factory pattern for scene types | Pattern to reuse for motion block type registry |
| `src/front-end/workers/engine/types.ts` | `WorkerScene` interface, seed RNG utilities | **Reuse seed/RNG system** (see §1.6) |
| `src/front-end/workers/scenes/WordCloudScene.ts` | 2D word cloud renderer | Inspiration for future motion block type |
| `src/front-end/workers/scenes/SingleWordScene.ts` | Single word display, audio-reactive | Inspiration for "flash" motion block type |
| `src/front-end/workers/scenes/WordSphereScene.ts` | 3D word sphere (Three.js) | Future 3D motion block type |
| `src/front-end/workers/scenes/ModelScene.ts` | 3D model with labels (Three.js) | Future 3D motion block type |
| `src/front-end/workers/scenes/PortraitMaskScene.ts` | Portrait mask fill | Future motion block type |
| `src/front-end/workers/scenes/animatables.ts` | Per-scene keyframeable property metadata | Pattern to reuse for motion block params |
| `src/front-end/composables/editor/useFrameEvaluation.ts` | Beat/word index per frame | Adapt for motion block audio reactivity |
| `src/front-end/composables/editor/useFrameRenderer.ts` | Sends frame data to worker | Adapt for motion renderer |
| `src/front-end/composables/editor/useRenderWorker.ts` | Worker lifecycle management | May adapt for worker-based motion rendering later |
| `src/front-end/composables/editor/useWorkerSceneConfig.ts` | Scene config to worker bridge | Replace with motion config bridge |
| `src/front-end/utils/timeline/wordPoolEvaluation.ts` | Old word pool system | Replaced by lyric track consumption |
| `src/front-end/composables/editor/useActionTracks.ts` | Old action/override system | Replaced by motion block overrides |

### What exists and is REUSABLE

| Component | Path | How to reuse |
|-----------|------|-------------|
| Keyframe interpolation | `src/front-end/utils/tracks.ts` | `evalInterpolatedAtFrame()`, `upsertKeyframe()` — use directly for motion property animation |
| Easing functions | `src/front-end/utils/easing.ts` | Use for motion enter/exit curves |
| Seed RNG utilities | `src/front-end/workers/engine/types.ts` | `createMulberry32()`, `deriveSeed()`, `hashStringToUint32()` — extract into shared utility |
| Timeline viewport | `src/front-end/components/timeline/useTimelineViewport.ts` | Shared zoom/pan for motion tracks |
| Snap engine | `src/front-end/composables/timeline/useSnapEngine.ts` | Snap motion blocks to lyric items, beats |
| Audio player | `src/front-end/composables/editor/useAudioPlayer.ts` | Shared playback |
| Audio analysis | `src/front-end/composables/editor/useAudioAnalysis.ts` | Beat/energy data for audio-reactive presets |
| Preview canvas | `src/front-end/composables/editor/usePreviewCanvas.ts` | Dual-canvas pattern for motion preview |
| TipTap integration | `src/front-end/components/TipTapLyricAnalyzer.vue` | Adapt for per-item rich text overrides |
| Font service | `src/front-end/services/FontsService.ts` | Font loading for motion renderer |
| Undo/redo | `src/front-end/composables/editor/useUndoRedo.ts` | Already project-wide snapshots |
| Export pipeline | `src/front-end/composables/editor/useVideoExport.ts` | Adapt for motion canvas export |

---

## 1) Core Concepts

### 1.1 Motion Blocks (not "Motion Layers")

The old PRD described `MotionLayer` as a persistent layer that always consumes a lyric track. **We are replacing this** with a more flexible concept: **Motion Blocks**.

A **motion block** is a discrete item on a motion track. It:
- Has a **start time** and **end time** on the timeline (like a lyric item, but on a motion track)
- Has a **type** that determines how it renders (like scenes have types)
- **Consumes** lyrics from a selected source lyric track during its active time
- Has its own **style**, **transform**, and **type-specific parameters**
- Can have **per-item overrides** for the lyric items it consumes (text replacement, hide, style tweaks)

This is analogous to how the old scene system worked: scenes had types (wordcloud, singleWord, etc.), each with its own renderer and parameters. Motion blocks follow the same pattern.

### 1.2 Motion Tracks (One Block Per Track)

Motion blocks live on **motion tracks** in the timeline. A motion track:
- Is visually similar to a lyric track lane in the timeline
- Contains **exactly one motion block** (the track IS the block, conceptually)
- Has a name, color, and visibility controls (enabled/disabled)
- Motion tracks on **different tracks CAN overlap** — they composite in track order (top = front)
- Tracks can be **duplicated** (duplicates the track + its block, creates a new independent copy)

**Why one block per track:** This is the least error-prone design. Each track represents one visual element on screen. Multiple elements = multiple tracks. This avoids complex within-track block management and makes the timeline immediately readable — each lane is one "thing" on screen. It also matches how users think: "I want words at the top AND a subtitle at the bottom" = two tracks, not two blocks on one track.

**Creating a new motion track:** The user picks a motion block type from a list (like choosing a scene type). This creates a new track with a single block. The block starts at the playhead position with a **default duration of 5 seconds** (clamped to not exceed the audio end). The user then trims/extends it as needed.

### 1.3 Motion Block Types

Each motion block type is a **pluggable renderer** with its own logic for consuming lyric items and drawing to canvas. MVP types:

| Type | Display | How it consumes lyrics |
|------|---------|----------------------|
| `subtitle` | Shows full text of each active lyric item, like film subtitles | Renders whichever lyric items are active during the block's time range. One item visible at a time. Whole item fades in/out as a unit. |
| `wordReveal` | Shows words appearing one by one | Each word from the source track gets individual enter/exit animation. Words accumulate or replace based on config. |
| `paragraph` | Shows a full paragraph/verse block | Pulls all items from the source track that fall within the block's time range. Lays them out as flowing text. Individual word opacity based on each item's timing. |

**Future types (not MVP, but the architecture must support them):**
- `flash` — SpaceTypeGenerator-inspired rapid word flash
- `typewriter` — Character-by-character reveal
- `verticalStack` — Words stacked vertically
- `3dText` — Three.js text rendering (reuses old scene engine)

Each type is registered in a **MotionBlockRegistry** (same pattern as `SceneRegistry`).

### 1.4 Source Track Binding

A motion block has a `sourceTrackId` that points to a `LyricTrack`. The motion block renderer reads lyric items from that track during its active time window.

Since each motion track has exactly one block, the source track selection is effectively per-track.

When the user creates a motion track, they pick:
1. The block type (subtitle, wordReveal, paragraph)
2. The source lyric track (from a dropdown of available lyric tracks)

**Lyric items do not overlap within a track** (enforced in lyric mode). This simplifies resolution: at any given time, there is at most one active item per source track. The motion block acts as a container window — it only renders lyric items whose timing falls within the block's start/end range.

### 1.4.1 Dangling Reference Protection

Motion blocks reference lyric tracks and items by ID. These references can break if the user modifies lyrics:

**Scenario: Source track deleted**
- If a lyric track is deleted and a motion block references it via `sourceTrackId`, the block shows "Source track missing" in the inspector and renders nothing.
- The motion block is NOT auto-deleted — the user can reassign a different source track.

**Scenario: Lyric items changed (split/merge/delete)**
- If an item referenced by an `ItemOverride.sourceItemId` no longer exists, the override is **silently skipped** (graceful degradation). The block renders using the original lyric text for any unmatched overrides.
- When switching to motion mode, run a **cleanup pass**: scan all motion blocks for orphaned override references. Show a non-blocking toast: "Some item overrides were removed because the source lyrics changed." Remove the orphaned entries from the data.

**Implementation:** Add a utility function `cleanOrphanedOverrides(project: WolkProject)` that:
1. For each motion track → block → overrides, check if `sourceItemId` still exists in the source track
2. Remove overrides that reference non-existent items
3. Return a count of removed overrides (for the toast notification)

Call this on mode switch to motion AND on project load.

### 1.5 Per-Item Overrides

When a motion block is active, it consumes lyric items from its source track. The user can override individual items **without changing the source lyrics**:

```
ItemOverride {
    sourceItemId: string      // references TimelineItem.id in the source lyric track
    hidden: boolean           // skip this item entirely
    textOverride?: string     // rich text (TipTap JSON) — replaces display text
    styleOverride?: Partial<MotionStyle>  // per-item style tweaks (bold, color, etc.)
    transformOverride?: Partial<MotionTransform>  // per-item position tweaks
}
```

The override is stored on the motion block. The source lyric item is never modified.

**Rich text editing for overrides:** We reuse TipTap in the inspector panel. When editing an override, the user sees a small TipTap editor initialized with the original lyric text. They can make it bold, italic, change case, etc. The TipTap JSON is stored in `textOverride`.

### 1.6 Seed System (Reused from Scene Engine)

The existing seeded RNG system (`createMulberry32`, `deriveSeed`, `hashStringToUint32` in `src/front-end/workers/engine/types.ts`) provides deterministic randomness for reproducible renders.

**Action:** Extract these three functions into a new shared utility file:
`src/front-end/utils/seededRng.ts`

Motion block types that need randomness (e.g., `wordReveal` with randomized word order, or `flash` with random positions) use this system. The project's `settings.seed` feeds the base seed, and each motion block derives its own scoped RNG from its `id`.

This ensures:
- Same seed → same visual output (reproducible exports)
- Different blocks get different but deterministic random sequences

---

## 2) Data Model Changes

### 2.1 New Types (replace old MotionLayer)

The existing `MotionLayer`, `SnippetOverride` types in `project_types.ts` are **replaced** by the following:

```ts
// ---- Layer B: Motion Mode (REVISED) ----------------------------------------

export type MotionBlockType = 'subtitle' | 'wordReveal' | 'paragraph';
// Future: 'flash' | 'typewriter' | 'verticalStack' | '3dText'

export interface MotionEnterExit {
    // Dynamic duration that adapts to item length
    fraction: number;       // fraction of item duration (0-1), e.g., 0.3 = 30% of item time
    minFrames: number;      // floor clamp in frames, e.g., 3 (= 50ms at 60fps) — prevents too-fast animation
    maxFrames: number;      // ceiling clamp in frames, e.g., 30 (= 500ms at 60fps) — prevents too-slow animation
    easing: string;         // easing function name from utils/easing.ts, e.g., 'easeOutCubic'
    style: 'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale' | 'none';
    // 'none' = instant appear/disappear (cut)
    // Inspector shows min/max in ms for user convenience (converted via fps)
}

export interface ItemOverride {
    sourceItemId: string;
    hidden: boolean;
    textOverride?: string;              // TipTap JSON for rich text override
    styleOverride?: Partial<MotionStyle>;
    transformOverride?: Partial<MotionTransform>;
}

export interface MotionBlock {
    id: string;
    type: MotionBlockType;
    sourceTrackId: string;              // which LyricTrack to consume
    startMs: number;
    endMs: number;
    style: MotionStyle;                 // shared style (font, color, size, etc.)
    transform: MotionTransform;         // shared position (anchor, offset, scale, rotation)
    enter: MotionEnterExit;             // how items animate in
    exit: MotionEnterExit;              // how items animate out
    overrides: ItemOverride[];          // per-lyric-item visual overrides
    params: Record<string, any>;        // type-specific parameters
    propertyTracks: PropertyTrack[];    // keyframe animation on block properties over time
}

export interface MotionTrack {
    id: string;
    name: string;
    color: string;
    enabled: boolean;
    collapsed: boolean;
    block: MotionBlock;                 // exactly ONE block per track
}
```

### 2.2 MotionStyle (kept, slightly extended)

```ts
export interface MotionStyle {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    fontStyle: 'normal' | 'italic' | 'oblique';
    textCase: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
    letterSpacing: number;              // NEW: px, for spread-out text effects
    lineHeight: number;                 // NEW: multiplier, for paragraph blocks
    color: string;
    opacity: number;
    backgroundColor: string | null;
    backgroundPadding: number;
}
```

### 2.3 MotionTransform (kept as-is)

```ts
export interface MotionTransform {
    anchorX: 'left' | 'center' | 'right';
    anchorY: 'top' | 'center' | 'bottom';
    offsetX: number;
    offsetY: number;
    scale: number;
    rotation: number;
}
```

### 2.4 Updated WolkProject

```ts
export interface WolkProject {
    id: string;
    version: 2;
    song: WolkProjectSong;
    settings: WolkProjectSettings;
    font: WolkProjectFont;
    rawLyrics: string;
    lyricTracks: LyricTrack[];
    motionTracks: MotionTrack[];        // CHANGED from motionLayers: MotionLayer[]
    backgroundImage?: string;           // NEW: optional background image path (wolk:// protocol)
    backgroundColor: string;            // NEW: default '#000000', can be 'transparent'
    createdAt: number;
    updatedAt: number;
}
```

### 2.5 PropertyTrack on Motion Blocks

Motion blocks can have keyframe tracks that animate their properties over time. This reuses the existing `PropertyTrack` / `Keyframe` system from `src/types/timeline_types.ts` and the `evalInterpolatedAtFrame()` function from `src/front-end/utils/tracks.ts`.

Example: a motion block's `transform.offsetY` could be keyframed to drift upward over 10 seconds. The keyframes are stored in `block.propertyTracks` and evaluated per-frame during rendering.

**Decision: EVERYTHING is frame-based.** Keyframes store `frame: number` (frame index at the project's FPS), consistent with the existing keyframe system. The inspector UI shows time in ms for user convenience using frame↔ms conversion: `ms = frame * 1000 / fps` and `frame = Math.round(ms * fps / 1000)`. This avoids confusion between two different keyframe conventions.

**Note:** `MotionBlock.startMs` and `endMs` remain in milliseconds (matching `TimelineItem` convention for the timeline UI), but keyframe tracks within the block use frame numbers. The conversion happens at the boundary between timeline UI (ms) and keyframe evaluation (frames).

### 2.6 Project Duration Without Audio

If no audio file is loaded, the project needs a **manual duration setting**. Add to `WolkProjectSettings`:

```ts
export interface WolkProjectSettings {
    fps: number;
    renderWidth: number;               // custom canvas resolution
    renderHeight: number;              // custom canvas resolution
    seed: string;
    durationMs: number;                // NEW: manual project duration in ms (used when no audio)
    exportBitrateMbps?: number;
    includeAudio?: boolean;
}
```

**Behavior:**
- If audio is loaded, project duration = audio duration (auto-detected)
- If no audio is loaded, project duration = `settings.durationMs` (default: 30000 = 30 seconds)
- The user can always override the duration manually in the Project Inspector
- Timeline, playback, and export all use this resolved duration

### 2.7 Custom Canvas Resolution

The project already has `renderWidth` and `renderHeight` in `WolkProjectSettings`. These define the canvas size for both preview and export. The OffscreenCanvas render target is sized to these dimensions.

**The motion renderer uses the same OffscreenCanvas pattern** as the existing preview system (`usePreviewCanvas`). The render canvas is created at `renderWidth × renderHeight` and the preview display scales it to fit the preview panel while maintaining aspect ratio.

**In the Project Inspector**, add width/height controls with common presets:
- 1920×1080 (HD landscape)
- 1080×1920 (HD portrait / phone)
- 1080×1080 (square)
- 3840×2160 (4K)
- Custom (free input)

---

## 3) Rendering Architecture

### 3.1 Main Thread Canvas 2D (MVP)

The motion renderer runs on the **main thread** using Canvas 2D. This is different from the old scene engine which runs in a Web Worker with OffscreenCanvas.

**Why main thread for MVP:**
- Font loading in Web Workers is unreliable and was flagged as an issue
- Canvas 2D text rendering is fast enough for styled text
- TipTap rich text → canvas conversion is simpler on main thread
- We avoid the Worker message-passing complexity for the MVP
- The old Worker pipeline remains available for future 3D motion block types

**Rendering pipeline per frame:**

```
1. Convert currentMs to currentFrame: frame = Math.round(ms * fps / 1000)
2. Clear canvas (transparent or backgroundColor)
3. If backgroundImage is set, draw it
4. For each enabled motion track (bottom to top = back to front):
   a. Get the track's block. Convert block startMs/endMs to frames. If currentFrame is outside range, skip.
   b. Resolve source lyric items active at currentFrame (items store ms, convert at resolution time)
   c. Apply per-item overrides (hidden, textOverride, styleOverride) — skip orphaned refs
   d. Compute enter/exit animation state for each item (all in frame units)
   e. Evaluate block propertyTracks at currentFrame (keyframes stored as frame numbers)
   f. Call the block type's renderer with all resolved data
   g. The renderer draws to canvas with globalAlpha, transforms, etc.
```

**Frame/ms boundary rule:** The project data model stores timing in ms (`startMs`, `endMs` on blocks and items) for timeline UI consistency. Keyframe tracks store frame numbers. All rendering math operates in frames. Conversion happens at the boundary when reading ms values into the render pipeline.

### 3.2 Motion Block Renderer Interface

Each motion block type implements this interface:

```ts
export interface MotionBlockRenderer {
    /**
     * Called once when the block type is first used.
     * Opportunity to precompute layouts, load assets, etc.
     */
    prepare(block: MotionBlock, sourceItems: TimelineItem[]): void;

    /**
     * Render one frame of this motion block.
     *
     * @param ctx          - Canvas 2D rendering context (OffscreenCanvas context)
     * @param block        - The motion block being rendered
     * @param activeItems  - Lyric items active at this frame (already filtered + overrides applied)
     * @param currentFrame - Current frame number
     * @param fps          - Project frames per second (for any time-based calculations)
     * @param canvasSize   - { width, height } of the render canvas
     * @param animatedProps - Evaluated keyframe values for this frame
     * @param rng          - Seeded RNG scoped to this block
     */
    render(
        ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        block: MotionBlock,
        activeItems: ResolvedItem[],
        currentFrame: number,
        fps: number,
        canvasSize: { width: number; height: number },
        animatedProps: Record<string, any>,
        rng: SeedRng,
    ): void;

    /**
     * Cleanup when block is removed or type changes.
     */
    dispose(): void;
}

/**
 * A lyric item after override resolution, ready for rendering.
 */
export interface ResolvedItem {
    id: string;
    text: string;                       // original or overridden text
    richText?: any;                     // TipTap JSON if rich text override exists
    startMs: number;
    endMs: number;
    enterProgress: number;              // 0 = just entering, 1 = fully entered
    exitProgress: number;               // 0 = fully visible, 1 = fully exited
    isActive: boolean;                  // true if currentMs is within startMs..endMs
    style: MotionStyle;                 // merged (block default + per-item override)
    transform: MotionTransform;         // merged (block default + per-item override)
}
```

### 3.3 MotionBlockRegistry

Same pattern as `SceneRegistry`:

```ts
// src/front-end/motion/MotionBlockRegistry.ts

const registry = new Map<MotionBlockType, () => MotionBlockRenderer>();

export function registerBlockType(type: MotionBlockType, factory: () => MotionBlockRenderer) {
    registry.set(type, factory);
}

export function createBlockRenderer(type: MotionBlockType): MotionBlockRenderer {
    const factory = registry.get(type);
    if (!factory) throw new Error(`Unknown motion block type: ${type}`);
    return factory();
}

// Register MVP types
registerBlockType('subtitle', () => new SubtitleRenderer());
registerBlockType('wordReveal', () => new WordRevealRenderer());
registerBlockType('paragraph', () => new ParagraphRenderer());
```

### 3.4 Enter/Exit Animation Resolution

The `MotionEnterExit` config uses dynamic duration. Here's how to compute the actual animation progress for a given item:

```ts
function computeEnterExitProgress(
    item: TimelineItem,
    currentFrame: number,
    fps: number,
    enter: MotionEnterExit,
    exit: MotionEnterExit,
): { enterProgress: number; exitProgress: number } {
    // Convert item timing to frames
    const startFrame = Math.round(item.startMs * fps / 1000);
    const endFrame = Math.round(item.endMs * fps / 1000);
    const itemDurationFrames = endFrame - startFrame;
    const elapsed = currentFrame - startFrame;
    const remaining = endFrame - currentFrame;

    // Enter duration: fraction of item duration in frames, clamped
    const enterFrames = Math.max(enter.minFrames, Math.min(enter.maxFrames, Math.round(itemDurationFrames * enter.fraction)));
    // Exit duration: fraction of item duration in frames, clamped
    const exitFrames = Math.max(exit.minFrames, Math.min(exit.maxFrames, Math.round(itemDurationFrames * exit.fraction)));

    // Enter progress: 0 = just started, 1 = fully entered
    let enterProgress = 1;
    if (enter.style !== 'none' && elapsed < enterFrames) {
        enterProgress = applyEasing(elapsed / enterFrames, enter.easing);
    }

    // Exit progress: 0 = fully visible, 1 = fully exited
    let exitProgress = 0;
    if (exit.style !== 'none' && remaining < exitFrames) {
        exitProgress = applyEasing(1 - remaining / exitFrames, exit.easing);
    }

    return { enterProgress, exitProgress };
}
```

This means (at 60fps):
- A 6-frame word (100ms) with `fraction: 0.3, minFrames: 2, maxFrames: 30` → 2 frames enter (6 * 0.3 = 1.8, clamped to min 2)
- A 120-frame verse (2000ms) with same config → 30 frames enter (120 * 0.3 = 36, clamped to max 30)

**Inspector display:** The inspector shows min/max in milliseconds for user convenience. Conversion: `ms = frames * 1000 / fps`. At 60fps, minFrames=2 shows as "33ms", maxFrames=30 shows as "500ms".

### 3.5 Future: 3D Motion Block Types via Worker

When 3D motion block types are added (Phase 4+), they will use the existing `SceneEngine` + Web Worker pipeline. The motion compositor will:
1. Render 2D blocks on the main-thread canvas
2. Render 3D blocks on the Worker OffscreenCanvas
3. Composite both canvases together for the final output

This is why the scene engine code is deprecated but **not deleted**. The `WorkerScene` interface, `SceneRegistry` pattern, and seed RNG system are all designed to be reused.

**Note:** The seed RNG functions should be extracted from `src/front-end/workers/engine/types.ts` into `src/front-end/utils/seededRng.ts` so both the main-thread motion renderer and the Worker scene engine can import them without cross-dependency.

---

## 4) UI Architecture

### 4.1 Mode Toggle Behavior

The existing `mode: 'lyric' | 'motion'` ref in `ProjectEditor.vue` controls what's visible:

| Element | Lyric Mode | Motion Mode |
|---------|-----------|-------------|
| Left panel | Track list + raw lyrics + generators | Motion track list + add motion type |
| Timeline lanes (top) | Lyric track lanes (editable) | Lyric track lanes (**locked**, dimmed) |
| Timeline lanes (middle) | — | Motion track lanes (editable) |
| Timeline lanes (bottom) | Waveform + analysis | Waveform + analysis |
| Right panel (inspector) | Item inspector (text, timing, split/merge) | Block inspector (type, source, style, transform, overrides) |
| Preview canvas | Basic lyric text preview | Full motion render (composited blocks on canvas) |

**Timeline lane ordering (top to bottom):**
1. Lyric track lanes — locked in motion mode (editable in lyric mode)
2. Motion track lanes — editable in motion mode (hidden in lyric mode)
3. Waveform / analysis lanes — always visible, always at bottom

**Lyric tracks are automatically locked in motion mode.** They remain visible as reference (showing the timing of words/sentences/verses) but cannot be edited. The user must switch back to lyric mode to edit lyrics. This prevents accidental changes to the source of truth while working on visuals.

**All standard UX patterns from lyric mode carry over to motion mode:**
- Copy/paste tracks (`Cmd/Ctrl+C`, `Cmd/Ctrl+V` on selected track → duplicates track + block)
- Drag to move blocks on timeline, trim edges to resize
- Keyboard shortcuts: `Space` play/pause, `Delete` to delete selected track, arrows to nudge block position, `Cmd+Z` undo, `Cmd+Shift+Z` redo
- Snap to lyric item boundaries, beat markers, playhead (via existing `useSnapEngine`)

### 4.2 UX Flow: First Time in Motion Mode

When the user switches to motion mode for the first time (no motion tracks yet):

1. Left panel shows an empty track list with a prominent **"+ Add Motion"** button
2. Clicking it shows a **type picker** — a simple list/grid of available motion types:
   - **Subtitle** — "Show one line at a time, like film subtitles"
   - **Word Reveal** — "Words appear one by one with animation"
   - **Paragraph** — "Full text block with per-word timing"
3. After picking a type, a **source track dropdown** appears — "Which lyric track should this use?"
4. A new motion track + block is created:
   - Track named after type + source (e.g., "Subtitle — Words")
   - Block starts at playhead, 5 seconds long (clamped to audio end)
   - Default style from project font settings
   - Default transform: centered
5. The preview immediately shows the motion render — **live feedback from the start**
6. The inspector opens showing the new block's properties

**This gets the user from "empty" to "seeing something" in 3 clicks.**

**Edge case: no lyric tracks exist.** If the user enters motion mode with zero lyric tracks, the type picker still works but the source track dropdown shows "No lyric tracks available — switch to Lyric mode to create tracks." The "+ Add Motion" button remains active so the user can see the picker, but creating a track is blocked until a source exists.

### 4.3 Motion Track Lane (New Component)

`src/front-end/components/timeline/lanes/MotionTrackLane.vue`

Since each track has exactly one block, the lane shows:
- The single block as a colored rectangle spanning its time range
- Block shows: type icon + track name + source track name
- The block can be dragged (move) and trimmed (resize edges)
- Blocks snap to lyric item boundaries, beats, playhead
- Click to select, inspector shows block properties
- Empty areas before/after the block are visible but inactive

### 4.3 Motion Inspector (New Component)

`src/front-end/components/editor/MotionInspector.vue`

When a motion block is selected, the inspector shows:

**Section: Block Settings**
- Type selector (dropdown: subtitle / wordReveal / paragraph)
- Source track selector (dropdown of lyric tracks)
- Start/end time (editable, like ItemInspector)

**Section: Style**
- Font family (project font or override)
- Font size, weight, style
- Text case (none / uppercase / lowercase / capitalize)
- Letter spacing, line height
- Color picker
- Opacity slider
- Background color (or transparent)
- Background padding

**Section: Transform**
- Anchor X (left / center / right)
- Anchor Y (top / center / bottom)
- Offset X, Offset Y (number inputs + drag handle on preview)
- Scale, Rotation

**Section: Enter/Exit Animation**
- Enter style (fade / slideUp / slideDown / slideLeft / slideRight / scale / none)
- Enter fraction (slider 0-1)
- Enter min/max (displayed in ms for user convenience, stored as frames internally)
- Enter easing (dropdown)
- Same controls for exit

**Section: Type-Specific Parameters**
- Shown/hidden based on block type
- e.g., `wordReveal` might have: `accumulate: boolean` (words stay or replace)

**Section: Item Overrides**
- List of lyric items that fall within this block's time range
- Each shows: original text, hidden toggle, "Edit" button
- "Edit" opens TipTap rich text editor for that item's textOverride
- Per-item style/transform overrides (expandable per item)

### 4.5 Motion Track List Panel (New Component)

`src/front-end/components/editor/MotionTrackListPanel.vue`

Left panel in motion mode:
- **"+ Add Motion"** button at top → opens type picker + source selector (see §4.2)
- List of motion tracks with:
  - Enable/disable toggle (eye icon)
  - Track name (editable on double-click)
  - Track color indicator
  - Type badge (ST / WR / PG)
  - Source track name (small text)
- Drag to reorder (changes z-order: top of list = rendered in front)
- Track context menu: rename, duplicate track (creates independent copy), delete
- **Duplicate** is the primary way to create similar motion elements — duplicate a styled track, reposition it, change the source

### 4.6 Project Inspector Additions

In the Project Inspector (`ProjectInspector.vue`), add:

**Canvas Resolution:**
- Width × Height inputs with preset buttons: 1920×1080, 1080×1920, 1080×1080, 3840×2160, Custom
- Changes apply to the OffscreenCanvas render target and preview aspect ratio

**Project Duration (when no audio):**
- Duration input in seconds (converted to ms internally)
- Only shown when no audio file is loaded
- When audio is loaded, duration auto-detects from audio and this field is read-only

**Background:**
- Background color picker (with "transparent" option)
- Background image upload
- Background image fit mode (cover / contain / stretch)

All of these are global to the project, not per-block.

---

## 5) Implementation Steps (Detailed)

Each step is designed to be independently testable and small enough for a single session.

### Step 1: Extract Seed RNG to Shared Utility

**What:** Move `createMulberry32`, `deriveSeed`, `hashStringToUint32` from `src/front-end/workers/engine/types.ts` to a new file `src/front-end/utils/seededRng.ts`. Update the import in `types.ts` to re-export from the new location (no breakage).

**Files to create:**
- `src/front-end/utils/seededRng.ts`

**Files to modify:**
- `src/front-end/workers/engine/types.ts` — change to import + re-export from `seededRng.ts`

**Test:** Old scene engine still works (it re-exports). New file can be imported independently.

---

### Step 2: Update Data Model Types

**What:** Replace `MotionLayer` and `SnippetOverride` in `project_types.ts` with the new types: `MotionBlock`, `MotionTrack`, `MotionBlockType`, `MotionEnterExit`, `ItemOverride`. Update `WolkProject` to use `motionTracks: MotionTrack[]` instead of `motionLayers: MotionLayer[]`. Add `backgroundImage`, `backgroundColor`. Add `letterSpacing`, `lineHeight` to `MotionStyle`. Add defaults for new types.

**Files to modify:**
- `src/types/project_types.ts`

**Files to check for breakage:**
- `src/front-end/views/ProjectEditor.vue` — references `motionLayers` in project type
- `src/back-end/internal-processes/project-storage.ts` — serializes project data
- `src/front-end/services/ProjectService.ts` — project CRUD

**Test:** Project still loads. `motionTracks` defaults to `[]`. No runtime errors.

---

### Step 3: Enter/Exit Animation Utilities

**What:** Create utility functions for computing enter/exit progress. This is pure logic, no UI.

**Files to create:**
- `src/front-end/utils/motion/enterExitAnimation.ts`

Contents:
- `computeEnterExitProgress(item, currentFrame, fps, enter, exit)` — returns `{ enterProgress, exitProgress }`
- `applyEnterExitToAlpha(enterProgress, exitProgress, enterStyle, exitStyle)` — returns opacity 0-1
- `applyEnterExitToTransform(enterProgress, exitProgress, enterStyle, exitStyle)` — returns `{ translateX, translateY, scale }` offsets
- `msToFrame(ms, fps)` and `frameToMs(frame, fps)` — conversion helpers used throughout

**Test:** Unit-testable. Given a 60-frame item (1000ms at 60fps) at frame 12 with fraction=0.3 → enterProgress should be ~0.67. Given frame 57 with exit fraction=0.2 → exitProgress should be ~0.75.

---

### Step 4: Lyric Item Resolution for Motion Blocks

**What:** Create a function that, given a motion block and the source lyric track, resolves which items are active at a given time and applies overrides.

**Files to create:**
- `src/front-end/utils/motion/resolveMotionItems.ts`

Contents:
- `resolveActiveItems(block, sourceTrack, currentFrame, fps)` → `ResolvedItem[]`
  1. Filter source track items to those whose timing falls within block's start/end range
  2. Filter to those active at currentFrame (convert item ms to frames)
  3. Apply overrides (hidden, textOverride, styleOverride, transformOverride) — skip orphaned overrides gracefully
  4. Compute enterProgress/exitProgress for each
  5. Return resolved items ready for rendering
- `cleanOrphanedOverrides(project: WolkProject)` → `{ removedCount: number }`
  1. For each motion track → block → overrides, check if `sourceItemId` exists in the source track
  2. Check if `sourceTrackId` still references a valid lyric track
  3. Remove orphaned override entries
  4. Return count of removals (for toast notification)

**Test:** Unit-testable.
- Given a block spanning 0-5000ms consuming a word track, at frame 150 (2500ms at 60fps), returns the active word(s) with correct enter/exit progress.
- Given a block with an override referencing a deleted item, `cleanOrphanedOverrides` removes it and returns count=1.
- Given a block referencing a deleted source track, resolution returns empty array (renders nothing).

---

### Step 5: Motion Block Renderer Interface + Registry

**What:** Create the `MotionBlockRenderer` interface and `MotionBlockRegistry`. No actual renderers yet — just the interface and the registration mechanism.

**Files to create:**
- `src/front-end/motion/types.ts` — `MotionBlockRenderer` interface, `ResolvedItem` type
- `src/front-end/motion/MotionBlockRegistry.ts` — `registerBlockType()`, `createBlockRenderer()`

**Test:** Registry can register and retrieve a dummy renderer.

---

### Step 6: Subtitle Renderer (First Block Type)

**What:** Implement `SubtitleRenderer` — the simplest motion block type. Shows the text of the currently active lyric item, centered per the block's transform, with enter/exit fade.

**Files to create:**
- `src/front-end/motion/renderers/SubtitleRenderer.ts`

**Behavior:**
1. Find the single active `ResolvedItem` (if multiple overlap, show the latest by startMs)
2. Apply enter/exit animation (opacity fade + optional slide)
3. Measure text with `ctx.measureText()` for positioning
4. Apply transform (anchor, offset, scale, rotation via `ctx.setTransform()`)
5. Apply style (font, color, case, background rect, padding)
6. Draw text with `ctx.fillText()` at computed position with `globalAlpha`

**Test:** Create a subtitle block manually in code, draw to a test canvas, verify text appears with correct style and fades.

---

### Step 7: WordReveal Renderer (Second Block Type)

**What:** Implement `WordRevealRenderer` — shows words from the source track one by one, each with individual enter/exit animation.

**Files to create:**
- `src/front-end/motion/renderers/WordRevealRenderer.ts`

**Behavior:**
1. Resolve all lyric items in the block's time range
2. For each item: compute individual enter/exit progress based on that item's startMs/endMs
3. Render each word at the block's position (single-word display: current word centered)
4. Apply per-word opacity from enter/exit progress
5. If type param `accumulate: true`, previously-entered words remain visible (list mode)
6. If type param `accumulate: false`, only the current word is visible (replace mode)

**Test:** Create a wordReveal block consuming a word track, verify words appear sequentially.

---

### Step 8: Paragraph Renderer (Third Block Type)

**What:** Implement `ParagraphRenderer` — shows a flowing text block with per-word opacity based on lyric timing.

**Files to create:**
- `src/front-end/motion/renderers/ParagraphRenderer.ts`

**Behavior:**
1. Resolve all lyric items that fall within the block's time range
2. Layout all words as a flowing paragraph (word wrap based on available width from transform)
3. For each word: compute its opacity from its lyric item's timing + enter/exit animation
4. Draw each word at its layout position with its individual opacity
5. Apply block-level style and transform to the whole paragraph

**Implementation detail for paragraph layout:**
- `measureText()` each word
- Track cumulative X position, wrap to new line when exceeding width
- Store computed `{ word, x, y, width }` layout array
- Draw each word with individual `globalAlpha`

**Test:** Create a paragraph block consuming a verse track, verify text wraps correctly and words fade in/out individually.

---

### Step 9: Motion Canvas Compositor (Composable)

**What:** Create `useMotionRenderer` composable that orchestrates the full rendering pipeline.

**Files to create:**
- `src/front-end/composables/editor/useMotionRenderer.ts`

**Responsibilities:**
- Accepts: project data (motionTracks, lyricTracks, settings), currentFrame (or currentMs — converts internally), canvasSize
- For each frame:
  1. Convert ms to frame if needed
  2. Clear canvas
  3. Draw background (color or image)
  4. For each enabled motion track (back to front):
     a. Get the track's block — convert block ms to frames, skip if currentFrame outside range
     b. Resolve items via `resolveActiveItems(block, sourceTrack, currentFrame, fps)`
     c. Evaluate block propertyTracks at currentFrame (frame-based keyframes)
     d. Get/create block renderer from registry
     e. Call `renderer.render()` with all data
  5. Return the rendered canvas for preview display

**Provides:**
- `renderMotionFrame(currentMs)` — converts to frame internally, renders one frame to the OffscreenCanvas
- `getCanvas()` — returns the OffscreenCanvas (for export pipeline and preview via `usePreviewCanvas`)

**Test:** Wire up to a test harness, verify multiple tracks with overlapping time ranges render and composite correctly (back-to-front z-order).

---

### Step 10: Motion Track UI — Timeline Lane

**What:** Create `MotionTrackLane.vue` component for the timeline.

**Files to create:**
- `src/front-end/components/timeline/lanes/MotionTrackLane.vue`

**Behavior (one block per track):**
- Renders the single block as a colored rectangle spanning its time range
- Block color matches the track color
- Drag to move the block horizontally, trim left/right edges to resize
- Snap to lyric item edges, beat markers, playhead (reuse `useSnapEngine`)
- Click to select → emit selection event → inspector shows block properties
- Same drag/trim gesture code as `LyricTrackLane.vue` (reuse pattern, not the component itself)

**Visual design:**
- Same height and grid layout as lyric track lanes
- Label column (left): track name + type badge (ST/WR/PG) + source track name
- Lane area (right): single colored block rectangle
- Block interior text: abbreviated source text (first few words)
- Dimmed/grayed when track is disabled
- Playhead line via existing `--playhead-x` CSS variable

**Test:** Add a motion track, verify the block appears on the timeline lane. Drag to move, trim edges. Verify snap works against lyric item boundaries.

---

### Step 11: Motion Inspector

**What:** Create `MotionInspector.vue` with all the sections described in §4.3.

**Files to create:**
- `src/front-end/components/editor/MotionInspector.vue`

**Build incrementally:**
1. First: Block settings section (type, source, timing) — connect to data model
2. Then: Style section (font, color, etc.) — connect to block.style
3. Then: Transform section (anchor, offset, scale, rotation) — connect to block.transform
4. Then: Enter/exit section — connect to block.enter / block.exit
5. Then: Item overrides section — list items, hide toggle, text edit

**Each section is independently testable** — changing a value should update the block data, trigger undo snapshot, and re-render the preview.

**Test:** Select a motion block, change style properties in inspector, verify preview updates.

---

### Step 12: Motion Track List Panel

**What:** Create `MotionTrackListPanel.vue` for the left panel in motion mode.

**Files to create:**
- `src/front-end/components/editor/MotionTrackListPanel.vue`

**Behavior:**
- **"+ Add Motion"** button → type picker + source selector (see §4.2), creates new track with block
- Lists motion tracks with enable/disable toggle
- Drag to reorder tracks (changes composite z-order)
- Track context menu: rename, duplicate (full track + block copy), delete

**Test:** Add motion tracks via type picker, reorder, duplicate, verify timeline reflects changes.

---

### Step 13: Wire into ProjectEditor.vue

**What:** Connect all motion components into the existing editor view.

**Files to modify:**
- `src/front-end/views/ProjectEditor.vue`

**Changes:**
1. Replace `<p class="panel-placeholder">Motion layers (Phase 2)</p>` with `<MotionTrackListPanel>`
2. In motion mode: show `<MotionInspector>` in right panel instead of `<ItemInspector>`
3. In motion mode: **force-lock all lyric track lanes** (set `locked` visually, disable all gestures, dim appearance). Lyric lanes remain visible as reference above the motion lanes.
3b. **On switch to motion mode:** run `cleanOrphanedOverrides(project)`. If any overrides were removed, show a non-blocking toast: "N item overrides were removed because source lyrics changed." This runs on every lyric→motion switch and on project load.
4. In motion mode: add `<MotionTrackLane>` for each motion track, positioned between lyric lanes and waveform/analysis lanes
5. In motion mode: switch preview from `drawLyricPreview()` to `useMotionRenderer().renderMotionFrame()`
6. Wire selection: clicking a motion track/block → deselect lyric items, show motion inspector
7. Wire undo/redo: motion track mutations go through existing `useUndoRedo`
8. Wire autosave: `motionTracks` changes trigger save (already covered by project snapshot)
9. Wire keyboard shortcuts in motion mode: `Space` play/pause, `Delete` delete selected track, `←/→` nudge block, `Cmd+Z` undo, `Cmd+Shift+Z` redo, `Cmd+C` copy track, `Cmd+V` paste (duplicate) track

**Test:** Toggle between lyric and motion mode. Verify:
- Left panel switches between track list panel and motion track list panel
- Inspector switches between item inspector and motion inspector
- Timeline ordering: lyric lanes (top, locked/dimmed) → motion lanes (middle, editable) → waveform (bottom)
- Lyric tracks cannot be edited in motion mode (locked state)
- Preview shows motion render in motion mode, lyric preview in lyric mode
- All keyboard shortcuts work in motion mode

---

### Step 14: Background Image Support

**What:** Add background image upload and rendering to the project.

**Files to modify:**
- `src/front-end/components/editor/ProjectInspector.vue` — add background controls
- `src/front-end/composables/editor/useMotionRenderer.ts` — draw background before motion blocks
- `src/types/project_types.ts` — already has `backgroundImage`, `backgroundColor` from Step 2

**Behavior:**
- Upload image → stored via existing asset upload pipeline
- Drawn as first layer in motion renderer (before all motion blocks)
- Fit modes: cover / contain / stretch
- Background color: solid color or 'transparent' (clear canvas with alpha=0)

**Test:** Upload an image, verify it appears behind motion blocks in preview.

---

### Step 15: Per-Item Rich Text Overrides with TipTap

**What:** Add TipTap-based rich text editing for item overrides in the motion inspector.

**Files to create:**
- `src/front-end/components/editor/MotionItemOverrideEditor.vue`

**Files to modify:**
- `src/front-end/components/editor/MotionInspector.vue` — add override section
- Motion renderers — parse TipTap JSON into styled text spans for canvas rendering

**Behavior:**
- In the override section, each lyric item within the block's range is listed
- User clicks "Edit" → small TipTap editor appears, pre-filled with original text
- User can: change text, apply formatting marks, change font
- TipTap JSON saved to `ItemOverride.textOverride`
- Renderers parse TipTap JSON into styled text spans for canvas rendering

**Supported TipTap marks/nodes (defined subset — everything else ignored):**

| Mark/Node | Canvas rendering |
|-----------|-----------------|
| **bold** | `ctx.font` weight set to bold |
| **italic** | `ctx.font` style set to italic |
| **underline** | Manual line drawn below text baseline |
| **textStyle.color** | `ctx.fillStyle` per span |
| **textStyle.fontSize** | `ctx.font` size per span |
| **textStyle.fontFamily** | `ctx.font` family per span |
| paragraph (node) | Line break in layout |
| text (node) | The actual text content |

**Everything else is ignored gracefully** — unknown marks are stripped, unknown nodes are skipped. This keeps the canvas renderer simple and prevents edge cases from TipTap features we don't support visually.

**Implementation: TipTap JSON → Canvas spans parser:**
Create `src/front-end/utils/motion/parseTipTapToSpans.ts` with:
- `parseTipTapToSpans(json: any): StyledSpan[]`
- Returns flat array of `{ text, bold, italic, underline, color?, fontSize?, fontFamily? }`
- Each span is drawn separately on canvas with its own style applied

**Test:** Override a word's text and style (e.g., make "shit" into bold red "*SH!T*"), verify the motion preview shows the override with correct formatting.

---

### Step 16: Export Integration

**What:** Wire the motion renderer into the existing export pipeline.

**Files to modify:**
- `src/front-end/composables/editor/useVideoExport.ts` — use motion canvas for frame capture
- `src/front-end/components/editor/ExportModal.vue` — update to use motion render

**Behavior:**

The existing export pipeline already works with frame-by-frame rendering and stitching (this was working in the previous deployment). The motion renderer integrates into this same pipeline:

1. **Frame-by-frame render:** For each frame (0 to totalFrames at project FPS):
   - Convert frame to ms: `ms = frame * 1000 / fps`
   - Call `renderMotionFrame(ms)` — draws to the OffscreenCanvas
   - Capture canvas frame data (existing `export:saveFrame` IPC)
   - Yield between frames with `setTimeout(0)` to keep UI responsive
2. **Progress bar:** Show render progress (current frame / total frames) with a **Stop** button
   - Stopping mid-export: save/stitch whatever frames have been rendered up to that point (partial export is still usable)
3. **Stitch or record:** Use existing assembly pipeline (`export:assembleVideo` IPC) to create final video
4. **Alpha support:** Canvas starts transparent when `backgroundColor === 'transparent'` → alpha-capable export (ProRes 4444 or PNG sequence)

**Note for implementors:** The render loop must yield between frames to avoid freezing the UI. Use `setTimeout(0)` or `requestAnimationFrame` batching (e.g., render 10 frames, yield, render 10 more). The existing export in the v1 editor already solved this — follow the same pattern.

**Test:** Export a short motion project. Verify:
- Progress bar shows correct frame count
- Stop button works (produces partial video)
- Exported video has correct text animation and timing
- Transparent background exports correctly (test with alpha-capable format)

---

## 6) Testing Checklist per Step

Each step should be manually verified before moving to the next:

| Step | Manual test |
|------|-----------|
| 1 | App boots, old scenes still render in old editor |
| 2 | Projects load, create, save. No console errors about missing fields |
| 3 | (unit test) Animation progress values correct for various item durations |
| 4 | (unit test) Item resolution returns correct items with overrides applied |
| 5 | Registry registers and retrieves renderer objects |
| 6 | Subtitle text renders to canvas with fade animation |
| 7 | Words appear one-by-one with individual timing |
| 8 | Paragraph text wraps and words have per-word opacity |
| 9 | Multiple tracks with overlapping time ranges composite in correct z-order |
| 10 | Block appears on timeline lane, can be dragged and trimmed |
| 11 | Inspector shows properties, editing updates preview live |
| 12 | "+ Add Motion" creates track via type picker. Tracks can be reordered, duplicated, deleted |
| 13 | Full mode toggle works: lyric tracks lock in motion mode, keyboard shortcuts work, preview switches |
| 14 | Background image shows behind motion blocks, transparency works |
| 15 | Rich text overrides display correctly in preview |
| 16 | Exported video has correct text animation and timing |

---

## 7) Notes for Future Phases

### 3D Motion Block Types (Phase 4+)

The deprecated scene engine (`SceneEngine.ts`, `WorkerScene` interface, `SceneRegistry`) should be adapted — not rewritten — for 3D motion block types. The approach:

1. Create a new `MotionBlockType` (e.g., `'3dText'`, `'wordSphere3d'`)
2. The renderer for this type delegates to the existing Worker-based scene engine
3. The Worker renders to an OffscreenCanvas
4. The main-thread motion compositor draws the Worker canvas as a layer (via `drawImage()`)
5. The scene engine receives its data from the motion block's `sourceTrackId` + resolved items, not from the old word bank system

This means the scene engine continues to work exactly as it does today, but its input data comes from the new motion system instead of the old editor.

### Audio-Reactive Motion (Phase 4+)

The existing audio analysis system (`useAudioAnalysis`, beat/energy/onset data) can feed into motion renderers:
- Beat → trigger instant scale pulse or word change
- Energy → modulate opacity, scale, or movement speed
- Spectral bands → drive color shifts

This data is already per-frame in the analysis cache. Motion block renderers receive it through the compositor.

### SpaceTypeGenerator-Style Effects (Phase 4+)

These become additional `MotionBlockType` entries:
- `flash` — words flash rapidly at beat intervals, position/size randomized (seeded RNG)
- `scatter` — words fly in from off-screen
- `gravity` — words drop and accumulate

Each is a self-contained renderer registered in `MotionBlockRegistry`.

---

## 8) Future Nice-to-Haves

### Lyric Preview Unification

Currently, lyric mode has its own simple preview renderer (`drawLyricPreview()` in `ProjectEditor.vue`) that draws active lyric text on the canvas. This is functionally a basic "subtitle" renderer.

**Future opportunity:** Once the motion renderer is stable, the lyric mode preview could be replaced by a default subtitle motion block rendered through the same pipeline. This would:
- Unify the rendering code (DRY — one renderer for all text display)
- Give lyric mode preview the same quality as motion mode (enter/exit animations, proper styling)
- Allow users to see "what this will look like in motion mode" even while editing lyrics

**Why not now:** Lyric mode works and is stable. The motion renderer doesn't exist yet. Making lyric preview depend on motion infrastructure would be a backward step during development. Build motion first, then unify when both are proven.

**How to do it later:** Create a transient (non-saved) subtitle motion block that auto-generates from the active lyric tracks. Use it as the lyric preview source. The block doesn't persist in the project data — it's computed on-the-fly for preview only.

---

## 9) Resolved Decisions

| Decision | Resolution |
|----------|-----------|
| Keyframe storage | Frame-based (matching existing system). Inspector displays ms via conversion. |
| Enter/exit min/max units | Frame-based (`minFrames`, `maxFrames`). Inspector displays ms. |
| Dangling references | Graceful degradation (skip orphaned refs at render time) + cleanup on mode switch with toast. |
| Partial item overlap with block | Lyric items don't overlap within a track. Block acts as time container — only renders items within its range. |
| TipTap override subset | Bold, italic, underline, color, fontSize, fontFamily. Everything else ignored. |
| Export approach | Frame-by-frame render to OffscreenCanvas with progress bar + stop button. Existing stitch pipeline. |
| No-audio duration | Manual `durationMs` in project settings. Auto-detected when audio is loaded. |
| Canvas resolution | Custom `renderWidth × renderHeight` in project settings. Presets in inspector. OffscreenCanvas sized to these. |
| Render canvas | Uses OffscreenCanvas (same pattern as existing `usePreviewCanvas` dual-canvas approach). |
| Undo/redo scope | Project-wide (existing system). Motion changes undoable in both modes. |

## 10) Open Questions

- [ ] Should the motion renderer use requestAnimationFrame in sync with the audio player, or should it be driven by the playback sync composable? (Recommendation: reuse `usePlaybackSync` — it already handles RAF + audio sync)
- [ ] Do we need a "copy block style" feature to quickly duplicate style/transform settings across blocks? (Probably yes, but post-MVP — duplicate track covers most cases)
- [ ] Should per-item overrides support per-item enter/exit animation overrides, or only text/style/transform? (Recommendation: start with text/style/transform only, add animation overrides later)
