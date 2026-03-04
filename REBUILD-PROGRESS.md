# WOLK Rebuild Progress Tracker

> Tracks progress across agent sessions for the Lyrics Timeline + Motion rebuild.
> See `PRD-lyrics-motion-rebuild.md` for the full specification.

---

## Current Phase: 2 — Motion Mode MVP (Lyric Mode Complete)

### Sub-Phase 1.0: Types + Tracking File
- **Status:** DONE
- Created `src/types/project_types.ts` with all v2 interfaces
- Created this tracking file

### Sub-Phase 1.1: Backend Storage for v2 Projects
- **Status:** DONE
- [x] `src/back-end/internal-processes/project-storage.ts` — full CRUD + asset uploads
- [x] IPC handlers registered in `internal-processes.ts`
- [x] `src/front-end/services/ProjectService.ts`
- [x] Preload bridge updated with `projects` namespace

### Sub-Phase 1.2: Router + ProjectList View
- **Status:** DONE
- [x] `src/front-end/views/ProjectList.vue` — lists v2 projects, create/delete/open
- [x] Router updated with `/projects` and `/project/:projectId` routes
- [x] Index.vue has "Projects" link (old routes preserved)

### Sub-Phase 1.3: Editor Shell + Raw Lyrics
- **Status:** DONE
- [x] `src/front-end/views/ProjectEditor.vue` — full editor with mode toggle
- [x] `src/front-end/components/editor/RawLyricsPanel.vue` — TipTap for rawLyrics
- [x] Audio player integration (useAudioPlayer)
- [x] Waveform + RulerLane integration in timeline
- [x] Styles in `src/front-end/styles/views/project-editor.scss`

### Sub-Phase 1.4: Track Generators + Lyric Track Lanes
- **Status:** DONE
- [x] `src/front-end/utils/lyricTrackGenerators.ts` — word/sentence/verse/custom generators
- [x] `src/front-end/components/timeline/lanes/LyricTrackLane.vue` — draggable items with move/trim
- [x] `src/front-end/components/editor/TrackListPanel.vue` — track CRUD + generator buttons

### Sub-Phase 1.5: Item Editing + Keyboard Shortcuts
- **Status:** DONE
- [x] Move, trim start/end gestures on LyricTrackLane
- [x] `src/front-end/components/editor/ItemInspector.vue` — text/timing/split/merge/delete
- [x] Keyboard shortcuts: Space, arrows, Delete/Backspace, Cmd+Z, Cmd+Shift+Z, S
- [x] `src/front-end/composables/editor/useUndoRedo.ts` — snapshot-based undo/redo
- [x] Autosave with 1s debounce

### Sub-Phase 1.6: Lyric Mode Polish Pass
- **Status:** DONE
- [x] Copy/paste lyric blocks with keyboard shortcuts (`Cmd/Ctrl+C`, `Cmd/Ctrl+V`) in `ProjectEditor.vue`
- [x] Cut lyric blocks with keyboard shortcut (`Cmd/Ctrl+X`) in `ProjectEditor.vue`
- [x] Solo logic now affects lyric preview rendering (mute + solo interaction fixed)
- [x] Lock visibility improved: lock indicator in track list + locked lane treatment
- [x] Item Inspector mutation controls disabled for locked tracks
- [x] Added `enforceNoOverlap()` safety net and wired it across lyric mutation paths
- [x] Track reorder in sidebar (up/down) wired to timeline lane order
- [x] Timeline order updated: lyric lanes first, waveform/analysis lanes at bottom
- [x] Collapsed lyric lanes now show mini timing blocks (clipped correctly while horizontally scrolling)
- [x] Undo/redo behavior stabilized for edit operations (including immediate undo after paste)

---

## Files Created/Modified

