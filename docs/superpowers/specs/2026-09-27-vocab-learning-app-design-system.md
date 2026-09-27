# Vocab Learning App — Design System

Date: 2026-09-27
Status: Proposal
Companion to: `2026-09-27-vocab-learning-app-design.md`

## 0. Scope Note

This is a product app (Auth / Library / Quiz / Dashboard — sidebar layout, forms,
card grids, data lists, quiz flows), not a landing page, portfolio, or marketing
site. Landing-page-specific rules (hero composition, marquees, bento rhythm,
scroll choreography, eyebrows, section-layout variety) don't apply and are
skipped. What's kept: color/type tokens, dark mode, contrast, icon discipline,
motion restraint, empty/loading/error states — the parts that generalize to any
UI surface.

**Design read:** personal / small-group vocab-learning app, shadcn/ui + Tailwind
(already decided in the design spec), minimal and low-distraction, calm accent
instead of a default AI-purple glow.

## 1. Foundation

- **shadcn/ui**, base color **zinc**, Tailwind v4 (CSS-based theme, no
  `tailwind.config.js` needed for tokens).
- **Style:** originally specified as **"new-york"** here, but the shadcn CLI
  has since replaced the old `style`/`baseColor` system with a set of
  presets, and `new-york` is no longer one of the available options — there
  is no supported way to pin it anymore. This project uses whatever the
  installed CLI (`shadcn@4.21.0` at last check) produces under its
  `radix-nova` preset instead, recorded as-is in `components.json`. The
  design tokens in §2 below are unaffected by this and already match exactly
  regardless of which style preset generated the primitives.
- Single accent color across the whole app (see §2) — every primary button,
  active nav item, focus ring, and link uses it. No second accent introduced
  later for "variety."
- Single corner-radius scale: `--radius: 0.625rem` (10px) applied via shadcn's
  `sm`/`md`/`lg`/`xl` radius vars (all derived from the one root value). Buttons,
  cards, inputs, dialogs all resolve from this one token — never hand-picked
  per component.

```bash
npx shadcn@latest init   # base color: zinc, css variables: yes (style is a CLI-chosen preset — see note above)
npx shadcn@latest add button card dialog input label badge table skeleton \
  toast sonner dropdown-menu avatar separator sidebar form
```

## 2. Color Tokens

Neutral zinc base (shadcn default) with one accent overridden: a clear blue,
not violet, to stay away from the generic AI-purple tell. Both light and dark
defined from the start; default to `prefers-color-scheme`, with a manual
toggle in the user menu (see §7).

```css
/* globals.css */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);

  --primary: oklch(0.55 0.22 258);        /* calm blue accent, not violet */
  --primary-foreground: oklch(0.985 0 0);

  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);

  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.55 0.22 258 / 0.5);      /* matches primary */

  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);

  --primary: oklch(0.65 0.19 258);        /* lighter, same hue */
  --primary-foreground: oklch(0.145 0 0);

  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);

  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.65 0.19 258 / 0.5);
}
```

Rules:
- No pure `#000`/`#fff` — the zinc-based near-black/near-white above already
  avoids this.
- `--primary-foreground` is checked against `--primary` for WCAG AA (4.5:1) in
  both modes before shipping any button.
- Badges (quiz question types, attempt status) use `--secondary`/`--muted`
  tones, never the accent — the accent stays reserved for actionable
  primary buttons and active states so it doesn't get diluted.

## 3. Typography

- **Geist Sans** for all UI text (headings, body, labels) via `next/font/google`
  or the `geist` npm package.
- **Geist Mono** for numeric/data values only: word counts, quiz scores,
  timestamps in attempt history, `currentIndex`/`totalQuestions` progress —
  anything meant to be scanned as a precise number.
- Scale (Tailwind utilities, applied consistently, not per-page invention):
  - Page title (`_pages` header, e.g. "Library"): `text-2xl font-semibold tracking-tight`
  - Section/card heading (folder name, quiz name): `text-lg font-medium`
  - Body: `text-sm text-muted-foreground` for secondary text, `text-sm` default for primary
  - Caption/meta (word count, last edited): `text-xs text-muted-foreground font-mono`
    (mono because these are numbers/dates)
