# Les Incollables -- Design System

Single source of truth for all UI decisions. Every color, font size, spacing,
glassmorphism treatment, and animation used in the app MUST come from this file
or from the Tailwind config that implements it (`tailwind.config.ts`, `globals.css`).

---

## Colors

### Primary (Blue)

Base: `#194ce6`

| Token        | Hex       | Usage                                  |
|--------------|-----------|----------------------------------------|
| primary-50   | `#EEF2FF` | Light backgrounds, hover states        |
| primary-100  | `#DBE4FF` | Subtle backgrounds                     |
| primary-200  | `#B8C9FF` | Borders, light accents                 |
| primary-500  | `#194ce6` | Main buttons, links, active states     |
| primary-600  | `#143DBF` | Hover on primary buttons               |
| primary-700  | `#102F99` | Active/pressed states                  |
| primary-900  | `#081A5C` | Dark text on light blue backgrounds    |

Tailwind usage: `bg-primary`, `bg-primary-50`, `text-primary-600`, etc.

### Secondary (Green)

Base: `#10B981`

| Token          | Hex       | Usage                        |
|----------------|-----------|------------------------------|
| secondary-50   | `#EFFCF6` | Success light background     |
| secondary-100  | `#D1FAE5` | Success backgrounds          |
| secondary-500  | `#10B981` | Correct answers, mastery     |
| secondary-600  | `#059669` | Hover on secondary buttons   |

### Neutral (Gray Scale)

| Token       | Hex       |
|-------------|-----------|
| neutral-50  | `#F9FAFB` |
| neutral-100 | `#F3F4F6` |
| neutral-200 | `#E5E7EB` |
| neutral-300 | `#D1D5DB` |
| neutral-400 | `#9CA3AF` |
| neutral-500 | `#6B7280` |
| neutral-700 | `#374151` |
| neutral-900 | `#111827` |

### Medical Accents

| Token          | Hex       | Usage                                     |
|----------------|-----------|-------------------------------------------|
| medical-teal   | `#0ea5e9` | Medical accent, confidence "Hésitant"     |
| medical-accent | `#38bdf8` | Secondary medical accent                  |

### Semantic Colors

| Token   | Hex       | Usage                                |
|---------|-----------|--------------------------------------|
| success | `#10B981` | Correct answers, completion          |
| error   | `#B91C1C` | Incorrect answers, errors (deep red) |
| warning | `#B45309` | Partial scores, warnings (deep amber)|
| info    | `#194ce6` | Informational (matches primary)      |

### Backgrounds

| Token            | Value     | Usage                                    |
|------------------|-----------|------------------------------------------|
| background-light | `#eef0f5` | Base page color (cool grey-blue)         |
| background-dark  | `#111521` | Reserved for future dark mode (not used) |
| bg-page-gradient | See below | Main content areas (student, admin, auth)|

Page background gradient (defined in `globals.css`):
```css
.bg-page-gradient {
  background:
    radial-gradient(ellipse at 15% 20%, rgba(25, 76, 230, 0.09) 0%, transparent 50%),
    radial-gradient(ellipse at 85% 70%, rgba(14, 165, 233, 0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(25, 76, 230, 0.04) 0%, transparent 65%),
    #eef0f5;
}
```

**Applied to:** Student layout `<main>`, admin layout `<main>`, login page, register page.

---

## Typography

### Font

| Property     | Value                                                         |
|--------------|---------------------------------------------------------------|
| Font family  | **Space Grotesk**                                             |
| Loading      | `next/font/google` with CSS variable `--font-space-grotesk`  |
| Tailwind     | `font-sans` and `font-display` (both map to Space Grotesk)   |
| Fallbacks    | system-ui, -apple-system, sans-serif                          |

### Typography Scale

| Pattern         | Classes                                                              | Usage                          |
|-----------------|----------------------------------------------------------------------|--------------------------------|
| Page title      | `text-[1.375rem] font-bold text-neutral-900 md:text-[1.75rem]`      | Mes résultats, S'entraîner, Base de données |
| Section heading | `text-[1.125rem] font-semibold text-neutral-900 md:text-[1.375rem]` | Progression, Historique, Calibration |
| Card title      | `text-base font-bold text-neutral-900 sm:text-lg`                   | Session terminée, Résultats    |
| Body text       | `text-sm text-neutral-500`                                          | Descriptions, subtitles        |
| Small label     | `text-[10px] font-bold uppercase tracking-widest text-neutral-400`  | SCORE HEBDO, NIVEAU DE CONFIANCE |
| Caption         | `text-xs text-neutral-400`                                          | Timestamps, metadata           |

