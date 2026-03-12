chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] Received message:', message.type);
  
  if (message.type === 'fetch-image-base64') {
    fetchImage(message.url)
      .then(base64 => sendResponse({ success: true, data: base64 }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.type === 'copy-to-clipboard') {
    copyImageToClipboard(message.url)
      .then(() => {
        console.log('[Offscreen] Copy success');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('[Offscreen] Copy failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

async function fetchImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function copyImageToClipboard(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  
  // The Clipboard API mostly supports PNG. If it's not a PNG, we convert it.
  let finalBlob = blob;
  if (blob.type !== 'image/png') {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    finalBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  }

  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': finalBlob })
  ]);
}