- No serif anywhere — this is a utility product, not editorial content.

## 4. Icons

- **Phosphor icons** (`@phosphor-icons/react`), one family for the whole app —
  sidebar nav, buttons, empty states, the 🔊 pronunciation glyph.
- Weight: `regular` by default, `fill` for the active sidebar item only. No
  mixing with any other icon set.

## 5. Layout Shell

- Sidebar: fixed 240px on desktop (`lg:` and up), collapses to a top header
  with a hamburger-triggered sheet below `1024px`. Items: Dashboard, Library,
  Quiz.
- Header: 64px height, logo left, user avatar + dropdown (profile, theme
  toggle, logout) right. Single line, never wraps.
- Content container: `max-w-6xl mx-auto px-4 md:px-6`.
- Mobile (`< 768px`): sidebar becomes the sheet above; grids collapse to a
  single column; dialogs go full-screen (`Drawer` component instead of
  centered `Dialog`) for anything with more than 2 form fields (add-vocab,
  create-quiz).

## 6. Component Conventions

- **Card grids** (folders, quizzes): CSS Grid, `grid-cols-1 md:grid-cols-2
  xl:grid-cols-3 gap-4`. Card = name, meta line (word count / question count,
  last edited, in `font-mono text-xs text-muted-foreground`), no shadow —
  a single `border` plus `hover:border-primary/40` for affordance.
- **Vocab item list / attempt history**: `Table` component with a sticky
  header once a folder exceeds ~15 rows; below that, a simple `divide-y` list
  is fine — this is real tabular data the user scans, not marketing copy, so
  the "avoid divide-y" guidance from the marketing-page skill doesn't apply
  here.
- **Dialogs**: create-folder, add-vocab-manual, create-quiz all use shadcn
  `Dialog` (desktop) / `Drawer` (mobile per §5). Every field: label above
  input, helper text under the label when needed, error text below the input
  in `text-destructive text-xs`. No placeholder-as-label.
- **Badges**: question type (`meaning`/`word`/`sentence`) and attempt status
  (`in_progress`/`completed`) as small `secondary`-variant badges — never the
  accent color, so accent stays reserved for actions.
- **Empty states**: one Phosphor icon (muted), one line of copy naming what's
  missing, one primary-action button. E.g. empty folder → icon + "No words
  yet" + "Add words" button.
- **Loading**: `Skeleton` shaped like the real card/row layout for list pages.
  A small inline spinner only inside a submit button mid-request.
- **Toasts**: shadcn `sonner` for transient confirmations (saved, deleted,
  quiz submitted) — not for anything the user needs to act on.
- **Buttons**: one primary per view/dialog. Never two buttons with the same
  intent (e.g. don't have both a header "New folder" button and a duplicate
  "Create folder" button visible in the same view without an obvious reason).

## 7. Motion

Low intensity by design — this is a study tool, not a marketing surface.
- Rely on shadcn/Radix's built-in enter/exit transitions for dialogs, dropdowns,
  and toasts (already tuned, no extra library needed).
- List/card grids: a single fade-in on first paint only (Tailwind
  `animate-in fade-in` or Motion `whileInView` with `once: true`) — no
  perpetual loops, no parallax, no scroll hijacking.
- Everything respects `prefers-reduced-motion` — since motion here is already
  minimal (fades/slides on `transform`/`opacity` only), this is effectively
  free.

## 8. Dark Mode

- `next-themes` with `attribute="class"`, default `system`, manual toggle in
  the user menu (§5).
- Tokens are the CSS variables in §2 — no per-component hardcoded colors.
  Test every new component in both modes before calling it done.

## 9. What's Explicitly Not Used From the Parent Skill

Hero composition rules, hero stack/eyebrow limits, marquee caps, bento cell
counting, section-layout-repetition variety, scroll-pin/horizontal-pan
patterns, "trusted by" logo walls, quote-length limits — all landing-page
constructs that don't map onto a sidebar product app. If a future marketing
page (e.g. a public sign-up landing page) gets added to this project, those
rules apply there, not to the app shell described above.