---

## Page Layout

### Student pages
```html
<main className="flex-1 overflow-y-auto bg-page-gradient p-4 pb-20 md:p-6 md:pb-6">
  <div className="mx-auto max-w-2xl">
    <!-- page content -->
  </div>
</main>
```
- `max-w-2xl` (672px) centers content on desktop
- `pb-20` on mobile clears the floating bottom nav
- `pb-6` on desktop (no bottom nav)

### Admin pages
```html
<main className="bg-page-gradient flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
  <div className="mx-auto max-w-full px-1 md:px-4">
    <!-- admin content -->
  </div>
</main>
```
- Admin uses `max-w-full` (spreadsheet needs full width)

---

## Glassmorphism System

All cards, buttons, inputs, and containers use a glassmorphism design system.
Classes are defined in `globals.css` under `@layer components`.

### glass-card (Primary card container)

Used for: metric cards, chart containers, session history cards, topic chapters, quiz progress card, modals, score cards, all major card surfaces.

```css
.glass-card {
  background: rgba(255, 255, 255, 0.78);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.02),   /* subtle outline */
    0 2px 4px rgba(0, 0, 0, 0.03),    /* tight shadow */
    0 8px 24px rgba(0, 0, 0, 0.06),   /* diffused shadow */
    0 0 30px rgba(255, 255, 255, 0.8),/* white glow */
    inset 0 1px 0 rgba(255, 255, 255, 1); /* top light highlight */
}
```

### glass-card-inner (Nested/inner card)

Used for: sub-chapter items, review question rows, false certainty items, alert rows, admin inner panels. More transparent to create visual hierarchy.

```css
.glass-card-inner {
  background: rgba(255, 255, 255, 0.35);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 12px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.02),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
```

### glass-btn (Primary button enhancement)

Applied alongside `bg-primary` on primary action buttons.

```css
.glass-btn {
  border-radius: 16px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    0 4px 12px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
```

### glass-btn-secondary (Secondary/outline button)

```css
.glass-btn-secondary {
  background: rgba(255, 255, 255, 0.65);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
```

### glass-input (Form inputs and selects)

```css
.glass-input {
  background: rgba(255, 255, 255, 0.7);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.03),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}
```

---

## Border Radius

| Element          | Radius | Class/Source               |
|------------------|--------|----------------------------|
| Cards            | 16px   | `glass-card` (built-in)    |
| Inner cards      | 12px   | `glass-card-inner` (built-in) |
| Primary buttons  | 16px   | `rounded-2xl` + `glass-btn` |
| Secondary buttons| 16px   | `rounded-2xl` + `glass-btn-secondary` |
| Ghost buttons    | 16px   | `rounded-2xl`              |
| Inputs/selects   | 16px   | `glass-input` (built-in)   |
| Confidence btns  | 12px   | `rounded-xl`               |
| Pills/badges     | 9999px | `rounded-full`             |
| Mobile nav       | 20px   | Inline style               |
| UndoToast        | 12px   | `rounded-xl` (dark toast, exception) |

**Rule:** No `rounded-lg` (8px) on any user-facing button or card. Use `rounded-2xl` (16px) minimum.

---

## Shadows

Layered shadow system. Never use raw `shadow-md` or `shadow-lg` — always use glass classes.

| Element      | Layers | Description |
|--------------|--------|-------------|
| Cards        | 5      | outline (1px) + tight (2px) + diffused (8px) + white glow (30px) + inset highlight |
| Buttons      | 3      | tight (1px) + medium (4px) + inset highlight |
| Inputs       | 2      | tight (1px) + inset highlight |
| Inner cards  | 2      | tight (1px) + inset highlight |
| Mobile nav   | 3      | upward shadow (-2px) + white glow (40px) + inset highlight |

---

## Button Patterns

### Primary button
```html
<button className="rounded-2xl bg-primary glass-btn px-6 py-2.5 text-sm font-bold text-white hover:bg-primary/90 active:scale-[0.98] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none">
  Action
</button>
```

### Danger button
```html
<button className="rounded-2xl bg-error glass-btn px-4 py-2 text-sm font-semibold text-white shadow-error/25 hover:bg-red-700">
  Supprimer
</button>
```

