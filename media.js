// media.js — Image download + zip generation

/**
 * Collect all image URLs from posts, returning { url, filename } pairs.
 */
function collectImages(posts) {
  const images = [];
  let counter = 1;

  for (const post of posts) {
    const embed = post?.embed;
    if (!embed) continue;

    const addImages = (imgArray) => {
      for (const img of imgArray || []) {
        const url = img.fullsize || img.thumb || '';
        if (url) {
          const ext = guessExtension(url);
          images.push({ url, filename: `image_${counter}${ext}` });
          counter++;
        }
      }
    };

    if (embed.$type === 'app.bsky.embed.images#view') {
      addImages(embed.images);
    }

    if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
      const media = embed.media;
      if (media?.$type === 'app.bsky.embed.images#view') {
        addImages(media.images);
      }
    }
  }

  return images;
}

/**
 * Guess file extension from a CDN URL.
 */
function guessExtension(url) {
  if (url.includes('.png')) return '.png';
  if (url.includes('.gif')) return '.gif';
  if (url.includes('.webp')) return '.webp';
  return '.jpg';
}

/**
 * Build a URL → relative-path map for markdown generation in download mode.
 */
function buildImageMap(images) {
  const map = new Map();
  for (const { url, filename } of images) {
    map.set(url, `./images/${filename}`);
  }
  return map;
}

/**
 * Load JSZip from CDN (lazy, only when needed).
 */
async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jszip@3/dist/jszip.min.js';
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error('Failed to load JSZip'));
    document.head.appendChild(script);
  });
}

/**
 * Download all images and create a zip containing the .md file + /images/ folder.
 * Triggers browser download of the zip.
 */
async function createArchiveZip(markdown, images, baseName) {
  const JSZip = await loadJSZip();
  const zip = new JSZip();

  zip.file(`${baseName}.md`, markdown);

  if (images.length > 0) {
    const imgFolder = zip.folder('images');
    const downloads = images.map(async ({ url, filename }) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        imgFolder.file(filename, blob);
      } catch (err) {
        console.warn(`Failed to download image ${url}: ${err.message}`);
      }
    });
    await Promise.all(downloads);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${baseName}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}
