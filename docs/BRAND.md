# PhysioQuiz — Design System (BRAND.md)

> Single source of truth for all UI decisions. Never hardcode one-off values.

---

## Color Palette

### Primary — Medical Blue
| Token | Hex | Usage |
|-------|-----|-------|
| `primary-50` | `#EBF5FF` | Backgrounds, hover states |
| `primary-100` | `#D6EBFF` | Light cards, selected states |
| `primary-200` | `#ADD6FF` | Borders, dividers |
| `primary-500` | `#2B7DE9` | Buttons, links, active elements |
| `primary-600` | `#1A65C4` | Button hover, emphasis |
| `primary-700` | `#0F4F9E` | Dark accents |
| `primary-900` | `#0A2D5C` | Headers, dark text on light bg |

### Secondary — Teal (Knowledge/Progress)
| Token | Hex | Usage |
|-------|-----|-------|
| `secondary-50` | `#EFFCF6` | Success backgrounds |
| `secondary-100` | `#D1FAE5` | Light success cards |
| `secondary-500` | `#10B981` | Success states, correct answers |
| `secondary-600` | `#059669` | Success hover |

### Semantic Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `success` | `#10B981` | Correct answer, mastery high |
| `error` | `#EF4444` | Wrong answer, mastery low |
| `warning` | `#F59E0B` | Partial score, medium mastery |
| `info` | `#3B82F6` | Tips, confidence "hésitant" |

### Heatmap Scale (from architecture doc section 8.2)
| Mastery | Color | Hex |
|---------|-------|-----|
| Not attempted | Gray | `#BDC3C7` |
| 0-20% | Dark red | `#C0392B` |
| 20-40% | Light red | `#E74C3C` |
| 40-60% | Orange | `#F39C12` |
| 60-75% | Yellow-green | `#F1C40F` |
| 75-90% | Light green | `#2ECC71` |
| 90-100% | Dark green | `#27AE60` |

### Neutrals
| Token | Hex | Usage |
|-------|-----|-------|
| `neutral-50` | `#F9FAFB` | Page background |
| `neutral-100` | `#F3F4F6` | Card background |
| `neutral-200` | `#E5E7EB` | Borders, dividers |
| `neutral-300` | `#D1D5DB` | Disabled states |
| `neutral-400` | `#9CA3AF` | Placeholder text |
| `neutral-500` | `#6B7280` | Secondary text |
| `neutral-700` | `#374151` | Primary text |
| `neutral-900` | `#111827` | Headings |

---

## Typography

| Element | Font | Weight | Size (mobile) | Size (desktop) |
|---------|------|--------|---------------|----------------|
| App name / logo | **Inter** | 800 | 20px | 24px |
| Page heading (H1) | **Inter** | 700 | 22px / 1.75rem | 28px / 1.75rem |
| Section heading (H2) | **Inter** | 600 | 18px / 1.125rem | 22px / 1.375rem |
| Card title (H3) | **Inter** | 600 | 16px / 1rem | 18px / 1.125rem |
| Body text | **Inter** | 400 | 14px / 0.875rem | 16px / 1rem |
| Small text / captions | **Inter** | 400 | 12px / 0.75rem | 14px / 0.875rem |
| Button text | **Inter** | 600 | 14px / 0.875rem | 16px / 1rem |
| Quiz question text | **Inter** | 500 | 15px / 0.9375rem | 17px / 1.0625rem |
| Proposition text | **Inter** | 400 | 14px / 0.875rem | 16px / 1rem |

**Font stack:** `'Inter', system-ui, -apple-system, sans-serif`

---

## Spacing Scale (Tailwind default)

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight gaps (icon-to-text) |
| `space-2` | 8px | Inline spacing |
| `space-3` | 12px | Card inner padding (mobile) |
| `space-4` | 16px | Card inner padding (desktop), section gaps |
| `space-6` | 24px | Between cards, section spacing |
| `space-8` | 32px | Page section spacing |
| `space-12` | 48px | Page top/bottom padding |

---

## Border Radius

| Element | Radius | Tailwind class |
|---------|--------|----------------|
| Buttons | 8px | `rounded-lg` |
| Cards | 12px | `rounded-xl` |
| Input fields | 8px | `rounded-lg` |
| Checkboxes (propositions) | 6px | `rounded-md` |
| Avatars / icons | 9999px | `rounded-full` |
| Modals | 16px | `rounded-2xl` |

---

## Shadows

| Level | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Input fields, subtle elevation |
| `shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Cards, dropdowns |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, floating elements |

---

## Component Tokens

### Buttons
| Variant | Background | Text | Border | Hover |
|---------|-----------|------|--------|-------|
| Primary | `primary-500` | `#FFFFFF` | none | `primary-600` |
| Secondary | `transparent` | `primary-500` | `primary-200` | `primary-50` |
| Danger | `error` | `#FFFFFF` | none | `#DC2626` |
| Ghost | `transparent` | `neutral-700` | none | `neutral-100` |
| Disabled | `neutral-200` | `neutral-400` | none | — |

**Min touch target:** 44px height (mobile accessibility)

### Cards
- Background: `neutral-100` (or `white` on `neutral-50` page)
- Border: `1px solid neutral-200`
- Padding: `space-4` (mobile), `space-6` (desktop)
- Shadow: `shadow-md`

### Glassmorphism
| Token | Background | Backdrop blur | Border | Usage |
|-------|-----------|---------------|--------|-------|
| `glass-card` | `rgba(255,255,255, 0.78)` | `blur(16px)` | `1px solid rgba(255,255,255, 0.8)` | Main content cards |
| `glass-card-inner` | `rgba(255,255,255, 0.40)` | `blur(6px)` | `1px solid rgba(255,255,255, 0.4)` | Stat cards, inner elements |
| `glass-btn-secondary` | `rgba(255,255,255, 0.65)` | `blur(8px)` | `1px solid rgba(255,255,255, 0.6)` | Secondary buttons |

### Quiz-specific
| Element | Correct | Incorrect | Partial | Unselected |
|---------|---------|-----------|---------|------------|
| Proposition bg | `secondary-50` | `#FEF2F2` | `#FFFBEB` | `white` |
| Proposition border | `secondary-500` | `error` | `warning` | `neutral-200` |
| Proposition icon | green check | red X | orange ~ | gray circle |

### Confidence Buttons
| State | Style |
|-------|-------|
| "Je devine" (unselected) | Ghost, `neutral-500` text |
| "Je devine" (selected) | `warning` bg, white text |
| "Hésitant" (unselected) | Ghost, `neutral-500` text |
| "Hésitant" (selected) | `info` bg, white text |
| "Sûr" (unselected) | Ghost, `neutral-500` text |
| "Sûr" (selected) | `secondary-500` bg, white text |

---

## Breakpoints (Tailwind defaults)

| Name | Min-width | Usage |
|------|-----------|-------|
| `sm` | 640px | Small tablets |
| `md` | 768px | Tablets — switch to sidebar layout |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Wide desktop |

**Mobile-first:** All base styles target mobile, then scale up.

---

## Animations

| Element | Animation | Duration |
|---------|-----------|----------|
| Page transitions | Fade in | 150ms |
| Card hover | Scale 1.01 + shadow-lg | 200ms |
| Button press | Scale 0.97 | 100ms |
| Correct answer reveal | Green border slide-in | 300ms |
| Wrong answer reveal | Red shake | 300ms |
| Progress bar fill | Width transition | 500ms ease-out |
| Toast notifications | Slide in from top | 200ms |