### Secondary button
```html
<button className="rounded-2xl glass-btn-secondary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-50">
  Secondary
</button>
```

### Ghost/text button
```html
<button className="rounded-2xl px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-white/50">
  Ghost
</button>
```

### Spring physics (on CTA buttons)
```html
style={{ transition: 'transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
```
Applied with `active:scale-[0.98]` on Valider, Suivante, Démarrer buttons.

---

## Card Patterns

### Standard card
```html
<div className="glass-card p-4">Content</div>
```

### Card with colored left border (metric cards, session history)
```html
<div className="glass-card p-3" style={{ borderLeft: '4px solid #194ce6' }}>
  Content
</div>
```

### Inner/nested card (sub-chapters, review items)
```html
<div className="glass-card-inner p-2.5">Content</div>
```

### Card with tilt effect
```html
<TiltCard className="glass-card p-4" tiltDeg={6}>Content</TiltCard>          <!-- metric cards: snappy -->
<TiltCard className="glass-card p-4" tiltDeg={1.5} gentle>Content</TiltCard>  <!-- chart cards: gentle -->
```

TiltCard spring config:
- Normal: `{ stiffness: 300, damping: 20 }`, perspective 800px
- Gentle: `{ stiffness: 100, damping: 30 }`, perspective 800px
- Default tiltDeg: 3

---

## Input Patterns

### Student-facing input
```html
<input className="glass-input px-3 py-2 text-sm text-neutral-700 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
```

### Compact admin input
```html
<select className="h-7 rounded-lg border border-neutral-300 px-1.5 text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
```

### iOS zoom prevention
Use `text-base sm:text-sm` on mobile-facing `<input>` and `<select>` to prevent iOS Safari auto-zoom (16px minimum on mobile).

---

## Modal / Dialog Pattern

### Overlay
```html
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
```

### Modal card
```html
<div className="mx-4 w-full max-w-sm glass-card p-6">
  <h2>Title</h2>
  <p>Content</p>
  <div className="mt-5 flex gap-3">
    <button className="flex-1 rounded-2xl glass-btn-secondary ...">Cancel</button>
    <button className="flex-1 rounded-2xl bg-primary glass-btn ...">Confirm</button>
  </div>
</div>
```

### Close button (X)
```html
<button className="rounded-2xl p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600">
  <X size={16} />
</button>
```

### Entry animation
Modals use `animate-fade-in` (150ms ease-out, translateY 4px → 0).

---

## Navigation

### Header
```html
<header className="sticky top-0 z-50 border-b border-primary/10 bg-background-light/80 backdrop-blur-md">
  <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
```

### Desktop Sidebar
```html
<aside className="hidden w-56 shrink-0 border-r border-white/40 bg-white/70 backdrop-blur-xl md:block">
```

### NavLink (shared by sidebar and mobile nav)
```html
<Link className={`flex min-h-[44px] items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors ${
  isActive ? 'bg-primary-50 text-primary' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
}`}>
```

### Mobile Bottom Nav
Floating pill nav with glassmorphism:
```css
{
  position: fixed,
  bottom: env(safe-area-inset-bottom, 8px),
  left: 12px, right: 12px,
  borderRadius: 20px,
  background: rgba(255, 255, 255, 0.82),
  backdropFilter: blur(20px),
  border: 1px solid rgba(255, 255, 255, 0.8),
  boxShadow: 0 -2px 16px rgba(0,0,0,0.04), 0 0 40px rgba(255,255,255,0.9), inset 0 1px 0 rgba(255,255,255,1),
  height: 49px /* iOS standard tab bar */
}
```

Requires `viewport-fit: cover` in viewport meta tag for `env(safe-area-inset-bottom)`.

---

## Icons

Library: **Phosphor Icons** (`@phosphor-icons/react`)

| Context           | Size | Weight    | Example                          |
|-------------------|------|-----------|----------------------------------|
| Inline in buttons | 14-16px | regular | `<ArrowLeft size={14} />`       |
| Nav items         | 20px | regular   | `<ChartBar size={20} />`        |
| Metric card icons | 16px | duotone   | `<ChartBar size={16} weight="duotone" />` |
| Active/selected   | varies | fill     | `<SealCheck weight="fill" />`   |
| Decorative        | varies | duotone  | `<Timer weight="duotone" />`    |

