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
      const dataUri = await getOffscreenBase64(imageUrl);
      
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
        message: 'Error: ' + e.message
      });
    }
  }
});
