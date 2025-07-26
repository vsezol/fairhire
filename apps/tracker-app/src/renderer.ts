// DOM elements
const urlInput = document.getElementById('urlInput') as HTMLInputElement;
const openBtn = document.getElementById('openBtn') as HTMLButtonElement;
const errorDiv = document.getElementById('error') as HTMLDivElement;

// URL validation patterns for different platforms
const urlPatterns = {
  zoom: /^https?:\/\/([\w-]+\.)?zoom\.us\//,
  googleMeet: /^https?:\/\/meet\.google\.com\//,
  sberJazz: /^https?:\/\/([\w-]+\.)?jazz\.sber\.ru\//,
  teams: /^https?:\/\/([\w-]+\.)?teams\.microsoft\.com\//,
  skype: /^https?:\/\/([\w-]+\.)?skype\.com\//,
  webex: /^https?:\/\/([\w-]+\.)?webex\.com\//,
  discord: /^https?:\/\/([\w-]+\.)?discord\.com\//,
  generic: /^https?:\/\/[\w.-]+\.[a-z]{2,}(\/.*)?$/i,
};

function showError(message: string): void {
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
  setTimeout(() => {
    errorDiv.classList.add('hidden');
  }, 5000);
}

function hideError(): void {
  errorDiv.classList.add('hidden');
}

function validateUrl(url: string): boolean {
  if (!url.trim()) {
    showError('Please enter a URL');
    return false;
  }

  // Check if it's a valid URL format
  try {
    new URL(url);
  } catch {
    showError('Please enter a valid URL');
    return false;
  }

  // Check if it matches known video call platforms or is a generic HTTPS URL
  const isValidPlatform = Object.values(urlPatterns).some((pattern) =>
    pattern.test(url)
  );

  if (!isValidPlatform) {
    showError(
      "URL format not recognized. Please make sure it's a valid video call link."
    );
    return false;
  }

  return true;
}

function setLoading(loading: boolean): void {
  if (loading) {
    openBtn.disabled = true;
    openBtn.textContent = 'Opening...';
    document.body.classList.add('loading');
  } else {
    openBtn.disabled = false;
    openBtn.textContent = 'Open';
    document.body.classList.remove('loading');
  }
}

async function openUrl(): Promise<void> {
  const url = urlInput.value.trim();

  if (!validateUrl(url)) {
    return;
  }

  hideError();
  setLoading(true);

  try {
    // Check if we're running in Electron
    if (window.electronAPI) {
      const result = await window.electronAPI.openUrl(url);

      if (result.success) {
        // Clear input on success
        urlInput.value = '';
        console.log('URL opened successfully');
      } else {
        showError(result.error || 'Failed to open URL');
      }
    } else {
      // Running in browser - open in new tab
      window.open(url, '_blank');
      urlInput.value = '';
      console.log('URL opened in new tab');
    }
  } catch (error) {
    console.error('Error opening URL:', error);
    showError('An error occurred while opening the URL');
  } finally {
    setLoading(false);
  }
}

// Event listeners
openBtn.addEventListener('click', openUrl);

urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    openUrl();
  }
});

urlInput.addEventListener('input', () => {
  hideError();
});

// Auto-format URLs
urlInput.addEventListener('blur', () => {
  const url = urlInput.value.trim();
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    urlInput.value = 'https://' + url;
  }
});

// Focus input on load
window.addEventListener('DOMContentLoaded', () => {
  urlInput.focus();
});

console.log('Video Call Browser renderer loaded');
