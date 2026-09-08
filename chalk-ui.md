# Chalk — UI Design System

A practical UI reference for building Chalk: navigation pattern, button system, motion, typography, and a full light + dark theme token set (with a theme toggle in the product, both modes need to be first-class, not an inverted afterthought).

---

## 1. Navigation Pattern — "The Rail," Not a Sidebar

A boxed, full-height, permanently-open left sidebar is the single most templated navigation shape in every AI chat product right now — it's the correct *information architecture* (Chalk's chat list can grow unbounded, so it does need a scannable, persistent list), but the flat rectangular panel is the orthodox part, not the structure itself. Chalk keeps the structure and replaces the shape and interaction model with something specific to the product: a chat tool literally about a piece of chalk and a rail/ledge it rests on.

**Concept: a floating, detached "chalk rail" dock + a keyboard-first command surface, no boxed sidebar and no heavy top bar at all.**

### Desktop (≥1024px)

- **The Rail**: a slim, *detached* vertical capsule (not flush to the viewport edge — floats with ~16px margin, rounded-full ends, subtle elevation) running down the left side, icon-only by default (~56px wide). It holds, top to bottom: New Chat, Chats (opens the command surface below), Library/Documents, Settings, Theme toggle. Icons magnify slightly and reveal a label pill on hover (dock-style proximity effect), rather than the rail permanently expanding into a wide text panel. This keeps the canvas — the actual conversation — as the visual focus, which matters for a study tool where screen space is spent reading, not browsing chrome.
- **New Chat** is not a labeled rectangular button sitting inside the rail like every other icon — it's the one deliberately different element: a solid filled circle styled like a chalk stick end-on, slightly larger than the other icons, with its own accent color. This is the "spend your boldness in one place" element; everything else in the rail stays quiet.
- **No permanent chat list panel.** Instead, clicking "Chats" (or `⌘K` / `Ctrl+K` from anywhere) opens a **centered floating command surface** — a search-first overlay listing recent chats with fuzzy title search, inline rename/delete on hover, and keyboard navigation (arrow keys + Enter). This is the actually unorthodox move: chat switching becomes a deliberate, fast, keyboard-driven action instead of a passive list you scan with your eyes at all times. Power users (your target — competitive programmers, students under time pressure) generally prefer this once they learn `⌘K`, and it removes a permanently-occupied 260px of screen width that a boxed sidebar costs you.
- **No heavy top bar strip.** Mode controls float instead: a small pill-shaped segmented control (Focus / Explore) and a second pill (Speed / Balanced / Accuracy) sit centered at the top of the message thread itself, not anchored in a full-width bar. The chat title sits to the left of these pills, click-to-rename inline, no separate toolbar row. Document count/ingestion status becomes a small badge attached to the input box at the bottom, where the student actually acts on it (adding more documents), rather than living in a disconnected header.

```
Desktop (≥1024px)
┌──┐                                              ┌──┐
│●│  ← New Chat (chalk-stick accent)              │  │
│  │                                               │  │
│⌘K│  ← opens command surface                     │  │
│  │                                               │  │
│📄│  ← Library                                    │  │
│  │           Chat Title            [Focus|Explore]   │
│⚙│           [Speed · Balanced · Accuracy]       │  │
│  │                                               │  │
│☾│  ← theme toggle    (message thread, full width)│  │
└──┘                                              └──┘
 ↑ detached rail,                     [ + Add docs   input box   ↑ ]
   floats free of the edge
```

### Tablet (768–1023px)

- The rail collapses its labels entirely (already icon-only, so little changes) but shrinks its margin from the edge and reduces to ~48px width.
- The mode-control pills stay centered but shrink to icon+abbreviation instead of full words ("F / E", "S / B / A") to conserve width.

### Mobile (<768px)

