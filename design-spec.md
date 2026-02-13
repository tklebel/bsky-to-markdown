# Bluesky Thread Archiver — Design Spec

## Overview

A **static web app** (HTML + CSS + JS) that converts Bluesky threads into Obsidian-friendly Markdown. No backend required — all API calls go directly to the public Bluesky AT Protocol API from the browser.

Hosted on **GitHub Pages** at `tklebel.github.io/bsky-archiver/`.

---

## Repo: `tklebel/bsky-archiver`

```
bsky-archiver/
├── index.html
├── style.css
├── app.js          # UI logic, option handling, localStorage
├── bsky-api.js     # URL parsing, API calls, thread walking
├── markdown.js     # Thread → Markdown conversion
├── media.js        # Image download + zip generation
├── README.md
└── LICENSE
```

GitHub Pages enabled on the `main` branch (root `/`). Deploys automatically on push.

---

## User Flow

1. Copy a Bluesky post URL (e.g., share from Bluesky app on Android → copy link)
2. Open `tklebel.github.io/bsky-archiver/` (bookmarked / home screen shortcut)
3. Paste the URL
4. Configure options (remembered via localStorage)
5. Tap "Archive"
6. Get rendered Markdown preview + copy/download buttons
7. Paste into Obsidian or save `.md` file to vault folder

---

## Options

| Option | Values | Default |
|--------|--------|---------|
| **Media** | `None` · `Inline` (CDN links) · `Download` (zip with images) | Inline |
| **Format** | `Minimal` (text + author + URL) · `Rich` (YAML frontmatter + engagement stats) | **Minimal** |

---

## What Gets Archived

The **original author's self-reply chain** only. Starting from the root post, follow replies where `author.did === root author DID`. Other people's replies are ignored — the goal is to capture the author's thread as a document, not the surrounding conversation.

---

## Bluesky API Flow (all public, no auth)

1. **Parse URL** → extract `handle` and `rkey` from `https://bsky.app/profile/{handle}/post/{rkey}`
2. **Resolve handle → DID**: `GET https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle={handle}`
3. **Fetch thread**: `GET https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at://{did}/app.bsky.feed.post/{rkey}&depth=1000`
4. **Walk the reply tree**: follow only replies where `author.did === root author DID`, collecting the self-reply chain in order

### Important API notes
- `depth` defaults to 6 — must set to 1000 for long threads
- `parentHeight` can be set up to 1000 to fetch parent context if the URL points to a mid-thread post
- Handle `NotFoundPost` and `BlockedPost` types gracefully
- Response structure is recursive: each `ThreadViewPost` has a `replies[]` array

---

## Markdown Output

### Minimal format (default)

```markdown
# Thread by @devezer.bsky.social

Source: https://bsky.app/profile/devezer.bsky.social/post/3mepbjbh2oc2j

> First post text here...
>
> — @devezer.bsky.social

---

> Second post in self-reply chain...
>
> — @devezer.bsky.social
```

### Rich format

```markdown
---
title: "Thread by @devezer.bsky.social"
author: devezer.bsky.social
date: 2025-02-10
source: https://bsky.app/profile/devezer.bsky.social/post/3mepbjbh2oc2j
archived: 2025-02-13
tags: [bluesky-archive]
---

# Thread by @devezer.bsky.social

> First post text here...
>
> ![alt text](https://cdn.bsky.app/img/feed/.../image.jpg)
>
> — @devezer.bsky.social · 2025-02-10 14:32 · ♡ 42 · ↻ 12

---

> Second post in self-reply chain...
>
> — @devezer.bsky.social · 2025-02-10 14:35 · ♡ 18 · ↻ 5
```

---

## Media Handling

| Mode | Behavior |
|------|----------|
| **None** | Images and link cards omitted entirely |
| **Inline** | `![alt](cdn_url)` for images; `[Card Title](url)` for link cards |
| **Download** | JS generates a `.zip` via JSZip containing the `.md` file + `/images/` folder. Image references in markdown point to relative paths `./images/filename.jpg` |

JSZip loaded from CDN, only when download mode is selected.

---

## Security

**XSS prevention**: Post text displayed via `textContent` (never `innerHTML`). Markdown output is plain text.

**No secrets**: No API keys, no auth tokens, no user credentials. Fully public API.

**CORS**: `public.api.bsky.app` sets permissive CORS headers for browser-to-API calls.

**localStorage**: Only stores user preferences (checkbox states). No sensitive data.

---

## Scalability

Static files served from GitHub Pages CDN — negligible bandwidth. All API calls go from the user's browser directly to Bluesky's servers. Each archive makes ~2 API calls from the user's own IP. Hosting costs: zero. A million users would be a million people hitting Bluesky, not us.

---

## Tech Stack

- **Vanilla HTML + CSS + JS** (no framework, no build step)
- **JSZip** (CDN) — loaded on demand for download-with-media mode
- **GitHub Pages** for hosting

---

## Future Extensions (out of scope for v1)

- Obsidian plugin (paste-to-expand: paste a bsky.app URL, plugin fetches and inserts the thread)
- ~~Android Share intent / Tasker integration~~ ✓ implemented (PWA Web Share Target + iOS Shortcut)
- Batch archiving (multiple URLs)
- ~~Quote post expansion (inline quoted posts)~~ ✓ implemented