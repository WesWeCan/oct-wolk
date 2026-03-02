# WOLK PRD: Lyrics Timeline + Motion Rebuild (MVP)

> Last updated: 2026-03-02
> Status: Lyric Mode implemented; Motion Mode next

---

## 1) Product Direction

WOLK shifts from an analysis-first / wordbank-first tool to a **lyric-timeline-first** tool for creating export-ready text visuals synced to music.

### Two-Layer Architecture

- **Layer A — Lyric Mode (source of truth):**
  Timed text tracks authored and edited by the user. This is the canonical timing and text data. Nothing in Layer B mutates Layer A.

- **Layer B — Motion Mode (consumer):**
  Visual layers that read from Layer A tracks and render styled text to canvas. Visual overrides (snippets, styling, transforms) live here and never change the underlying lyric truth.

### MVP Outcome

Export-ready lyric visuals (including alpha-capable path) for use in VJ tools like Resolume. Not a live-performance controller yet.

---

## 2) Goals and Non-Goals

### Goals

- Create a project with song metadata (title, audio file, cover image) and raw lyrics.
- Generate timed lyric tracks from raw text using a staged flow (verse -> line -> word).
- Create additional custom blank tracks (backing vocals, adlibs, stage cues).
- Edit track item timing with professional timeline tools.
- Build visual motion layers that each consume one lyric track.
- Render text visuals (single word, sentence block, verse block) on a configurable canvas.
- Style text with font, size, weight, color, case, background, opacity.
- Position text with anchors and free XY.
- Export with alpha support (target: ProRes 4444, fallback: PNG sequence).

### Non-Goals

- Live performance / real-time control mode (future).
- Legacy project migration (old projects are abandoned).
- Large preset library or SpaceTypeGenerator-style effects (future inspiration).
- Full deletion of deprecated modules (hide/disable for now, clean up later).
- Schema versioning system (starts after this release ships).

---

## 3) Locked Decisions

These were decided during brainstorming and are not open for re-discussion:

| Decision | Detail |
|---|---|
| Wordbanks removed | No longer part of core workflow. |
| Analysis-first screen removed | Not the entry point anymore. |
| Song metadata moves to project | No separate Song entity; project owns title/audio/cover. |
| Generated tracks are user-owned | Created once from raw lyrics, then fully editable. Manual edits always win. |
| Track items are strings with start/end | Uniform type for words, sentences, verses, cues. No overlap within a track. |
| Non-text cues are strings | `[sirene]`, `[shot]` etc. are plain string items. |
| Tracks are equal | No hardcoded special behavior for word vs sentence vs verse after generation. |
| Motion layers: single source each | Each layer binds to one track. Stack layers AE-style for multi-source. |
| Snippets are visual-only overrides | Never mutate Layer A truth. Layer A is always the fallback. |
| Transforms are per-item, copyable | Not per-snippet. |
| Font upload is essential + fast | Must preview immediately, not only on play. |
| Anchors + free XY positioning | Both required. |
| Custom canvas sizes | Required (various projection setups). |
| 3D RBJAN module | Visible but disabled in MVP. |
| Silhouette / weak image modules | Hidden/disabled, not deleted yet. |
| Old projects ignored | `.wolk` extension stays, internal format can fully change. |
| Generator flow is staged | Keep `verse -> line -> word`; do not revert to independent generator buttons. |

---

## 4) Functional Requirements

### 4.1 Layer A — Lyric Mode

#### Raw Lyrics

- Editable rich-text area using **TipTap** (keep existing TipTap integration).
- Serves as source note and input for track generators.
- Raw lyrics are stored as their own data field, separate from generated tracks.
- Users can edit raw lyrics at any time (fix typos, restructure).

#### Track Generators

Generator flow is intentionally staged:

| Step | Input | Output |
|---|---|---|
| Create Verse Track | Raw lyrics, split by stanza boundaries | Verse items |
| Create Line Track | Selected verse track + raw lyric lines | Line/sentence items constrained to verse windows |
| Create Word Track | Selected line track + tokenized raw lyric lines | Word items constrained to line windows |

**Default timing strategy (no analysis):** Items are placed sequentially with uniform duration, filling the audio duration evenly. User drags them to correct positions.

