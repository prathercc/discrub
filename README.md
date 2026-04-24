# Discrub

A powerful Discord data management tool for exporting, searching, and managing your Discord messages, reactions, and media.

Available as a **web app** (manual token entry) and a **Chrome/Firefox extension** (auto-authentication on Discord).

![Message Table](docs/screenshots/messages/message-table.png)

---

## Table of Contents

- [Features](#features)
  - [Browse Servers, Channels & DMs](#browse-servers-channels--dms)
  - [Message Feed, Search & Filters](#message-feed-search--filters)
  - [User Profiles & Quick Filters](#user-profiles--quick-filters)
  - [Click-to-Jump Navigation](#click-to-jump-navigation)
  - [Focus Mode](#focus-mode)
  - [Tour Mode & Targeted Help](#tour-mode--targeted-help)
  - [Export](#export)
  - [Purge](#purge)
  - [Reactions](#reactions)
  - [Message Operations](#message-operations)
  - [Forum Channels](#forum-channels)
  - [Analytics](#analytics)
  - [Data Package Import & Rehydration](#data-package-import--rehydration)
  - [Settings & Preferences](#settings--preferences)
  - [Status Log](#status-log)
  - [Pause, Resume & Cancel](#pause-resume--cancel)
  - [Theme Toggle](#theme-toggle)
  - [Additional Features](#additional-features)
- [Web App vs Extension](#web-app-vs-extension)
- [Getting Started](#getting-started)
- [Upgrading from Discrub Classic](#upgrading-from-discrub-classic)
- [Development](#development)
- [FAQ](#faq)
- [Tech Stack](#tech-stack)

---

## Features

### Browse Servers, Channels & DMs

Navigate your Discord servers with full channel category support, permission-based visibility (locked channels shown with lock icons), and direct message browsing with display names.

![Server & Channel Browsing](docs/screenshots/browsing/channel-list.png)
![DM Browsing](docs/screenshots/browsing/dm-list.png)

### Message Feed, Search & Filters

A Discord-style chunked feed with inline message rendering, role-colored author names, role icons, reply indicators, hover-only gutter timestamps, virtualization for smooth scroll on huge channels, and system messages (pins, joins, boosts, thread-created) rendered as compact native-looking notices.

**Filters** uses a two-layer model in one modal:

- **Search** hits Discord's API. Filter by message content, author, mentions, has-types (image, video, link, file, embed, sound, sticker, snapshot, poll, forward), date range with **time-of-day precision**, pinned status, and author type (human / bot / webhook). Results stream in lazily — the channel header shows `X of Y matches loaded` as you scroll, with a Load All option that transparently chains queries past Discord's 5,000-result cap.
- **Refine** narrows the messages already loaded, client-side, with no API calls. Survives "Load more" so new pages stay filtered, and a status entry appears when an incoming page contributed zero matches.

![Search & Filters](docs/screenshots/messages/search-filters.png)

### User Profiles & Quick Filters

Click any avatar or username to view a Discord-style profile card with display names, server nicknames, role colors, role list with icons, badges, account details, and profile customization info.

The profile modal also exposes two **one-click filter shortcuts**:
- **Filter messages by [name]** — narrows the channel to messages they authored
- **Filter messages mentioning [name]** — narrows to messages where they're @mentioned

Other active filters (date, content, etc.) are preserved when you apply either — only the user scope changes.

![User Profile](docs/screenshots/messages/user-profile.png)

### Click-to-Jump Navigation

Click any **reply bar**, **pinned-message notice**, or **thread-created notice** in the feed to jump to the referenced message. The target row briefly flashes amber so your eye lands on it. Works for any message that's currently loaded; out-of-view targets show a brief toast prompting you to load more first.

### Focus Mode

Distraction-free reading mode that hides the sidebar and status panel for a full-width feed. Press `F` to toggle, `Escape` to exit. Available from a Focus button in the channel toolbar.

### Tour Mode & Targeted Help

First-time users get a **guided tour** of the app — server browsing, multi-select, filters, exports, focus mode, and the message feed. Skippable, non-blocking, and tracked per-version (so future major changes can re-trigger the relevant steps without nagging users who've already seen them).

For day-to-day "what does this do?" moments, look for the small **`?` icons** placed next to the trickier affordances:
- Multi-select toggle (in channel and DM lists)
- Filters button + Refine section
- Profile quick-filter buttons
- Focus mode toggle
- Search match counter
- Purge mode toggle
- Pause / Resume controls
- Operation Delays setting
- Export preset dropdown

Click any `?` for a short paragraph explaining how the feature actually works — independent of the main tour and always available.

### Export

Export messages in four formats with granular control:

| Format | Description |
|--------|-------------|
| **HTML** | Styled webpage with avatars, formatting, reactions, role colors, and theme toggle |
| **CSV** | Spreadsheet-compatible format |
| **JSON** | Raw data format for analysis |
| **Media Only** | Download attachments without message content |

**HTML Templates:**
- **Discord Layout** (default) — wraps exports in a Discord-like shell with server sidebar, channel navigation, and theme toggle
- **Standard** — clean standalone HTML pages

**Export Features:**
- 9 built-in presets (Quick Text Backup, Full Archive, Data Analysis, Media Gallery, etc.)
- Custom preset creation and management
- Per-type media selection (images, videos, audio)
- Configurable messages per page
- Thread/forum post separation into individual files
- Detailed reaction user data in HTML exports
- Media breakdown bar showing file counts and sizes
- Artist mode (organize media by author)
- Sort order (oldest/newest first)
- README.html bundled with every export explaining how to navigate the files

![Export Dialog](docs/screenshots/export/export-dialog.png)
![Media Settings](docs/screenshots/export/media-settings.png)

### Purge

Delete messages and reactions across one or multiple channels with user targeting:

- **Messages Mode** — search-based deletion with per-user targeting
- **Attachments Only** — strip attachments from messages without deleting the text (own messages only — Discord API limitation)
- **Reactions Mode** — remove specific users' reactions from all messages (your own without permission, any user with Manage Messages)
- **Clear All Reactions** (admin) — bulk remove all reactions using a single API call per message

Features: multi-channel selection with one-click "Select all", filters integration (narrow by author, content, date, has-types) for both bulk export and bulk purge, retain-attachments option, thread-aware discovery (auto-unarchives during purge and re-archives when done), DM support (own messages only), pause/resume/cancel.

![Purge Dialog](docs/screenshots/purge/purge-dialog.png)

### Reactions

View who reacted to any message, with per-user reaction management:

- View reacting users with avatars
- Remove individual reactions (own reactions, or any with Manage Messages permission)
- Admin bulk removal — remove all reactions or all of a specific emoji in one API call
- Batch removal across selected messages with Discord-style emoji picker and user selection
- `reaction.me` optimization — skips unnecessary API calls for emojis the user hasn't reacted to

![Reaction Modal](docs/screenshots/reactions/reaction-modal.png)

### Message Operations

- **Delete** — single or bulk message deletion with confirmation
- **Edit** — single or bulk message editing
- **Attachment Management** — delete individual attachments or all from a message
- **Strip Attachments Only** — keep the message text but remove its attachments (own messages only — Discord API limitation)
- **Remove Reactions** — batch removal from toolbar with emoji/user selection
- **Stale-feed reload toast** — after a purge that targets the channel you're currently viewing, a one-click toast offers to reload the feed so you see Discord's post-purge state instead of the cached snapshot

### Forum Channels

Full support for forum/media channels (Discord channel types 15 and 16):

- Browse forum threads/posts with preview cards
- Search threads by name
- Load thread messages into the message table
- Export forum threads individually or as part of bulk exports
- Discovers archived threads (public and private)

![Forum Threads](docs/screenshots/forum/thread-list.png)

### Analytics

Message analytics with mention frequency, user engagement metrics, and CSV export. Includes "Skip Replies" option to exclude reply mentions from counts.

![Analytics](docs/screenshots/analytics/analytics-modal.png)

### Data Package Import & Rehydration

Import the ZIP from Discord's "Request All of My Data" export and browse, analyze, bulk-edit, bulk-delete, or re-export your full message history — including servers you've left. Processing happens entirely in your browser; the package file never leaves your device.

![Package empty state](docs/screenshots/package/package-empty-state.png)

**Analytics on your full message history.** Per-server and per-channel counts, channel-type breakdown, and an optional timeline view (monthly activity + hour-of-day patterns).

![Package analytics](docs/screenshots/package/package-analytics.png)

**Browse the messages.** Lazy CSV loading (up to 5 channels cached at once), Discord-style message formatting with markdown, mention chips, custom emoji, and auto-linked URLs. Attachment placeholders preserve the original CDN URL.

![Package message browser](docs/screenshots/package/package-message-browser.png)

**Tier 2 rehydration (opt-in, per channel).** Click "Load rich data" to fetch live `Message` objects from Discord — real reactions, reply quotes, named mentions, embeds, stickers, and fresh signed CDN URLs for attachments. Results persist to IndexedDB so enriched channels load instantly on return. Pause/resume/cancel work the same as every other long-running operation; partial results are saved on cancel.

![Package rehydrated](docs/screenshots/package/package-rehydrated.png)

Exports work identically to live exports (same dialog, all presets, all templates) and prefer the enriched `Message` objects when available. A "Rehydrate before export" toggle triggers enrichment just-in-time if the channel hasn't been rehydrated yet.

### Settings & Preferences

Comprehensive settings across multiple tabs:

- **Display** — date and time format
- **User Data** — display name and nickname lookup toggles, reaction enrichment, user data refresh rate
- **Operation Delays** — configurable search and delete delays with randomization modifier (with a built-in `?` explainer covering Discord rate limits)
- **Export Preferences** — default format, template, media types, and all export options
- **Purge Behavior** — default mode (Delete, Strip Attachments Only, Remove Reactions) and media retention

![Settings](docs/screenshots/settings/settings-dialog.png)

### Status Log

Terminal-style operation log with color-coded entries ([INFO], [OK], [ERR], [WARN], [SESSION]), real-time progress tracking, downloadable log file, and smooth expand/collapse animation. Auto-scrolls to latest entries on open.

![Status Log](docs/screenshots/ui/status-log.png)

### Pause, Resume & Cancel

All long-running operations (export, purge, load all, delete, edit, reaction removal) support:
- **Pause** — temporarily halt the operation
- **Resume** — continue from where you left off
- **Cancel** — abort the operation

Controls appear in the status bar whenever an operation is running.

### Theme Toggle

Switch between dark mode, light mode, and auto (system preference) from the top bar.

![Dark Theme](docs/screenshots/ui/theme-dark.png)
![Light Theme](docs/screenshots/ui/theme-light.png)

### Additional Features

- **Donation Wall** — Ko-Fi supporter feed with tier system and leaderboard
- **Ideas & Contact** — direct links to email and GitHub issues
- **Announcements** — in-app announcements rendered from GitHub-hosted markdown, with a version-aware re-trigger so users see fresh announcements once
- **Role Colors & Icons** — author names colored by highest-position role, with role icons next to author names in the feed and user profiles
- **Copy to Clipboard** — copy server, channel, or DM lists
- **Error Logging** — persistent error log with download capability
- **Tab Close Protection** — warns when closing tab during active operations

---

## Web App vs Extension

| Feature | Web App | Extension (Chrome / Firefox) |
|---------|---------|-----------|
| Authentication | Manual token entry | Auto-retrieves from Discord |
| "Other files" media type | Not available | Available |
| Overlay on Discord | No | Yes (iframe overlay) |
| Minimize to floating tab | No | Yes |
| Settings storage | localStorage | Browser extension storage |
| Installation | None (visit URL) | Install from Web Store / Add-ons |
| Auto-update | Always latest | Browser auto-updates |
| Discrub Classic | Not available | Built-in — select from launcher splash screen |

Both versions use the same codebase and make identical API calls from your browser. The extension includes Discrub Classic (the original interface) as a built-in option — when you first launch Discrub, a splash screen lets you choose between Discrub 2.0 and Discrub Classic. Your choice is remembered for future sessions.

---

## Getting Started

### Web App

1. Visit the hosted Discrub app
2. Get your Discord token:
   - Open Discord in your browser
   - Press `F12` to open DevTools
   - Go to the **Network** tab
   - Click on any request to `discord.com/api`
   - Find the `Authorization` header value — that's your token
3. Paste your token on the Discrub landing page
4. Browse your servers and start exporting!

### Extension (Chrome)

1. Install from the Chrome Web Store (or [load manually](#still-prefer-discrub-classic))
2. Navigate to [discord.com](https://discord.com)
3. Click the Discrub icon on the page — a launcher splash screen appears
4. Choose **Discrub 2.0** (modern interface) or **Discrub Classic** (original interface)
5. Discrub auto-retrieves your Discord token and loads the selected version

### Extension (Firefox)

1. Install from Firefox Add-ons (or [load manually](#still-prefer-discrub-classic))
2. Navigate to [discord.com](https://discord.com)
3. Same launcher and auto-authentication as Chrome

---

## Upgrading from Discrub Classic

If you're coming from Discrub Classic, see the [Onboarding Guide](ONBOARDING.md) for a detailed walkthrough of what's new, what's changed, and how to get the most out of the new version.

### Still prefer Discrub Classic?

You can manually install the legacy extension from the [releases page](https://github.com/prathercc/discrub-ext/releases):

**Chrome:**
1. Download the latest Chrome `.zip` from [Releases](https://github.com/prathercc/discrub-ext/releases)
2. Extract the ZIP file
3. Open Chrome and navigate to `chrome://extensions`
4. Enable **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked**
6. Select the extracted folder
7. Navigate to [discord.com](https://discord.com) — the Discrub Classic overlay will appear

**Firefox:**
1. Download the latest Firefox `.zip` from [Releases](https://github.com/prathercc/discrub-ext/releases)
2. Extract the ZIP file
3. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on**
5. Select any file inside the extracted folder (e.g., `manifest.json`)
6. Navigate to [discord.com](https://discord.com) — the Discrub Classic overlay will appear

> Note: Firefox temporary add-ons are removed when the browser closes. For persistent installation, the add-on must be signed or installed from Firefox Add-ons.

---

## Development

Build and tooling notes for project development and source-level review.
Official Discrub distributions are the Chrome Web Store and Firefox Add-ons
listings — see [Getting Started](#getting-started).

### Prerequisites

- Node.js 18+
- npm

### Install Dependencies

```bash
npm install --legacy-peer-deps
```

> The `--legacy-peer-deps` flag is required due to a date-fns peer dependency conflict.

### Development Server

```bash
npm run dev
```

Opens at `http://localhost:3000`. Set `VITE_DISCORD_TOKEN` in a `.env` file for auto-authentication during development.

### Production Build

```bash
npm run build
```

Output in `dist/`.

### Extension Build

```bash
# Chrome
npm run build:extension:chrome

# Firefox
npm run build:extension:firefox

# Both
npm run build:extension
```

### Run Tests

```bash
# Unit tests (Vitest)
npm test

# E2E tests (Cypress — requires dev server running)
npm run cy:run

# Cross-browser E2E
npm run cy:run:cross-browser

# Storybook
npm run storybook
```

### Regenerate Documentation Screenshots

```bash
npm run demo:screenshots
```

Runs the demo Cypress spec and copies screenshots to `docs/screenshots/`.

---

## FAQ

### Is Discrub safe to use?

Yes. Discrub runs entirely in your browser — your Discord token never leaves your device. There is no backend server, no data collection, no analytics. All Discord API calls originate from your browser's IP address, the same as if you were using Discord directly.

### Will I get rate limited?

Discrub includes configurable delays between API calls (default: 1s search, 2s delete) with randomization to avoid patterns. If Discord does rate limit you (HTTP 429), Discrub automatically waits the required `retry_after` duration before retrying. You can adjust delays in Settings > Operation Delays.

### What about Discord's Terms of Service?

Discrub uses your own user token to access data you already have permission to see. It does not automate account creation, mass-DM, spam, or any abusive behavior. It's a data management tool for your own account.

### Why not use a bot instead?

Bots require server admin permissions to be added, and they use a different authentication flow. Discrub works with your personal user token, giving you access to everything you can already see — including DMs, which bots cannot access.

### Can I export DMs?

Yes. Switch to the DMs tab, select a conversation, and export like any channel.

### What's the difference between Standard and Discord Layout templates?

**Discord Layout** (default) wraps the export in a Discord-like interface with a server sidebar, channel navigation, and theme toggle — ideal for bulk exports where you want to browse between channels. **Standard** produces clean, standalone HTML pages without the shell wrapper.

### Why can't I see some channels?

Channels you lack permission to view are shown with a lock icon and dimmed appearance. This is based on your Discord permissions (role-based, with channel-specific overwrite support). Admin users see all channels.

### Can I export media and attachments?

Yes. In the export dialog, expand "Files & Media" to enable media download. You can toggle individual types (images, videos, audio). Media is downloaded from Discord's CDN and included in the export ZIP.

> **Note:** The "Other files" type (PDFs, ZIPs, etc.) is only available in extension mode due to browser CORS restrictions on non-media file downloads.

### Is there a message limit?

No practical limit. Discord's search API returns up to 5,000 results per query, but Discrub automatically continues past this boundary by adjusting the search window. The "Load All" feature uses cursor-based pagination with no limit. You can export or purge entire channels regardless of size.

### Can I purge other users' messages or reactions?

Purging other users' messages requires the **Manage Messages** permission in that channel. Without it, you can only delete your own messages. The same applies to reactions — you can always remove your own reactions, but removing others' requires Manage Messages.

### How do I pause or cancel an operation?

When any operation is running (export, purge, delete, etc.), pause and cancel buttons appear in the status bar at the bottom of the screen. Pausing suspends the operation; you can resume or cancel from there.

### Does Discrub support forum channels?

Yes. Forum channels (and media channels) are fully supported. Discrub discovers archived threads (public and private), displays them in a thread list view, and exports each thread's messages individually.

### What happens if I close the tab during an export?

Discrub shows a browser warning before closing the tab during any active operation. If you dismiss the warning and close anyway, the operation is lost and any partial export data is discarded.

### Can multiple people use Discrub on the same server?

Yes. Each user runs Discrub independently in their own browser with their own token. There's no shared state, no server-side component, and no interference between users. Rate limits apply per-user.

### How do I report bugs or request features?

Use the Ideas & Contact button in the app (available in the "More" menu in the top bar) to send an email.

### How do I update Discrub?

- **Web app:** Always serves the latest version — just refresh the page
- **Extension:** Chrome and Firefox auto-update extensions. For manual installs, re-download from the releases page

### Does Discrub work offline?

No. Discrub requires an active internet connection to communicate with Discord's API. However, exported files (HTML, CSV, JSON) work fully offline once downloaded.

### What browsers are supported?

Discrub works in any modern browser (Chrome, Firefox, Edge, Brave, Safari). The extension is available for Chrome and Firefox. E2E tests are run against both Chrome and Firefox.

### What is the "Other files" media type?

This refers to non-media attachments like PDFs, ZIP files, documents, etc. Due to browser CORS restrictions, these can only be downloaded in extension mode (where the extension has permission to fetch from any origin). In web app mode, only images, videos, and audio are downloadable.

### How are role colors determined?

Discrub displays author names in the color of their highest-position role that has a non-zero color — the same logic Discord uses. Role icons (custom images or unicode emojis) from the highest-position role are also shown next to author names.

---

## Tech Stack

- **React 18** + **TypeScript** + **Vite**
- **Redux Toolkit** for state management
- **Material UI (MUI)** for components
- **discrub-core** for Discord API communication
- **Vitest** for unit testing (2885+ tests)
- **Cypress** for E2E testing (570+ tests across 33 specs)
- **Storybook** for component development (34 stories)

---

## License

All rights reserved. © 2026 prathercc.

The source code in this repository is publicly visible for transparency and
security review. Discrub is officially distributed via the Chrome Web Store and
Firefox Add-ons; those are the supported ways to use it.

"Discrub" and the Discrub logo are trademarks of prathercc and may not be used
in derivative or competing works.

---

Built by [@prathercc](https://github.com/prathercc)
