---
name: subtitle typewriter effect
overview: Add a stepped-letter typewriter enter/exit effect to the existing subtitle motion block, reusing the current timing model while avoiding regressions in shared enter/exit behavior and subtitle rendering.
todos:
  - id: verify-shared-timing-gate
    content: Update the shared enter/exit timing design so typewriter animates even with fade, move, and scale disabled.
    status: pending
  - id: design-stepped-rendering
    content: Implement stepped-letter rendering in the subtitle renderer using wrapped/measured rendered units rather than raw string substrings.
    status: pending
  - id: wire-inspector-compatibility
    content: Add the new effect to the subtitle animation inspector while preserving legacy style compatibility and sane defaults.
    status: pending
  - id: add-motion-tests
    content: Add focused timing and renderer regression tests for typewriter enter and reverse exit behavior.
    status: pending
isProject: false
---

# Subtitle Typewriter Enter/Exit Plan

## Recommendation

Implement this inside the existing `subtitle` motion block, not as a new plugin. A separate plugin would duplicate the lyric-backed resolver, inspector wiring, font collection, gizmo behavior, normalization, and tests for a feature that still uses the same subtitle data model.

## Critical Corrections To The Previous Analysis

- The hardest part is not just `SubtitleRenderer`; it is the shared timing gate in `[src/front-end/utils/motion/enterExitAnimation.ts](src/front-end/utils/motion/enterExitAnimation.ts)`. Today `enterProgress`/`exitProgress` only animate when `fade`, `move`, or `scale` is enabled, so a pure typewriter effect would silently do nothing unless that path is extended.
- The inspector in `[src/front-end/motion-blocks/subtitle/inspector/tabs/MotionAnimationTab.vue](src/front-end/motion-blocks/subtitle/inspector/tabs/MotionAnimationTab.vue)` still derives and writes the legacy `style` field. If we add a new effect and do not update that mapping carefully, saved data and UI state will drift.
- A true stepped-letter effect cannot rely on a naive substring of `item.text` because subtitle rendering supports rich spans and `wordStyleMap` in `[src/front-end/motion-blocks/subtitle/renderer/SubtitleRenderer.ts](src/front-end/motion-blocks/subtitle/renderer/SubtitleRenderer.ts)`. The reveal logic has to operate on the measured rendered units, not just raw string length.

## Implementation Approach

1. Extend the enter/exit model for a first-class typewriter mode.

- Update `[src/types/project_types.ts](src/types/project_types.ts)` so `MotionAnimationStyle` can represent the new effect without breaking saved subtitle tracks.
- Keep backwards compatibility: existing `fade`/`slide`/`scale` projects must normalize exactly as before.

1. Teach shared enter/exit timing helpers that typewriter counts as a real animation.

- Update `[src/front-end/utils/motion/enterExitAnimation.ts](src/front-end/utils/motion/enterExitAnimation.ts)` so enter/exit progress is produced for typewriter even when fade/move/scale are disabled.
- Preserve the existing duration model: `fraction`, `minFrames`, `maxFrames`, and easing continue to drive timing.

1. Add subtitle-specific stepped-letter rendering.

- In `[src/front-end/motion-blocks/subtitle/renderer/SubtitleRenderer.ts](src/front-end/motion-blocks/subtitle/renderer/SubtitleRenderer.ts)`, compute the ordered rendered character units after wrapping and span measurement, then map `enterProgress` to a visible unit count and `exitProgress` to a hidden-from-right unit count.
- Render whole visible units and skip hidden ones so the effect is truly stepped by letter, left-to-right on enter and right-to-left on exit.
- Make the composition rule explicit: typewriter should work with the same timing windows, and global fade/move/scale should either remain compatible or be intentionally disabled by the preset to avoid double-animation surprises.

1. Update the subtitle animation inspector to expose the new effect safely.

- Add a `Typewriter` preset/style path in `[src/front-end/motion-blocks/subtitle/inspector/tabs/MotionAnimationTab.vue](src/front-end/motion-blocks/subtitle/inspector/tabs/MotionAnimationTab.vue)`.
- Ensure the UI writes a consistent `MotionEnterExit` payload, including legacy compatibility fields where needed.
- Prefer a sane default preset: fade off, move off, scale off, shared timing still active.

1. Add targeted regression coverage.

- Add or update tests under `[tests/front-end/motion/](tests/front-end/motion/)` for:
  - shared timing progression when typewriter is selected and fade/move/scale are off;
  - subtitle renderer behavior for stepped enter and reverse stepped exit;
  - registry/plugin normalization still working for subtitle after the new style is introduced.
- Use focused motion tests rather than broad unrelated coverage.

## Main Risks To Guard Against

- Pure typewriter config produces no animation because shared progress never starts.
- Rich text or mixed styling causes letter counts to desync from what is actually drawn.
- Exit logic removes letters from the wrong side when text wraps to multiple lines.
- Legacy `style` mapping in the inspector overwrites the new mode or collapses it back to `fade`.
- Combining typewriter with fade/move/scale creates unexpected double effects unless the intended behavior is tested.

## Expected File Touches

- `[src/types/project_types.ts](src/types/project_types.ts)`
- `[src/front-end/utils/motion/enterExitAnimation.ts](src/front-end/utils/motion/enterExitAnimation.ts)`
- `[src/front-end/motion-blocks/subtitle/renderer/SubtitleRenderer.ts](src/front-end/motion-blocks/subtitle/renderer/SubtitleRenderer.ts)`
- `[src/front-end/motion-blocks/subtitle/inspector/tabs/MotionAnimationTab.vue](src/front-end/motion-blocks/subtitle/inspector/tabs/MotionAnimationTab.vue)`
- Possibly `[src/front-end/motion-blocks/subtitle/defaults.ts](src/front-end/motion-blocks/subtitle/defaults.ts)` if the new preset should be available by default
- Tests in `[tests/front-end/motion/](tests/front-end/motion/)`

## Test Focus

- Verify a cue with `style: 'typewriter'` and no fade/move/scale still advances through visible letters over the configured enter/exit windows.
- Verify exit hides characters in reverse order.
- Verify existing non-typewriter subtitle enter/exit behaviors still pass unchanged.

