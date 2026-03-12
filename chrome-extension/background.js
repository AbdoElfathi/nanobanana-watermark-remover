chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "remove-watermark",
    title: "Remove Gemini Watermark",
    contexts: ["image"]
  });
});

async function getOffscreenBase64(url) {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Fetching images across origins to process with local tool'
    });
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'fetch-image-base64',
      url: url
    }, (response) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      if (response && response.success) resolve(response.data);
      else reject(new Error(response ? response.error : "Unknown fetch error"));
    });
  });
}

// Fallback: extract image data directly from the tab's context
// This is necessary for blob: URLs or images that are strictly protected
async function tabContextFetch(tabId, url) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (targetUrl) => {
      return new Promise((resolve, reject) => {
        // Find the image in the page that matches the clicked URL
        const images = Array.from(document.querySelectorAll('img'));
        const img = images.find(i => i.src === targetUrl);
        
        if (!img) return reject("Image not found in page context");

        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          reject("Canvas extraction failed (CORS or other issue): " + e.message);
        }
      });
    },
    args: [url]
  });

  if (results && results[0] && results[0].result) {
    return results[0].result;
  }
  throw new Error("Failed to extract image from page context");
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "remove-watermark") {
    const imageUrl = info.srcUrl;
    const notificationId = 'gwt-' + Date.now();
    const fallbackIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAFElEQVR42gENAP7/AP///wD///8A/wAAAP8AAAAAAAEAAQAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAQA=';

    chrome.notifications.create(notificationId, {
      type: 'basic',
      title: 'Gemini Watermark Tool',
      message: 'Fetching image data...',
      iconUrl: fallbackIcon,
      priority: 0
    });
    
    try {
      let dataUri;
      
      // Attempt 1: Standard Offscreen Fetch
      try {
        dataUri = await getOffscreenBase64(imageUrl);
      } catch (e) {
        console.warn("Offscreen fetch failed, trying tab context fallback...", e);
        // Attempt 2: Direct extraction from tab (for blobs/protected images)
        dataUri = await tabContextFetch(tab.id, imageUrl);
      }
      
      chrome.notifications.update(notificationId, {
        message: 'Processing image locally...'
      });

      chrome.runtime.sendNativeMessage(
        "com.gwt.native_host",
        { url: dataUri },
        (response) => {
          if (chrome.runtime.lastError) {
            chrome.notifications.create({
              type: 'basic',
              title: 'Native Host Error',
              message: chrome.runtime.lastError.message,
              iconUrl: fallbackIcon,
              priority: 2
            });
            return;
          }

          if (response && response.success) {
            chrome.notifications.update(notificationId, {
              title: 'Success!',
              message: 'Saved to Downloads: ' + response.fileName,
              priority: 0
            });
          } else {
            chrome.notifications.update(notificationId, {
              title: 'Processing Failed',
              message: response ? response.error : "Unknown error"
            });
          }
        }
      );
    } catch (e) {
      chrome.notifications.update(notificationId, {
        title: 'Fetch Error',
        message: 'Unable to access image. Try clicking the image to enlarge it first.'
      });
      console.error("All fetch methods failed:", e);
    }
  }
});
