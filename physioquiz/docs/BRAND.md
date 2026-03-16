# Les Incollables -- Design System

Single source of truth for all UI decisions. Every color, font size, and spacing
value used in the app MUST come from this file or from the Tailwind config that
implements it (`tailwind.config.ts`, `globals.css`).

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

Tailwind usage: `bg-secondary-500`, `text-secondary-600`, etc.

### Neutral (Gray Scale)

Standard gray palette for text, borders, and backgrounds.

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

| Token          | Hex       | Usage                              |
|----------------|-----------|------------------------------------|
| medical-teal   | `#0ea5e9` | Medical accent, mastery "Bon" level |
| medical-accent | `#38bdf8` | Secondary medical accent           |

Tailwind usage: `text-medical-teal`, `bg-medical-accent`.

### Semantic Colors

| Token   | Hex       | Usage                                |
|---------|-----------|--------------------------------------|
| success | `#10B981` | Correct answers, completion          |
| error   | `#B91C1C` | Incorrect answers, errors (deep red) |
| warning | `#B45309` | Partial scores, warnings (deep amber)|
| info    | `#194ce6` | Informational (matches primary)      |

### Backgrounds

| Token            | Hex       | Usage              |
|------------------|-----------|--------------------|
| background-light | `#f6f6f8` | Light mode page bg |
| background-dark  | `#111521` | Dark mode page bg  |

---

## Typography

| Property     | Value                                                         |
|--------------|---------------------------------------------------------------|
| Font family  | **Space Grotesk**                                             |
| Loading      | `next/font/google` with CSS variable `--font-space-grotesk`  |
| Tailwind     | `font-sans` and `font-display` (both map to Space Grotesk)   |
| Fallbacks    | system-ui, -apple-system, sans-serif                          |

The font is applied globally via `globals.css`:

```css
@layer base {
  body {
    font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
  }
}
```

---

## Border Radius

| Token   | Value      | Usage                           |
|---------|------------|---------------------------------|
| DEFAULT | `0.25rem`  | Inputs, small elements          |
| lg      | `0.5rem`   | Cards, modals                   |
| xl      | `0.75rem`  | Large containers, quiz cards    |
| full    | `9999px`   | Pills, circular avatars/badges  |

---

## Shadows

The project uses Tailwind default shadow utilities.

| Class       | Typical usage                         |
|-------------|---------------------------------------|
| `shadow-sm` | Subtle elevation (inputs, hover)      |
| `shadow-md` | Cards, metric panels                  |
| `shadow-lg` | Modals, popovers                      |

---

## Glass Card Effect

Used for overlay cards that sit on top of gradient backgrounds.

```css
.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(25, 76, 230, 0.1);
}
```

Tailwind usage: apply the `glass-card` utility class (defined in `globals.css`
under `@layer components`).

---

## Animations

Defined in `tailwind.config.ts` under `keyframes` and `animation`.

| Class              | Keyframes        | Duration / Easing   | Usage                        |
|--------------------|------------------|---------------------|------------------------------|
| `animate-fade-in`  | `fade-in`        | 150ms ease-out      | General element entry        |
| `animate-correct-reveal` | `correct-reveal` | 300ms ease-out | Correct answer border reveal |
| `animate-wrong-shake`    | `wrong-shake`    | 300ms ease-out | Wrong answer shake feedback  |

### Keyframe details

**fade-in**: opacity 0 -> 1, translateY(4px) -> 0.
**correct-reveal**: border color transparent -> current, opacity 0.5 -> 1.
**wrong-shake**: translateX oscillates +/- 4px over four steps.

---

## Metric Cards

Dashboard stat cards follow this pattern:

- Layout: 2x2 responsive grid (`grid grid-cols-2 gap-4`)
- Each card: white background, `shadow-md`, `rounded-xl`
- Colored left border (4px) using the relevant semantic color
- SVG icon in the top-left area
- Main metric value (large, bold)
- Week-over-week trend indicator (small text, green up / red down arrow)

---

## Mastery Color Scale (Heatmap)

| Level | Label         | Color     | Score Range |
|-------|---------------|-----------|-------------|
| 0     | Non tente     | `#BDC3C7` | N/A         |
| 1     | Lacune grave  | `#B91C1C` | 0--20%      |
| 2     | En difficulte | `#DC2626` | 20--40%     |
| 3     | En progression| `#B45309` | 40--60%     |
| 4     | Correct       | `#D97706` | 60--75%     |
| 5     | Bon           | `#0ea5e9` | 75--90%     |
| 6     | Maitrise      | `#10B981` | 90--100%    |

---

## Confidence Colors (Calibration Chart)

| Level | Label      | Color                  |
|-------|------------|------------------------|
| 0     | Je devine  | `#B45309` (warning)    |
| 0.5   | Hesitant   | `#194ce6` (primary)    |
| 1     | Sur        | `#10B981` (secondary)  |

---

## PWA Theme

| Property         | Value       |
|------------------|-------------|
| App name         | Les Incollables |
| theme_color      | `#194ce6`   |
| background_color | `#f6f6f8`   |