**Optional analysis-assisted timing:** If audio analysis data is available (beats/onsets), generators can snap items to beat grid. This is a bonus, not required for MVP.

#### Track Model

```
LyricTrack {
  id: string
  name: string                    // user-editable label
  color: string                   // hex color for timeline lane display
  kind: 'word' | 'sentence' | 'verse' | 'custom'
  items: TimelineItem[]           // sorted by startMs, no overlaps
  muted: boolean
  solo: boolean
  locked: boolean
}

TimelineItem {
  id: string
  text: string                    // the displayed text (or cue label)
  startMs: number
  endMs: number
}
```

Rules:
- No overlap within a single track.
- Overlap across different tracks is allowed and expected.
- Gaps between items are allowed.
- Items are always sorted by `startMs`.

#### Track Operations

| Operation | Required |
|---|---|
| Add track (blank custom) | Yes |
| Delete track | Yes |
| Rename track | Yes |
| Duplicate track | Yes |
| Mute / Solo / Lock | Yes |
| Reorder tracks | Yes |
| Copy / Cut / Paste items within or across tracks | Yes |

#### Item Editing (timeline gestures)

| Gesture | Required | Notes |
|---|---|---|
| Move item (drag) | Yes | Horizontal drag on timeline |
| Trim start | Yes | Drag left edge |
| Trim end | Yes | Drag right edge |
| Split item | Yes | Split at playhead position |
| Merge adjacent items | Yes | Combine text, extend timing |
| Delete item | Yes | |
| Nudge left/right | Yes | Arrow keys, small frame increments |

#### Keyboard Shortcuts (Required)

| Key | Action |
|---|---|
| `Space` | Toggle play/pause (global, works in both modes) |
| `←` / `→` | Nudge selected item or scrub playhead |
| `Delete` / `Backspace` | Delete selected item(s) |
| `Cmd+Z` / `Ctrl+Z` | Undo |
| `Cmd+Shift+Z` / `Ctrl+Shift+Z` | Redo |
| `Cmd+C` / `Ctrl+C` | Copy selected item(s) |
| `Cmd+X` / `Ctrl+X` | Cut selected item(s) |
| `Cmd+V` / `Ctrl+V` | Paste at playhead |
| `S` | Split item at playhead |

### 4.2 Layer B — Motion Mode

#### Visual Layer Model

```
MotionLayer {
  id: string
  name: string
  enabled: boolean
  sourceTrackId: string           // binds to one LyricTrack.id
  displayMode: 'single' | 'block'
  // 'single': one item at a time (subtitle-style)
  // 'block': show full active item text as block
  snippets: SnippetOverride[]
  style: MotionStyle
  transform: MotionTransform
}

SnippetOverride {
  itemId: string                  // references a TimelineItem.id
  hidden: boolean                 // omit this item from display
  fadeInMs: number                // override fade-in duration
  fadeOutMs: number               // override fade-out duration
  textOverride?: string           // optional display text replacement
}

MotionStyle {
  fontFamily: string              // defaults to project font
  fontSize: number                // px
  fontWeight: number              // 100-900
  fontStyle: 'normal' | 'italic' | 'oblique'
  textCase: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  color: string                   // hex
  opacity: number                 // 0-1
  backgroundColor: string | null  // hex or null for transparent
  backgroundPadding: number       // px around text
}

MotionTransform {
  anchorX: 'left' | 'center' | 'right'
  anchorY: 'top' | 'center' | 'bottom'
  offsetX: number                 // px from anchor
  offsetY: number                 // px from anchor
  scale: number
  rotation: number                // degrees
}
```

#### Source Resolution Logic

At any frame `f`, for a given motion layer:
1. Find active `TimelineItem` in the bound `LyricTrack` where `startMs <= f <= endMs`.
2. Check if a `SnippetOverride` exists for that item:
   - If `hidden: true` → render nothing.
   - If `textOverride` exists → use that text instead.
   - Apply `fadeInMs` / `fadeOutMs` overrides.
3. If no active item → render nothing (gap = silence).
4. Layer A truth is always the fallback.

#### Rendering