- The floating rail is replaced by a **floating bottom dock** — the same capsule shape, rotated into a horizontal pill anchored in the thumb-reachable zone (bottom-center, ~16px above the input box, not edge-to-edge). Holds only the highest-frequency actions: New Chat (chalk-stick accent, center position — thumb's natural resting point), Chats (opens command surface as a **bottom sheet** rather than a centered modal, sliding up over 70% of the viewport), and Settings.
- Mode toggles (Focus/Explore, Speed/Accuracy) move into a single tap target next to the chat title at the very top — tapping opens a small popover with both pill controls stacked, rather than trying to fit both permanently on a narrow screen.
- The command surface, when opened on mobile, defaults to showing recent chats immediately (no typing required) with the search field pre-focused, since typing a query is optional but the list should be instantly usable.
- Standard safe-area padding applies so the floating dock never collides with iOS/Android home-gesture zones.

This structure is still fully "sidebar-equivalent" in function — nothing is lost — but nothing about its shape, position, or interaction reads as the default boxed-panel-plus-topbar every other AI chat clone ships with.

---

## 2. Button System

Use a strict three-tier hierarchy, and never more than one primary button visible in a given view — establishing clear hierarchy prevents user confusion and decision fatigue.

| Tier | Use for | Style |
|---|---|---|
| **Primary** | The one highest-priority action per view (Send message, New Chat, Ingest Documents) | Solid fill, primary color, white text |
| **Secondary** | Supporting actions (Cancel, Rename, Change mode) | Outlined or subtle-fill, primary-color text |
| **Tertiary / Ghost** | Low-emphasis actions (Delete chat from a menu, Copy citation) | Text-only, no border, muted color until hover |
| **Destructive** | Delete chat, delete document, clear history | Red fill or red text — reserved *only* for irreversible/data-loss actions, per standard convention that red signals caution |

**Rules to follow:**
- Short, specific, verb-led labels ("Ingest Documents", not "Submit" or "Click Here").
- Every button needs visible states: default, hover, pressed/active, disabled, loading — not just a single static look.
- Minimum touch target ~44–48px on any tappable control, even on desktop, so the mobile web view doesn't need a separate button system.
- Keep button sizing consistent within the same form/toolbar (don't mix a large primary button with a tiny secondary one in the same row).
- Primary action placed on the right in message/dialog rows (left-to-right reading convention), except the persistent "New Chat" button, which stays top-of-sidebar since it's the entry point, not a dialog action.

---

## 3. Motion & Micro-interactions

Keep animation purposeful and fast — this is a study tool, not a marketing site; motion should confirm actions and guide attention, never slow the user down.

- **Timing**: 100–300ms for most UI feedback (button press, toggle switch, hover state). Anything longer starts to feel laggy in a tool used for rapid back-and-forth study sessions.
- **Streaming responses**: token-by-token or chunk-by-chunk text reveal for LLM answers (matches user expectation from every modern AI chat product) — never a full-block "typing then dump" pattern.
- **Message send**: input box briefly compresses/settles as the message enters the thread (subtle, not bouncy).
- **Ingestion progress**: an animated progress indicator per-document (e.g. "Extracting → Chunking → Embedding → Ready") rather than a single spinner, since ingestion is multi-stage and can take a while — visible stage progress reduces perceived wait time.
- **Mode toggle (Focus/Explore)**: an instant, deliberate color-shift transition on the toggle itself, reinforcing that this is a meaningful state change, not decoration.
- **The Rail (desktop)**: icon proximity-magnify on hover (subtle, ~1.15x scale, spring easing, not linear) with the label pill sliding out from behind the icon rather than fading in place — this is the one "alive" chrome element in the product, matching the dock concept in Section 1.
- **Command surface (`⌘K`)**: opens with a quick scale-and-fade from center (150–200ms), backdrop dims rather than blurs (blur is expensive and reads as decoration here); closes just as fast on selection or Escape — this is a utility, not a moment to linger on.
- **Bottom dock / bottom sheet (mobile)**: the chat-list sheet slides up from the bottom edge with a slight overshoot-then-settle (spring, not ease-out), signaling it's a physical sheet being pulled into view, not a modal fading in.
- **Low-confidence / "not in notes" response**: a distinct, calmer entrance (no bounce, slightly muted color) — this is a "the app is being honest with you" moment, not an error, so it shouldn't feel alarming.
- Respect `prefers-reduced-motion` — disable non-essential animation for users who request it at the OS level.

---

## 4. Typography

**Recommended pairing: Plus Jakarta Sans (headings/UI labels) + Inter (body/message text)** — a pairing built for modern SaaS products, giving headings a bit of warmth and personality while keeping body/reading text crisp and efficient, which matters here since students will be reading long LLM answers for extended study sessions. Inter in particular is the most battle-tested UI body font for dense, information-heavy screens, and both are free (Google Fonts), variable-weight, and screen-optimized.

**Alternative if you want something slightly more distinctive:** Outfit (headings, using its bold 700–800 weights) + Work Sans (body) — Outfit's variable weight range goes from thin body text to bold headlines while Work Sans stays grounded and practical for reading-heavy screens.

**Type scale (rem, 16px base):**

| Token | Size | Weight | Use |
|---|---|---|---|
| `text-xs` | 0.75rem | 400 | Timestamps, metadata, citation labels |
| `text-sm` | 0.875rem | 400 | Secondary UI text, sidebar chat list |
| `text-base` | 1rem | 400 | Chat message body |
| `text-lg` | 1.125rem | 500 | Section headers within a chat |
| `text-xl` | 1.5rem | 600 | Page/panel titles |
| `text-2xl` | 2rem | 700 | Empty-state / onboarding headlines |

Monospace (e.g. **JetBrains Mono**) reserved for any code blocks the LLM outputs (relevant for CS-adjacent coursework) — don't use it anywhere else.

---

## 5. Theme Tokens — Light & Dark Mode

Using your palette as the core neutral + primary system:

| Name | Hex | Role in the system |
|---|---|---|
| Charcoal | `#323031` | Darkest neutral — dark-mode base, light-mode text |
| Slate | `#3D3B3C` | Dark-mode surface |
| Stone | `#7F7979` | Mid neutral — secondary text in both modes |
| Chalk | `#C1BDB3` | Lightest neutral — light-mode surface/border, **dark-mode text** |
| Dusk | `#5F5B6B` | The one non-neutral hue — primary/accent in both modes |

There's a nice literal payoff here: in dark mode, primary text renders in **Chalk (`#C1BDB3`) on a Charcoal (`#323031`) background** — chalk-on-blackboard, which is about as on-brand as a palette gets without being cartoonish about it.

Your five colors don't include the extra hues needed for semantic states (grounded-vs-external citation chips, warnings, errors) — those need to stay visually distinct from each other and from neutral text for colorblind users, which a monochrome set can't do alone. I've added four low-saturation, warm-muted hues that sit in the same desaturated register as Dusk rather than reaching for bright saturated colors that would clash with the palette's quiet character. Flagged clearly below — swap them if you have preferences.

Dark mode is not just an inverted palette: pure black/white are avoided (your palette already avoids them — Charcoal and Chalk are both warm, not clinical), accents are kept desaturated so they don't vibrate on the dark surface, and elevation is built from progressively lighter surface tones rather than shadows (which barely read on dark backgrounds).

### Light mode

| Token | Hex | Role |
|---|---|---|
| `bg-base` | `#EDEAE4` | App background *(tint of Chalk)* |
| `bg-surface` | `#FAF9F6` | Cards, message bubbles *(near-white, warm)* |
| `bg-surface-raised` | `#FFFFFF` | Modals, dropdowns, hover rows |
| `border-subtle` | `#C1BDB3` | Dividers, input borders — Chalk itself |
| `text-primary` | `#323031` | Main text — Charcoal |
| `text-secondary` | `#7F7979` | Metadata, timestamps — Stone |
| `primary` | `#5F5B6B` | Primary buttons, links, active states — Dusk |
| `primary-hover` | `#4A4757` | Primary hover/active *(darkened Dusk)* |
| `focus-mode` *(added)* | `#7C8B6F` | Focus-mode indicator, grounded-citation chips (muted sage) |
| `explore-mode` *(added)* | `#6B7B8C` | Explore-mode indicator, web-sourced chips (dusty blue) |
| `warning` *(added)* | `#B08D57` | Low-confidence banners (muted ochre) |
| `error` *(added)* | `#A65A4B` | Destructive actions (muted brick) |

### Dark mode

| Token | Hex | Role |
|---|---|---|
| `bg-base` | `#323031` | App background — Charcoal |
| `bg-surface` | `#3D3B3C` | Cards, message bubbles — Slate |
| `bg-surface-raised` | `#494647` | Modals, dropdowns, hover rows *(lightened Slate, for elevation)* |
| `border-subtle` | `#5F5B6B` | Dividers, input borders — Dusk |
| `text-primary` | `#C1BDB3` | Main text — Chalk-on-Charcoal |
| `text-secondary` | `#7F7979` | Metadata, timestamps — Stone |
| `primary` | `#A39FB0` | Primary buttons, links *(lightened Dusk for dark-surface contrast)* |
| `primary-hover` | `#8F8AA0` | Primary hover/active |
| `focus-mode` *(added)* | `#9AAB8C` | Focus-mode indicator *(lightened sage)* |
| `explore-mode` *(added)* | `#8B9DAE` | Explore-mode indicator *(lightened dusty blue)* |
| `warning` *(added)* | `#C9A876` | Low-confidence banners *(lightened ochre)* |
| `error` *(added)* | `#C17C6E` | Destructive actions *(lightened brick)* |

### CSS variable implementation

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

Toggle by setting `data-theme="dark"` on `<html>` (or `document.documentElement`), stored in `localStorage`/user settings so it persists across sessions, and initialized from `prefers-color-scheme` on first visit only.

---

## 6. Chat-Specific UI Patterns

- **Message bubbles**: user messages right-aligned on `bg-surface-raised`; assistant messages left-aligned, full-width or near-full-width (not bubble-constrained) since answers are often long — this matches the reading-heavy nature of study content better than a narrow chat-bubble width.
- **Citation chips**: inline, small pill-shaped tags (`[Doc: Chapter 4 Notes, p.12]`) using `focus-mode` green in Focus answers and `explore-mode` cyan for any web-sourced addition in Explore answers — this is the single most important visual signal in the whole product, so give it a dedicated, consistent chip style rather than plain inline text.
- **"Not in your notes" response**: rendered in a calm, bordered callout (not a red error box) using `text-secondary` + a subtle `border-subtle` outline — it's an honest answer, not a failure state.
- **Ingestion panel**: per-document row showing filename, page count once known, and a 4-stage progress indicator (Uploading → Extracting → Chunking → Embedding), with a green checkmark on completion.
- **Empty state (new chat, no documents yet)**: large, friendly prompt — "Ingest your notes to start studying" — with the ingest button as the single primary action on screen, since a new chat is unusable until this happens.
