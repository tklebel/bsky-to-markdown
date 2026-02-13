// app.js — UI logic, option persistence

const LS_KEY = 'bsky-archiver-options';

const urlInput    = document.getElementById('url-input');
const archiveBtn  = document.getElementById('archive-btn');
const outputSection = document.getElementById('output-section');
const outputPre   = document.getElementById('output-preview');
const copyBtn     = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');
const errorMsg    = document.getElementById('error-msg');
const loadingMsg  = document.getElementById('loading-msg');

const optMedia    = document.getElementById('opt-media');
const optFormat   = document.getElementById('opt-format');

// Stores the last archive result for the download button
let lastArchive = null;

// --- Persist options ---

function loadOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    if (saved.media)   optMedia.value   = saved.media;
    if (saved.format)  optFormat.value  = saved.format;
  } catch (_) {}
}

function saveOptions() {
  localStorage.setItem(LS_KEY, JSON.stringify({
    media:  optMedia.value,
    format: optFormat.value,
  }));
}

function getOptions() {
  return {
    media:  optMedia.value,
    format: optFormat.value,
  };
}

[optMedia, optFormat].forEach(el => el.addEventListener('change', saveOptions));

// --- Update download button label based on media mode ---

function updateDownloadLabel() {
  downloadBtn.textContent = optMedia.value === 'download'
    ? 'Download .zip'
    : 'Download .md';
}

optMedia.addEventListener('change', updateDownloadLabel);

// --- UI helpers ---

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
  loadingMsg.classList.add('hidden');
  outputSection.classList.add('hidden');
}

function showLoading() {
  loadingMsg.classList.remove('hidden');
  errorMsg.classList.add('hidden');
  outputSection.classList.add('hidden');
  archiveBtn.disabled = true;
}

function showOutput(markdown) {
  // Use textContent so no XSS risk from post content
  outputPre.textContent = markdown;
  outputSection.classList.remove('hidden');
  loadingMsg.classList.add('hidden');
  archiveBtn.disabled = false;
}

function hideAll() {
  errorMsg.classList.add('hidden');
  loadingMsg.classList.add('hidden');
  outputSection.classList.add('hidden');
}

// --- Archive action ---

archiveBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) {
    showError('Please enter a Bluesky post URL.');
    return;
  }

  hideAll();
  showLoading();

  try {
    const threadData = await archiveThread(url);
    const options = getOptions();

    let imageMap = null;
    if (options.media === 'download') {
      const images = collectImages(threadData.mainPosts);
      imageMap = buildImageMap(images);
    }

    const markdown = threadToMarkdown(threadData, options, imageMap);

    // Store for the download button
    lastArchive = { markdown, threadData, options, imageMap };

    updateDownloadLabel();
    showOutput(markdown);
  } catch (err) {
    showError(err.message || 'Unknown error');
    archiveBtn.disabled = false;
  }
});

// Allow pressing Enter in URL field
urlInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') archiveBtn.click();
});

// --- Copy ---

copyBtn.addEventListener('click', async () => {
  const text = outputPre.textContent;
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy Markdown'; }, 2000);
  } catch (_) {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy Markdown'; }, 2000);
  }
});

// --- Download ---

downloadBtn.addEventListener('click', async () => {
  if (!lastArchive) return;

  const { markdown, threadData, options } = lastArchive;
  const urlVal = urlInput.value.trim();
  const match = urlVal.match(/\/post\/([^/?#]+)/);
  const rkey = match ? match[1] : 'thread';
  const baseName = `bsky-${rkey}`;

  if (options.media === 'download') {
    // Zip mode: download markdown + images
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Packaging...';
    try {
      const images = collectImages(threadData.mainPosts);
      await createArchiveZip(markdown, images, baseName);
    } catch (err) {
      showError('Failed to create zip: ' + err.message);
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Download .zip';
    }
  } else {
    // Plain .md download
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
});

// --- Init ---
loadOptions();
updateDownloadLabel();