MVP text renderers all use **2D canvas** (OffscreenCanvas in web worker, matching existing `WorkerScene` pattern):

- **Single mode:** Renders one item's text, centered or anchored per transform.
- **Block mode:** Renders the full text of the active item (useful for sentences/verses that are multi-line).

Both modes apply `MotionStyle` and `MotionTransform`.

Background transparency: The canvas `clearRect` before render gives alpha=0 base. Scenes draw text on transparent background by default. If `backgroundColor` is set, draw a rect behind text.

---

## 5) UX Structure

### App Navigation (Simplified)

Old flow: `Index → SongBank → LyricAnalyzer → EditorIndex → Editor`

New flow: `Index → ProjectList → Project Editor`

The Project Editor is a single view with a **mode toggle**.

### Editor Layout

```
┌─────────────────────────────────────────────────┐
│ Toolbar: [Play/Pause] [Stop] [Mode: Lyric|Motion] [Export] │
├────────┬────────────────────────┬───────────────┤
│        │                        │               │
│  Left  │     Preview Canvas     │    Right      │
│ Panel  │     (monitor)          │    Panel      │
│        │                        │ (inspector)   │
│        │                        │               │
├────────┴────────────────────────┴───────────────┤
│              Timeline (shared)                   │
│  [Track lanes + waveform + playhead]             │
└──────────────────────────────────────────────────┘
```

#### In Lyric Mode (Layer A)

- **Left panel:** Track list (add/delete/mute/solo/lock/reorder), raw lyrics editor (TipTap), generator buttons.
- **Timeline:** Lyric track lanes with draggable items (top), waveform/analysis lanes below. Collapsed lyric tracks still show mini timing blocks.
- **Right panel:** Selected item inspector (text, timing, split/merge actions).
- **Preview:** Shows text as it would render (uses active motion layers if any exist, otherwise plain preview).

#### In Motion Mode (Layer B)

- **Left panel:** Motion layer stack (add/delete/enable/reorder). Each layer shows source binding.
- **Timeline:** Same timeline, same tracks visible (read-only in this mode). Motion layers can show their own overlay indicators.
- **Right panel:** Selected layer inspector: source binding, display mode, style controls, transform controls, snippet overrides.
- **Preview:** Live render of all enabled motion layers composited.

#### Shared Between Modes

- Playhead, transport controls, zoom/pan, waveform.
- `Space` always toggles play/pause regardless of mode.
- Preview canvas always visible.
- Canvas size controls always accessible.

---

## 6) Export Requirements

| Format | Priority | Alpha | Notes |
|---|---|---|---|
| ProRes 4444 | Primary target | Yes | Requires ffmpeg with ProRes support |
| PNG sequence | Fallback | Yes | Always works, larger files |
| WebM (VP9) | Keep existing | No (or limited) | Already implemented |
| MP4 (H.264) | Keep existing | No | Already implemented via ffmpeg |

Implementation note: Existing frame-by-frame export pipeline (`export:saveFrame`, `export:assembleVideo`) can be extended for ProRes. PNG sequence export is essentially the existing frame export without assembly.

---

## 7) Project Data Model

```ts
interface WolkProject {
  id: string
  version: 2                         // new schema, breaks from v1

  song: {
    title: string
    subtitle?: string
    audioSrc: string                  // wolk:// protocol path
    coverSrc?: string
  }

  settings: {
    fps: number                       // default 60
    renderWidth: number               // default 1920
    renderHeight: number              // default 1080
    seed: string
    exportBitrateMbps?: number
    includeAudio?: boolean
  }

  font: {
    family: string                    // 'ProjectFont' when custom uploaded
    fallbacks: string[]
    style: 'normal' | 'italic' | 'oblique'
    weight: number
    name?: string                     // human-friendly display name
    localPath?: string                // wolk:// path to uploaded font file
  }

  rawLyrics: string                   // editable source note (plain text or TipTap JSON)

  lyricTracks: LyricTrack[]
  motionLayers: MotionLayer[]
}
```

See Section 4.1 and 4.2 for `LyricTrack`, `TimelineItem`, `MotionLayer`, `SnippetOverride`, `MotionStyle`, `MotionTransform` definitions.

