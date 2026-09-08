---
name: chalk-ui
description: >-
  Use this skill when working on Chalk's frontend, UI components, styling, theming,
  responsive layouts, or any visual/design work. Covers the navigation rail, button system,
  motion/micro-interactions, typography, light/dark theme tokens, and chat-specific UI patterns
  like citation chips, message bubbles, ingestion progress, and the command surface.
---

# Chalk UI Design System

## Navigation — "The Rail," Not a Sidebar

Chalk uses a floating, detached dock + keyboard-first command surface instead of a boxed sidebar.

### Desktop (≥1024px)
- **The Rail**: slim, detached vertical capsule (~56px wide), floating with ~16px margin, rounded-full ends, subtle elevation. Icon-only by default.
- Contains (top to bottom): New Chat, Chats (⌘K), Library/Documents, Settings, Theme toggle
- **New Chat**: solid filled circle styled like a chalk stick end-on, slightly larger, accent color — the one bold element
- Icons magnify slightly on hover (dock-style proximity, ~1.15x, spring easing) with label pill sliding out
- **No permanent chat list panel** — clicking Chats or `⌘K`/`Ctrl+K` opens a centered floating command surface with fuzzy search, inline rename/delete, keyboard navigation
- **No heavy top bar** — mode controls float as pill-shaped segmented controls centered at top of message thread
  - Focus / Explore pill
  - Speed / Balanced / Accuracy pill
  - Chat title to the left, click-to-rename inline
- Document count/ingestion status: small badge on input box at bottom

### Tablet (768–1023px)
- Rail shrinks to ~48px, reduces margin
- Mode pills shrink to abbreviations ("F / E", "S / B / A")

### Mobile (<768px)
- Rail replaced by **floating bottom dock** — horizontal pill, bottom-center, ~16px above input
- Holds: New Chat (center, accent), Chats (opens bottom sheet, 70% viewport), Settings
- Mode toggles: single tap target next to chat title → popover with both pill controls stacked
- Command surface defaults to showing recent chats immediately, search field pre-focused

---

## Button System (Three Tiers)

| Tier | Use | Style |
|---|---|---|
| **Primary** | One highest-priority action per view (Send, New Chat, Ingest) | Solid fill, primary color, white text |
| **Secondary** | Supporting actions (Cancel, Rename, Change mode) | Outlined or subtle-fill, primary-color text |
| **Tertiary/Ghost** | Low-emphasis (Delete from menu, Copy citation) | Text-only, no border, muted until hover |
| **Destructive** | Delete, clear history — irreversible/data-loss ONLY | Red fill or text, reserved for caution |

**Rules:**
- Verb-led labels ("Ingest Documents", not "Submit")
- All states: default, hover, pressed, disabled, loading
- Min touch target ~44–48px on all controls
- Consistent sizing within the same form/toolbar
- Primary action on the right in dialog rows

---

## Motion & Micro-interactions

Keep animation fast and purposeful — 100–300ms for most UI feedback.

| Element | Behavior |
|---|---|
| **Streaming responses** | Token/chunk-by-chunk text reveal |
| **Message send** | Input box briefly compresses/settles |
| **Ingestion progress** | Animated multi-stage: Extracting → Chunking → Embedding → Ready |
| **Mode toggle** | Instant color-shift transition |
| **Rail icons** | Proximity-magnify on hover (~1.15x, spring), label pill slides out |
| **Command surface** | Quick scale-and-fade from center (150–200ms), backdrop dims (not blur) |
| **Mobile bottom sheet** | Slides up with slight overshoot-then-settle (spring) |
| **"Not in notes" response** | Calmer entrance, no bounce, slightly muted color |

Always respect `prefers-reduced-motion`.

---

## Typography

**Primary pairing**: Plus Jakarta Sans (headings/UI labels) + Inter (body/messages)

| Token | Size | Weight | Use |
|---|---|---|---|
| `text-xs` | 0.75rem | 400 | Timestamps, metadata, citation labels |
| `text-sm` | 0.875rem | 400 | Secondary UI text, sidebar chat list |
| `text-base` | 1rem | 400 | Chat message body |
| `text-lg` | 1.125rem | 500 | Section headers within chat |
| `text-xl` | 1.5rem | 600 | Page/panel titles |
| `text-2xl` | 2rem | 700 | Empty-state / onboarding headlines |

**JetBrains Mono** for code blocks only.

---

## Theme Tokens

