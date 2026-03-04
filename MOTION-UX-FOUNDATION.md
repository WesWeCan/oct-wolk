# Motion UX Foundation

> Canonical UX execution companion to `MOTION-ARCHITECTURE.md`.
> Purpose: separate architecture/foundation work from usability polish so progress status stays honest.

---

## 1) Scope Boundaries

### Foundation (must stabilize first)

- Block types in scope now:
  - `subtitle`
  - `wordReveal`
  - `paragraph`
- Focus:
  - predictable renderer behavior
  - timeline interaction parity
  - inspector completeness for daily authoring
  - keyframe MVP usability in motion mode
  - stable integration in `ProjectEditor.vue`

### UX Pass (after foundation is stable)

- Creator-first defaults and presets
- Better transform ergonomics (less numeric-only editing)
- Better wording/labels for block parameters
- Better discoverability of behavior differences between block types
- Subtitle-first DRY consolidation: migrate most 2D text behaviors into subtitle parameters instead of separate block types

### Deferred (not in this iteration)

- `flash`
- `typewriter`
- `verticalStack`
- `3dText`

Planning note for next iteration:
- `wordReveal` and `paragraph` are candidates for deprecation in favor of subtitle behavior modes (e.g. reveal mode, line mode, vertical stack mode) to reduce duplicated renderer logic.

Deferred types enter implementation only after:
1. Foundation checklist is green.
2. Step 14/15/16 are complete and manually verified.

---

## 2) Current State Snapshot

### Works well enough

- Subtitle render path is understandable and testable.
- Motion tracks can be created, selected, trimmed, moved.
- Motion mode wiring exists and preview updates.

### Still confusing / partial

- `wordReveal` behavior lacks clear authoring expectations.
- `paragraph` wrapping and readability controls need polish.
- Transform controls are functional but not user-friendly.
- Inspector density is still high for first-time use.

---

## 3) Foundation Checklist (Execution Order)

Each item must include:
- Implemented changes
- Manual verification request
- Result (`pass` or `needs fixes`)

### F1 — Step 13 integration polish

- [ ] Confirm lyric lanes are always non-editable in motion mode.
- [ ] Confirm orphaned override cleanup triggers on project load + lyric->motion mode switch.
- [ ] Confirm motion keyboard parity:
  - copy/paste selected motion track
  - delete selected motion track
  - left/right nudge selected motion track

### F2 — Step 7 wordReveal consistency

- [ ] Confirm `replace` behavior is deterministic.
- [ ] Confirm `accumulate` behavior is deterministic.
- [ ] Confirm text timing matches lyric source timing at scrub + playback.

### F3 — Step 8 paragraph consistency

- [ ] Confirm wrap behavior at common canvas sizes (`1920x1080`, `1080x1920`, `1080x1080`).
- [ ] Confirm per-word opacity follows item timing.
- [ ] Confirm no severe clipping artifacts at long lines.

### F4 — Step 10 timeline interaction parity

- [ ] Confirm drag and trim are reliable at low/high zoom.
- [ ] Confirm snapping works against lyric edges + playhead.
- [ ] Confirm selection state remains stable while editing.

### F5 — Step 11 inspector completeness (foundation level)

- [ ] Confirm source/timing/style/transform/enter-exit edits update preview live.
- [ ] Confirm wordReveal type params are understandable enough to use.
- [ ] Confirm basic item overrides (hide/text) behave predictably.

### F6 — Step 12 track list parity (foundation level)

- [ ] Confirm create/duplicate/reorder/delete preserves render order and selection.
- [ ] Confirm enable/disable updates preview immediately.
- [ ] Confirm type creation path is clear and low-friction.

### F7 — Step 15 rich override baseline

- [ ] Confirm per-item rich override editor opens/closes reliably in inspector.
- [ ] Confirm TipTap JSON overrides render during scrub/playback for `subtitle`, `wordReveal`, and `paragraph`.
- [ ] Confirm clearing an override falls back to source lyric text with no stale styles.