### New Files
- `src/types/project_types.ts`
- `src/back-end/internal-processes/project-storage.ts`
- `src/front-end/services/ProjectService.ts`
- `src/front-end/views/ProjectList.vue`
- `src/front-end/views/ProjectEditor.vue`
- `src/front-end/components/editor/RawLyricsPanel.vue`
- `src/front-end/components/editor/TrackListPanel.vue`
- `src/front-end/components/editor/ItemInspector.vue`
- `src/front-end/components/timeline/lanes/LyricTrackLane.vue`
- `src/front-end/utils/lyricTrackGenerators.ts`
- `src/front-end/utils/uuid.ts`
- `src/front-end/composables/editor/useUndoRedo.ts`
- `src/front-end/styles/views/project-editor.scss`

### Modified Files
- `src/back-end/internal-processes/internal-processes.ts` — added projects IPC handlers
- `src/preload.ts` — added projects bridge
- `src/front-end/router/index.ts` — added ProjectList + ProjectEditor routes
- `src/front-end/views/Index.vue` — added Projects nav link
- `src/front-end/styles/index.scss` — imported project-editor styles

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-02-26 | v2 projects use `project.json` alongside existing `song.json` | Old and new coexist in same storage directory |
| 2026-02-26 | Old routes kept alive during rebuild | Zero breakage of existing functionality |
| 2026-02-26 | Types defined with millisecond timing (startMs/endMs) | Matches PRD spec; frame conversion happens at render time |
| 2026-02-26 | Snapshot-based undo/redo (50 max, 300ms throttle) | Matches existing LyricAnalyzer pattern |
| 2026-02-26 | Nudge amount: 50ms per arrow key press | Good balance of precision and speed |
| 2026-02-26 | Reuse existing editor infrastructure (timeline, resize, preview) | Prevents reinventing solved problems; see PRD §11 |
| 2026-03-01 | Keep verse -> line -> word generator flow | UX tested better than direct independent generation; retained intentionally |
| 2026-03-02 | Lyric mode accepted as feature-complete for MVP handoff | Move focus to Phase 2 Motion Mode in next iteration |
| 2026-03-02 | Motion Mode redesigned: blocks on tracks, not persistent layers | Motion blocks are discrete timeline items with types (like scenes), consuming lyric tracks. See `MOTION-ARCHITECTURE.md` |
| 2026-03-02 | Old scene engine deprecated, not deleted | Will be adapted for 3D motion block types in Phase 4+. Seed RNG system reused. |
| 2026-03-02 | Motion rendering on main thread (Canvas 2D) | Avoids Worker font-loading issues. Worker pipeline preserved for future 3D types. |
| 2026-03-02 | Enter/exit animation uses dynamic duration (fraction + min/max clamp) | Adapts to fast words (100ms) and slow verses (5s) alike |
| 2026-03-02 | Motion block type is immutable after creation | Prevents renderer/state mismatch; changing type now requires delete + re-create |
| 2026-03-02 | New motion block defaults to 10s at playhead (clamped to project end) | Faster authoring while keeping duration constraints predictable |
| 2026-03-02 | Next iteration will be subtitle-first DRY | Consolidate most 2D text behaviors as subtitle parameters; consider deprecating separate `wordReveal`/`paragraph` block types |

---

### Infrastructure Refactor: Reuse Existing Editor Patterns
- **Status:** DONE
- [x] Timeline layout replaced with TimelineRoot's `--playhead-x` CSS variable + `120px | 1fr` grid + `.lane::after` playhead from `timeline.scss`
- [x] Panel resizing reuses `editor.scss` resize handle visuals (sidebar `::after`, inspector `::before`, timeline `::before`)
- [x] Preview canvas wired up with `usePreviewCanvas` composable (dual-canvas pattern)
- [x] Lightweight `drawLyricPreview()` renders active lyric text at current playhead position
- [x] Removed duplicated timeline/playhead/resize SCSS from `project-editor.scss`
- [x] LyricTrackLane positioning math verified against ScenesLane patterns
- [x] PRD updated with Section 11: "Reuse First" implementation principle

---

## Next Up: Phase 2 — Motion Mode MVP (REDESIGNED)