### Core Palette

| Name | Hex | Role |
|---|---|---|
| Charcoal | `#323031` | Darkest neutral — dark-mode base, light-mode text |
| Slate | `#3D3B3C` | Dark-mode surface |
| Stone | `#7F7979` | Mid neutral — secondary text both modes |
| Chalk | `#C1BDB3` | Lightest neutral — light-mode surface/border, dark-mode text |
| Dusk | `#5F5B6B` | Primary/accent in both modes |

Dark mode renders **Chalk on Charcoal** — chalk-on-blackboard, literally on-brand.

### Light Mode Tokens

| Token | Hex | Role |
|---|---|---|
| `--bg-base` | `#EDEAE4` | App background |
| `--bg-surface` | `#FAF9F6` | Cards, message bubbles |
| `--bg-surface-raised` | `#FFFFFF` | Modals, dropdowns, hover rows |
| `--border-subtle` | `#C1BDB3` | Dividers, input borders |
| `--text-primary` | `#323031` | Main text |
| `--text-secondary` | `#7F7979` | Metadata, timestamps |
| `--color-primary` | `#5F5B6B` | Buttons, links, active states |
| `--color-primary-hover` | `#4A4757` | Primary hover/active |
| `--focus-mode` | `#7C8B6F` | Focus indicator, grounded-citation chips (muted sage) |
| `--explore-mode` | `#6B7B8C` | Explore indicator, web-sourced chips (dusty blue) |
| `--warning` | `#B08D57` | Low-confidence banners (muted ochre) |
| `--error` | `#A65A4B` | Destructive actions (muted brick) |

### Dark Mode Tokens

| Token | Hex | Role |
|---|---|---|
| `--bg-base` | `#323031` | App background |
| `--bg-surface` | `#3D3B3C` | Cards, message bubbles |
| `--bg-surface-raised` | `#494647` | Modals, dropdowns, hover rows |
| `--border-subtle` | `#5F5B6B` | Dividers, input borders |
| `--text-primary` | `#C1BDB3` | Main text |
| `--text-secondary` | `#7F7979` | Metadata, timestamps |
| `--color-primary` | `#A39FB0` | Buttons, links |
| `--color-primary-hover` | `#8F8AA0` | Primary hover/active |
| `--focus-mode` | `#9AAB8C` | Focus indicator |
| `--explore-mode` | `#8B9DAE` | Explore indicator |
| `--warning` | `#C9A876` | Low-confidence banners |
| `--error` | `#C17C6E` | Destructive actions |

### CSS Implementation

```css
:root {
  --bg-base: #EDEAE4;
  --bg-surface: #FAF9F6;
  --bg-surface-raised: #FFFFFF;
  --border-subtle: #C1BDB3;
  --text-primary: #323031;
  --text-secondary: #7F7979;
  --color-primary: #5F5B6B;
  --color-primary-hover: #4A4757;
  --focus-mode: #7C8B6F;
  --explore-mode: #6B7B8C;
  --warning: #B08D57;
  --error: #A65A4B;
}

[data-theme="dark"] {
  --bg-base: #323031;
  --bg-surface: #3D3B3C;
  --bg-surface-raised: #494647;
  --border-subtle: #5F5B6B;
  --text-primary: #C1BDB3;
  --text-secondary: #7F7979;
  --color-primary: #A39FB0;
  --color-primary-hover: #8F8AA0;
  --focus-mode: #9AAB8C;
  --explore-mode: #8B9DAE;
  --warning: #C9A876;
  --error: #C17C6E;
}
```

Toggle via `data-theme="dark"` on `<html>`. Persist in `localStorage`, initialize from `prefers-color-scheme` on first visit.

---

## Chat-Specific UI Patterns

- **Message bubbles**: User messages right-aligned on `bg-surface-raised`. Assistant messages left-aligned, full/near-full width (not bubble-constrained — study answers are long)
- **Citation chips**: Inline pill-shaped `[Doc: Chapter 4 Notes, p.12]` using `--focus-mode` green in Focus, `--explore-mode` blue for web-sourced in Explore
- **"Not in your notes"**: Calm bordered callout with `text-secondary` + `border-subtle` outline — honest answer, not an error
- **Ingestion panel**: Per-document row: filename, page count, 4-stage progress (Uploading → Extracting → Chunking → Embedding), green checkmark on completion
- **Empty state**: "Ingest your notes to start studying" with ingest button as the single primary action