---

## 8) Existing Infrastructure: Keep / Adapt / Remove

### Keep and Reuse

| Component | Path | Notes |
|---|---|---|
| OffscreenCanvas render worker | `src/front-end/workers/renderWorker.ts` | Adapt message protocol for new data flow |
| SceneEngine + registry | `src/front-end/workers/engine/` | Keep architecture, register new text renderers |
| WorkerScene interface | `src/front-end/workers/engine/types.ts` | New scenes implement this |
| Timeline viewport + zoom/pan | `src/front-end/components/timeline/useTimelineViewport.ts` | Reuse as-is |
| Waveform lane | `src/front-end/components/timeline/lanes/WaveformLane.vue` | Reuse as-is |
| Audio analysis pipeline | `src/front-end/composables/editor/useAudioAnalysis.ts` | Keep for advanced mode |
| Audio player | `src/front-end/composables/editor/useAudioPlayer.ts` | Reuse as-is |
| Playback sync | `src/front-end/composables/editor/usePlaybackSync.ts` | Reuse as-is |
| Preview canvas composable | `src/front-end/composables/editor/usePreviewCanvas.ts` | Reuse as-is |
| Font service + system font listing | `src/front-end/services/FontsService.ts` | Reuse as-is |
| TipTap editor | `src/front-end/components/TipTapLyricAnalyzer.vue` | Adapt for raw lyrics panel |
| Export pipeline (frame capture) | `src/back-end/internal-processes/internal-processes.ts` | Extend for ProRes/PNG seq |
| Internal storage + wolk protocol | `src/back-end/internal-processes/internal-storage.ts` | Reuse as-is |
| Keyframe/interpolation utilities | `src/front-end/utils/tracks.ts` | Reuse as-is |

### Adapt / Rewrite

| Component | Reason |
|---|---|
| `Editor.vue` | Major rewrite: two-mode toggle, new panel layout |
| `TimelineRoot.vue` | Add lyric track lanes, adapt for new data model |
| `SingleWordScene.ts` | Adapt to consume `TimelineItem` text instead of wordbank |
| `useFrameEvaluation.ts` | Rewrite: resolve active items from lyric tracks instead of word pools |
| `useWorkerSceneConfig.ts` | Rewrite: pass lyric item data to worker |
| Song storage / types | Replace `Song` type with `WolkProject`, new storage format |
| Router | Simplify to `Index → ProjectList → Editor` |

### Hide / Disable (Not Delete)

| Component | Action |
|---|---|
| `WordCloudScene.ts` | Hide from scene picker, keep code |
| `WordSphereScene.ts` | Hide from scene picker, keep code |
| `ModelScene.ts` (3D) | Show in UI but disabled badge |
| `PortraitMaskScene.ts` | Hide from scene picker, keep code |
| `LyricAnalyzer.vue` | Remove from router (functionality absorbed into editor) |
| `SongBank.vue` | Replace with simpler ProjectList |
| Wordbank components | Remove from UI, keep files |

### Remove from Active Use

| Component | Notes |
|---|---|
| `WordBank.vue`, `WordBankGroupNode.vue` | No longer in workflow |
| `InspectorAllowedWords.vue` | No longer needed |
| `useWordPoolMarkers.ts` | Replaced by lyric track system |
| `useActionTracks.ts` | Replaced by snippet system |
| Word pool evaluation utilities | Replaced by lyric track resolution |

---

## 9) Implementation Phases

### Phase 1: Foundation + Lyric Mode

**Deliverables:**
- New `WolkProject` data model and storage.
- New project creation flow (title + audio upload).
- Raw lyrics editor (TipTap) integrated in editor left panel.
- Staged track generation flow (verse -> line -> word).
- Custom blank track creation.
- Timeline lanes for lyric tracks with item rendering.
- All item editing gestures (move/trim/split/merge/delete).
- Track operations (mute/solo/lock/duplicate/rename/delete/reorder).
- Keyboard shortcuts (Space play/pause, arrows, delete, undo/redo, split, copy/cut/paste).
- Waveform lane integration.
- Basic playback with audio sync.
- Collapsed lane mini-block visualization.
- Lock indicators + locked inspector controls.