### F8 — 2D keyframe + monitor manipulation baseline

- [ ] Confirm keyframe mini-lanes are available for selected motion tracks (`offsetX`, `offsetY`, `scale`, `rotation`, `opacity`).
- [ ] Confirm keyframe edits affect motion preview during scrub/playback.
- [ ] Confirm monitor manipulation tool can move, scale, and rotate selected subtitle blocks and can be toggled off.

---

## 3.1 Step-to-Foundation Mapping

| Architecture step | Foundation slice |
|---|---|
| Step 13 (integration) | F1 |
| Step 7 (wordReveal) | F2 |
| Step 8 (paragraph) | F3 |
| Step 10 (timeline lane UX) | F4 |
| Step 11 (inspector completeness) | F5 |
| Step 12 (track list parity) | F6 |
| Step 15 (rich text overrides) | F7 |
| Keyframe MVP + monitor interactions | F8 |

Execution order for current iteration is: **F1 -> F2 -> F3 -> F4 -> F5 -> F6 -> F7 -> F8**.

---

## 4) UX Redesign (Implemented)

### U1 — Inspector Redesign (Tabbed, Single-Column)

- [x] Refactored `MotionInspector.vue` into 4-tab layout: Style, Position, Anim, Items.
- [x] New sub-components: `MotionAppearanceTab.vue`, `MotionPositionTab.vue`, `MotionAnimationTab.vue`, `MotionItemsTab.vue`.
- [x] Single-column layout throughout with collapsible Advanced section.
- [x] Background section moved to collapsed `<details>` (project-level, not per-track).
- [x] Removed "Type Parameters" section (wordReveal/paragraph deprecated).

### U2 — Transform Gizmo in Monitor

- [x] New `useMotionGizmo.ts` composable: draws dashed bounding box, corner scale handles, rotation handle on overlay canvas.
- [x] Pointer events: drag inside = move, drag corner = scale, drag rotation handle = rotate.
- [x] Icon toggle button (diamond) replaces old "Transform Tool" text button.
- [x] Removed old `onPreviewPointerDown`/`applyMonitorTransformDelta` from ProjectEditor.

### U3 — Keyframe Diamond Workflow

- [x] Keyframe diamonds inline with each animatable property (offsetX, offsetY, scale, rotation, opacity) in Position tab.
- [x] Diamond states: hollow (empty), half-filled, filled — reflecting keyframe presence at current frame.
- [x] Click toggles keyframe at current frame via `upsertKeyframe`/`removeKeyframeAtIndex`.
- [x] Removed timeline keyframe sublanes (PropertyMiniLane), "Keyframes" toggle, expando CSS.

### U4 — Item Overrides Redesign

- [x] Compact word list in Items tab: search, eye toggle (hide), seek-to-playhead, override indicator dot.
- [x] Context-switch: selecting an item switches Style/Position/Anim tabs to show that item's overrides.
- [x] "Editing: [word]" banner with "Back to block" button.
- [x] Per-word styling: word chips for multi-word items, scoping Appearance tab to individual word via `wordStyleMap`.
- [x] `ItemOverride.wordStyleMap` added to data model for full per-word style parity.
- [x] `SubtitleRenderer` reads `wordStyleMap` and generates `StyledSpan[]` when no TipTap rich text.
- [x] Deleted `MotionItemOverrideEditor.vue` (TipTap editor for overrides).

### U5 — Enter/Exit Opacity Defaults

- [x] `DEFAULT_MOTION_ENTER_EXIT.opacityStart` changed from 1 to 0 (fade-in default).

---

## 5) Verification Matrix

| Area | Manual test required | Promote to `[x]` |
|---|---|---|
| Foundation items (F1-F6) | Yes | Only after pass |
| UX items (U1-U3) | Yes | Only after pass |
| Deferred types | N/A in this iteration | Not eligible |

Rule: no status promotion in `REBUILD-PROGRESS.md` to `[x]` without explicit manual confirmation.

