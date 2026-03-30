# W.O.L.K. - Words On Live Kanvas

**An open-source platform for artists to create animated visual word canvases with music.**

W.O.L.K. is an Electron-based desktop application that transforms lyrics and words into dynamic, animated visual scenes synchronized with audio. Create stunning word-based visuals using multiple scene types, timeline-based animation, and export to video.

## Features

- 🎨 **Multiple Scene Types**
  - WordCloud: Dynamic word clouds with multiple layout modes (spiral, ring, grid)
  - WordSphere: 3D rotating sphere with words
  - Single Word: Focused single-word display
  - 3D Model: Import and animate 3D models (.obj) with word labels
  - Portrait Mask: Fill portrait images with animated words

- 🎵 **Audio Analysis**
  - Automatic beat detection
  - Spectral analysis (low/mid/high frequency bands)
  - Energy envelope tracking
  - Visual synchronization with music

- ⏱️ **Timeline Editor**
  - Multi-scene timeline management
  - Keyframe-based animation system
  - Property animation (colors, scale, opacity, etc.)
  - Word pool management with keyframes
  - Visual timeline with beat markers

- 🎬 **Video Export**
  - WebM export (always available)
  - MP4 export (requires ffmpeg)
  - Customizable resolution and bitrate
  - Audio track inclusion

- 📝 **Word Management**
  - Lyric analyzer with TipTap editor
  - Word bank organization
  - Hierarchical word groups
  - Dynamic word pool selection per frame

- 🔤 **Font System**
  - System font scanning and import
  - Project-embedded fonts
  - Font style and weight management
  - Custom fallback chains

## Prerequisites