**Exit criteria:** User can create project, paste lyrics, run `verse -> line -> word` generation, edit timing, copy/cut/paste items, reorder tracks, and hear synced playback with stable undo/redo.

### Phase 2: Motion Mode MVP

**Deliverables:**
- Motion layer model + UI (add/delete/enable/reorder).
- Source binding (layer → track).
- Display modes (single / block).
- New text renderer scene (`TextDisplayScene`) implementing `WorkerScene`.
- Snippet overrides (hide items, fade overrides, text replacement).
- Style controls (font, size, weight, case, color, opacity, background).
- Transform controls (anchors, XY offset, scale, rotation).
- Copy transforms across items.
- Preview canvas showing composited motion layers.
- Mode toggle UI (Lyric ↔ Motion).

**Exit criteria:** User can create motion layers, bind to lyric tracks, style text, position it, see live preview.

### Phase 3: Export + Polish

**Deliverables:**
- ProRes 4444 export path (via ffmpeg).
- PNG sequence export.
- Font upload performance optimization (instant preview).
- Canvas size presets + custom size.
- Disabled module badges (3D visible but greyed out).
- Hidden modules removed from UI pickers.
- Undo/redo polish across both modes.

**Exit criteria:** User can export a full song with alpha transparency, usable in Resolume.

### Phase 4: Post-MVP (Future)

- 3D RBJAN module rewrite to consume lyric track data.
- Old module cleanup/deletion pass.
- Advanced analysis overlays (beats/bands/energy in Lyric mode).
- Analysis-assisted generator timing.
- SpaceType-inspired animation behaviors.
- Live performance mode exploration.

---

## 10) MVP Acceptance Test

One complete workflow:

1. Create new project with song title and audio file.
2. Upload custom font → see it immediately in preview.
3. Paste raw lyrics.
4. Generate verse track, then line track, then word track.
5. Create custom track for backing vocals, manually add items.
6. Edit timing: move items, trim, split, merge, copy/cut/paste. Hear audio while editing.
7. Switch to Motion mode.
8. Add motion layer bound to word track → single display mode → see words appear.
9. Add second layer bound to sentence track → block display mode → positioned differently.
10. Style both layers (color, size, case, background).
11. Hide specific items via snippet overrides.
12. Export with alpha (ProRes 4444 or PNG sequence).
13. Import exported file into Resolume and verify alpha + timing.

---

## 11) Implementation Principle: Reuse First

The existing (v1) Editor already has battle-tested solutions for common UI patterns. The new ProjectEditor **must reuse** these rather than reimplementing from scratch:

| Pattern | Source | Reuse Strategy |
|---------|--------|----------------|
| Panel resizing (sidebar, inspector) | `editor.scss` + `Editor.vue` | CSS custom properties + same pointer handler pattern |
| Timeline layout (label column + lanes) | `TimelineRoot.vue` + `timeline.scss` | 120px/1fr grid, `.lane-label` left column, `.lane` wrappers |
| Playhead rendering across lanes | `timeline.scss` `.lane::after` | `--playhead-x` CSS variable (same formula as TimelineRoot) |
| Canvas display scaling | `usePreviewCanvas.ts` | Dual-canvas (offscreen render + scaled preview) |
| Timeline interactions (pan/zoom/scrub) | `useLaneInteractions.ts` + `useTimelineViewport.ts` | Used directly by lane components |
| Item drag/trim gestures | `ScenesLane.vue` | Same pointer capture + hit-test pattern in LyricTrackLane |

New code should only be written for genuinely new functionality (lyric-specific preview rendering, track generators, etc.), not for infrastructure that already works.

---

## 12) Open Technical Spikes

- **ProRes 4444 via ffmpeg:** Confirm ffmpeg build supports ProRes encoder (`prores_ks`). Test on macOS (primary target).
- **Font loading in OffscreenCanvas worker:** Current `ensureWorkerFont` approach works but may have delay. Investigate preloading strategy.
- **Timeline performance:** Stress-test with a song having 500+ word items across 5 tracks.
- **TipTap in sidebar:** Confirm TipTap editor works well in constrained panel width (currently used in full-page layout).
