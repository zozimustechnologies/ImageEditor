No accounts or credentials required. The extension works entirely locally with no sign-in, no server, and no external services.

How to test:
1. Install the extension and click its toolbar icon to open the side panel.
2. Load an image via the "Browse Files" button, drag-and-drop, or paste from clipboard (Ctrl+V).
3. Use the Crop, Resize, Filters, and Creative tabs to edit the image.
4. Click Download in the Export tab to save the result.
5. To test the context-menu flow: right-click any image on a webpage and select "Edit image" — it opens in the side panel automatically.
6. The "Images on this page" section (below the upload zone) lists images found on the active tab; click any thumbnail to load it.

Undo/Redo: Ctrl+Z / Ctrl+Y (or the toolbar buttons) — up to 20 steps.

Permissions used:
- sidePanel — to display the editor UI
- contextMenus — for the right-click "Edit image" option
- activeTab / scripting — to scan the current page for images (only when the panel is open and the user triggers the scan)

No dependencies on other products. All processing is done in-browser via the Canvas 2D API. No network requests are made at any point.
