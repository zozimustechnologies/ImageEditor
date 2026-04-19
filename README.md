# Image Editor — Browser Side Panel Extension

A lightweight image editor that runs in your browser's side panel. Crop, resize, apply filters, and export images — all without leaving your browser.

Built as a Manifest V3 extension using the Side Panel API for Edge and Chrome.

## Features

- **Load images** — drag & drop, file picker, paste from clipboard, or right-click any image on the web
- **Crop** — interactive drag handles, preset aspect ratios (Free, 1:1, 4:3, 16:9, 3:2), manual coordinate input
- **Resize** — width/height with locked aspect ratio, preset scales (25%–200%)
- **Filters** — brightness, contrast, saturation, blur, grayscale, sepia, hue rotate, opacity
- **Presets** — Original, Vivid, Warm, Cool, B&W, Sepia, High Contrast, Vintage
- **Export** — PNG, JPEG, or WebP with quality control
- **Undo/Redo** — full history stack with Ctrl+Z / Ctrl+Y

## Install

1. Open `edge://extensions` (or `chrome://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder

Click the extension icon in the toolbar to open the side panel.

## Usage

- Click the toolbar icon to open the editor in the side panel
- Right-click any image on a page → **Edit image** to send it directly to the editor
- Paste an image from clipboard with Ctrl+V or the Paste button

## Structure

```
├── manifest.json      # Extension manifest (MV3)
├── background.js      # Service worker — toolbar click + context menu
├── sidepanel.html     # Side panel shell
├── sidepanel.css      # Dark theme styling
├── sidepanel.js       # All editor logic (Canvas 2D API)
└── icons/             # Extension icons
```

Zero dependencies. All processing is local — no data leaves your browser.

## License

<p>&copy Zozimus Technologies. All rights reserved.</p>

[MIT License](/LICENSE)
