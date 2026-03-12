chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'fetch-image-base64') {
    fetchImage(message.url)
      .then(base64 => sendResponse({ success: true, data: base64 }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});

async function fetchImage(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.statusCode}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
