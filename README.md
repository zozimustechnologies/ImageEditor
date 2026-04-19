# Image Editor — Browser Side Panel Extension

A lightweight, privacy-first image editor that runs in your browser's side panel. Crop, resize, apply filters, convert formats, and use 12 creative pixel-manipulation effects — all without leaving your current tab.

Built as a Manifest V3 extension using the Side Panel API for Microsoft Edge and Google Chrome.

## Features

### Image Loading (6 methods)
- **File picker** — browse and select any image file
- **Drag & drop** — drop files or image URLs onto the editor
- **Clipboard paste** — Ctrl+V or click the Paste button
- **Right-click context menu** — right-click any image on the web → "Edit image"
- **Page image detection** — scans the active tab and shows a thumbnail gallery of every image on the page
- **URL drop** — drag images directly from other browser tabs

### Editing Tools
- **Crop** — interactive drag handles, 5 preset aspect ratios (Free, 1:1, 4:3, 16:9, 3:2), manual pixel coordinate input
- **Resize** — width/height with locked aspect ratio, preset scales (25%, 50%, 75%, 100%, 150%, 200%)

### Filters
- **8 adjustable sliders** — brightness, contrast, saturation, blur, grayscale, sepia, hue rotation, opacity
- **8 one-click presets** — Original, Vivid, Warm, Cool, B&W, Sepia, High Contrast, Vintage

### 12 Creative Filters
Unique pixel-manipulation effects with intensity control and AI-powered recommendations:

| Filter | Effect |
|---|---|
| 🧠 Memory Drift | Nostalgic blur with warm color drift |
| 🧬 Genetic Mutation | Chaotic pixel displacement (adjustable mutation rate) |
| 🕰️ Time Slice | Day-to-night gradient across the image |
| 🧭 Perspective Warp | Barrel distortion / fish-eye |
| 🎭 Emotion: Happy | Warm glow with bloom |
| 🎭 Emotion: Sad | Cool desaturation with blue shift |
| 🎭 Emotion: Angry | Edge-detected red amplification |
| 🌌 Physics Breaker | Sine-wave displacement + chromatic aberration |
| 🧩 Multi-Reality | Three-way split: posterized / real / sketch |
| 🔍 Detail Redistribution | Inverted sharpness vignette |
| 📡 Signal Corruption | VHS-style glitch with scanlines |
| 🌱 Growth / Decay | Organic rust, growth, and aging |

### Export
- **Formats** — PNG, JPEG, WebP
- **Quality control** — adjustable slider for lossy formats
- **One-click download** — filename auto-generated from original

### Other
- **Undo/Redo** — 20-step history with Ctrl+Z / Ctrl+Y
- **Image analysis** — automatic creative filter recommendation based on image content
- **Dark theme** — matches browser UI

## Install

1. Open `edge://extensions` (or `chrome://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

Click the extension icon in the toolbar to open the side panel.

## Usage

1. Click the toolbar icon to open the side panel
2. Load an image: browse files, drag-and-drop, paste from clipboard, or click a detected page image
3. Edit with Crop, Resize, Filters, or Creative tools
4. Export as PNG, JPEG, or WebP

Right-click any image on a webpage → **"Edit image"** to send it directly to the editor.

## Privacy

- 100% local processing — images are never uploaded
- No tracking, analytics, or cookies
- No external scripts or network requests
- Minimal permissions — only what's needed

## Structure

```
├── manifest.json        # Extension manifest (MV3)
├── background.js        # Service worker — toolbar click, context menu, page scanning
├── sidepanel.html       # Side panel UI shell
├── sidepanel.css        # Dark theme styling
├── sidepanel.js         # All editor logic (Canvas 2D API, ~1400 lines)
├── icons/               # Extension icons (16, 48, 128px)
└── storeassets/         # Edge Add-on store listing assets
    ├── description.md           # Store description
    ├── extensionlogo.png        # 300×300 logo
    ├── smallpromotionaltile.png # 440×280 tile
    ├── largepromotionaltile.png # 1400×560 tile
    ├── screenshot-1280x800.png  # Full-size screenshot
    └── screenshot-640x400.png   # Small screenshot
```

Zero dependencies. Pure HTML, CSS, and vanilla JavaScript. All processing uses the Canvas 2D API.

## License

© Zozimus Technologies. All rights reserved.

[MIT License](/LICENSE)
