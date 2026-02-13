// bsky-api.js — URL parsing, API calls, thread walking

const BSKY_API = 'https://public.api.bsky.app/xrpc';

/**
 * Parse a bsky.app URL into { handle, rkey }.
 * Accepts: https://bsky.app/profile/{handle}/post/{rkey}
 */
function parseBlueskyUrl(url) {
  const match = url.trim().match(
    /^https?:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/
  );
  if (!match) throw new Error('Invalid Bluesky URL. Expected: https://bsky.app/profile/handle/post/rkey');
  return { handle: match[1], rkey: match[2] };
}

/**
 * Resolve a handle (e.g. "alice.bsky.social") to a DID.
 */
async function resolveHandle(handle) {
  const res = await fetch(
    `${BSKY_API}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
  );
  if (!res.ok) throw new Error(`Could not resolve handle "${handle}": ${res.status}`);
  const data = await res.json();
  return data.did;
}

/**
 * Fetch a single thread page starting from an AT-URI.
 */
async function fetchThreadPage(uri) {
  const res = await fetch(
    `${BSKY_API}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=1000&parentHeight=1000`
  );
  if (!res.ok) throw new Error(`Could not fetch thread: ${res.status}`);
  const data = await res.json();
  if (!data.thread) throw new Error('Unexpected API response: no thread field');
  return data.thread;
}

/**
 * Check if a node is truncated: the post claims replies exist but the
 * API returned none (server hard-caps depth at ~10).
 */
function isTruncated(node) {
  return node.$type === 'app.bsky.feed.defs#threadViewPost' &&
    (node.post?.replyCount ?? 0) > 0 &&
    (!node.replies || node.replies.length === 0);
}

/**
 * Recursively fetch the full thread, re-fetching subtrees that the API
 * truncated due to its internal depth limit.
 */
async function fetchThreadFull(uri) {
  const thread = await fetchThreadPage(uri);

  async function expandTruncated(node) {
    if (!node || node.$type !== 'app.bsky.feed.defs#threadViewPost') return;

    if (isTruncated(node)) {
      const subtree = await fetchThreadPage(node.post.uri);
      node.replies = subtree.replies || [];
    }

    for (const reply of (node.replies || [])) {
      await expandTruncated(reply);
    }
  }

  await expandTruncated(thread);
  return thread;
}

/**
 * Fetch the full thread starting from a DID + rkey.
 */
async function fetchThread(did, rkey) {
  const uri = `at://${did}/app.bsky.feed.post/${rkey}`;
  return fetchThreadFull(uri);
}

/**
 * Walk a ThreadViewPost tree and return a flat list of posts
 * for the "main thread only" mode (only posts by the root author).
 *
 * Strategy: starting from the root, follow the longest chain of
 * replies from the same author (first matching reply at each level).
 */
function walkMainThread(thread) {
  const posts = [];
  const rootDid = thread.post?.author?.did;
  if (!rootDid) return posts;

  let node = thread;
  while (node && node.$type === 'app.bsky.feed.defs#threadViewPost') {
    posts.push(node.post);
    // Find the next reply by the same author
    const next = (node.replies || []).find(
      r => r.$type === 'app.bsky.feed.defs#threadViewPost' &&
           r.post?.author?.did === rootDid
    );
    node = next || null;
  }
  return posts;
}

/**
 * High-level: fetch everything needed for a given bsky URL.
 * Returns { handle, url, mainPosts }
 */
async function archiveThread(url) {
  const { handle, rkey } = parseBlueskyUrl(url);
  const did = await resolveHandle(handle);
  const thread = await fetchThread(did, rkey);
  const mainPosts = walkMainThread(thread);

  return {
    handle,
    url: url.trim(),
    mainPosts,
  };
}
