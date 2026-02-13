# Bluesky Thread Archiver

A static web app that converts Bluesky threads into Obsidian-friendly Markdown. No backend, no login — all API calls go directly to the public Bluesky AT Protocol API from your browser.

**Live:** https://tklebel.github.io/bsky-archiver/

---

## How to use

**On desktop:** Open the [live app](https://tklebel.github.io/bsky-archiver/), paste a Bluesky post URL, choose your options, and hit **Turn into Markdown**. You get a Markdown preview you can copy or download — ready to paste into Obsidian or any other editor.

**On mobile:** The app also integrates with your phone's share sheet, so you can archive a thread directly from the Bluesky app without copying any URLs. See [Mobile share sheet](#mobile-share-sheet) below for setup.

Only the original author's self-reply chain is captured. Other people's replies are ignored. The goal is the author's thread as a document, not the surrounding conversation.

## Options

| Option | Choices | Default |
|--------|---------|---------|
| **Media** | None · Inline (CDN links) · Download (zip with images) | Inline |
| **Format** | Minimal · Rich (YAML frontmatter + engagement stats) | Minimal |

Options are remembered via `localStorage`.

### Media modes

- **None** — images and link cards are omitted
- **Inline** — images as `![alt](cdn_url)`, link cards as `[title](url)`
- **Download** — produces a `.zip` containing the `.md` file and an `images/` folder with all images downloaded locally; image references in the markdown use relative paths

### Format modes

**Minimal** — clean output, just text, author, and source link:

```markdown
# Thread by @alice.bsky.social

Source: https://bsky.app/profile/alice.bsky.social/post/abc123

> First post text here...
>
> — @alice.bsky.social

---

> Second post...
>
> — @alice.bsky.social
```

**Rich** — adds YAML frontmatter and engagement stats:

```markdown
---
title: "Thread by @alice.bsky.social"
author: alice.bsky.social
date: 2025-02-10
source: https://bsky.app/profile/alice.bsky.social/post/abc123
archived: 2025-02-13
tags: [bluesky-archive]
---

# Thread by @alice.bsky.social

> First post text here...
>
> — @alice.bsky.social · 2025-02-10 14:32 · ♡ 42 · ↻ 12
```

## Mobile share sheet

The app can be added to your phone's share sheet, so archiving a thread is just: **Share → Bsky Archive → Copy Markdown**. No need to copy-paste URLs.

Technically, this works via a `?url=` query parameter — if the URL contains a Bluesky post, the app auto-populates the input and starts archiving immediately.

### Android (Chrome PWA)

Chrome supports the [Web Share Target API](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target), so the app can appear directly in Android's share sheet. Chrome is only needed for the one-time install — after that, the share target works from any app.

**One-time setup (in Chrome):**

1. Open the hosted app in Chrome on Android
2. Tap the Chrome menu → **Add to Home Screen** → **install** when prompted

**Usage (from any app):**

1. In the Bluesky app, tap **Share** on a post
2. Pick **Bsky Archive** from the share sheet
3. The archiver opens and immediately starts fetching
4. Tap **Copy Markdown** → paste into Obsidian

### iOS (Apple Shortcut)

iOS doesn't support Web Share Target (not even in Chrome, which uses Safari's engine under the hood). You can get a similar workflow using Apple Shortcuts:

1. Open the **Shortcuts** app → tap **+** to create a new shortcut
2. Set it to accept **URLs** from the **Share Sheet**
3. Add an **Open URL** action with: `https://tklebel.github.io/bsky-archiver/?url={Shortcut Input}`
4. Name it "Bsky Archive" and save

Then from the Bluesky app, tap **Share** → **Bsky Archive**, and Safari opens with the URL pre-filled.

## How it works

1. Parse the Bluesky URL → extract handle and post ID
2. Resolve handle → DID via `public.api.bsky.app`
3. Fetch the thread (depth=1000 to handle long threads; truncated subtrees are re-fetched automatically)
4. Walk the reply tree, keeping only posts by the root author
5. Convert to Markdown with the chosen options

No API keys. No authentication. No server. All requests go from your browser directly to Bluesky's public API.

## Running locally

Since this is a plain static site with no build step, any simple HTTP server works. From the repo root:

```bash
# Python (usually pre-installed)
python3 -m http.server 8080
```

Then open http://localhost:8080 in your browser.


## Self-hosting / GitHub Pages

This is a zero-dependency static site (plain HTML + CSS + JS, no build step). To host your own copy:

1. Fork this repo
2. Go to **Settings → Pages**, set source to **Deploy from a branch**, branch `main`, folder `/`
3. Your copy will be live at `https://<your-username>.github.io/bsky-archiver/`

The only external dependency loaded at runtime is [JSZip](https://stashbox.org/3765289/jszip.min.js) (from jsDelivr CDN), and only when the **Download** media mode is used.

## File structure

```
index.html      — UI
style.css       — Styles
app.js          — UI logic, option persistence, share target handling
bsky-api.js     — URL parsing, API calls, thread walking
markdown.js     — Thread → Markdown conversion
media.js        — Image download + zip generation
manifest.json   — PWA manifest (share target, icons)
sw.js           — Service worker (required for PWA installability)
icon.svg        — App icon
```

## License

MIT — see [LICENSE](LICENSE).
