# Contributing

Thanks for wanting to contribute to W.O.L.K.

## Development Setup

```bash
yarn install
yarn start
```

Run tests before opening a pull request:

```bash
yarn test
```

## Project Conventions

- Use `yarn`, not `npm`
- Prefer focused changes over broad opportunistic refactors
- Keep Vue single-file components in the repository style:
  - `<script setup lang="ts">`
  - `<template>`
- Keep component styling in the shared `styles/` tree instead of inline SFC SCSS blocks unless there is a strong reason not to
- Prefer `axios` over `fetch` when you actually need network requests
- Avoid adding CI or automation scaffolding unless explicitly requested

## Pull Request Expectations

- Explain the problem and the reason for the change
- Mention any user-facing behavior changes
- Mention any packaging or archive format implications
- Keep tests aligned with intended behavior

## Manual Verification

Please do not rely only on unit tests for Electron/media changes. When relevant,
also manually verify:

- project creation
- audio import
- lyric editing
- motion track editing
- archive import and export
- WebM export
- MP4 export when `ffmpeg` is installed

## Legal Notes

By contributing, you agree that your contribution may be distributed under the
repository license.