---

## Loading / Skeleton States

Use `animate-pulse` with glass-compatible backgrounds:
```html
<div className="h-16 animate-pulse rounded-2xl border border-neutral-200 bg-white/30" />
```

**Note:** Some legacy skeletons still use `bg-neutral-100`. New features should use `bg-white/30` to match the glass theme.

### Empty states
```html
<div className="rounded-2xl border border-dashed border-white/40 bg-white/40 backdrop-blur-sm p-8 text-center">
  <p className="text-sm text-neutral-500">Aucun contenu disponible.</p>
</div>
```

---

## PillToggle (Tab Switcher)

Container:
```html
<div className="relative flex rounded-full bg-white/40 backdrop-blur-sm border border-white/40 p-1">
```

Sliding pill (Framer Motion):
```html
<motion.div className="absolute inset-y-1 rounded-full bg-primary shadow-md" />
```
- Animation: `type: 'spring', stiffness: 400, damping: 30`
- Width: `100% / options.length`
- Position: `translateX(activeIndex * 100%)`

Button labels: `relative z-10 rounded-full px-4 py-1.5 text-xs font-medium`

---

## ScoreCircle

Animated SVG ring showing score percentage.

| Score range | Color     | Token         |
|-------------|-----------|---------------|
| ≥ 75%       | `#10B981` | secondary-500 |
| ≥ 40%       | `#D97706` | amber/warning |
| < 40%       | `#DC2626` | red/error     |
| null        | `#D1D5DB` | neutral-300   |

Default size: 64px, strokeWidth: 3. Common variants:
- Metric card: `size={80} strokeWidth={3.5} fontSize={24}`
- Session history: `size={40} strokeWidth={2.5} fontSize={11}`

---

## Animations

### CSS animations (tailwind.config.ts)

| Class                         | Keyframes            | Duration / Easing         | Usage                        |
|-------------------------------|----------------------|---------------------------|------------------------------|
| `animate-fade-in`             | `fade-in`            | 150ms ease-out            | General element entry        |
| `animate-correct-reveal`      | `correct-reveal`     | 300ms ease-out            | Correct answer reveal        |
| `animate-wrong-shake`         | `wrong-shake`        | 300ms ease-out            | Wrong answer shake           |
| `animate-slide-in-right`      | `slide-in-right`     | 250ms ease-out            | Question card transition     |
| `animate-correction-slide-in` | `correction-slide-in`| 250ms ease-out            | Correction view entry        |
| `animate-stagger-fade-in`     | `stagger-fade-in`    | 350ms ease-out, fill both | CSS staggered items          |
| `animate-glow-pulse`          | `glow-pulse`         | 2s ease-in-out infinite   | Démarrer button glow ring    |

### Framer Motion animations

| Component          | Initial → Animate                | Transition                              |
|--------------------|----------------------------------|-----------------------------------------|
| StaggerList        | `y:20, scale:0.97` → `y:0, scale:1` | `duration: 0.5, delay: i*0.12, ease: [0.25,0.1,0.25,1]` |
| TiltCard (normal)  | rotateX/Y on pointer move        | Spring `stiffness:300, damping:20`      |
| TiltCard (gentle)  | rotateX/Y on pointer move        | Spring `stiffness:100, damping:30`      |
| PillToggle pill    | translateX between tabs          | Spring `stiffness:400, damping:30`      |
| Bottom sheet       | `y:'100%'` → `y:0`              | `duration:1, ease:[0.22,1,0.36,1]`     |
| Bottom sheet peek  | `y:80` → `y:0`                  | `duration:0.5, delay:0.4, ease:[0.22,1,0.36,1]` |
| Activity legend    | `x:-6, opacity:0` → `x:0, opacity:1` | `duration:0.3, delay:0.1+i*0.07`  |
| Heatmap detail     | `y:6, opacity:0` → `y:0, opacity:1` | `duration:0.25, delay:i*0.04`     |

---

## Confidence Selector

Horizontal pill layout with icon right of label. No borders.

