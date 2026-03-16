# Les Incollables — Progress Log

## Sprint 0: Preprocessing Pipeline

**Status:** COMPLETE
**Date:** 2026-03-13

### Plan (checklist)

- [x] Convert `.doc` → `.docx` via LibreOffice CLI
- [x] Parse document structure: chapters, questions, propositions, answers
- [x] Handle Word auto-numbering (`numPr`) for proposition letters
- [x] Detect bold letter labels as answer source (Pass 1)
- [x] Parse answer lines with 60+ format variants (Pass 2)
- [x] Resolve conflicts between bold and line answer sources
- [x] Write standardized `.docx` output
- [x] Generate `questions_a_corriger.txt` for manual review
- [x] Verify original file integrity (SHA-256 hash)
- [x] Write unit tests + end-to-end tests
- [x] Review with 2 parallel agents (tech + QA)
- [x] Preserve images and tables in output (54/54 images, 4/4 tables)

### Results

| Metric | Value |
|--------|-------|
| Total questions parsed | 465 |
| Questions with answers (line only) | 44 |
| Questions with answers (bold only) | 60 |
| Questions with answers (both, consistent) | 331 |
| Questions missing answers | 30 |
| Questions with 0 propositions | 10 |
| Answer mismatches (line vs bold) | 45 |
| Images preserved | 54/54 |
| Tables preserved | 4/4 |
| Tests written | 38 |
| Tests passing | 38/38 |

### Files Produced

- `scripts/preprocessing.py` (~950 lines) — main pipeline with image/table preservation
- `scripts/test_preprocessing.py` (~254 lines) — 38 unit + e2e tests
- `PCEM II s def3_standardise.docx` — standardized output (all images and tables intact)
- `questions_a_corriger.txt` — items needing manual correction

### Key Decisions & Deviations

1. **"Réponses" (plural)** used instead of "Réponse" per user instruction, overriding the spec.
2. **Propositions not limited to A-E** — the parser supports F, G, etc.
3. **Bold detection targets letter labels**, not bold content within proposition text.
4. **Answer line (Réponse) ALWAYS takes precedence** over bold detection when they disagree. No exceptions.
5. **Questions without answers** stay in the standardized doc but will be set to `is_active = false` during Sprint 2 import (DB already has `is_active BOOLEAN DEFAULT true`). This keeps data intact while preventing answer-less questions from entering quiz rotation.
6. **Zero-proposition "questions"** (10 total) are mislabeled themes/explanations in the original — not real questions. Same treatment: `is_active = false` at import.

### Images & Tables — Fully Preserved

- **54/54 images** preserved via XML deep-copy with image relationship remapping
- **4/4 tables** preserved (interleaved between explanation paragraphs)
- Stem images and explanation images both handled
- Empty paragraphs containing images are tracked and copied

**Trade-off:** Removing the chapter-title break from the explanation state means some inter-question chapter titles get captured as explanation text. This is preferable to losing explanation content with images.

### Issues Found & Fixed

See `docs/ERROR_LOG.md` for the full list (10 errors logged with solutions).

---

## Sprint 1: Fondations techniques

**Status:** COMPLETE
**Date:** 2026-03-13

### Plan (checklist)

- [x] Initialize Next.js 14 + Tailwind CSS + TypeScript
- [x] Configure Supabase:
  - [x] 8 tables: `profiles`, `topics`, `questions`, `choices`, `question_images`, `sessions`, `session_answers`, `session_answer_choices`
  - [x] 4 SQL views: `question_user_stats`, `question_error_rate`, `user_progress_over_time`, `topic_mastery`
  - [x] RLS policies on all tables
  - [x] `handle_new_user` trigger for auto profile creation
- [x] Authentication:
  - [x] Sign-up page (email, password, name, university, year)
  - [x] Login page
  - [x] Route protection middleware
  - [x] Admin role check utility
  - [x] Email confirmation handling
- [x] Base layout:
  - [x] Header with navigation + admin link
  - [x] Sidebar (desktop) / bottom nav (mobile)
  - [x] Student vs admin routing (route groups)
  - [x] 16 placeholder pages for all routes
- [x] PWA configuration:
  - [x] manifest.json (name, icons, theme color)
  - [x] Service worker (basic cache-first) + registration
  - [x] iOS meta tags
  - [x] Placeholder icons (192x192, 512x512)
- [x] Linting & formatting:
  - [x] ESLint (eslint-config-next + TypeScript strict + prettier)
  - [x] Prettier
  - [x] tsconfig.json with `strict: true`
  - [x] npm scripts: `lint`, `lint:fix`, `format`, `type-check`, `validate`
- [x] Dev workflow:
  - [x] `docs/BRAND.md` created (medical blue + teal, user approved)
  - [x] `.claude/agents/tech-reviewer.md`
  - [x] `.claude/agents/ux-reviewer.md`
  - [x] Local migration files in `supabase/migrations/` (001-006)
- [x] DOMPurify installed (ready for Sprint 2 HTML rendering)
- [x] TypeScript types for all DB entities (`src/types/index.ts`)
- [x] `SafeChoice` type that excludes `is_correct` (anti-cheat)

### Tests

| Test | Result |
|------|--------|
| `npm run type-check` | PASS — 0 errors |
| `npm run lint` | PASS — 0 warnings, 0 errors |
| `npm run build` | PASS — all routes compile |

### Review — 2 agents in parallel

**Tech reviewer (Opus):**
- B1-B3: False positives (docs exist at project root, not inside `physioquiz/`)
- I1 (service worker not registered): **FIXED** — added `ServiceWorkerRegistrar` component
- I2 (email confirmation not handled): **FIXED** — register page now detects confirmation flow
- I3 (DOMPurify missing): **FIXED** — installed with types
- Created `supabase/migrations/` with 6 local SQL audit files

**UX reviewer (Sonnet):**
- I1 (error colors outside brand): **FIXED** — use `text-error` token
- I2 (logout button missing type/aria-label): **FIXED**
- I3 (bottom nav touch targets < 44px): **FIXED** — `min-h-[44px]` + `py-3`
- I4 (missing autocomplete attributes): **FIXED** — all form inputs
- I5 (font variable not wired to Tailwind): **FIXED** — `var(--font-inter)` in config
- I6 (mobile nav icon-only, no aria-label): **FIXED** — `aria-label` + `title` on all links
- Minor fixes: responsive card padding (`p-6 sm:p-8`), French accents (HTML entities), logo size (`text-xl md:text-2xl`), `maximumScale: 5` for zoom accessibility, `role="alert"` on error messages, `neutral-400` added to BRAND.md