> **IMPORTANT:** The original PRD Section 4.2 described `MotionLayer` as a persistent layer.
> This has been **superseded** by the Motion Block architecture described in `MOTION-ARCHITECTURE.md`.
> The old `MotionLayer`, `SnippetOverride` types in `project_types.ts` are to be replaced.
> The old scene engine code is **deprecated but not deleted** — it will be adapted in Phase 4+ for 3D motion block types.
>
> **UX execution companion:** `MOTION-UX-FOUNDATION.md` is now the active checklist for splitting
> Foundation stabilization vs UX polish (and keeping deferred block types out of current MVP scope).

**New approach:** Motion Blocks on Motion Tracks (see `MOTION-ARCHITECTURE.md` for full spec)

### Phase 2 Completion (strict complete only)
- **Complete:** 6 / 16 steps (**38%**)
- **Status legend:** `[ ]` not started, `[-]` partial/in-progress, `[x]` fully complete + manually verified
- **Promotion rule:** never move a step to `[x]` until manual verification is explicitly confirmed.

- [x] Step 1: Extract seed RNG to shared utility
  - Implemented: `src/front-end/utils/seededRng.ts`, worker type re-export compatibility
  - Manual verification requested: open app + confirm legacy scene paths still boot
  - Result: pass
- [x] Step 2: Update data model types
  - Implemented: `MotionTrack`/`MotionBlock` model, project settings extensions, storage normalization for legacy `motionLayers`
  - Manual verification requested: load/create/save/reload project with no schema errors
  - Result: pass
- [x] Step 3: Enter/exit animation utilities
  - Implemented: `computeEnterExitProgress`, alpha/transform helpers, ms↔frame helpers
  - Manual verification requested: subtitle fade behavior while scrubbing
  - Result: pass
- [x] Step 4: Lyric item resolution for motion blocks
  - Implemented: active/all item resolution, orphan cleanup utility
  - Manual verification requested: missing source/override gracefully degrades
  - Result: pass
- [x] Step 5: Motion block renderer interface + registry
  - Implemented: motion renderer contract + type registry
  - Manual verification requested: block type switches resolve correct renderer without crash
  - Result: pass
- [x] Step 6: Subtitle renderer
  - Implemented: text render + style/transform + enter/exit alpha behavior
  - Manual verification requested: subtitle appears on scrub/play in motion mode
  - Result: pass

- [-] Step 7: WordReveal renderer
  - Implemented: `src/front-end/motion/renderers/WordRevealRenderer.ts`, `accumulate` param support
  - Remaining for completion: manual UX tuning for spacing and per-word animation polish
  - Manual verification requested: words reveal sequentially in both accumulate and replace modes
  - Result: needs verification
- [-] Step 8: Paragraph renderer
  - Implemented: `src/front-end/motion/renderers/ParagraphRenderer.ts` with line-wrap + per-word opacity
  - Remaining for completion: typography polish (line breaks/overflow edge cases)
  - Manual verification requested: paragraph wraps consistently across canvas sizes
  - Result: needs verification
- [-] Step 9: Motion canvas compositor (useMotionRenderer)
  - Implemented: multi-track compositing, renderer lifecycle, property-track evaluation, type registration for subtitle/wordReveal/paragraph
  - Implemented: animated property application for subtitle path (`transform.offsetX/offsetY/scale/rotation`, `style.opacity`)
  - Remaining for completion: broader animated-prop parity for legacy `wordReveal`/`paragraph` compatibility path
  - Manual verification requested: overlapping tracks respect z-order and remain stable while scrubbing
  - Result: needs verification
- [-] Step 10: Motion track UI — timeline lane
  - Implemented: visible motion lanes, selection, drag move, trim left/right, snap integration hooks
  - Implemented: wheel pan/zoom interactions on motion lanes (parity with lyric lane viewport behavior)
  - Remaining for completion: additional gesture polish parity with lyric lane
  - Manual verification requested: drag/trim/snap behavior works across zoom levels
  - Result: needs verification
