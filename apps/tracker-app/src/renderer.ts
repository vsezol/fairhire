// DOM elements
const urlInput = document.getElementById('urlInput') as HTMLInputElement;
const openBtn = document.getElementById('openBtn') as HTMLButtonElement;

// Focus input on load
window.addEventListener('DOMContentLoaded', () => {
  urlInput.focus();
  updateButtonState();
});

openBtn.addEventListener('click', openUrl);

urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    openUrl();
  }
});

// Auto-format URLs
urlInput.addEventListener('blur', () => {
  const url = getInputValue();
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    setInputValue('https://' + url);
  }
});

urlInput.addEventListener('input', () => updateButtonState());

async function openUrl(): Promise<void> {
  const url = getInputValue();
  await window.electronAPI.openUrl(url);
}

function setInputValue(value: string): void {
  urlInput.value = value;
  updateButtonState();
}

function getInputValue(): string {
  return urlInput.value.trim();
}

function updateButtonState(): void {
  if (isButtonDisabled()) {
    openBtn.setAttribute('disabled', 'true');
  } else {
    openBtn.removeAttribute('disabled');
  }
}

function isButtonDisabled(): boolean {
  return urlInput.value.trim()?.length === 0;
}
