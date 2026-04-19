(() => {
  'use strict';

  /* ================================================================
     STATE
     ================================================================ */
  const state = {
    originalImage: null,   // HTMLImageElement of loaded image
    currentCanvas: null,   // offscreen canvas holding current pixel data
    fileName: 'image',
    fileExt: 'png',
    undoStack: [],
    redoStack: [],
    maxHistory: 20,
    // Crop
    cropActive: false,
    cropRatio: null,       // null = free, or [w, h]
    cropRect: { x: 0, y: 0, w: 0, h: 0 },
    // Filters (CSS filter values)
    filters: {
      brightness: 100,
      contrast: 100,
      saturate: 100,
      blur: 0,
      grayscale: 0,
      sepia: 0,
      hueRotate: 0,
      opacity: 100,
    },
    // Resize
    lockAspect: true,
    aspectRatio: 1,
    // Export
    exportFormat: 'png',
    exportQuality: 0.92,
  };

  /* ================================================================
     DOM REFS
     ================================================================ */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const uploadZone   = $('#uploadZone');
  const fileInput     = $('#fileInput');
  const browseBtn     = $('#browseBtn');
  const pasteBtn      = $('#pasteBtn');
  const canvasArea    = $('#canvasArea');
  const previewCanvas = $('#previewCanvas');
  const ctx           = previewCanvas.getContext('2d');
  const canvasWrapper = $('#canvasWrapper');
  const imageInfo     = $('#imageInfo');
  const cropOverlay   = $('#cropOverlay');
  const cropRegion    = $('#cropRegion');

  // Tool tabs & panels
  const toolTabs   = $$('.tool-tab');
  const toolPanels = $$('.tool-panel');

  // Crop
  const cropXInput = $('#cropX');
  const cropYInput = $('#cropY');
  const cropWInput = $('#cropW');
  const cropHInput = $('#cropH');

  // Resize
  const resizeWInput = $('#resizeW');
  const resizeHInput = $('#resizeH');
  const lockAspectBtn = $('#lockAspect');
  const resizeInfo    = $('#resizeInfo');

  // Filters
  const filterSliders = {
    brightness: $('#filter-brightness'),
    contrast:   $('#filter-contrast'),
    saturate:   $('#filter-saturate'),
    blur:       $('#filter-blur'),
    grayscale:  $('#filter-grayscale'),
    sepia:      $('#filter-sepia'),
    hueRotate:  $('#filter-hueRotate'),
    opacity:    $('#filter-opacity'),
  };

  // Export
  const qualitySection = $('#qualitySection');
  const qualitySlider  = $('#exportQuality');
  const exportInfo     = $('#exportInfo');

  // Actions
  const undoBtn     = $('#undoBtn');
  const redoBtn     = $('#redoBtn');
  const newImageBtn = $('#newImageBtn');

  /* ================================================================
     IMAGE LOADING
     ================================================================ */
  function loadImage(src, name) {
    const img = new Image();
    img.onload = () => {
      state.originalImage = img;
      if (name) {
        const dotIdx = name.lastIndexOf('.');
        state.fileName = dotIdx > 0 ? name.substring(0, dotIdx) : name;
        state.fileExt = dotIdx > 0 ? name.substring(dotIdx + 1).toLowerCase() : 'png';
      }
      // Create offscreen canvas with image
      const oc = document.createElement('canvas');
      oc.width = img.naturalWidth;
      oc.height = img.naturalHeight;
      oc.getContext('2d').drawImage(img, 0, 0);
      state.currentCanvas = oc;
      state.aspectRatio = img.naturalWidth / img.naturalHeight;

      // Clear history
      state.undoStack = [];
      state.redoStack = [];
      updateUndoRedoButtons();

      // Reset filters
      resetFilterState();
      syncFilterSliders();

      showEditor();
      renderPreview();
      updateImageInfo();
      initResizeInputs();
      initCropOverlay();
    };
    img.onerror = () => {
      console.error('Failed to load image');
    };

    if (src instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.readAsDataURL(src);
    } else {
      img.crossOrigin = 'anonymous';
      img.src = src;
    }
  }

  function loadFromFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    loadImage(file, file.name);
  }

  function showEditor() {
    uploadZone.classList.add('hidden');
    canvasArea.classList.remove('hidden');
  }

  function showUpload() {
    canvasArea.classList.add('hidden');
    uploadZone.classList.remove('hidden');
    state.currentCanvas = null;
    state.originalImage = null;
    state.undoStack = [];
    state.redoStack = [];
  }

  /* ── File Input ── */
  browseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) loadFromFile(e.target.files[0]);
  });

  /* ── Drag & Drop ── */
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
  });
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) { loadFromFile(file); return; }
    // Handle URL drops (dragging images from web pages)
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url && /^https?:\/\/.+/i.test(url)) {
      loadImage(url, url.split('/').pop().split('?')[0] || 'image.png');
    }
  });

  /* ── Also allow drop on canvas area ── */
  canvasArea.addEventListener('dragover', (e) => e.preventDefault());
  canvasArea.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) { loadFromFile(file); return; }
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (url && /^https?:\/\/.+/i.test(url)) {
      loadImage(url, url.split('/').pop().split('?')[0] || 'image.png');
    }
  });

  /* ── Paste ── */
  pasteBtn.addEventListener('click', async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          loadImage(blob, 'pasted-image.png');
          return;
        }
      }
    } catch (err) {
      console.error('Clipboard read failed:', err);
    }
  });

  document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        loadFromFile(item.getAsFile());
        return;
      }
    }
  });

  /* ── Context menu / message from background ── */
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'loadImage' && msg.url) {
        loadImage(msg.url, msg.url.split('/').pop().split('?')[0] || 'image.png');
      }
      if (msg.type === 'pageImages' && msg.images) {
        renderPageImages(msg.images);
      }
    });
    // Ask background to scan on panel load
    chrome.runtime.sendMessage({ type: 'scanTab' });
  }

  newImageBtn.addEventListener('click', showUpload);

  /* ================================================================
     RENDERING
     ================================================================ */
  function renderPreview() {
    if (!state.currentCanvas) return;
    const oc = state.currentCanvas;
    previewCanvas.width = oc.width;
    previewCanvas.height = oc.height;
    // Apply CSS filter string for live preview
    const filterStr = buildCSSFilter();
    ctx.filter = filterStr;
    ctx.drawImage(oc, 0, 0);
    ctx.filter = 'none';
  }

  function buildCSSFilter() {
    const f = state.filters;
    return [
      `brightness(${f.brightness}%)`,
      `contrast(${f.contrast}%)`,
      `saturate(${f.saturate}%)`,
      `blur(${f.blur}px)`,
      `grayscale(${f.grayscale}%)`,
      `sepia(${f.sepia}%)`,
      `hue-rotate(${f.hueRotate}deg)`,
      `opacity(${f.opacity}%)`,
    ].join(' ');
  }

  function updateImageInfo() {
    if (!state.currentCanvas) return;
    const w = state.currentCanvas.width;
    const h = state.currentCanvas.height;
    imageInfo.innerHTML = `<span>${state.fileName}.${state.fileExt}</span><span>${w} × ${h}px</span>`;
  }

  /* ================================================================
     UNDO / REDO
     ================================================================ */
  function pushHistory() {
    // Save current canvas as ImageData
    const oc = state.currentCanvas;
    const data = oc.getContext('2d').getImageData(0, 0, oc.width, oc.height);
    state.undoStack.push({ data, width: oc.width, height: oc.height });
    if (state.undoStack.length > state.maxHistory) state.undoStack.shift();
    state.redoStack = [];
    updateUndoRedoButtons();
  }

  function undo() {
    if (state.undoStack.length === 0) return;
    // Save current to redo
    const oc = state.currentCanvas;
    const curData = oc.getContext('2d').getImageData(0, 0, oc.width, oc.height);
    state.redoStack.push({ data: curData, width: oc.width, height: oc.height });

    const prev = state.undoStack.pop();
    restoreFromHistory(prev);
  }

  function redo() {
    if (state.redoStack.length === 0) return;
    const oc = state.currentCanvas;
    const curData = oc.getContext('2d').getImageData(0, 0, oc.width, oc.height);
    state.undoStack.push({ data: curData, width: oc.width, height: oc.height });

    const next = state.redoStack.pop();
    restoreFromHistory(next);
  }

  function restoreFromHistory(entry) {
    const oc = state.currentCanvas;
    oc.width = entry.width;
    oc.height = entry.height;
    oc.getContext('2d').putImageData(entry.data, 0, 0);
    state.aspectRatio = entry.width / entry.height;
    renderPreview();
    updateImageInfo();
    initResizeInputs();
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    undoBtn.disabled = state.undoStack.length === 0;
    redoBtn.disabled = state.redoStack.length === 0;
  }

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  /* ================================================================
     TOOL TABS
     ================================================================ */
  toolTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tool = tab.dataset.tool;
      toolTabs.forEach(t => t.classList.toggle('active', t === tab));
      toolPanels.forEach(p => p.classList.toggle('active', p.id === `panel-${tool}`));

      // Show/hide crop overlay
      if (tool === 'crop') {
        activateCrop();
      } else {
        deactivateCrop();
      }

      // Update recommendations when Creative tab opens
      if (tool === 'creative') {
        analyzeAndRecommend();
      }
    });
  });

  /* ================================================================
     CROP
     ================================================================ */
  function initCropOverlay() {
    if (!state.currentCanvas) return;
    // Set crop to full image initially
    state.cropRect = { x: 0, y: 0, w: state.currentCanvas.width, h: state.currentCanvas.height };
    syncCropInputs();
    positionCropRegion();
  }

  function activateCrop() {
    if (!state.currentCanvas) return;
    state.cropActive = true;
    cropOverlay.classList.remove('hidden');
    positionCropRegion();
  }

  function deactivateCrop() {
    state.cropActive = false;
    cropOverlay.classList.add('hidden');
  }

  function syncCropInputs() {
    const r = state.cropRect;
    cropXInput.value = Math.round(r.x);
    cropYInput.value = Math.round(r.y);
    cropWInput.value = Math.round(r.w);
    cropHInput.value = Math.round(r.h);
  }

  function positionCropRegion() {
    if (!state.currentCanvas) return;
    const canvasRect = previewCanvas.getBoundingClientRect();
    const wrapperRect = canvasWrapper.getBoundingClientRect();

    const scaleX = canvasRect.width / state.currentCanvas.width;
    const scaleY = canvasRect.height / state.currentCanvas.height;
    const offsetX = canvasRect.left - wrapperRect.left;
    const offsetY = canvasRect.top - wrapperRect.top;

    const r = state.cropRect;
    cropRegion.style.left   = (offsetX + r.x * scaleX) + 'px';
    cropRegion.style.top    = (offsetY + r.y * scaleY) + 'px';
    cropRegion.style.width  = (r.w * scaleX) + 'px';
    cropRegion.style.height = (r.h * scaleY) + 'px';
  }

  // Crop handle dragging
  let cropDrag = null;

  function startCropDrag(e, handle) {
    e.preventDefault();
    const canvasRect = previewCanvas.getBoundingClientRect();
    const scaleX = state.currentCanvas.width / canvasRect.width;
    const scaleY = state.currentCanvas.height / canvasRect.height;

    cropDrag = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...state.cropRect },
      scaleX,
      scaleY,
      imgW: state.currentCanvas.width,
      imgH: state.currentCanvas.height,
    };
  }

  document.addEventListener('mousemove', (e) => {
    if (!cropDrag) return;
    const dx = (e.clientX - cropDrag.startX) * cropDrag.scaleX;
    const dy = (e.clientY - cropDrag.startY) * cropDrag.scaleY;
    const s = cropDrag.startRect;
    const r = { ...s };
    const h = cropDrag.handle;

    if (h === 'move') {
      r.x = clamp(s.x + dx, 0, cropDrag.imgW - s.w);
      r.y = clamp(s.y + dy, 0, cropDrag.imgH - s.h);
    } else {
      if (h.includes('w') || h === 'w') {
        r.x = clamp(s.x + dx, 0, s.x + s.w - 10);
        r.w = s.w - (r.x - s.x);
      }
      if (h.includes('e') || h === 'e') {
        r.w = clamp(s.w + dx, 10, cropDrag.imgW - s.x);
      }
      if (h.includes('n') || h === 'n') {
        r.y = clamp(s.y + dy, 0, s.y + s.h - 10);
        r.h = s.h - (r.y - s.y);
      }
      if (h.includes('s') || h === 's') {
        r.h = clamp(s.h + dy, 10, cropDrag.imgH - s.y);
      }

      // Enforce aspect ratio if set
      if (state.cropRatio) {
        const [rw, rh] = state.cropRatio;
        const targetRatio = rw / rh;
        if (h.includes('e') || h.includes('w') || h === 'e' || h === 'w') {
          r.h = r.w / targetRatio;
        } else {
          r.w = r.h * targetRatio;
        }
        // Clamp to image bounds
        if (r.x + r.w > cropDrag.imgW) r.w = cropDrag.imgW - r.x;
        if (r.y + r.h > cropDrag.imgH) r.h = cropDrag.imgH - r.y;
      }
    }

    state.cropRect = r;
    syncCropInputs();
    positionCropRegion();
  });

  document.addEventListener('mouseup', () => { cropDrag = null; });

  // Crop region move
  cropRegion.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('crop-handle')) return;
    startCropDrag(e, 'move');
  });

  // Crop handles
  $$('.crop-handle').forEach(el => {
    el.addEventListener('mousedown', (e) => {
      startCropDrag(e, el.dataset.handle);
    });
  });

  // Crop ratio buttons
  $$('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.ratio-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const r = btn.dataset.ratio;
      if (r === 'free') {
        state.cropRatio = null;
      } else {
        const [w, h] = r.split(':').map(Number);
        state.cropRatio = [w, h];
        // Adjust current crop to match ratio
        const targetRatio = w / h;
        const cr = state.cropRect;
        const newH = cr.w / targetRatio;
        if (cr.y + newH <= state.currentCanvas.height) {
          cr.h = newH;
        } else {
          cr.h = state.currentCanvas.height - cr.y;
          cr.w = cr.h * targetRatio;
        }
        syncCropInputs();
        positionCropRegion();
      }
    });
  });

  // Crop number inputs
  [cropXInput, cropYInput, cropWInput, cropHInput].forEach(input => {
    input.addEventListener('change', () => {
      if (!state.currentCanvas) return;
      const imgW = state.currentCanvas.width;
      const imgH = state.currentCanvas.height;
      state.cropRect.x = clamp(parseInt(cropXInput.value) || 0, 0, imgW - 10);
      state.cropRect.y = clamp(parseInt(cropYInput.value) || 0, 0, imgH - 10);
      state.cropRect.w = clamp(parseInt(cropWInput.value) || 10, 10, imgW - state.cropRect.x);
      state.cropRect.h = clamp(parseInt(cropHInput.value) || 10, 10, imgH - state.cropRect.y);
      syncCropInputs();
      positionCropRegion();
    });
  });

  // Apply crop
  $('#applyCrop').addEventListener('click', () => {
    if (!state.currentCanvas) return;
    pushHistory();
    const r = state.cropRect;
    const oc = state.currentCanvas;
    const srcCtx = oc.getContext('2d');
    const data = srcCtx.getImageData(
      Math.round(r.x), Math.round(r.y),
      Math.round(r.w), Math.round(r.h)
    );
    oc.width = Math.round(r.w);
    oc.height = Math.round(r.h);
    srcCtx.putImageData(data, 0, 0);
    state.aspectRatio = oc.width / oc.height;
    renderPreview();
    updateImageInfo();
    initResizeInputs();
    initCropOverlay();
  });

  $('#cancelCrop').addEventListener('click', () => {
    initCropOverlay();
    positionCropRegion();
  });

  // Reposition crop on window resize
  window.addEventListener('resize', () => {
    if (state.cropActive) positionCropRegion();
  });

  /* ================================================================
     RESIZE
     ================================================================ */
  function initResizeInputs() {
    if (!state.currentCanvas) return;
    resizeWInput.value = state.currentCanvas.width;
    resizeHInput.value = state.currentCanvas.height;
    state.aspectRatio = state.currentCanvas.width / state.currentCanvas.height;
    updateResizeInfo();
  }

  resizeWInput.addEventListener('input', () => {
    if (state.lockAspect) {
      resizeHInput.value = Math.round(parseInt(resizeWInput.value) / state.aspectRatio) || 1;
    }
    updateResizeInfo();
  });

  resizeHInput.addEventListener('input', () => {
    if (state.lockAspect) {
      resizeWInput.value = Math.round(parseInt(resizeHInput.value) * state.aspectRatio) || 1;
    }
    updateResizeInfo();
  });

  lockAspectBtn.addEventListener('click', () => {
    state.lockAspect = !state.lockAspect;
    lockAspectBtn.classList.toggle('active', state.lockAspect);
    // Update lock icon
    lockAspectBtn.innerHTML = state.lockAspect
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v1"/></svg>';
  });

  $$('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.currentCanvas) return;
      const scale = parseFloat(btn.dataset.scale);
      resizeWInput.value = Math.round(state.currentCanvas.width * scale);
      resizeHInput.value = Math.round(state.currentCanvas.height * scale);
      updateResizeInfo();
    });
  });

  function updateResizeInfo() {
    if (!state.currentCanvas) return;
    const ow = state.currentCanvas.width;
    const oh = state.currentCanvas.height;
    const nw = parseInt(resizeWInput.value) || ow;
    const nh = parseInt(resizeHInput.value) || oh;
    resizeInfo.textContent = `${ow}×${oh} → ${nw}×${nh}`;
  }

  $('#applyResize').addEventListener('click', () => {
    if (!state.currentCanvas) return;
    const nw = parseInt(resizeWInput.value);
    const nh = parseInt(resizeHInput.value);
    if (!nw || !nh || nw < 1 || nh < 1) return;

    pushHistory();
    const oc = state.currentCanvas;
    const temp = document.createElement('canvas');
    temp.width = nw;
    temp.height = nh;
    temp.getContext('2d').drawImage(oc, 0, 0, nw, nh);
    oc.width = nw;
    oc.height = nh;
    oc.getContext('2d').drawImage(temp, 0, 0);
    state.aspectRatio = nw / nh;
    renderPreview();
    updateImageInfo();
    initResizeInputs();
    initCropOverlay();
  });

  /* ================================================================
     FILTERS
     ================================================================ */
  const filterPresets = {
    original:     { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0, sepia: 0, hueRotate: 0, opacity: 100 },
    vivid:        { brightness: 110, contrast: 120, saturate: 150, blur: 0, grayscale: 0, sepia: 0, hueRotate: 0, opacity: 100 },
    warm:         { brightness: 105, contrast: 105, saturate: 110, blur: 0, grayscale: 0, sepia: 30, hueRotate: 0, opacity: 100 },
    cool:         { brightness: 100, contrast: 110, saturate: 90, blur: 0, grayscale: 0, sepia: 0, hueRotate: 180, opacity: 100 },
    bw:           { brightness: 100, contrast: 120, saturate: 0, blur: 0, grayscale: 100, sepia: 0, hueRotate: 0, opacity: 100 },
    sepia:        { brightness: 100, contrast: 100, saturate: 100, blur: 0, grayscale: 0, sepia: 80, hueRotate: 0, opacity: 100 },
    highcontrast: { brightness: 100, contrast: 180, saturate: 120, blur: 0, grayscale: 0, sepia: 0, hueRotate: 0, opacity: 100 },
    vintage:      { brightness: 110, contrast: 90, saturate: 70, blur: 0.3, grayscale: 10, sepia: 40, hueRotate: 0, opacity: 100 },
  };

  function resetFilterState() {
    Object.assign(state.filters, filterPresets.original);
  }

  function syncFilterSliders() {
    for (const [key, slider] of Object.entries(filterSliders)) {
      slider.value = state.filters[key];
      updateFilterLabel(key);
    }
  }

  function updateFilterLabel(key) {
    const el = $(`#val-${key}`);
    if (!el) return;
    const v = state.filters[key];
    if (key === 'blur') el.textContent = `${v}px`;
    else if (key === 'hueRotate') el.textContent = `${v}°`;
    else el.textContent = `${v}%`;
  }

  // Slider input
  for (const [key, slider] of Object.entries(filterSliders)) {
    slider.addEventListener('input', () => {
      state.filters[key] = parseFloat(slider.value);
      updateFilterLabel(key);
      renderPreview();
      // Deselect preset buttons
      $$('.filter-preset-btn').forEach(b => b.classList.remove('active'));
    });
  }

  // Preset buttons
  $$('.filter-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = filterPresets[btn.dataset.preset];
      if (!preset) return;
      $$('.filter-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.assign(state.filters, preset);
      syncFilterSliders();
      renderPreview();
    });
  });

  // Apply filters (bake into canvas)
  $('#applyFilters').addEventListener('click', () => {
    if (!state.currentCanvas) return;
    pushHistory();
    const oc = state.currentCanvas;
    const temp = document.createElement('canvas');
    temp.width = oc.width;
    temp.height = oc.height;
    const tCtx = temp.getContext('2d');
    tCtx.filter = buildCSSFilter();
    tCtx.drawImage(oc, 0, 0);
    tCtx.filter = 'none';
    oc.getContext('2d').clearRect(0, 0, oc.width, oc.height);
    oc.getContext('2d').drawImage(temp, 0, 0);
    // Reset filter state after baking
    resetFilterState();
    syncFilterSliders();
    $$('.filter-preset-btn').forEach(b => b.classList.remove('active'));
    $('.filter-preset-btn[data-preset="original"]').classList.add('active');
    renderPreview();
  });

  $('#resetFilters').addEventListener('click', () => {
    resetFilterState();
    syncFilterSliders();
    $$('.filter-preset-btn').forEach(b => b.classList.remove('active'));
    $('.filter-preset-btn[data-preset="original"]').classList.add('active');
    renderPreview();
  });

  /* ================================================================
     EXPORT
     ================================================================ */
  $$('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.format-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.exportFormat = btn.dataset.format;
      const showQuality = state.exportFormat === 'jpeg' || state.exportFormat === 'webp';
      qualitySection.classList.toggle('visible', showQuality);
      updateExportInfo();
    });
  });

  qualitySlider.addEventListener('input', () => {
    state.exportQuality = parseInt(qualitySlider.value) / 100;
    $('#val-quality').textContent = `${qualitySlider.value}%`;
    updateExportInfo();
  });

  function updateExportInfo() {
    if (!state.currentCanvas) return;
    const oc = state.currentCanvas;
    exportInfo.textContent = `${oc.width}×${oc.height} • ${state.exportFormat.toUpperCase()}`;
  }

  function getExportMime() {
    const map = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
    return map[state.exportFormat] || 'image/png';
  }

  function getExportExtension() {
    const map = { png: 'png', jpeg: 'jpg', webp: 'webp' };
    return map[state.exportFormat] || 'png';
  }

  $('#downloadBtn').addEventListener('click', () => {
    if (!state.currentCanvas) return;
    // Build final export canvas with filters baked in
    const oc = state.currentCanvas;
    const expCanvas = document.createElement('canvas');
    expCanvas.width = oc.width;
    expCanvas.height = oc.height;
    const expCtx = expCanvas.getContext('2d');
    expCtx.filter = buildCSSFilter();
    expCtx.drawImage(oc, 0, 0);

    const mime = getExportMime();
    const quality = (state.exportFormat === 'jpeg' || state.exportFormat === 'webp')
      ? state.exportQuality : undefined;

    expCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.fileName}-edited.${getExportExtension()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, mime, quality);
  });

  /* ================================================================
     HELPERS
     ================================================================ */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  // Initial export info when switching to export tab
  const exportTab = document.querySelector('[data-tool="export"]');
  if (exportTab) {
    exportTab.addEventListener('click', updateExportInfo);
  }

  /* ================================================================
     KEYBOARD SHORTCUTS
     ================================================================ */
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
  });

  /* ================================================================
     PAGE IMAGES
     ================================================================ */
  const pageImagesSection = $('#pageImagesSection');
  const pageImagesList    = $('#pageImagesList');
  const refreshPageImages = $('#refreshPageImages');

  function renderPageImages(images) {
    if (!images || images.length === 0) {
      pageImagesSection.classList.add('hidden');
      return;
    }
    pageImagesSection.classList.remove('hidden');
    pageImagesList.innerHTML = '';
    images.forEach(img => {
      const thumb = document.createElement('div');
      thumb.className = 'page-image-thumb';
      thumb.title = img.src.split('/').pop().split('?')[0];
      const imgEl = document.createElement('img');
      imgEl.src = img.src;
      imgEl.loading = 'lazy';
      imgEl.alt = '';
      thumb.appendChild(imgEl);
      if (img.width && img.height) {
        const badge = document.createElement('span');
        badge.className = 'page-img-badge';
        badge.textContent = `${img.width}×${img.height}`;
        thumb.appendChild(badge);
      }
      if (img.isPageImage) {
        const badge = document.createElement('span');
        badge.className = 'page-img-badge';
        badge.style.left = '2px';
        badge.style.right = 'auto';
        badge.textContent = 'PAGE';
        thumb.appendChild(badge);
      }
      thumb.addEventListener('click', () => {
        const name = img.src.split('/').pop().split('?')[0] || 'image.png';
        loadImage(img.src, name);
      });
      pageImagesList.appendChild(thumb);
    });
  }

  if (refreshPageImages) {
    refreshPageImages.addEventListener('click', () => {
      pageImagesList.innerHTML = '<div class="page-images-loading">Scanning page…</div>';
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'scanTab' });
      }
    });
  }

  /* ================================================================
     CREATIVE FILTERS — Pixel Manipulation Engine
     ================================================================ */
  let selectedCreative = null;
  let creativePreviewCanvas = null; // temp canvas for preview

  const creativeIntensitySlider = $('#creativeIntensity');
  const creativeControlsDiv     = $('#creativeControls');
  const mutationRateDiv         = $('#creativeMutationRate');
  const mutationRateSlider      = $('#mutationRate');

  // Card selection — click to immediately apply
  $$('.creative-card').forEach(card => {
    card.addEventListener('click', () => {
      if (!state.currentCanvas) return;
      $$('.creative-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedCreative = card.dataset.creative;
      creativeControlsDiv.style.display = 'block';
      mutationRateDiv.style.display = selectedCreative === 'geneticMutation' ? 'block' : 'none';
      // Auto-apply: save history, apply filter, render
      pushHistory();
      applyCreativeFilter(state.currentCanvas, selectedCreative);
      renderPreview();
      updateImageInfo();
    });
  });

  creativeIntensitySlider.addEventListener('input', () => {
    $('#val-creativeIntensity').textContent = `${creativeIntensitySlider.value}%`;
  });
  mutationRateSlider.addEventListener('input', () => {
    $('#val-mutationRate').textContent = `${mutationRateSlider.value}%`;
  });

  /* ── Creative Filter Algorithms ── */
  function applyCreativeFilter(canvas, filterName) {
    const intensity = parseInt(creativeIntensitySlider.value) / 100;
    const c = canvas.getContext('2d', { willReadFrequently: true });
    const w = canvas.width, h = canvas.height;

    // Perspective warp needs its own flow
    if (filterName === 'perspectiveWarp') {
      filterPerspectiveWarp(canvas, c, w, h, intensity);
      return;
    }

    const imageData = c.getImageData(0, 0, w, h);
    const d = imageData.data;
    const orig = new Uint8ClampedArray(d);

    switch (filterName) {
      case 'memoryDrift':      filterMemoryDrift(d, orig, w, h, intensity); break;
      case 'geneticMutation':  filterGeneticMutation(d, orig, w, h, intensity); break;
      case 'timeSlice':        filterTimeSlice(d, w, h, intensity); break;
      case 'emotionHappy':     filterEmotionHappy(d, w, h, intensity); break;
      case 'emotionSad':       filterEmotionSad(d, w, h, intensity); break;
      case 'emotionAngry':     filterEmotionAngry(d, orig, w, h, intensity); break;
      case 'physicsBreaker':   filterPhysicsBreaker(d, orig, w, h, intensity); break;
      case 'multiReality':     filterMultiReality(d, orig, w, h, intensity); break;
      case 'detailRedist':     filterDetailRedistribution(d, orig, w, h, intensity); break;
      case 'signalCorrupt':    filterSignalCorruption(d, orig, w, h, intensity); break;
      case 'growthDecay':      filterGrowthDecay(d, w, h, intensity); break;
    }

    c.putImageData(imageData, 0, 0);
  }

  /* 🧠 1. Memory Drift — fast box blur from edges + warm color shift */
  function filterMemoryDrift(d, orig, w, h, intensity) {
    const cx = w / 2, cy = h / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    // Horizontal pass then vertical pass (separable box blur — O(n) per pixel)
    const tmp = new Uint8ClampedArray(orig);

    // Horizontal blur pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
        const radius = Math.floor(dist * 12 * intensity);
        if (radius < 1) continue;
        const idx = (y * w + x) * 4;
        let r = 0, g = 0, b = 0, count = 0;
        const x0 = Math.max(0, x - radius);
        const x1 = Math.min(w - 1, x + radius);
        for (let xi = x0; xi <= x1; xi++) {
          const si = (y * w + xi) * 4;
          r += orig[si]; g += orig[si + 1]; b += orig[si + 2];
          count++;
        }
        tmp[idx] = r / count; tmp[idx + 1] = g / count; tmp[idx + 2] = b / count;
      }
    }

    // Vertical blur pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
        const radius = Math.floor(dist * 12 * intensity);
        if (radius < 1) { const idx = (y * w + x) * 4; d[idx] = tmp[idx]; d[idx+1] = tmp[idx+1]; d[idx+2] = tmp[idx+2]; continue; }
        const idx = (y * w + x) * 4;
        let r = 0, g = 0, b = 0, count = 0;
        const y0 = Math.max(0, y - radius);
        const y1 = Math.min(h - 1, y + radius);
        for (let yi = y0; yi <= y1; yi++) {
          const si = (yi * w + x) * 4;
          r += tmp[si]; g += tmp[si + 1]; b += tmp[si + 2];
          count++;
        }
        d[idx] = r / count; d[idx + 1] = g / count; d[idx + 2] = b / count;
      }
    }

    // Warm color drift — stronger effect
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
        d[idx]     = clamp(d[idx] + dist * 40 * intensity, 0, 255);
        d[idx + 1] = clamp(d[idx + 1] + dist * 10 * intensity, 0, 255);
        d[idx + 2] = clamp(d[idx + 2] - dist * 35 * intensity, 0, 255);
      }
    }
  }

  /* 🧬 2. Genetic Mutation — pixel displacement + channel swaps + color mutation */
  function filterGeneticMutation(d, orig, w, h, intensity) {
    const mutRate = parseInt(mutationRateSlider.value) / 100;
    const seed = Date.now() & 0xFFFF;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r1 = pseudoRandom(seed + x * 3 + y * w);
        if (r1 < mutRate) {
          // Large spatial displacement
          const dispX = Math.floor((pseudoRandom(seed + idx + 1) - 0.5) * 50 * intensity);
          const dispY = Math.floor((pseudoRandom(seed + idx + 2) - 0.5) * 50 * intensity);
          const nx = clamp(x + dispX, 0, w - 1);
          const ny = clamp(y + dispY, 0, h - 1);
          const ni = (ny * w + nx) * 4;
          d[idx]     = orig[ni];
          d[idx + 1] = orig[ni + 1];
          d[idx + 2] = orig[ni + 2];
        }
        // Channel rotation for 20% of mutated pixels
        if (pseudoRandom(seed + idx + 7) < mutRate * 0.4) {
          const t = d[idx];
          d[idx] = d[idx + 2];
          d[idx + 2] = d[idx + 1];
          d[idx + 1] = t;
        }
        // Wild color shift
        if (pseudoRandom(seed + idx + 8) < mutRate * 0.6) {
          d[idx]     = clamp(d[idx] + (pseudoRandom(seed + idx + 9) - 0.5) * 120 * intensity, 0, 255);
          d[idx + 1] = clamp(d[idx + 1] + (pseudoRandom(seed + idx + 10) - 0.5) * 120 * intensity, 0, 255);
          d[idx + 2] = clamp(d[idx + 2] + (pseudoRandom(seed + idx + 11) - 0.5) * 120 * intensity, 0, 255);
        }
      }
    }
  }

  /* 🕰️ 3. Time Slice — morning→noon→night color temperature */
  function filterTimeSlice(d, w, h, intensity) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const pos = x / w;
        let rShift, gShift, bShift, brightMult;
        if (pos < 0.33) {
          // Morning: golden warm
          const t = 1 - pos / 0.33;
          rShift = 60 * t * intensity;
          gShift = 30 * t * intensity;
          bShift = -40 * t * intensity;
          brightMult = 1 - 0.2 * t * intensity;
        } else if (pos < 0.66) {
          // Noon: bright
          rShift = 10 * intensity;
          gShift = 10 * intensity;
          bShift = 5 * intensity;
          brightMult = 1 + 0.1 * intensity;
        } else {
          // Night: dark blue
          const t = (pos - 0.66) / 0.34;
          rShift = -60 * t * intensity;
          gShift = -30 * t * intensity;
          bShift = 50 * t * intensity;
          brightMult = 1 - 0.5 * t * intensity;
        }
        d[idx]     = clamp(d[idx] * brightMult + rShift, 0, 255);
        d[idx + 1] = clamp(d[idx + 1] * brightMult + gShift, 0, 255);
        d[idx + 2] = clamp(d[idx + 2] * brightMult + bShift, 0, 255);
      }
    }
  }

  /* 🧭 4. Perspective Warp — barrel distortion */
  function filterPerspectiveWarp(canvas, c, w, h, intensity) {
    const src = c.getImageData(0, 0, w, h);
    const dst = c.createImageData(w, h);
    const cx = w / 2, cy = h / 2;
    const strength = intensity * 1.5;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const nx = (x - cx) / maxR;
        const ny = (y - cy) / maxR;
        const r = Math.sqrt(nx * nx + ny * ny);
        if (r === 0) {
          const di = (y * w + x) * 4;
          const si = di;
          dst.data[di] = src.data[si]; dst.data[di+1] = src.data[si+1]; dst.data[di+2] = src.data[si+2]; dst.data[di+3] = src.data[si+3];
          continue;
        }
        const warpR = r * (1 + strength * r * r);
        const sx = Math.round(cx + (nx / r) * warpR * maxR);
        const sy = Math.round(cy + (ny / r) * warpR * maxR);
        const di = (y * w + x) * 4;
        if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
          const si = (sy * w + sx) * 4;
          dst.data[di] = src.data[si]; dst.data[di+1] = src.data[si+1]; dst.data[di+2] = src.data[si+2]; dst.data[di+3] = src.data[si+3];
        } else {
          dst.data[di+3] = 255;
        }
      }
    }
    c.putImageData(dst, 0, 0);
  }

  /* 🎭 5. Emotion: Happy — warm tones, bright glow */
  function filterEmotionHappy(d, w, h, intensity) {
    for (let i = 0; i < d.length; i += 4) {
      d[i]     = clamp(d[i] * (1 + 0.25 * intensity) + 30 * intensity, 0, 255);
      d[i + 1] = clamp(d[i + 1] * (1 + 0.1 * intensity) + 15 * intensity, 0, 255);
      d[i + 2] = clamp(d[i + 2] * (1 - 0.2 * intensity), 0, 255);
      // Bloom on bright areas
      const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (lum > 150) {
        const bloom = (lum - 150) / 105 * 40 * intensity;
        d[i]     = clamp(d[i] + bloom, 0, 255);
        d[i + 1] = clamp(d[i + 1] + bloom * 0.7, 0, 255);
      }
    }
  }

  /* 🎭 6. Emotion: Sad — desaturated, blue, dark */
  function filterEmotionSad(d, w, h, intensity) {
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      // Heavy desaturation
      d[i]     = clamp(d[i] * (1 - 0.7 * intensity) + lum * 0.7 * intensity - 20 * intensity, 0, 255);
      d[i + 1] = clamp(d[i + 1] * (1 - 0.7 * intensity) + lum * 0.7 * intensity - 10 * intensity, 0, 255);
      d[i + 2] = clamp(d[i + 2] * (1 - 0.5 * intensity) + lum * 0.5 * intensity + 40 * intensity, 0, 255);
      // Darken
      d[i]     = clamp(d[i] * (1 - 0.25 * intensity), 0, 255);
      d[i + 1] = clamp(d[i + 1] * (1 - 0.2 * intensity), 0, 255);
    }
  }

  /* 🎭 7. Emotion: Angry — contrast, red shift, edge enhancement */
  function filterEmotionAngry(d, orig, w, h, intensity) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const center = orig[idx + ch] * 5;
          const neighbors = orig[((y-1)*w+x)*4+ch] + orig[((y+1)*w+x)*4+ch]
                          + orig[(y*w+x-1)*4+ch] + orig[(y*w+x+1)*4+ch];
          const edge = Math.abs(center - neighbors);
          d[idx + ch] = clamp(orig[idx + ch] + edge * intensity, 0, 255);
        }
        // Strong red shift + contrast
        d[idx]     = clamp(d[idx] * (1 + 0.5 * intensity) + 30 * intensity, 0, 255);
        d[idx + 1] = clamp(d[idx + 1] * (1 - 0.2 * intensity), 0, 255);
        d[idx + 2] = clamp(d[idx + 2] * (1 - 0.3 * intensity), 0, 255);
      }
    }
  }

  /* 🌌 8. Physics Breaker — row wave displacement + chromatic aberration */
  function filterPhysicsBreaker(d, orig, w, h, intensity) {
    // Wavy row displacement
    for (let y = 0; y < h; y++) {
      const shift = Math.floor(Math.sin(y * 0.04) * 30 * intensity);
      for (let x = 0; x < w; x++) {
        const srcX = clamp(x + shift, 0, w - 1);
        const di = (y * w + x) * 4;
        const si = (y * w + srcX) * 4;
        d[di] = orig[si]; d[di + 1] = orig[si + 1]; d[di + 2] = orig[si + 2]; d[di + 3] = orig[si + 3];
      }
    }
    // Chromatic aberration — split RGB channels
    const shift2 = Math.floor(10 * intensity);
    const copy = new Uint8ClampedArray(d);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const rx = clamp(x + shift2, 0, w - 1);
        const bx = clamp(x - shift2, 0, w - 1);
        d[idx]     = copy[(y * w + rx) * 4];
        d[idx + 2] = copy[(y * w + bx) * 4 + 2];
      }
    }
  }

  /* 🧩 9. Multi-Reality — left=posterized, center=real, right=sketch */
  function filterMultiReality(d, orig, w, h, intensity) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const pos = x / w;
        for (let ch = 0; ch < 3; ch++) {
          const real = orig[idx + ch];
          // Strong posterize (4 levels)
          const poster = Math.round(real / 255 * 4) / 4 * 255;
          // Edge detect
          const edge = Math.abs(
            orig[idx + ch] * 4
            - orig[((y-1)*w+x)*4+ch]
            - orig[((y+1)*w+x)*4+ch]
            - orig[(y*w+clamp(x-1,0,w-1))*4+ch]
            - orig[(y*w+clamp(x+1,0,w-1))*4+ch]
          );
          const sketch = clamp(255 - edge * 4, 0, 255);

          let val;
          if (pos < 0.33) {
            const t = pos / 0.33;
            val = poster * (1 - t) + real * t;
          } else if (pos < 0.66) {
            val = real;
          } else {
            const t = (pos - 0.66) / 0.34;
            val = real * (1 - t) + sketch * t;
          }
          d[idx + ch] = clamp(orig[idx + ch] * (1 - intensity) + val * intensity, 0, 255);
        }
      }
    }
  }

  /* 🔍 10. Detail Redistribution — center smooth, edges sharp */
  function filterDetailRedistribution(d, orig, w, h, intensity) {
    const cx = w / 2, cy = h / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    for (let y = 2; y < h - 2; y++) {
      for (let x = 2; x < w - 2; x++) {
        const idx = (y * w + x) * 4;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / maxDist;
        for (let ch = 0; ch < 3; ch++) {
          // 5-pixel cross average for blur
          const avg = (orig[((y-1)*w+x)*4+ch] + orig[((y+1)*w+x)*4+ch]
                     + orig[(y*w+x-1)*4+ch] + orig[(y*w+x+1)*4+ch]
                     + orig[((y-2)*w+x)*4+ch] + orig[((y+2)*w+x)*4+ch]
                     + orig[(y*w+x-2)*4+ch] + orig[(y*w+x+2)*4+ch]
                     + orig[idx+ch]) / 9;
          // Sharpen = 2*center - avg
          const sharp = clamp(orig[idx+ch] * 3 - avg * 2, 0, 255);
          // Center → blurred, edges → sharpened
          const centerBlend = (1 - dist) * intensity;
          const edgeBlend = dist * intensity;
          const blurred = avg * centerBlend + orig[idx+ch] * (1 - centerBlend);
          const sharpened = sharp * edgeBlend + orig[idx+ch] * (1 - edgeBlend);
          d[idx + ch] = clamp(blurred * (1 - dist) + sharpened * dist, 0, 255);
        }
      }
    }
  }

  /* 📡 11. Signal Corruption — channel offset + scanlines + glitch blocks */
  function filterSignalCorruption(d, orig, w, h, intensity) {
    const channelShift = Math.floor(15 * intensity);
    // RGB channel offset
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const rx = clamp(x + channelShift, 0, w - 1);
        const bx = clamp(x - channelShift, 0, w - 1);
        d[idx]     = orig[(y * w + rx) * 4];
        d[idx + 1] = orig[idx + 1];
        d[idx + 2] = orig[(y * w + bx) * 4 + 2];
        d[idx + 3] = 255;
      }
    }
    // Scanlines (every 2 rows)
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        d[idx]     = clamp(d[idx] * (1 - 0.3 * intensity), 0, 255);
        d[idx + 1] = clamp(d[idx + 1] * (1 - 0.3 * intensity), 0, 255);
        d[idx + 2] = clamp(d[idx + 2] * (1 - 0.3 * intensity), 0, 255);
      }
    }
    // Glitch blocks
    const seed = 12345;
    const numBlocks = Math.floor(8 + 20 * intensity);
    for (let i = 0; i < numBlocks; i++) {
      const by = Math.floor(pseudoRandom(seed + i) * h);
      const bh = Math.floor(pseudoRandom(seed + i + 50) * 15 + 3);
      const shift = Math.floor((pseudoRandom(seed + i + 100) - 0.5) * 80 * intensity);
      for (let y = by; y < Math.min(by + bh, h); y++) {
        const tmpRow = new Uint8ClampedArray(w * 4);
        for (let x = 0; x < w; x++) {
          const si = (y * w + clamp(x + shift, 0, w - 1)) * 4;
          tmpRow[x * 4] = d[si]; tmpRow[x * 4 + 1] = d[si + 1]; tmpRow[x * 4 + 2] = d[si + 2]; tmpRow[x * 4 + 3] = 255;
        }
        for (let x = 0; x < w; x++) {
          const di = (y * w + x) * 4;
          d[di] = tmpRow[x*4]; d[di+1] = tmpRow[x*4+1]; d[di+2] = tmpRow[x*4+2];
        }
      }
    }
  }

  /* 🌱 12. Growth/Decay — cracks, rust, green growth, aging */
  function filterGrowthDecay(d, w, h, intensity) {
    const seed = 42;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const n = pseudoNoise(x * 0.02, y * 0.02, seed);
        // Cracks & rust
        if (n > 0.5) {
          const s = (n - 0.5) / 0.5 * intensity;
          d[idx]     = clamp(d[idx] * (1 - s * 0.5) + 80 * s, 0, 255);
          d[idx + 1] = clamp(d[idx + 1] * (1 - s * 0.6) + 40 * s, 0, 255);
          d[idx + 2] = clamp(d[idx + 2] * (1 - s * 0.8), 0, 255);
        }
        // Green growth
        const n2 = pseudoNoise(x * 0.015 + 200, y * 0.015 + 200, seed + 7);
        if (n2 > 0.55) {
          const g = (n2 - 0.55) / 0.45 * intensity;
          d[idx]     = clamp(d[idx] * (1 - g * 0.5), 0, 255);
          d[idx + 1] = clamp(d[idx + 1] + 70 * g, 0, 255);
          d[idx + 2] = clamp(d[idx + 2] * (1 - g * 0.5) + 10 * g, 0, 255);
        }
        // Aging sepia
        const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
        const a = 0.35 * intensity;
        d[idx]     = clamp(d[idx] * (1 - a) + (lum + 25) * a, 0, 255);
        d[idx + 1] = clamp(d[idx + 1] * (1 - a) + (lum + 10) * a, 0, 255);
        d[idx + 2] = clamp(d[idx + 2] * (1 - a) + (lum - 20) * a, 0, 255);
      }
    }
  }

  /* ── Pseudo-random & noise helpers ── */
  function pseudoRandom(seed) {
    let x = Math.sin(seed) * 43758.5453;
    return x - Math.floor(x);
  }

  function pseudoNoise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = pseudoRandom(ix + iy * 57 + seed);
    const b = pseudoRandom(ix + 1 + iy * 57 + seed);
    const c = pseudoRandom(ix + (iy + 1) * 57 + seed);
    const dd = pseudoRandom(ix + 1 + (iy + 1) * 57 + seed);
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + dd * ux * uy;
  }

  /* ================================================================
     IMAGE ANALYSIS & RECOMMENDATIONS
     ================================================================ */
  function analyzeAndRecommend() {
    if (!state.currentCanvas) return;
    const oc = state.currentCanvas;
    const c = oc.getContext('2d', { willReadFrequently: true });
    const w = oc.width, h = oc.height;
    // Sample pixels (every 10th pixel for performance)
    const data = c.getImageData(0, 0, w, h).data;
    let totalR = 0, totalG = 0, totalB = 0;
    let totalLum = 0, totalSat = 0;
    let edgeSum = 0;
    let count = 0;

    for (let y = 0; y < h; y += 10) {
      for (let x = 0; x < w; x += 10) {
        const idx = (y * w + x) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        totalR += r; totalG += g; totalB += b;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLum += lum;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        totalSat += max > 0 ? (max - min) / max : 0;
        count++;
      }
    }

    const avgR = totalR / count;
    const avgG = totalG / count;
    const avgB = totalB / count;
    const avgLum = totalLum / count;
    const avgSat = totalSat / count;
    const isWide = w / h > 1.5;

    const recName = $('#recFilterName');
    const recBtn = $('#applyRecommended');
    let recommended = '';
    let reason = '';

    if (avgSat < 0.15) {
      // Low saturation — already muted
      recommended = 'signalCorrupt';
      reason = 'Signal Corruption — low saturation images make great glitch art';
    } else if (avgLum > 170) {
      // Very bright
      recommended = 'emotionHappy';
      reason = 'Emotion: Happy — bright image suits warm glow';
    } else if (avgLum < 80) {
      // Dark
      recommended = 'emotionSad';
      reason = 'Emotion: Sad — dark tones suit cool melancholy';
    } else if (isWide && avgSat > 0.3) {
      // Wide & colorful — likely landscape
      recommended = 'timeSlice';
      reason = 'Time Slice — wide colorful images suit day-to-night gradients';
    } else if (avgR > avgB + 30) {
      // Warm-dominant
      recommended = 'growthDecay';
      reason = 'Growth/Decay — warm tones pair well with organic aging';
    } else if (avgB > avgR + 30) {
      // Cool-dominant
      recommended = 'physicsBreaker';
      reason = 'Physics Breaker — cool tones amplify light-bending effects';
    } else if (avgSat > 0.5) {
      // High saturation
      recommended = 'geneticMutation';
      reason = 'Genetic Mutation — saturated images mutate beautifully';
    } else {
      recommended = 'memoryDrift';
      reason = 'Memory Drift — balanced images suit the faded memory look';
    }

    recName.textContent = reason;
    recBtn.style.display = 'inline-flex';
    recBtn.onclick = () => {
      // Select the recommended card
      $$('.creative-card').forEach(c => {
        c.classList.toggle('active', c.dataset.creative === recommended);
      });
      selectedCreative = recommended;
      creativeControlsDiv.style.display = 'block';
      mutationRateDiv.style.display = recommended === 'geneticMutation' ? 'block' : 'none';
    };
  }

  /* ================================================================
     UNSAVED CHANGES WARNING
     ================================================================ */
  window.addEventListener('beforeunload', (e) => {
    // Warn if an image is loaded and edits have been made
    if (state.currentCanvas && state.undoStack.length > 0) {
      e.preventDefault();
    }
  });

})();
