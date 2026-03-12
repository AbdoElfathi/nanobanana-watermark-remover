chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "remove-watermark",
    title: "Remove Gemini Watermark",
    contexts: ["image"]
  });
});

async function getOffscreenBase64(url) {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Fetching images'
    });
  }
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'fetch-image-base64', url: url }, (response) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      if (response && response.success) resolve(response.data);
      else reject(new Error(response ? response.error : "Fetch error"));
    });
  });
}

async function tabContextFetch(tabId, url) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (targetUrl) => {
      const img = Array.from(document.querySelectorAll('img')).find(i => i.src === targetUrl);
      if (!img) throw new Error("Image not found");
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    },
    args: [url]
  });
  return results[0].result;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "remove-watermark") {
    const imageUrl = info.srcUrl;
    const notificationId = 'gwt-' + Date.now();
    const icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAFElEQVR42gENAP7/AP///wD///8A/wAAAP8AAAAAAAEAAQAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAQA=';

    chrome.notifications.create(notificationId, {
      type: 'basic', title: 'Gemini Watermark Tool', message: 'Processing...', iconUrl: icon
    });
    
    try {
      let dataUri;
      try { dataUri = await getOffscreenBase64(imageUrl); } 
      catch (e) { dataUri = await tabContextFetch(tab.id, imageUrl); }
      
      chrome.runtime.sendNativeMessage("com.gwt.native_host", { url: dataUri }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          chrome.notifications.update(notificationId, { title: 'Error', message: 'Processing failed.' });
          return;
        }

        // Inject the preview modal
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (previewUrl) => {
            if (document.getElementById('gwt-preview-overlay')) return;

            const overlay = document.createElement('div');
            overlay.id = 'gwt-preview-overlay';
            Object.assign(overlay.style, {
              position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
              backgroundColor: 'rgba(0,0,0,0.8)', zIndex: '999999',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'sans-serif'
            });

            const container = document.createElement('div');
            Object.assign(container.style, {
              backgroundColor: 'white', padding: '20px', borderRadius: '12px',
              maxWidth: '90%', maxHeight: '90%', display: 'flex', flexDirection: 'column', gap: '15px'
            });

            const header = document.createElement('h3');
            header.innerText = 'Preview: Watermark Removed';
            header.style.margin = '0';
            header.style.color = '#000000';

            const img = document.createElement('img');
            img.src = previewUrl;
            Object.assign(img.style, { maxWidth: '100%', maxHeight: '70vh', borderRadius: '4px', objectFit: 'contain' });

            const btnRow = document.createElement('div');
            btnRow.style.display = 'flex'; btnRow.style.gap = '10px'; btnRow.style.justifyContent = 'flex-end';

            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = 'Cancel';
            Object.assign(cancelBtn.style, { padding: '8px 16px', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer' });

            const saveBtn = document.createElement('button');
            saveBtn.innerText = 'Download Image';
            Object.assign(saveBtn.style, { 
              padding: '8px 16px', borderRadius: '6px', border: 'none', 
              backgroundColor: '#646cff', color: 'white', cursor: 'pointer', fontWeight: 'bold' 
            });

            cancelBtn.onclick = () => {
              document.body.removeChild(overlay);
              chrome.runtime.sendMessage({ type: 'close-preview' });
            };

            saveBtn.onclick = () => {
              chrome.runtime.sendMessage({ type: 'download-preview', url: previewUrl });
              document.body.removeChild(overlay);
            };

            btnRow.appendChild(cancelBtn); btnRow.appendChild(saveBtn);
            container.appendChild(header); container.appendChild(img); container.appendChild(btnRow);
            overlay.appendChild(container);
            document.body.appendChild(overlay);
          },
          args: [response.previewUrl]
        });

        chrome.notifications.clear(notificationId);
      });
    } catch (e) {
      chrome.notifications.update(notificationId, { title: 'Fetch Error', message: e.message });
    }
  }
});

// Handle messages from the injected preview script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'download-preview') {
    chrome.downloads.download({
      url: msg.url,
      filename: 'cleaned_' + Date.now() + '.png',
      saveAs: true
    });
    chrome.runtime.sendNativeMessage("com.gwt.native_host", { type: 'stop-server' });
  } else if (msg.type === 'close-preview') {
    chrome.runtime.sendNativeMessage("com.gwt.native_host", { type: 'stop-server' });
  }
});