- [-] Step 11: Motion inspector
  - Implemented: **UX REDESIGN** — tabbed single-column layout (Style, Position, Anim, Items) via 4 sub-components
  - Implemented: Style tab with font family/size/weight, bold/italic/underline toggles, color/opacity, text case chips, advanced section (letter spacing, line height, BG)
  - Implemented: Position tab with 3x3 anchor grid, offset X/Y, scale, rotation — each with keyframe diamond icon
  - Implemented: Animation tab with enter/exit style chips, fraction slider, easing dropdown, opacity start/end controls
  - Implemented: Items tab with compact word list, search, hide toggle, seek-to-playhead, override indicator dot
  - Implemented: Context-switch — selecting an item routes Style/Position/Anim edits to that item's overrides
  - Implemented: Per-word styling — word chips for multi-word items, scoping Style tab to individual words via `wordStyleMap`
  - Implemented: "Editing: [word]" banner with "Back to block" / "Back to item" navigation
  - Remaining for completion: final polish for edge cases and testing across block types
  - Manual verification requested: inspector tab edits live-update preview, item/word context-switch works, per-word styling renders
  - Result: needs verification
- [-] Step 12: Motion track list panel
  - Implemented: add by block type, select, enable/disable, duplicate, reorder (up/down), delete
  - Remaining for completion: context menu UX parity + drag reorder polish
  - Manual verification requested: add/duplicate/reorder/delete maintain correct timeline and render order
  - Result: needs verification
- [-] Step 13: Wire into ProjectEditor.vue
  - Implemented: motion sidebar/inspector/lanes, lyric-lane lock in motion mode, orphan cleanup on load/mode switch with non-blocking notice, motion keyboard parity (copy/paste/delete/nudge)
  - Implemented: **UX REDESIGN** — removed timeline keyframe sublanes (PropertyMiniLane) and expando rows in favor of inspector-integrated keyframe diamonds
  - Implemented: `useMotionGizmo` composable draws visual bounding-box/handles on overlay canvas (move/scale/rotate)
  - Implemented: gizmo toggle button (diamond icon) replaces old "Transform Tool" text button in monitor header
  - Implemented: removed "Keyframes" toggle button (keyframes now managed via Position tab diamonds)
  - Implemented: cleaned up old expando CSS classes (`.motion-track-stack`, `.motion-row-base`, `.motion-row-expando`, `.motion-keyframe-lane-row`, `.motion-keyframe-label`)
  - Remaining for completion: final polish pass for all motion-mode shortcuts and selection edge cases
  - Manual verification requested:
    - Confirm motion tracks display at normal 42px height (no expando)
    - Confirm gizmo toggle activates visual bounding box on selected track in monitor
    - Confirm drag gizmo handles for move/scale/rotate update preview live
    - Confirm keyframe diamonds in Position tab correctly add/remove keyframes at current frame
    - Confirm wheel pan/zoom + motion drag/trim still behave correctly
  - Result: needs verification
- [-] Step 14: Background image support
  - Implemented: project-level `backgroundImageFit` (`cover`/`contain`/`stretch`) in project model/storage defaults
  - Implemented: `useMotionRenderer` draws background image before motion tracks and applies fit mode
  - Implemented: motion inspector background controls (color/transparent toggle/image upload/fit/remove)
  - Manual verification requested:
    - Upload a background image and verify it appears behind text in Motion mode
    - Switch fit mode across `cover`, `contain`, `stretch` and confirm behavior
    - Toggle transparent background and confirm alpha canvas base still works
  - Result: needs verification
- [-] Step 15: Per-item overrides + per-word styling
  - Implemented: **UX REDESIGN** — deleted `MotionItemOverrideEditor.vue` (TipTap editor); replaced with Items tab + context-switch pattern
  - Implemented: compact scrollable word list with search, eye toggle, seek-to-playhead, override indicator dot
  - Implemented: selecting an item in Items tab switches Style/Position/Anim tabs to show that item's overrides
  - Implemented: `ItemOverride.wordStyleMap` for full per-word style parity (color, opacity, bold, italic, underline, fontSize, fontFamily)
  - Implemented: word chip UI for multi-word items — click a word to scope Style tab to that specific word
  - Implemented: `SubtitleRenderer` reads `wordStyleMap` and generates `StyledSpan[]` when no TipTap rich text
  - Implemented: `spansFromWordStyleMap()` utility in `renderTipTapSpans.ts`
  - Remaining for completion: test per-word styling end-to-end with complex multi-word items
  - Manual verification requested:
    - Select an item in Items tab -> confirm Style/Position/Anim tabs now edit that item's overrides
    - For a multi-word item, click word chips -> confirm individual word styling renders in preview
    - Confirm "Back to block" / "Back to item" navigation works correctly
    - Confirm hidden items remain hidden, empty overrides fall back to defaults
  - Result: needs verification