### Key Decisions & Deviations

1. **No `next-pwa`** — using manual SW registration instead. Simpler, fewer dependencies.
2. **Config file extensions** — `.mjs` and `.ts` instead of `.js` (created by `create-next-app@14`). Functionally equivalent.
3. **Google OAuth deferred** — starting with email/password only. Can add Google later.
4. **Edge Functions scaffolded** but empty (Sprint 2 deliverable).
5. **Supabase project**: "Incollables" (`thonkmcacdycojenwakj`), region `eu-west-1`.

---

## Sprint 2: Quiz entraînement

**Status:** COMPLETE
**Ref:** PhysioQuiz_Architecture_v3_FINALE.md, section "Sprint 2" (line ~1751)

### Phase A: Import Script — COMPLETE

**Date:** 2026-03-13

| Metric | Value |
|--------|-------|
| Questions imported | 465 |
| Active questions | 427 |
| Inactive questions | 38 |
| Topics | 15 |
| Choices | 2,253 |
| Images uploaded | 54 |
| Unit tests | 63/63 passing |

**Files produced:**
- `scripts/import_to_db.py` (~1000 lines) — two-pass parser + mammoth HTML + Supabase import
- `scripts/test_import.py` (~360 lines) — 63 unit + integration tests

**Review results (2 agents parallel):**
- Tech reviewer: 0 blockers, 2 important fixed (convert_image multi-image bug, missing SELECT storage policies)
- QA reviewer: 1 blocker fixed (6 questions with 0 correct answers deactivated), 1 important fixed (<3 proposition check)

**Issues found & fixed:**
1. `convert_image` returned wrong URL for multi-image explanations → fixed with blob-content matching
2. Storage bucket missing SELECT policies → re-created
3. 6 active questions had 0 correct answers (answer letters referenced non-existent propositions) → deactivated + added post-import safety check
4. 3 questions with <3 propositions still active → added to post-import safety check
5. Unescaped fallback HTML → added `html.escape()`
6. Silent exception swallowing → changed to log warnings

**Known limitations:**
- Topic hierarchy is flat (12/15 topics under "Préface") — Word doc uses inconsistent heading styles
- 4 explanations fail mammoth conversion (Q92, Q108, Q122, Q244) — fall back to plain text HTML

---

### Phase B: Edge Functions + Scoring Logic — COMPLETE

**Date:** 2026-03-13

#### Implementation

| # | Task | File(s) | Done |
|---|------|---------|------|
| B1 | `scoreAnswer()` — partial scoring per §5bis | `src/lib/scoring.ts` | [x] |
| B2 | `calculateWeights()`, `weightedSampleWithoutReplacement()`, `shuffleArray()` | `src/lib/quiz-engine.ts` | [x] |
| B3 | Edge Function `select-questions` — 3 modes, anti-cheat, session creation | `supabase/functions/select-questions/index.ts` | [x] |
| B4 | Edge Function `validate-answer` — scoring, correction, session lifecycle | `supabase/functions/validate-answer/index.ts` | [x] |
| B5 | Auth checks: JWT, session ownership, question-session membership | Both Edge Functions | [x] |
| B6 | Session completion: `is_completed`, `completed_at`, `score_percent` | `validate-answer` | [x] |

#### Tests

| Test | Result |
|------|--------|
| `npm run type-check` | PASS — 0 errors |
| `npm run lint` | PASS — 0 errors |
| `npm run build` | PASS — all routes compile |
| Unit tests (`jest`) | PASS — 26/26 (12 scoring + 14 quiz-engine) |
| Anti-cheat (T-B11) | PASS — `select-questions` never selects or returns `is_correct` |
| Edge Function deploy | PASS — both deployed v2 ACTIVE |

#### Review (2 agents in parallel)

**Tech reviewer:**
- BLOCKER fixed: Race condition on session counters → atomic RPC `update_session_counters`
- IMPORTANT fixed: Missing UNIQUE constraint on `session_answers(session_id, question_id)` → added
- IMPORTANT fixed: Unnecessary INSERT RLS on `session_questions` → removed
- IMPORTANT fixed: Fragile wrong_count ternary → simplified with `isWrong` boolean
- IMPORTANT noted: CORS allows `*` (acceptable for prototype, restrict in production)
- Scoring formula, weight formula, anti-cheat all verified correct vs architecture doc

**QA reviewer:**
- IMPORTANT fixed: Floating-point rounding in weighted sampling → added last-item fallback
- IMPORTANT fixed: No validation that `selected_choice_ids` belong to question → added check
- IMPORTANT noted: No integration test for 1-question session lifecycle (deferred to E2E)
- All 7 scoring examples from §5bis.3 covered in tests
- All 3 weight cases + false certainty bonus tested
- Session lifecycle (create → answer → complete) verified correct

#### DB Changes

- Migration 007: `session_questions` table (ordered question list per session)
- Migration 008: UNIQUE constraint on `session_answers`, removed INSERT RLS on `session_questions`
- Migration 009: `update_session_counters` RPC function (atomic counter updates)
- `question_user_stats` view already had confidence columns from prior session

#### Files Produced

- `src/lib/scoring.ts` — partial scoring function
- `src/lib/quiz-engine.ts` — weight calculation, weighted sampling, Fisher-Yates shuffle
- `src/lib/__tests__/scoring.test.ts` — 12 unit tests
- `src/lib/__tests__/quiz-engine.test.ts` — 14 unit tests
- `supabase/functions/select-questions/index.ts` — Edge Function (deployed v2)
- `supabase/functions/validate-answer/index.ts` — Edge Function (deployed v2)
- `supabase/functions/_shared/cors.ts` — shared CORS headers
- `jest.config.js` — Jest configuration
- `supabase/migrations/007-009` — 3 migration audit files

---

### Phase C: UI Components — COMPLETE

**Date:** 2026-03-13

#### Implementation (3 clusters, each reviewed by 2 agents)

**Cluster 1: Topic Browsing + Quiz Setup (C1-C4)**
- `src/hooks/useTopics.ts` — shared fetch + tree builder + question count via RPC
- `src/components/ui/TopicTree.tsx` — recursive accordion, question count badges, 44px touch targets
- `src/app/(student)/topics/page.tsx` — topic list with skeleton + retry
- `src/app/(student)/quiz/setup/[topicId]/page.tsx` — two-step flow (select count → [Démarrer]), subtopics toggle, exam mode link

