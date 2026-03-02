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

## Next Up: Phase 2 — Motion Mode MVP
- Motion layer model + UI
- Source binding (layer -> track)
- TextDisplayScene implementing WorkerScene
- Style/transform controls
- Preview canvas compositing
- See PRD Section 4.2 + Phase 2 deliverables

## Notes
- Generator UX intentionally stays chained (`verse -> line -> word`) and differs from the earlier direct-button wording in the PRD.
- Redo is implemented and mapped to `Cmd/Ctrl+Shift+Z`.
- Lyric timeline now supports copy/cut/paste (`Cmd/Ctrl+C`, `Cmd/Ctrl+X`, `Cmd/Ctrl+V`).
- Waveform/analysis lanes are shown below lyric lanes by default; track reorder controls are in the sidebar.

## Phase 3: Export + Polish — NOT STARTED
