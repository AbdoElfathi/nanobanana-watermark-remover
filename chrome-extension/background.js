chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "remove-watermark",
    title: "Remove Gemini Watermark",
    contexts: ["image"]
  });
});

async function getOffscreenContext() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_PARSER'],
    justification: 'Fetching images'
  });
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
      await getOffscreenContext();
      let dataUri;
      try {
        dataUri = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'fetch-image-base64', url: imageUrl }, (res) => {
            if (res && res.success) resolve(res.data); else reject(res ? res.error : "Fetch error");
          });
        });
      } catch (e) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (url) => {
            const img = Array.from(document.querySelectorAll('img')).find(i => i.src === url);
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
            canvas.getContext('2d').drawImage(img, 0, 0);
            return canvas.toDataURL('image/png');
          },
          args: [imageUrl]
        });
        dataUri = results[0].result;
      }
      
      chrome.runtime.sendNativeMessage("com.gwt.native_host", { url: dataUri }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          chrome.notifications.update(notificationId, { title: 'Error', message: 'Processing failed.' });
          return;
        }

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
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            });

            const container = document.createElement('div');
            Object.assign(container.style, {
              backgroundColor: 'white', padding: '24px', borderRadius: '16px',
              maxWidth: '90%', maxHeight: '90%', display: 'flex', flexDirection: 'column', gap: '20px'
            });

            const header = document.createElement('h3');
            header.innerText = 'Watermark Removed ✨';
            header.style.margin = '0'; header.style.color = '#1a1a1a';

            const img = document.createElement('img');
            img.src = previewUrl;
            Object.assign(img.style, { maxWidth: '100%', maxHeight: '65vh', borderRadius: '8px', objectFit: 'contain' });

            const btnRow = document.createElement('div');
            btnRow.style.display = 'flex'; btnRow.style.gap = '12px'; btnRow.style.justifyContent = 'flex-end';

            const cancelBtn = document.createElement('button');
            cancelBtn.innerText = 'Close';
            Object.assign(cancelBtn.style, { padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', backgroundColor: 'white', color: '#000000' });

            const copyBtn = document.createElement('button');
            copyBtn.innerText = 'Copy to Clipboard';
            Object.assign(copyBtn.style, { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: 'white', cursor: 'pointer', fontWeight: 'bold' });

            const saveBtn = document.createElement('button');
            saveBtn.innerText = 'Download';
            Object.assign(saveBtn.style, { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#646cff', color: 'white', cursor: 'pointer', fontWeight: 'bold' });

            const closeAction = () => {
              if (document.getElementById('gwt-preview-overlay')) {
                document.body.removeChild(overlay);
                chrome.runtime.sendMessage({ type: 'close-preview' });
              }
            };

            overlay.onclick = (e) => { if (e.target === overlay) closeAction(); };
            cancelBtn.onclick = closeAction;
            
            copyBtn.onclick = async () => {
              copyBtn.innerText = 'Copying...';
              try {
                // Fetch the blob directly in the page to ensure "User Gesture" context
                const res = await fetch(previewUrl);
                const blob = await res.blob();
                
                // Ensure it's a PNG for clipboard
                let finalBlob = blob;
                if (blob.type !== 'image/png') {
                  const imgData = await createImageBitmap(blob);
                  const canvas = document.createElement('canvas');
                  canvas.width = imgData.width; canvas.height = imgData.height;
                  canvas.getContext('2d').drawImage(imgData, 0, 0);
                  finalBlob = await new Promise(r => canvas.toBlob(res => r(res), 'image/png'));
                }

                await navigator.clipboard.write([
                  new ClipboardItem({ 'image/png': finalBlob })
                ]);
                
                copyBtn.innerText = 'Copied! ✅';
                setTimeout(() => copyBtn.innerText = 'Copy to Clipboard', 2000);
              } catch (err) {
                console.error('Copy failed:', err);
                copyBtn.innerText = 'Error! ❌';
                copyBtn.style.backgroundColor = '#ef4444';
                setTimeout(() => { copyBtn.innerText = 'Copy to Clipboard'; copyBtn.style.backgroundColor = '#10b981'; }, 2000);
              }
            };

            saveBtn.onclick = () => { chrome.runtime.sendMessage({ type: 'download-preview', url: previewUrl }); document.body.removeChild(overlay); };

            btnRow.appendChild(cancelBtn); btnRow.appendChild(copyBtn); btnRow.appendChild(saveBtn);
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

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'download-preview') {
    chrome.downloads.download({ url: msg.url, filename: 'cleaned_' + Date.now() + '.png', saveAs: true });
    chrome.runtime.sendNativeMessage("com.gwt.native_host", { type: 'stop-server' });
  } else if (msg.type === 'close-preview') {
    chrome.runtime.sendNativeMessage("com.gwt.native_host", { type: 'stop-server' });
  }
});
