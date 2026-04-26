#!/usr/bin/env node
// Generates storeassets/screenshot-1280x800.png and screenshot-640x400.png
// Usage: node screenshot.js

const puppeteer = require('puppeteer');
const path = require('path');

const HTML = 'file://' + path.resolve(__dirname, 'sidepanel.html');
const OUT = path.resolve(__dirname, 'storeassets');

async function makeScreenshot(page, outPath, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });

  // Draw a vivid sample landscape onto the canvas and activate the editor UI
  await page.evaluate(() => {
    // --- build a sample image as a data URL using an offscreen canvas ---
    const oc = document.createElement('canvas');
    oc.width = 800; oc.height = 530;
    const ctx = oc.getContext('2d');

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, 300);
    sky.addColorStop(0, '#1a6fc4');
    sky.addColorStop(1, '#87ceeb');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 800, 300);

    // Sun
    ctx.beginPath();
    ctx.arc(650, 80, 55, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe066';
    ctx.fill();

    // Mountains (back)
    ctx.beginPath();
    ctx.moveTo(0, 300);
    ctx.lineTo(150, 130); ctx.lineTo(310, 270);
    ctx.lineTo(460, 110); ctx.lineTo(620, 260);
    ctx.lineTo(800, 150); ctx.lineTo(800, 300);
    ctx.closePath();
    ctx.fillStyle = '#5a7fa0';
    ctx.fill();

    // Mountains (front)
    ctx.beginPath();
    ctx.moveTo(0, 340);
    ctx.lineTo(200, 195); ctx.lineTo(400, 310);
    ctx.lineTo(600, 180); ctx.lineTo(800, 300);
    ctx.lineTo(800, 340); ctx.closePath();
    ctx.fillStyle = '#3a6644';
    ctx.fill();

    // Ground
    const ground = ctx.createLinearGradient(0, 340, 0, 530);
    ground.addColorStop(0, '#4a8c52');
    ground.addColorStop(1, '#2d5e36');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 340, 800, 190);

    const sampleDataUrl = oc.toDataURL('image/png');

    // Feed the image into the extension's canvas
    const img = new Image();
    img.onload = () => {
      // Replicate what sidepanel.js does when an image is loaded
      const preview = document.getElementById('previewCanvas');
      preview.width = img.width;
      preview.height = img.height;
      preview.getContext('2d').drawImage(img, 0, 0);

      // Show canvas area, hide upload zone
      document.getElementById('uploadZone').classList.add('hidden');
      const canvasArea = document.getElementById('canvasArea');
      canvasArea.classList.remove('hidden');

      // Show image info
      document.getElementById('imageInfo').textContent =
        `${img.width} × ${img.height} px`;

      // Activate the Filters tab to show a richer panel
      document.querySelectorAll('.tool-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
      const filtersTab = document.querySelector('[data-tool="filters"]');
      if (filtersTab) filtersTab.classList.add('active');
      const filtersPanel = document.getElementById('panel-filters');
      if (filtersPanel) filtersPanel.classList.add('active');

      // Set a non-default brightness to make sliders look used
      const bSlider = document.getElementById('filter-brightness');
      if (bSlider) { bSlider.value = 115; }
      const bVal = document.getElementById('val-brightness');
      if (bVal) bVal.textContent = '115%';

      const cSlider = document.getElementById('filter-contrast');
      if (cSlider) { cSlider.value = 110; }
      const cVal = document.getElementById('val-contrast');
      if (cVal) cVal.textContent = '110%';
    };
    img.src = sampleDataUrl;
  });

  // Give the image.onload time to fire
  await new Promise(r => setTimeout(r, 300));

  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`Saved: ${outPath}`);
}

async function makeUploadScreenshot(page, outPath, width, height) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(HTML, { waitUntil: 'domcontentloaded' });
  // Leave as upload screen (default state)
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`Saved: ${outPath}`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // 1280x800 — editor in use (filters panel)
  await makeScreenshot(page, path.join(OUT, 'screenshot-1280x800.png'), 1280, 800);

  // 640x400 — upload / landing screen
  await makeUploadScreenshot(page, path.join(OUT, 'screenshot-640x400.png'), 640, 400);

  await browser.close();
})();