- [-] Step 16: Export integration
  - Implemented: wired `ExportModal` and export controls into `ProjectEditor.vue` monitor UI for Motion mode
  - Implemented: moved `Include Audio` control from monitor settings into `ExportModal` (export-only context)
  - Implemented: monitor export controls simplified (single entry point button; stop remains in export modal flow)
  - Implemented: added `startCanvasFrameExport()` in `useVideoExport.ts` to support frame-by-frame export from main-thread canvas renderers (no worker dependency)
  - Implemented: motion export frame loop now calls motion renderer per frame, captures PNGs, saves batched frames, yields with `setTimeout(0)`, then assembles via existing ffmpeg pipeline
  - Implemented: stopping frame export now prompts to optionally assemble already-rendered frames into a usable partial output
  - Remaining for completion: verify transparent-background alpha behavior in final encoded outputs with your preferred codec/container workflow
  - Manual verification requested:
    - Open Motion mode -> Export -> choose `Frame-by-Frame` -> run a short export and verify text timing/style match preview
    - Start another export and press `Stop Export` during frame rendering; verify export stops cleanly
    - If using transparent background, run an export and confirm expected transparency behavior in your target playback/editing tool
  - Result: needs verification

## Notes
- Generator UX intentionally stays chained (`verse -> line -> word`) and differs from the earlier direct-button wording in the PRD.
- Redo is implemented and mapped to `Cmd/Ctrl+Shift+Z`.
- Lyric timeline now supports copy/cut/paste (`Cmd/Ctrl+C`, `Cmd/Ctrl+X`, `Cmd/Ctrl+V`).
- Waveform/analysis lanes are shown below lyric lanes by default; track reorder controls are in the sidebar.
- **2026-03-02:** Motion Mode redesigned from "persistent layers" to "motion blocks on tracks" — see `MOTION-ARCHITECTURE.md`.
- **2026-03-02:** Old scene engine (Three.js) deprecated but preserved for future 3D motion block types (Phase 4+).
- **2026-03-02:** Motion rendering will use main-thread Canvas 2D (not Web Worker) to avoid font-loading issues.
- **2026-03-02:** Motion UX execution split documented in `MOTION-UX-FOUNDATION.md` (Foundation first, UX pass second, deferred block types explicit).
- **2026-03-02:** Active UX pass scope confirmed: 2D + keyframe MVP now, 3D deferred; full per-item override parity targeted.
- **2026-03-04:** Motion UX Redesign completed: tabbed inspector (Style/Position/Anim/Items), visual transform gizmo on monitor overlay, keyframe diamonds in inspector (replacing timeline sublanes), compact item overrides with per-word `wordStyleMap` styling, TipTap override editor deleted.
- **2026-03-04:** UX fixes: tabs replaced with stacked `<details>` sections; `markDirty()` now called on every motion track mutation (preview auto-updates); keyframe immutability fix (shallow-copy propertyTracks before mutation); start/end fields show frames with time annotation; items inline-expandable with text override input.
- **2026-03-04:** Keyframe System Redesign: property registry (`keyframeProperties.ts`) with 16 keyframeable properties (10 moving, 6 stationary); step interpolation fix in `evalInterpolatedAtFrame`; `PropertyTrack.enabled` flag; `PropertyKeyframeLane.vue` with diamonds, drag, dblclick-delete, right-click interpolation menu; inspector checkboxes enable/disable keyframing per property with auto-first-keyframe; `SubtitleRenderer` reads ALL animated style+transform props; renderer reports `lastBounds` for gizmo sync; easing expanded with `easeInCubic`/`easeOutCubic`.

## Phase 3: Export + Polish — IN PROGRESS