- **Node.js** 18+ (with npm/yarn)
- **Yarn** package manager (recommended)
- **ffmpeg** (optional, for MP4 export)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/WesWeCan/oct-wolk.git
cd oct-wolk
```

### 2. Install Dependencies

```bash
yarn install
```

### 3. Install ffmpeg (Optional - for MP4 Export)

ffmpeg is **optional** but highly recommended for MP4 video export. Without it, the application will only export WebM format.

#### macOS

Using Homebrew:
```bash
brew install ffmpeg
```

#### Windows

**Option 1: Using winget (Windows 10+)**
```bash
winget install ffmpeg
```

**Option 2: Using Chocolatey**
```bash
choco install ffmpeg
```

**Option 3: Using Scoop**
```bash
scoop install ffmpeg
```

**Option 4: Manual Installation**
1. Download from [https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/)
2. Extract the archive
3. Add the `bin` folder to your system PATH

#### Linux

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Fedora/RHEL/CentOS:**
```bash
sudo dnf install ffmpeg
```

**Arch Linux:**
```bash
sudo pacman -S ffmpeg
```

**Verify Installation:**
```bash
ffmpeg -version
```

## Development

### Running in Development Mode

Start the application in development mode with hot-reload:

```bash
yarn start
```

This will launch the Electron app with the development server running.

### Building the Application

Create a production build:

```bash
yarn package
```

Create distributable packages for your platform:

```bash
yarn make
```

Built applications will be in the `out` directory.

## Usage

### Quick Start

1. **Create a New Song Project**
   - Launch W.O.L.K.
   - Click "Editor" → "Create New Song"
   - Or go to "Song Bank" to manage word collections

2. **Import Audio**
   - Click "Song Data" in the editor
   - Upload an audio file (MP3, WAV, etc.)
   - Wait for automatic audio analysis

3. **Add Words**
   - Go to "Lyric Analyzer" to paste lyrics
   - Words will be automatically extracted
   - Organize words into groups if desired

4. **Create Scenes**
   - Click "+ Add Scene" in the scene list
   - Choose a scene type (WordCloud, WordSphere, etc.)
   - Configure scene parameters in the Inspector

5. **Animate**
   - Use the timeline to position scenes
   - Add keyframes for animated properties
   - Use the word pool to control which words display

6. **Export**
   - Use `Export .wolk` to save a portable project archive
   - Use `Import .wolk` to bring a project archive into local storage
   - Use `Export Presets` / `Import Preset` for motion preset archives
   - Use video export for WebM/MP4 output
   - Check that ffmpeg is installed for MP4 support

### Scene Types

- **WordCloud**: Creates dynamic word clouds with configurable layouts (spiral, ring, grid), colors, and animations
- **WordSphere**: 3D rotating sphere with words placed on its surface
- **Single Word**: Displays one word at a time, centered and animated
- **3D Model**: Import .obj 3D models with optional textures, add word labels that connect to the model
- **Portrait Mask**: Upload a portrait image and fill it with words that conform to the image shape

### Keyboard Shortcuts

- **Space**: Play/Pause
- **Cmd/Ctrl + Wheel**: Zoom timeline
- **Drag**: Move scenes and keyframes
- **Shift + Drag**: Select multiple keyframes

## Project Structure

```
oct-wolk/
├── src/
│   ├── back-end/           # Electron main process
│   │   ├── internal-processes/
│   │   │   ├── song-storage.ts       # Song/project management
│   │   │   ├── timeline-storage.ts   # Timeline data storage
│   │   │   ├── analysis-storage.ts   # Audio analysis cache
│   │   │   └── fonts.ts              # Font system
│   │   └── services/
│   │       └── FileService/          # File management utilities
│   ├── front-end/          # Vue 3 renderer process
│   │   ├── components/     # Vue components
│   │   ├── composables/    # Vue composition functions
│   │   ├── services/       # Frontend services
│   │   ├── styles/         # SCSS styles
│   │   ├── utils/          # Utility functions
│   │   ├── views/          # Page views
│   │   └── workers/        # Web Workers for rendering
│   │       ├── engine/     # Scene engine
│   │       └── scenes/     # Scene implementations
│   ├── types/              # TypeScript type definitions
│   ├── main.ts             # Electron main entry
│   ├── preload.ts          # Preload script (IPC bridge)
│   └── renderer.ts         # Vue app entry
├── forge.config.ts         # Electron Forge configuration
├── vite.*.config.ts        # Vite build configurations
└── package.json
```

## Export Formats

### .wolk
- Zip archive with a `.wolk` extension
- Contains `manifest.json`, `project/project.json`, and `project/files/...`
- Designed for full project portability, including project-local assets such as audio, fonts, and uploaded files

### .wolkdpreset / .wolkpresets
- Zip archives with custom extensions
- `.wolkdpreset` stores a single motion preset
- `.wolkpresets` stores a multi-preset bundle grouped by block type

### WebM
- **Always available** (uses browser MediaRecorder API)
- VP9 video codec with Opus audio
- Excellent quality and compression
- Native web browser support

### MP4
- **Requires ffmpeg installation**
- Automatic conversion from WebM
- H.264 video codec
- Better compatibility with video players and editing software

The application will automatically detect if ffmpeg is available and enable MP4 export accordingly.

Packaged macOS and Windows builds can also receive `.wolk` files from the OS and import them directly into the project library.

## Font Management

W.O.L.K. supports two font systems:

1. **System Fonts**: Browse and import fonts from your system
2. **Project Fonts**: Embed fonts directly into your project for portability

Fonts are automatically loaded into the render worker for consistent rendering across all scene types.

## Data Storage

W.O.L.K. stores project data locally in your application data directory:

- **macOS**: `~/Library/Application Support/Words On Live Kanvas - Open Culture Tech/wolk/`
- **Windows**: `%APPDATA%/Words On Live Kanvas - Open Culture Tech/wolk/`
- **Linux**: `~/.config/Words On Live Kanvas - Open Culture Tech/wolk/`

The structure includes:
- `docStorage/songs/`: Each song/project has its own folder containing:
  - `project.json`: Project metadata, tracks, and render settings
  - `audio.*` / `cover.*`: Imported media files when present
  - `fonts/`: Project-local fonts copied into the project
  - `assets/`: Uploaded files (images, models, other project assets)
- `docStorage/exports/`: Video exports (accessible via "Open Folder" button after export)
- `docStorage/presets/`: Saved motion presets grouped by block type

## Troubleshooting

### ffmpeg not found
If you see "ffmpeg not found" warnings:
1. Install ffmpeg for your platform (see Installation section)
2. Restart the application
3. The app will automatically detect ffmpeg

### Video export fails
- Ensure you have sufficient disk space
- Check that audio is loaded properly
- Try reducing resolution or bitrate
- Check console for specific error messages

### Fonts not appearing
- Ensure fonts are installed on your system
- Try embedding the font into your project
- Restart the application after installing new fonts

### Audio analysis taking too long
- Audio analysis runs in the background
- Larger files take longer to analyze
- Results are cached for future use
- Check the analysis status in the editor

## License

This project is licensed under **CC-BY-4.0** (Creative Commons Attribution 4.0 International).

You are free to:
- Share: Copy and redistribute the material
- Adapt: Remix, transform, and build upon the material

Under the following terms:
- Attribution: You must give appropriate credit

See [LICENSE](LICENSE) file for full details.

## Credits

**Created by**: WesWeCan  
**GitHub**: [@WesWeCan](https://github.com/WesWeCan)

### Technologies Used

- **Electron** - Desktop application framework
- **Vue 3** - Reactive UI framework
- **TypeScript** - Type-safe JavaScript
- **Three.js** - 3D graphics and rendering
- **Vite** - Build tool and dev server
- **TipTap** - Rich text editor
- **Meyda** - Audio feature extraction

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## Support

For questions, issues, or feature requests, please open an issue on GitHub:
[https://github.com/WesWeCan/oct-wolk/issues](https://github.com/WesWeCan/oct-wolk/issues)

---

**Happy Creating! 🎨🎵**