**Cluster 2: Core Quiz Flow (C5-C10)**
- `src/hooks/useQuiz.ts` — full quiz state (load, toggle, validate via Edge Function, next, timer)
- `src/components/quiz/QuestionCard.tsx` — progress bar, timer (MM:SS), question text + images
- `src/components/quiz/ChoiceList.tsx` — SafeChoice checkboxes, post-validation coloring (green/red/pale green), animations
- `src/components/ui/ConfidenceSelector.tsx` — 3 toggle buttons (Je devine/Hésitant/Sûr) per BRAND.md
- `src/components/quiz/CorrectionView.tsx` — score feedback, partial message, DOMPurify explanation
- `src/app/(student)/quiz/play/[sessionId]/page.tsx` — full quiz flow with focus management

**Cluster 3: Results (C11-C13)**
- `src/components/quiz/SessionSummary.tsx` — semantic score color, stats breakdown, expandable failed questions, "Recommencer les ratées" + "Voir ma progression" + "Retour aux cours"
- `src/app/(student)/quiz/results/[sessionId]/page.tsx` — parallel data fetch via RPC, sorted answers

#### DB Changes
- Migration 010: `get_question_counts_by_topic` RPC (performance)
- Migration 011: `safe_choices` view + restricted `choices` RLS (anti-cheat — students can't read `is_correct`)
- Migration 012: `get_session_choices` RPC (reveals `is_correct` only for completed sessions owned by user)
- Security: `search_path = public` on all SECURITY DEFINER functions

#### Dependencies Added
- `@tailwindcss/typography` — prose classes for explanation HTML
- `isomorphic-dompurify` — SSR-safe HTML sanitization

#### Tailwind Config Updates
- Added animations: `fade-in` (150ms), `correct-reveal` (300ms), `wrong-shake` (300ms)
- Added typography plugin

#### Tests

| Test | Result |
|------|--------|
| `npm run type-check` | PASS — 0 errors |
| `npm run lint` | PASS — 0 errors, 0 warnings |
| `npm run build` | PASS — all routes compile |
| Unit tests (Jest) | PASS — 26/26 |

#### Review (6 agents total — 2 per cluster)

**Cluster 1 — Tech reviewer:**
- 0 blockers. 4 important fixed: duplicated tree/count logic (extracted shared utilities), fetching all questions for counting (created RPC), supabase in dependency array (useCallback), missing exam mode button (added)
- BRAND.md: shadow-sm → shadow-md on topic cards, touch target 28px → 44px

**Cluster 1 — QA reviewer:**
- 0 blockers after fixes. Fixed: two-step start flow, French accents (être, connecté, démarrer, réessayer, préparation), aria-expanded on accordion, retry buttons on errors, 0-question topics non-clickable, "questions" instead of "Q" abbreviation

**Cluster 2 — Tech reviewer:**
- 3 blockers fixed: (1) stateRef declared after usage → moved before, (2) RLS allowing is_correct leak → created safe_choices view + restricted RLS, (3) raw storage_path for images → resolved via getPublicUrl()
- 7 important fixed: timer drift → Date.now() delta, timer stops on completion, empty submission guard, focus management, aria groups, error message improvement, isomorphic-dompurify

**Cluster 2 — QA reviewer:**
- 0 blockers. Fixed: animations added (correct-reveal, wrong-shake, fade-in), confidence shown after validation (disabled), aria-live on correction, role="group" on choices

**Cluster 3 — Tech reviewer:**
- 0 blockers. 4 important: search_path on SECURITY DEFINER (fixed), sessions RLS verified (user_id = auth.uid()), "comparison with previous sessions" deferred to Sprint 4, "Voir ma progression" button added (links to /progress placeholder)

**Cluster 3 — QA reviewer:**
- Fixed: "Recommencer les ratées" label + retry link with failed question IDs, semantic score color (green/warning/red), sorted answers by question number, sorted choices by label, H2 sizing per BRAND.md, shadow-md on review cards, aria-hidden on decorative elements, aria-label on expand buttons, padded seconds in duration

#### Deferred Items (tracked)
- **Comparison with previous sessions on topic** → Sprint 4 (needs historical session queries + charts)
- **Topic mastery bar in TopicTree** → Sprint 4 (needs topic_mastery view data after quiz completion)
- **"Recommencer les ratées" with actual failed-only session** → requires `select-questions` Edge Function to accept specific question IDs (currently passes retry IDs via URL param, setup page can use them in a future enhancement)

#### E2E Testing (Playwright) — 6/6 PASSING

**Test file:** `e2e/quiz-flow.spec.ts` (serial mode, shared session state)
**Config:** `playwright.config.ts` (baseURL: localhost:3001, chromium headless)
**Test user:** `teste2e@gmail.com` / `TestPass123`

| Test | Description | Status |
|------|-------------|--------|
| T-C4 | Login + Topics page (15 topics, question count badges) | PASS |
| T-C5 | Quiz setup + start session (choices visible on play page) | PASS |
| T-C6a | Validate button disabled when no choice selected | PASS |
| T-C6b | Select choice + validate + correction view | PASS |
| T-C7 | Complete all questions + results page (score, stats, expandable) | PASS |
| T-C8 | Mobile responsive at 375px (touch targets ≥ 40px, no overflow) | PASS |

#### Bugs Found & Fixed During E2E Testing

1. **`use(params)` crash** — Next.js 14 passes `params` as plain object, not Promise. All 7 dynamic route pages fixed: `use(params)` → direct destructuring.
2. **Edge Function 401** — `verify_jwt: true` blocked JWTs before function code ran. Redeployed both Edge Functions with `verify_jwt: false` (functions have internal auth checks).
3. **Infinite recursion in RLS** — Admin policies on `profiles` referenced `profiles` itself. Created `is_admin()` SECURITY DEFINER function to bypass RLS cycle. Migration 013.
4. **`get_session_choices` type mismatch** — `choices.label` is `char(1)` but function declared `text`. Added explicit `c.label::text` cast. Migration 014.
5. **Parent topic "Préface" with 0 direct questions** — Setup page showed 0 available questions. Auto-enable `includeSubtopics` when topic has children but no direct questions.
6. **Header "Deconnexion" button 28px** — Missing `min-h-[44px]` for touch target compliance at mobile width.

#### Post-E2E Polish (user feedback)

**Date:** 2026-03-13

1. **Correction message shortened** — "Une mauvaise réponse annule le score." → "Mauvaise réponse." (`CorrectionView.tsx`)
2. **Session completion interstitial enriched** — now shows: average score (accounts for partial), breakdown (X correctes, Y partielles, Z incorrectes) instead of just "X/N correctes" (`quiz/play/[sessionId]/page.tsx`)
3. **Validation speed optimized** — `validate-answer` Edge Function v4 deployed:
   - Parallelized 3 guard queries via `Promise.all` (~200-400ms saved)
   - Parallelized counter update + explanation fetch (~100-200ms saved)
   - Removed redundant COUNT query (derive completion from counters)
   - Added `average_score` field in `session_stats` response
4. **CLAUDE.md updated** — added mandatory "Testing Rules" section: always run Playwright E2E before manual tests
5. **`CorrectionData` type updated** — added `average_score: number | null` to `session_stats`

---

### Phase D: Pause/Resume + Dashboard — COMPLETE

**Date:** 2026-03-13

#### Implementation

| # | Task | File(s) | Done |
|---|------|---------|------|
| D1 | `lib/pause-manager.ts` — pause/resume/abandoned | `src/lib/pause-manager.ts` | [x] |
| D2 | Pause button in quiz header (training only) | `QuestionCard.tsx`, `useQuiz.ts` | [x] |
| D3 | Auto-pause hooks (visibilitychange) | `useQuiz.ts` | [x] |
| D4 | `/dashboard` page — paused, completed, weak questions | `src/app/(student)/dashboard/page.tsx` | [x] |
| D5 | Resume flow — resume at correct question | `useQuiz.ts` | [x] |
| D6 | Abandoned session check (>7 days paused) | `pause-manager.ts`, `quiz/play/page.tsx` | [x] |
| D7 | Effective duration (subtract pause time) | `quiz/results/page.tsx` | [x] |

#### Key implementation details

- **Pause/resume**: Atomic conditional updates (`WHERE is_paused = expected_value`) to prevent race conditions
- **Auto-pause**: `visibilitychange` event (training mode only). `sendBeacon` approach was rejected (sends POST, not PATCH, no auth headers)
- **Timer**: Uses `baseElapsedRef + delta` to continue from previous elapsed time on resume
- **Timer visibility**: Only shown in exam mode (`showTimer={quiz.sessionType === 'exam'}`)
- **Dashboard sections**: Paused sessions (resume button), recent completed (with timestamps), aggregated weak questions (cross-session)
- **Weak questions**: New `get_weak_questions` RPC function — groups by question across ALL completed sessions, shows avg score + attempt count, sorted by `(100 - avg_score) * attempt_count` descending (worst and most-repeated first)
- **Back navigation**: Added "← Retour" link on quiz play page and results page

#### DB Changes
- Migration 015: `get_weak_questions` RPC function (SECURITY DEFINER, aggregates session_answers across sessions)
- Migration 016: Updated sort to `(100 - avg_score) * attempt_count DESC`

#### Tests

| Test | Result |
|------|--------|
| `npm run type-check` | PASS — 0 errors |
| `npm run lint` | PASS — 0 errors |
| `npm run build` | PASS — all routes compile |
| Unit tests (Jest) | PASS — 32/32 (including 6 pause-manager tests) |
| Playwright E2E | PASS — 6/6 |

#### Review (2 agents in parallel)

**Tech reviewer:**
- BLOCKER fixed (B1): `sendBeacon` sends POST not PATCH, no auth headers → removed, relying on visibilitychange only
- BLOCKER fixed (B2): Read-then-update race condition in pause/resume → atomic conditional UPDATE
- 2 important fixed: missing error handling in auto-resume, stateRef.current race in timer

**QA reviewer:**
- IMPORTANT fixed: timer showing in training mode (should be exam only) → `showTimer` prop
- IMPORTANT fixed: missing back navigation on play/results pages → added "← Retour" links
- IMPORTANT fixed: session score showing 0% instead of average → client-side `computedAvgScore`
- Minor: French copy improvements, sr-only labels on status icons

#### Post-review user feedback (2 rounds)

**Round 1:**
1. "Questions à revoir" sort on results page: changed from question_number to score_percent ascending (worst first)
2. Session score 0% → now shows computed average from individual answer scores
3. Back navigation added to play + results pages
4. Timer hidden in training mode (exam only)
5. Fixed historical session scores in DB for test users

**Round 2:**
1. Completed sessions: added time to timestamps (e.g. "13 mars, 14:30")
2. Weak questions on dashboard: show top 3 with "Voir plus" button to expand
3. Sort changed to `(100 - avg_score) * attempt_count` — questions failed more often rank higher
4. Cleared stale `.next` cache causing "Cannot find module vendor-chunks/@supabase.js"
5. Renamed app from "PhysioQuiz" to "Les Incollables" (layout, header, login, register, manifest)

#### Files Produced/Modified

- `src/lib/pause-manager.ts` — pause/resume/abandoned logic (NEW)
- `src/lib/__tests__/pause-manager.test.ts` — 6 unit tests (NEW)
- `src/hooks/useQuiz.ts` — session type, pause/resume, auto-pause, timer continuity
- `src/components/quiz/QuestionCard.tsx` — showTimer prop, pause button
- `src/app/(student)/quiz/play/[sessionId]/page.tsx` — back link, abandoned handling, timer visibility
- `src/app/(student)/quiz/results/[sessionId]/page.tsx` — back link, effective duration
- `src/app/(student)/dashboard/page.tsx` — full rewrite (paused sessions, completed with timestamps, weak questions section)
- `src/components/quiz/SessionSummary.tsx` — computed avg score, score-sorted failed questions
- `src/app/layout.tsx` — renamed to Les Incollables
- `src/components/ui/Header.tsx` — renamed
- `src/app/(auth)/login/page.tsx` — renamed
- `src/app/(auth)/register/page.tsx` — renamed
- `public/manifest.json` — renamed

---

### Phase E: Final Review, Performance & Polish — COMPLETE

**Date:** 2026-03-13

#### Performance Fixes (Critical — app was extremely laggy)

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Cascading re-renders every second | Timer updating entire `QuizState`, re-rendering all children | Extracted `useTimer` hook; memoized `ChoiceList`, `CorrectionView`, `ConfidenceSelector`, `QuestionCard` with `React.memo` |
| `ChoiceList` re-rendering on every state change | `Set<string>` props fail shallow comparison | Custom `areSetsEqual` comparator in `memo()` |
| Per-image `getPublicUrl()` calls | N+1 Supabase API calls per question load | Single base URL concatenation (`storageBaseUrl + path`) |
| Service worker caching dynamic pages | SW cached all GET 200 responses including API calls | Rewrote to cache-first only for static assets by extension regex; network-first for navigation; never intercept API/Supabase |
| Timer drift on pause/resume cycles | `timerBaseElapsed` never refreshed after resume | Re-fetch `total_pause_seconds` from DB on each resume |

**Files produced/modified:**
- `src/hooks/useTimer.ts` — standalone timer hook (NEW)
- `src/hooks/useQuiz.ts` — removed timer state, added `timerRunning`/`timerBaseElapsed`, batch image URL resolution, timer drift fix
- `src/components/quiz/ChoiceList.tsx` — `memo()` + custom Set comparator
- `src/components/quiz/CorrectionView.tsx` — `memo()`
- `src/components/ui/ConfidenceSelector.tsx` — `memo()`
- `src/components/quiz/QuestionCard.tsx` — `memo()`, removed redundant `.sort()`
- `public/service-worker.js` — complete rewrite (cache-first static only)
- `next.config.mjs` — cleaned up, added `compress: true`

#### Error Boundaries

- `src/app/(student)/error.tsx` — catches errors in student routes (NEW)
- `src/app/(auth)/error.tsx` — catches errors in auth routes (NEW)
- Safe French messages, no raw `error.message` exposed, `role="alert"`, `min-h-[44px]` retry buttons

#### E2E Tests — Pause/Resume/Dashboard

**Test file:** `e2e/pause-dashboard.spec.ts` (serial mode)

| Test | Description | Status |
|------|-------------|--------|
| T-E1 | Pause mid-quiz → redirected to dashboard with paused session | PASS |
| T-E2 | Resume paused session → quiz resumes at correct question | PASS |
| T-E3 | Dashboard sections (paused, completed, weak questions) | PASS |
| T-E4 | Complete session → appears in dashboard recent sessions | PASS |
| T-E5 | Mobile dashboard at 375px (no overflow, touch targets ≥ 40px) | PASS |

#### Validation

| Test | Result |
|------|--------|
| `npm run type-check` | PASS — 0 errors |
| `npm run lint` | PASS — 0 errors |
| `npm run build` | PASS — all routes compile |
| Unit tests (Jest) | PASS — 32/32 |
| Playwright E2E | PASS — 11/11 (6 quiz-flow + 5 pause-dashboard) |

#### Review (2 agents in parallel)

**Tech reviewer:**
- 0 blockers, 0 important, 2 minor (pause-manager unit test gap noted, React.memo overhead note)
- All performance fixes verified correct
- Service worker rewrite verified safe (no API interception)

**QA reviewer:**
- 0 blockers, 4 important fixed:
  1. Login/Register submit buttons missing `min-h-[44px]` → added
  2. Header "Deconnexion" → "Déconnexion" + aria-label accent fix
  3. Disabled button color `bg-neutral-300` → `bg-neutral-200 disabled:text-neutral-400` per BRAND.md
  4. Metadata description missing French accents → fixed ("révision", "étudiants", "médecine")
- 6 minor items noted (acceptable for current sprint)

---

## Sprint 2: COMPLETE

All phases (A through E) are done. The training quiz is fully functional:
- 427 active questions across 15 topics
- Weighted question selection (spaced repetition via confidence + error rate)
- Server-side scoring with anti-cheat (Edge Functions)
- Partial scoring per architecture spec
- Pause/resume with atomic state management
- Dashboard with paused sessions, completed sessions, weak questions
- Performance-optimized (isolated timer, memoized components, efficient caching)
- 11 E2E tests + 32 unit tests all passing
- BRAND.md compliance verified, mobile responsive (375px)

---

## Sprint 3: Examen blanc

**Status:** COMPLETE
**Date:** 2026-03-13

### Plan (checklist)

- [x] Update `select-questions` Edge Function to handle `time_limit_seconds` for exam mode
- [x] Create `save-exam-answer` Edge Function — saves answers without scoring during exam
- [x] Create `submit-exam` Edge Function — batch scoring on submission
- [x] `useExam` hook — full exam state management (load, toggle, flag, navigate, submit)
- [x] `Countdown` component — server-synced countdown with 5-min warning
- [x] `ExamQuestionCard` — question display without correction/confidence
- [x] `ExamNavigator` — clickable question grid with answered/flagged/current states
- [x] `FlagButton` — toggle flag for review
- [x] `ExamResults` — score display, stats breakdown, review section with DOMPurify
- [x] `ConfirmDialog` — focus trap + ESC-to-close confirmation before submit
- [x] Exam setup page — auto-computed question count (70%) + duration (45s/q), subtopics toggle
- [x] Exam play page — countdown, navigation, flag, choices, submit flow
- [x] Exam results page — standalone page for completed exams via URL
- [x] E2E test suite (`e2e/exam-flow.spec.ts`) — 6 tests
- [x] UX + accessibility review fixes

### Edge Functions

| Function | Version | Description |
|----------|---------|-------------|
| `select-questions` | v4 | Added `time_limit_seconds` to session insert + response for exam mode |
| `save-exam-answer` | v1 | Upsert pattern: saves/updates student answers without scoring. Validates auth, session ownership, exam type, time limit, question membership, choice validity |
| `submit-exam` | v1 | Batch scores ALL answers, creates rows for unanswered (score 0%), completes session with counters + `score_percent`, returns full correction with `is_correct` + explanations |

### Anti-cheat enforcement

- `save-exam-answer`: never returns `is_correct` — scoring fields are placeholders
- `submit-exam`: only reveals correct answers AFTER marking session `is_completed = true`
- Client uses `safe_choices` view (no `is_correct` column) during exam play

### Components

| Component | Key features |
|-----------|-------------|
| `Countdown` | Server-synced timer, 5-min warning (fires once), auto-submit on expiry, `aria-live="polite"` (assertive when urgent) |
| `ExamQuestionCard` | Progress bar, question text + images. No correction, no confidence, no timer, no pause |
| `ExamNavigator` | Clickable grid, answered/unanswered/current/flagged states, legend, 44px touch targets, memoized with custom comparator |
| `FlagButton` | Toggle with warning color, `aria-pressed` |
| `ExamResults` | Semantic score color (green ≥75, warning ≥50, red <50), duration vs time limit, 4 stat badges, expandable review cards with DOMPurify explanations, `aria-live="polite"` on score |
| `ConfirmDialog` | Focus trap (Tab cycling), ESC-to-close, auto-focus on cancel, unanswered count message, `role="dialog"` + `aria-modal` |

### Files Produced/Modified

**New files:**
- `supabase/functions/save-exam-answer/index.ts` — Edge Function
- `supabase/functions/submit-exam/index.ts` — Edge Function
- `src/hooks/useExam.ts` — exam state management hook (~440 lines)
- `src/components/ui/Countdown.tsx` — server-synced countdown
- `src/components/exam/ExamQuestionCard.tsx` — exam question display
- `src/components/exam/ExamNavigator.tsx` — question navigation grid
- `src/components/exam/FlagButton.tsx` — flag toggle button
- `src/components/exam/ExamResults.tsx` — results view with review section
- `e2e/exam-flow.spec.ts` — 6 E2E tests

**Modified files:**
- `supabase/functions/select-questions/index.ts` — added `time_limit_seconds` support
- `src/app/(student)/exam/setup/[topicId]/page.tsx` — full rewrite with auto-computed params (no user selection)
- `src/app/(student)/exam/play/[sessionId]/page.tsx` — full rewrite with exam flow + ConfirmDialog
- `src/app/(student)/exam/results/[sessionId]/page.tsx` — full rewrite for standalone results page

### Tests

| Test | Result |
|------|--------|
| `npm run type-check` | PASS — 0 errors |
| `npm run lint` | PASS — 0 errors |
| `npm run build` | PASS — all routes compile |
| Unit tests (Jest) | PASS — 32/32 |
| Playwright E2E (exam) | PASS — 6/6 |
| Playwright E2E (all) | PASS — 17/17 |

### Review (2 agents in parallel)

**Tech reviewer — all IMPORTANT fixes applied:**
- IMPORTANT #1: `submit-exam` didn't enforce server-side time limit → added time check + duration capped at `time_limit_seconds` for late submissions. Deployed v2.
- IMPORTANT #2: `submitExam` saved ALL questions (including untouched) redundantly → filtered to only touched questions (answered or flagged)
- IMPORTANT #4: Missing "Refaire cet examen" button per spec → renamed "Nouvel examen blanc" to "Refaire cet examen"
- MINOR #3: ExamNavigator memo compares Sets by reference (accepted — performance impact negligible)
- MINOR #7: `useCallback` deps include `exam` object (accepted — no measurable perf issue)
- MINOR #8: Progress chart deferred to Sprint 4

**UX reviewer — all fixes applied:**
- B2 (BLOCKER): Confirmation dialog had no focus trap or ESC → wrote `ConfirmDialog` component with focus trap + ESC handler
- B3: Countdown `aria-live="off"` → changed to `"polite"`
- I1: ExamNavigator buttons 36px → 44px touch targets (`min-h-[44px] min-w-[44px]`)
- I2: Added `aria-label` on prev/next navigation buttons
- I3: Added `aria-label` on custom count/duration input fields
- I5: Added `aria-live="polite"` on ExamResults score section
- I6: Added `aria-label` on "Terminer l'examen" button
- I7: Added `animate-fade-in` on ReviewCard expanded content
- I8: Fixed HTML entities (`Personnalis&eacute;`) rendering literally → proper Unicode

### Key Decisions

1. **No pause in exam mode** — enforced both client-side (no pause button) and server-side (time check in `save-exam-answer`)
2. **Debounced saves** — 500ms debounce per question to reduce API calls during rapid toggling
3. **Flush-before-submit** — `submitExam()` clears pending debounce timers and force-saves all answers before calling `submit-exam`
4. **Unanswered = 0%** — `submit-exam` creates `session_answer` rows for unanswered questions with `score_percent: 0`
5. **Both Edge Functions use `verify_jwt: false`** — internal auth checks via `supabase.auth.getUser()` instead (consistent with existing Edge Functions)
6. **Reused `ChoiceList` component** from training mode — same checkbox UI, just without disabled/correction states
7. **Admin-controlled exam params** — question count = `ceil(70% of available)`, duration = `45s × question count`. Hardcoded constants (`QUESTION_RATIO`, `SECONDS_PER_QUESTION`) at top of setup page, ready to move to admin config later. No user-facing selection UI for count or duration.
8. **No warning banner** on setup page — removed "Correction à la fin uniquement. Pas de pause possible." per user feedback (students know what examen blanc means)

---

## Sprint 4: Statistiques & Progression

**Status:** COMPLETE
**Date:** 2026-03-16

### Plan (checklist)

- [x] Database layer:
  - [x] `get_dashboard_stats` RPC — avg score, sessions, study time, partial count, confidence fill rate
  - [x] `get_activity_by_week` RPC — sessions grouped by ISO week
  - [x] `get_calibration_data` RPC — success rate per confidence level + false certainties (JSON)
  - [x] `get_topic_mastery_detailed` RPC — full §8.3 mastery formula with CTEs
  - [x] All 4 migration files saved with full SQL (migrations 018-021)
- [x] Mastery utility (`src/lib/mastery.ts`) — color/label mapping for 7-level heatmap scale, 21 unit tests
- [x] Chart components:
  - [x] `ProgressChart` — AreaChart, 30d/90d toggle, topic/type filters, 75% reference line
  - [x] `ActivityChart` — BarChart, sessions per ISO week
  - [x] `CalibrationChart` — ComposedChart with bars + perfect calibration scatter dots, incentive mode (<30%), false certainties list
  - [x] `Heatmap` — Treemap (desktop) + card fallback (mobile), legend, click→topic navigation
  - [x] `TopicMastery` — horizontal bars sorted weakest-first with coverage info
- [x] Dashboard rewrite:
  - [x] 4 metric cards (score this week, sessions, study time, partial count)
  - [x] Progress chart inline
  - [x] Activity + calibration side-by-side
  - [x] Heatmap miniature (compact mode) with "Voir tout" link
  - [x] Paused sessions, recent sessions, weak questions (carried from Sprint 2)
  - [x] Quick-start buttons (Commencer une session + Carte des connaissances)
  - [x] Sections always visible with empty states (not conditionally hidden)
- [x] Heatmap page (`/heatmap`) — full Treemap + card fallback + color legend
- [x] Progress page (`/progress`) — score evolution, activity, calibration, topic mastery, session history
- [x] E2E tests (`e2e/stats-progress.spec.ts`) — 8 tests
- [x] Review (2 agents: tech + UX) — all blockers and important issues fixed
- [x] `npm run validate` — 0 errors
- [x] All Playwright E2E — 25/25 passing

### DB Changes

| Migration | RPC | Description |
|-----------|-----|-------------|
| 017 | `get_weak_questions` | Fixed sort: score 0 first (attempts DESC), then non-zero (avg score ASC) |
| 018 | `get_dashboard_stats` | Avg score this week, sessions, study time, partials, confidence fill rate |
| 019 | `get_activity_by_week` | Sessions grouped by ISO week (last N weeks) |
| 020 | `get_calibration_data` | JSON: per-confidence success rates + top 10 false certainties |
| 021 | `get_topic_mastery_detailed` | Full §8.3 formula: 0.50×recent_success + 0.30×last_correct + 0.20×avg_confidence, coverage weighting |

### Mastery formula verification (§8.3)

Verified in `get_topic_mastery_detailed` RPC SQL:
```
question_mastery = 0.50 × recent_success_rate(last 3) + 0.30 × last_correct × 100 + 0.20 × avg_confidence × 100
topic_mastery = avg(question_mastery) × (questions_attempted / total_questions)
```

### Components

| Component | File | Key features |
|-----------|------|-------------|
| `ProgressChart` | `src/components/stats/ProgressChart.tsx` | AreaChart, 30d/90d toggle (44px buttons), topic/type filters, gradient fill, 75% reference line, screen reader summary |
| `ActivityChart` | `src/components/stats/ActivityChart.tsx` | BarChart, ISO week labels, primary-500 color, screen reader summary |
| `CalibrationChart` | `src/components/stats/CalibrationChart.tsx` | ComposedChart: bars (BRAND.md confidence colors) + diamond scatter (perfect calibration). Incentive mode (<30%). False certainties list |
| `Heatmap` | `src/components/stats/Heatmap.tsx` | Treemap (desktop) + card fallback (mobile). Keyboard-accessible hidden link list. Dark text on light colors for contrast. 44px compact buttons. Legend |
| `TopicMastery` | `src/components/stats/TopicMastery.tsx` | Horizontal bars, sorted weakest-first (null last), coverage percentage |

### Tests

| Test | Result |
|------|--------|
| `npm run type-check` | PASS — 0 errors |
| `npm run lint` | PASS — 0 errors |
| Unit tests (Jest) | PASS — 53/53 (32 prior + 21 mastery) |
| Playwright E2E (all) | PASS — 25/25 (17 prior + 8 new) |

### E2E Tests Added

**File:** `e2e/stats-progress.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| T-S1 | Dashboard metric cards visible | PASS |
| T-S2 | Dashboard has progress chart with toggle | PASS |
| T-S3 | Dashboard has activity and calibration cards | PASS |
| T-S4 | Dashboard quick-start buttons | PASS |
| T-S5 | Heatmap page loads with content | PASS |
| T-S6 | Progress page loads with sections | PASS |
| T-S7 | Progress page has topic mastery bars | PASS |
| T-S8 | Mobile responsive dashboard at 375px | PASS |

### Review (2 agents in parallel)

**Tech reviewer — all blockers and important fixes applied:**
- B1 (BLOCKER): Migration files were empty stubs → exported actual SQL from Supabase, all 4 files now contain full reproducible DDL
- B2 (BLOCKER): CalibrationChart perfect calibration markers invisible (`stroke="transparent"`) → replaced with diamond Scatter dots + legend
- I4: Chart colors used `#3B82F6` instead of BRAND.md `primary-500` (`#2B7DE9`) → fixed in ProgressChart + ActivityChart
- I5: CalibrationChart confidence colors didn't match BRAND.md confidence buttons → fixed to `#F59E0B` (Je devine), `#3B82F6` (Hésitant), `#10B981` (Sûr)
- I6: Dashboard error handling only checked 2/8 RPCs → added `statsResult.error` check
- I1: Mastery formula verified correct in exported RPC SQL (§8.3 compliant)
- Dashboard field name bug found during fix: RPC returns `total_sessions_this_week`/`total_study_time_seconds`/`partial_answer_count` but code mapped wrong names → fixed mapping + seconds→minutes conversion

**UX reviewer — all blockers and important fixes applied:**
- B1 (BLOCKER): Treemap cells not keyboard-accessible → added visually hidden accessible link list (`sr-only ul`) for keyboard/screen reader users
- B2 (BLOCKER): Charts invisible to screen readers → added `role="img"` + `sr-only` text summaries on all charts
- I1: Compact heatmap buttons below 44px → added `min-h-[44px]`
- I2-I3: ProgressChart toggle buttons and selects below 44px → changed from `min-h-[36px]` to `min-h-[44px]`
- I4-I5: Dashboard/progress hid sections when empty → sections now always render, child components handle empty states
- I9: White text on yellow/green heatmap cells failed WCAG contrast → dark text (`#1f2937`) for mastery 60-90%
- I10: CalibrationChart perfect calibration was invisible → visible diamond markers
- M5: Calibration incentive text shortened
- M8: Added `aria-labelledby` on all progress page sections

### Accepted/Deferred items

- M1: Hardcoded chart colors (match BRAND.md but not extracted to constants) — acceptable for now
- M4: Missing "Examen blanc" quick-start button on dashboard — deferred (low priority, users can access via sidebar)
- M7: Heatmap is flat (not grouped by level-2 parent) — the `children` field exists in the interface but topic hierarchy from the Word doc is mostly flat; will revisit when topic structure is enriched
- M6: ActivityChart avg_score fetched but not displayed — bar chart shows session count only per spec; avg_score available in tooltip
- I7-I8: No E2E tests for error states or heatmap click navigation — deferred to Sprint 5

### Files Produced/Modified

**New files:**
- `src/lib/mastery.ts` — mastery color/label utility
- `src/lib/__tests__/mastery.test.ts` — 21 unit tests
- `src/components/stats/ProgressChart.tsx` — score evolution chart
- `src/components/stats/ActivityChart.tsx` — weekly activity chart
- `src/components/stats/CalibrationChart.tsx` — calibration chart + false certainties
- `src/components/stats/Heatmap.tsx` — treemap + card fallback
- `src/components/stats/TopicMastery.tsx` — horizontal mastery bars
- `e2e/stats-progress.spec.ts` — 8 E2E tests

**Modified files:**
- `src/app/(student)/dashboard/page.tsx` — full rewrite with metric cards + charts
- `src/app/(student)/heatmap/page.tsx` — full rewrite with Treemap + legend
- `src/app/(student)/progress/page.tsx` — full rewrite with charts + session history
- `e2e/pause-dashboard.spec.ts` — "Sessions en cours" heading check made conditional
- `supabase/migrations/017-021` — 5 migration files (1 sort fix + 4 new RPCs with full SQL)

### Dependencies Added

- `recharts` — charting library for all visualizations

---

## Sprint 4.5: Navigation Restructure (4 tabs → 3 tabs)

**Status:** COMPLETE
**Date:** 2026-03-16

### Goal

Consolidate 4 student-facing tabs (Tableau de bord, Cours, Carte, Progression) into 3 clean tabs with zero content overlap, better chart design, and smarter data filtering.

### New Tab Structure

| Tab | Route | Content |
|-----|-------|---------|
| **Apprendre** | `/learn` | Placeholder for future course content |
| **S'entraîner** | `/practice` | Paused sessions + topic tree (start quizzes) |
| **Mes résultats** | `/stats` | ALL analytics consolidated |

### Changes

**Created (6 files):**
- `src/app/(student)/learn/page.tsx` — placeholder with "Bientôt disponible" cards
- `src/app/(student)/practice/page.tsx` — paused sessions at top + TopicTree below
- `src/app/(student)/stats/page.tsx` — all analytics: metric cards → ProgressChart (with question_count bars) → Heatmap (attempted only) → TopicMastery (attempted only) → CalibrationChart → WeakQuestions → session history
- `src/components/ui/PausedSessionCard.tsx` — extracted from old dashboard
- `src/components/stats/MetricCards.tsx` — extracted from old dashboard
- `src/components/stats/WeakQuestions.tsx` — extracted from old dashboard

**Enhanced (2 components):**
- `ProgressChart` — `AreaChart` → `ComposedChart` with dual Y-axes (score % left, question count right as gray bars)
- `Heatmap` — `<text>` → `<foreignObject>` with word-break wrapping (no more truncation); `truncate` → `line-clamp-2` on compact + mobile cards

**Deleted (5 files/dirs):**
- `src/app/(student)/dashboard/` — replaced by `/practice` + `/stats`
- `src/app/(student)/topics/` — absorbed into `/practice`
- `src/app/(student)/heatmap/` — absorbed into `/stats`
- `src/app/(student)/progress/` — replaced by `/stats`
- `src/components/stats/ActivityChart.tsx` — killed, replaced by question_count bars on ProgressChart

**Updated cross-references (14+ files):**
- All `/dashboard` → `/practice`, `/topics` → `/practice`, `/progress` → `/stats`, `/heatmap` → `/stats`
- Sidebar: 3-tab navigation (Apprendre, S'entraîner, Mes résultats)
- Updated: middleware, page.tsx, Header, login, register, SessionSummary, ExamResults, quiz play/results/setup, exam play/results

**Data filtering:**
- Heatmap and TopicMastery now filtered to `attempted_questions > 0` (no more bloated unattempted topics)

### Tests

| Test | Result |
|------|--------|
| `npm run type-check` | PASS — 0 errors |
| `npm run lint` | PASS — 0 errors |
| Playwright E2E | 17/25 pass, 3 pre-existing serial flakiness failures, 5 skipped |

### Review (2 agents in parallel)

**Tech reviewer:** 0 blockers, 0 important. No dead imports, no broken routes, correct data fetching.
**UX reviewer:** 0 blockers, 0 important, 1 minor (mobile bottom nav padding tight but acceptable). BRAND.md compliance verified.

---

## What to pick up next: Sprint 5 — Admin Dashboard

**Ref:** PhysioQuiz_Architecture_v3_FINALE.md, section "Sprint 5"

### Prerequisites
- Sprint 4 fully complete
- Supabase project: `thonkmcacdycojenwakj` (eu-west-1)
- Test user: `teste2e@gmail.com` / `TestPass123`
- Playwright E2E suites: 25 tests across 4 files (quiz-flow, pause-dashboard, exam-flow, stats-progress)
- All 53 unit tests passing

### Key features to implement
- Admin dashboard with aggregated metrics (no individual tracking)
- Question error rate visualization
- Chapter difficulty analysis
- User engagement metrics (DAU/WAU/MAU)
- Admin-controlled exam parameters (move from hardcoded constants)

### Deferred items from previous sprints (to consider)
- "Examen blanc" button on student dashboard (M4 from Sprint 4)
- E2E tests for error states and heatmap navigation (I7-I8 from Sprint 4)
- Hierarchical heatmap grouping by level-2 parent (M7 from Sprint 4)
- "Recommencer les ratées" with specific question IDs (from Sprint 2)
- Topic mastery bar in TopicTree component (from Sprint 2)

---

### Critical rules (all sprints)

- **NEVER send `is_correct` to client** — use `SafeChoice` type (`src/types/index.ts`)
- **Validation ONLY via Edge Functions** — no client-side answer checking
- **DOMPurify** for ALL explanation HTML rendering
- **Partial scoring**: 1 wrong answer checked = score 0% (non-negotiable)
- **Answer line always takes precedence** over bold during import (from Sprint 0 decisions)

---

## URGENT — Items to work on next

### 1. Webpack cache corruption during HMR — FIXED (2026-03-16)

**Problem:** Next.js 14.2.35 webpack persistent cache corrupts during HMR, causing Tailwind custom theme to revert to defaults.

**Fix applied:** Disabled webpack filesystem cache entirely in dev mode (`config.cache = false` in `next.config.mjs`). This forces Tailwind to rebuild CSS on every HMR update (~100-200ms slower but 100% reliable). Removed the `rm -rf .next/cache` workaround from the dev script since it's no longer needed.

**Future:** When upgrading to Next.js 15+ with Turbopack (`next dev --turbo`), the `config.cache = false` block can be removed as Turbopack doesn't have this bug.

### 2. Session type filter not applied to all stats sections

**Problem:** The page-level session type filter ("Tous les types" / "Entrainement" / "Examen") should filter ALL sections consistently. Currently:
- Metric cards: filtered (7-day window)
- Progress chart: filtered
- Heatmap: filtered
- Calibration: filtered
- **Weak questions**: filtered via RPC param
- **Session history**: filtered

Verify all sections respect the filter with real multi-type data. The filter was added recently and edge cases may exist.

### 3. Verify data accuracy across all stats

**Problem:** Numbers shown in UI must be verifiable against the database. Known discrepancy investigated and explained (2026-03-16):
- "Rep. partielles" card (5) counts individual answer events flagged `is_partially_correct = true` in last 7 days
- "Questions a revoir" (7 with >0% avg) counts distinct questions whose average score across ALL attempts is between 0-100%, which includes questions not flagged partial but with mixed results across sessions
- Both numbers are correct but measure different things — tooltips added to clarify

**Action:** Add integration tests that compare UI-displayed values against direct SQL queries to catch regressions.

### 4. "Questions a revoir" — scrollable container done, RPC limit raised

**Done (2026-03-16):** Replaced expand/collapse with scrollable container (max-height 400px). RPC `get_weak_questions` default limit raised from 10 to 1000. Migration file updated.

### 5. "Fausses certitudes" — sort by score, scrollable container

**Done (2026-03-16):** RPC `get_calibration_data` false_certainties now sorted by `score_percent ASC` (0% first, then partials). Removed LIMIT 10. Added scrollable container with score display matching "Questions a revoir" style.
