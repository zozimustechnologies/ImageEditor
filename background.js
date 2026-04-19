/* background.js — Service worker for Image Editor side panel extension */

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'editImage',
    title: 'Edit image',
    contexts: ['image'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'editImage' && info.srcUrl) {
    chrome.sidePanel.open({ tabId: tab.id }).then(() => {
      // Small delay to let the panel load before sending the message
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'loadImage',
          url: info.srcUrl,
        });
      }, 500);
    });
  }
});

/* ── Scan active tab for images ── */
async function scanTabForImages(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    // Skip chrome:// and edge:// pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') ||
        tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const images = [];
        // Check if the page itself is an image (browser opens image directly)
        const isImagePage = document.contentType && document.contentType.startsWith('image/');
        if (isImagePage) {
          const img = document.querySelector('img');
          if (img && img.src) {
            images.push({
              src: img.src,
              width: img.naturalWidth || 0,
              height: img.naturalHeight || 0,
              isPageImage: true,
            });
            return images;
          }
        }

        // Collect all <img> elements on the page
        const seen = new Set();
        document.querySelectorAll('img').forEach(img => {
          const src = img.src;
          if (!src || src.startsWith('data:') || seen.has(src)) return;
          // Skip tiny images (likely icons/tracking pixels)
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (w < 40 || h < 40) return;
          seen.add(src);
          images.push({ src, width: w, height: h, isPageImage: false });
        });

        // Also check CSS background images on common containers
        document.querySelectorAll('[style*="background-image"], picture source').forEach(el => {
          if (el.tagName === 'SOURCE' && el.srcset) {
            const src = el.srcset.split(',')[0].trim().split(' ')[0];
            if (src && !src.startsWith('data:') && !seen.has(src)) {
              seen.add(src);
              images.push({ src, width: 0, height: 0, isPageImage: false });
            }
          }
        });

        return images;
      },
    });

    if (results && results[0] && results[0].result) {
      chrome.runtime.sendMessage({
        type: 'pageImages',
        images: results[0].result,
        tabUrl: tab.url,
      });
    }
  } catch (err) {
    // Content script injection can fail on restricted pages — ignore
  }
}

// Scan only when the side panel explicitly asks — no automatic injection
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'scanTab') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (tabs[0]) scanTabForImages(tabs[0].id);
    });
  }
});