| Level | Label      | Icon                            | Selected bg    | Selected text              |
|-------|------------|---------------------------------|----------------|----------------------------|
| 0     | Je devine  | `CoinVertical` (fill, rotate-45)| `bg-amber-50`  | `text-warning` (#B45309)   |
| 0.5   | Hésitant   | `Scales`                        | `bg-sky-50`    | `text-medical-teal` (#0ea5e9) |
| 1     | Sûr        | `SealCheck` (fill)              | `bg-teal-50`   | `text-teal-600`            |

Unselected: `text-neutral-500 hover:bg-white/50`. Icon size: 16px.

---

## Confidence Colors (Calibration Chart Dots)

| Level | Label      | Dot color              |
|-------|------------|------------------------|
| 0     | Je devine  | `#B45309` (warning)    |
| 0.5   | Hésitant   | `#194ce6` (primary)    |
| 1     | Sûr        | `#10B981` (secondary)  |

---

## Quiz Choice Cards

Borderless design with background tints:

| State                     | Border              | Background          |
|---------------------------|---------------------|---------------------|
| Default (unselected)      | `border-transparent`| `bg-neutral-50/80`  |
| Selected (pre-validation) | `border-transparent`| `bg-primary/5`      |
| Correct (post-validation) | `border-transparent`| `bg-secondary-50`   |
| Wrong (post-validation)   | `border-transparent`| `bg-red-50`         |
| Missed correct            | `border-transparent`| `bg-secondary-50/50`|
| Unselected+incorrect      | `border-transparent`| `bg-neutral-50/80`  |

Cross-out icon: `Prohibit` (Phosphor) at 18px, `text-neutral-400` default, fills + `text-neutral-600` when active.

---

## Metric Cards

- Layout: 2x2 responsive grid (`grid grid-cols-2 gap-2.5`)
- Each card: `glass-card` with `TiltCard` wrapper (`tiltDeg={6}`)
- Colored left border (4px) using inline `style={{ borderLeft: '4px solid ...' }}`
- `CountUp` animation on numeric values (400ms ease-out quad)
- SVG icon in top-right (duotone weight, 16px)
- Week-over-week trend indicator with `TrendUp`/`TrendDown`/`Minus` icons

---

## Mastery Color Scale (Heatmap)

| Level | Label         | Color     | Score Range |
|-------|---------------|-----------|-------------|
| 0     | Non tenté     | `#BDC3C7` | N/A         |
| 1     | Lacune grave  | `#B91C1C` | 0--20%      |
| 2     | En difficulté | `#DC2626` | 20--40%     |
| 3     | En progression| `#B45309` | 40--60%     |
| 4     | Correct       | `#D97706` | 60--75%     |
| 5     | Bon           | `#0ea5e9` | 75--90%     |
| 6     | Maîtrisé      | `#10B981` | 90--100%    |

Treemap cells use a diagonal gradient overlay (`white 25% → black 10%`) for depth.

---

## iOS Considerations

- `overscroll-behavior: none` on `html, body` (prevents elastic bounce)
- `viewport-fit: cover` in viewport meta tag (enables `env(safe-area-inset-bottom)`)
- `text-base` (16px) minimum on mobile `<input>`/`<select>` to prevent auto-zoom
- Use `text-base sm:text-sm` pattern for responsive input sizing
- Mobile bottom nav uses `env(safe-area-inset-bottom, 8px)` for safe area

---

## Admin-Specific Notes

- Admin views use the same glassmorphism system as student views
- AG Grid spreadsheet retains its own theme (`.question-grid-theme` in `globals.css`)
- AG Grid variables: font 13px Space Grotesk, header bg `#F9FAFB`, row hover `rgba(238,242,255,0.5)`, border `#E5E7EB`
- Admin filter dropdowns use compact sizing (`h-7 text-xs rounded-lg border-neutral-300`) — not glass-input
- Difficulty and Active columns use custom `SelectFilter` component (dropdown) in AG Grid
- Utility actions (Corbeille, Historique, +Chapitre, Gérer chapitres, +Question) in ⋮ hamburger menu
- Draft rows: 3px primary left border + italic text on chapter/question cells

---

## PWA Theme

| Property         | Value       |
|------------------|-------------|
| App name         | Les Incollables |
| theme_color      | `#194ce6`   |
| background_color | `#eef0f5`   |

---

## UndoToast (Exception)

The undo toast uses a dark style that intentionally differs from the glass system:
```html
<div className="rounded-xl bg-neutral-900 px-5 py-3 text-white shadow-lg">
  <button className="rounded-lg bg-white/20 px-3 py-1 text-sm">Annuler</button>
</div>
```
This is the only element that uses `rounded-xl` on a button and dark backgrounds.
