// markdown.js — Thread data → Markdown conversion

/**
 * Extract plain text from a post's record, handling facets for links/mentions.
 * For MVP we just use the raw text.
 */
function postText(post) {
  return post?.record?.text || '';
}

/**
 * Format an ISO date string to YYYY-MM-DD HH:MM (UTC).
 */
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toISOString().slice(0, 10);
  const time = d.toISOString().slice(11, 16);
  return `${date} ${time}`;
}

/**
 * Format only the date part YYYY-MM-DD.
 */
function formatDateOnly(iso) {
  if (!iso) return '';
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Build image markdown for a post's embed, depending on media option.
 * Returns an array of lines to append to the post block.
 *
 * @param {object} post
 * @param {string} mediaOption - 'none' | 'inline' | 'download'
 * @param {Map} [imageMap] - URL → relative path map (used in download mode)
 */
function mediaLines(post, mediaOption, imageMap) {
  if (mediaOption === 'none') return [];

  const embed = post?.embed;
  if (!embed) return [];

  const resolveUrl = (url) => {
    if (mediaOption === 'download' && imageMap) {
      return imageMap.get(url) || url;
    }
    return url;
  };

  const lines = [];

  // Images embed
  if (embed.$type === 'app.bsky.embed.images#view') {
    for (const img of embed.images || []) {
      const alt = img.alt || '';
      const url = img.fullsize || img.thumb || '';
      if (url) lines.push(`![${alt}](${resolveUrl(url)})`);
    }
  }

  // External link card
  if (embed.$type === 'app.bsky.embed.external#view') {
    const ext = embed.external;
    if (ext?.uri) {
      lines.push(`[${ext.title || ext.uri}](${ext.uri})`);
    }
  }

  // Record with media (e.g. quote + images)
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    const media = embed.media;
    if (media?.$type === 'app.bsky.embed.images#view') {
      for (const img of media.images || []) {
        const alt = img.alt || '';
        const url = img.fullsize || img.thumb || '';
        if (url) lines.push(`![${alt}](${resolveUrl(url)})`);
      }
    }
  }

  return lines;
}

/**
 * Render a single post as a blockquote block.
 *
 * @param {object} post
 * @param {object} options
 * @param {Map} [imageMap] - URL → relative path map (used in download mode)
 */
function renderPost(post, options, imageMap) {
  const prefix = '> ';
  const text = postText(post);
  const handle = post?.author?.handle || 'unknown';
  const createdAt = post?.record?.createdAt;

  const lines = [];

  // Text lines — preserve newlines within the blockquote
  const textLines = text.split('\n');
  for (const line of textLines) {
    lines.push(`${prefix}${line}`);
  }

  // Media
  const media = mediaLines(post, options.media, imageMap);
  for (const m of media) {
    lines.push(prefix.trimEnd());
    lines.push(`${prefix}${m}`);
  }

  // Attribution line
  lines.push(prefix.trimEnd());
  if (options.format === 'rich' && createdAt) {
    const likes = post?.likeCount ?? '';
    const reposts = post?.repostCount ?? '';
    const stats = (likes !== '' && reposts !== '')
      ? ` · ♡ ${likes} · ↻ ${reposts}`
      : '';
    lines.push(`${prefix}— @${handle} · ${formatDate(createdAt)}${stats}`);
  } else {
    lines.push(`${prefix}— @${handle}`);
  }

  return lines.join('\n');
}

/**
 * Full conversion: thread data → Markdown string.
 *
 * @param {object} threadData - returned by archiveThread()
 * @param {object} options - { media: 'none'|'inline'|'download', format: 'minimal'|'rich' }
 * @param {Map} [imageMap] - URL → relative path map (used in download mode)
 */
function threadToMarkdown(threadData, options, imageMap) {
  const { handle, url, mainPosts } = threadData;
  const today = new Date().toISOString().slice(0, 10);
  const firstPost = mainPosts[0];
  const postDate = firstPost?.record?.createdAt
    ? formatDateOnly(firstPost.record.createdAt)
    : today;

  const lines = [];

  // YAML frontmatter (rich only)
  if (options.format === 'rich') {
    lines.push('---');
    lines.push(`title: "Thread by @${handle}"`);
    lines.push(`author: ${handle}`);
    lines.push(`date: ${postDate}`);
    lines.push(`source: ${url}`);
    lines.push(`archived: ${today}`);
    lines.push('tags: [bluesky-archive]');
    lines.push('---');
    lines.push('');
  }

  // Title
  lines.push(`# Thread by @${handle}`);
  lines.push('');
  if (options.format === 'minimal') {
    lines.push(`Source: ${url}`);
    lines.push('');
  }

  // Main thread posts
  for (const post of mainPosts) {
    lines.push(renderPost(post, options, imageMap));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Remove trailing separator
  if (lines[lines.length - 1] === '') lines.pop();
  if (lines[lines.length - 1] === '---') lines.pop();
  if (lines[lines.length - 1] === '') lines.pop();

  return lines.join('\n');
}
