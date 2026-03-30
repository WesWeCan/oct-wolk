# W.O.L.K.

W.O.L.K. (Words On Live Kanvas) is an desktop app for building lyric-driven motion graphics, timing them against audio, and exporting finished videos.

## What It Does

- Creates local projects with audio, cover art, uploaded assets, and embedded project data
- Edits raw lyrics and derived lyric tracks inside a timeline workflow
- Authors motion blocks with reusable presets
- Supports the built-in motion block types:
  - `subtitle`
  - `cloud`
  - `primitive3d`
- Exports projects as portable `.wolk` archives
- Imports and exports motion presets as `.wolkdpreset` and `.wolkpresets`
- Exports video as WebM, and MP4 when `ffmpeg` is available

## Tech Stack

- Electron
- Vue 3
- TypeScript
- Vite
- Three.js
- TipTap
- Meyda

## Requirements

- Node.js 18+
- Yarn
- `ffmpeg` for MP4 export support

## Install

```bash
git clone https://github.com/WesWeCan/oct-wolk.git
cd oct-wolk
yarn install
```

## Run In Development

```bash
yarn start
```

## Run Tests

```bash
yarn test
```

## Package Builds

```bash
yarn package
yarn make
```

For signed macOS builds:

```bash
ELECTRON_FORGE_SIGN_MAC=1 yarn make
```

The signing and notarization behavior is controlled by environment variables in
`forge.config.ts`.

## Project Workflow

1. Create a project from the home screen.
2. Import audio, cover art, and other project assets.
3. Paste or edit lyrics in the project editor.
4. Generate and refine lyric tracks.
5. Add motion tracks using the available motion block plugins.
6. Adjust styling, timing, presets, and export settings.
7. Export the result to WebM or MP4.

## Motion Architecture

The renderer uses a motion-block registry instead of the older scene system.

- `subtitle` handles timed text composition and animation
- `cloud` builds word-cloud style motion from word tracks
- `primitive3d` renders simple 3D primitives or imported models with word
  sprites

New block types register through `src/front-end/motion-blocks/index.ts` and the
shared plugin contracts in `src/front-end/motion-blocks/core/`.

## Archive Formats

### `.wolk`

- Portable project archive
- Contains a manifest, `project.json`, and copied project files
- Intended for moving full projects between machines

### `.wolkdpreset`

- Single motion preset archive
- Stores one preset for one motion block type

### `.wolkpresets`

- Bundle archive for multiple motion presets

## Video Export

- WebM export is always available
- MP4 export uses `ffmpeg`
- Export settings live on the project document and include:
  - FPS
  - Render width and height
  - Duration
  - Bitrate
  - Audio inclusion
  - Raw frame retention
  - Optional alpha MOV assembly

## Local Storage

W.O.L.K. stores its internal data in your Documents folder under `WOLK/`.

Current builds migrate existing data from older storage locations on startup
when needed, including the prior Electron Application Support location and the
older `~/Documents/__oct_files/wolk/` location.

Typical locations:

- macOS: `~/Documents/WOLK/`
- Windows: `%USERPROFILE%\\Documents\\WOLK\\`
- Linux: `~/Documents/WOLK/`

Important folders:

- `songs/`
- `exports/`
- `presets/`

## Repository Layout

```text
src/
  back-end/
    application-menu.ts
    internal-processes/
  front-end/
    components/
    composables/
    motion-blocks/
    services/
    styles/
    views/
  shared/
  types/
  main.ts
  preload.ts
  renderer.ts
tests/
forge.config.ts
vitest.config.ts
```

## Open Source Release Notes

- Code is licensed under Apache-2.0. See `LICENSE`.
- Project notices live in `NOTICE`.
- Major third-party acknowledgements live in `ACKNOWLEDGEMENTS.md`.
- Security reporting guidance lives in `SECURITY.md`.
- Contribution guidance lives in `CONTRIBUTING.md`.

## Forking And Rebranding

The codebase is intentionally permissive so you can fork it and build on top of
it.

Runtime-visible branding is centralized in `src/shared/branding.ts`, and is intended for Open Culture Tech but a full rebrand still requires manual updates in a few packaging files:

- `package.json`
- `forge.config.ts`
- app icons and build resources


## Manual Verification

Automated tests cover a good part of the codebase, but this is still an Electron app with media, fonts, file imports, and export flows. Before publishing a release, manually verify:

- opening the app and creating a project
- importing audio and assets
- editing lyrics and motion tracks
- exporting WebM
- exporting MP4 with `ffmpeg` installed
- importing and exporting `.wolk` archives
- importing and exporting motion presets

## Contributing

See `CONTRIBUTING.md`.

## Security

See `SECURITY.md`.

