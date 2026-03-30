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

## FFmpeg For MP4 Export

W.O.L.K. always supports WebM export. MP4 export requires a separately installed
`ffmpeg` executable that the app can find on your system.

This project does not currently bundle the standalone `ffmpeg` CLI used for MP4
encoding. Some packaged Electron builds may still contain files such as
`ffmpeg.dll`, but those are Chromium/Electron runtime media libraries and are not
the same as a user-invokable `ffmpeg` binary.

Install `ffmpeg` using one of the following:

### macOS

```bash
brew install ffmpeg
ffmpeg -version
```

### Windows

Option 1:

```bash
winget install ffmpeg
ffmpeg -version
```

Option 2:

```bash
choco install ffmpeg
ffmpeg -version
```

Option 3:

```bash
scoop install ffmpeg
ffmpeg -version
```

Option 4:

Download a build from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/), extract it,
and add its `bin` folder to your `PATH`.

### Linux

Ubuntu / Debian:

```bash
sudo apt update
sudo apt install ffmpeg
ffmpeg -version
```

Fedora / RHEL / CentOS:

```bash
sudo dnf install ffmpeg
ffmpeg -version
```

Arch:

```bash
sudo pacman -S ffmpeg
ffmpeg -version
```

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

On macOS, `yarn make` now signs and notarizes release builds by default.
It expects:

- a `Developer ID Application` certificate in your keychain
- Xcode command line tools
- notarization credentials available through one of the Forge-supported methods

The default local notarization path uses your stored `notarytool` keychain profile:

```bash
xcrun notarytool store-credentials "notarytool-password" \
  --apple-id "you@example.com" \
  --team-id "YOURTEAMID" \
  --password "app-specific-password"
```

Then build the release:

```bash
yarn make:mac
```

For Windows builds from macOS, use the zip maker only:

```bash
yarn make:win
```

That cross-build path produces both Windows `.zip` artifacts in sequence:

- `win32/arm64`
- `win32/x64`

It avoids depending on the Windows Squirrel installer toolchain on macOS. If you
want the native Windows installer output, run `yarn make --platform=win32` on a
Windows machine.

To build both Windows zips and then the signed macOS release:

```bash
yarn make:all
```

Alternative notarization inputs supported by `forge.config.ts`:

- `APPLE_KEYCHAIN_PROFILE` or `NOTARYTOOL_KEYCHAIN_PROFILE`
- `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` or `APPLE_PASSWORD`, and `APPLE_TEAM_ID`
- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, and `APPLE_API_ISSUER`

Optional overrides:

- `APPLE_SIGN_IDENTITY` to force a specific signing identity
- `APPLE_KEYCHAIN` to point at a non-default keychain
- `ELECTRON_FORGE_SIGN_MAC=0` to skip signing for a local unsigned package
- `ELECTRON_FORGE_NOTARIZE=0` to sign without notarizing

Verify your signing identities before packaging:

```bash
security find-identity -p codesigning -v
```

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
- MP4 export uses a separately installed `ffmpeg` executable
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

