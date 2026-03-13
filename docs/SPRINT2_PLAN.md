# Sprint 2 — Quiz entraînement — DETAILED PLAN

**Status:** IN PROGRESS (Phases A-D complete, Phase E next)
**Created:** 2026-03-13

## Workflow per phase

```
IMPLEMENT → TEST → REVIEW (2 agents parallel) → FIX → next phase
```

Execution order: Phase A → B → C → D → E

---

## Phase A: Import Script

**Status:** COMPLETE ✓

### Implement

| # | Task | Details | Done |
|---|------|---------|------|
| A1 | Create Supabase Storage bucket | `question-images` bucket with SELECT policies (auth+anon), INSERT for service_role | [x] |
| A2 | `scripts/requirements.txt` | Added `mammoth`, `supabase`, `Pillow`, `python-dotenv` | [x] |
| A3 | `scripts/import_to_db.py` — Topic parsing | Two-pass parser: Pass 1 identifies question boundaries, Pass 2 parses with chapter context. `is_valid_chapter_title()` filter + `clean_chapter_title()` | [x] |
| A4 | Question + choices parsing | question_text (plain text), propositions A-E+ → `choices` rows, answer line → `is_correct` per choice | [x] |
| A5 | Image extraction + upload | 54 images extracted → uploaded to `question-images` bucket → `question_images` rows with storage_path | [x] |
| A6 | Explanation → HTML via mammoth | Explanation paragraphs → temp .docx → mammoth HTML. Images matched by blob content to Storage URLs | [x] |
| A7 | Inactive flagging | `is_active = false` for 30 missing answers + 10 zero-proposition + post-import safety checks (0 correct answers, <3 propositions) | [x] |
| A8 | Idempotency | Script clears all data before import (cascading deletes) | [x] |
| A9 | Dry-run mode | `--dry-run` flag parses and reports counts without DB writes | [x] |

### Test

| # | Test | Expected result | Pass |
|---|------|-----------------|------|
| T-A1 | Run `--dry-run` on standardized doc | 465 questions, 15 topics, 54 images detected | [x] |
| T-A2 | Run full import | 465 questions, 2253 choices, 54 images in Storage | [x] |
| T-A3 | `SELECT COUNT(*) FROM questions WHERE is_active = false` | 38 (30 missing + 10 zero-prop − 2 overlap + post-import safety deactivations) | [x] |
| T-A4 | `SELECT COUNT(*) FROM topics` | 15 topics | [x] |
| T-A5 | Spot-check 5 questions | Verified against Word doc | [x] |
| T-A6 | Spot-check 3 explanations with images | `<img>` tags point to valid Storage URLs | [x] |
| T-A7 | Spot-check 2 explanations with tables | `<table>` HTML well-formed | [x] |
| T-A8 | Re-run import (idempotency) | Same counts, no duplicates | [x] |
| T-A9 | Unit tests (`scripts/test_import.py`) | 63 tests — all passing | [x] |

### Review (2 agents in parallel)

- **Agent 1 — Tech reviewer:** 0 blockers. 2 important fixed: (1) `convert_image` multi-image bug — was returning first URL regardless of image, fixed with blob-content matching + sequential fallback. (2) Missing SELECT storage policies — re-created. 1 minor fixed: unescaped fallback HTML.
- **Agent 2 — QA reviewer:** 1 blocker fixed: 6 active questions with 0 correct answers (Q140,143,154,384,392,424) — deactivated via SQL + added post-import safety check. 1 important fixed: 3 questions with <3 propositions still active — added to safety check. 1 important noted: flat topic hierarchy (12/15 under "Préface") — known limitation from Word doc's inconsistent heading styles.

### Fix

All blockers and important issues fixed. 63/63 tests passing. Final DB state: 465 questions (427 active, 38 inactive), 15 topics, 2253 choices, 54 images.

---

## Phase B: Edge Functions + Scoring Logic

**Status:** COMPLETE ✓

### Implement

| # | Task | Details | Done |
|---|------|---------|------|
| B1 | `lib/scoring.ts` | `scoreAnswer()` function per §5bis.2: 1 wrong checked = 0%, partial = correct/total, all correct = 100%. Shared types for scoring results | [x] |
| B2 | `lib/quiz-engine.ts` | `calculateWeights()` per §5.2 (3 cases: never seen = 0.70, with confidence, without confidence). `weightedSampleWithoutReplacement()` per §5.3. Proposition shuffler (Fisher-Yates) | [x] |
| B3 | `supabase/functions/select-questions/index.ts` | Edge Function: receive `topic_id`, `session_type`, `question_count`, `include_subtopics`, `user_id`. Query `question_user_stats` view. Apply selection algorithm. Create `sessions` row. Return shuffled `SafeChoice[]` (NO `is_correct`). Handle 3 modes: weighted (short), shuffle-all, uniform (exam) | [x] |
| B4 | `supabase/functions/validate-answer/index.ts` | Edge Function: receive `session_id`, `question_id`, `selected_choice_ids[]`, `confidence`. Fetch `choices` with `is_correct` server-side. Call `scoreAnswer()`. Insert `session_answer` + `session_answer_choices`. Update `sessions` counters. Return `is_correct`, `is_partially_correct`, `score_percent`, `correct_choices[]`, `explanation_html` | [x] |
| B5 | Auth checks in Edge Functions | Verify JWT, verify session belongs to user, verify question belongs to session | [x] |
| B6 | Session completion | When last question answered, set `is_completed = true`, `completed_at = NOW()`, calculate `score_percent` | [x] |

### Test

| # | Test | Expected result | Pass |
|---|------|-----------------|------|
| T-B1 | Unit test `scoreAnswer()` — 7 cases from §5bis.3 | All pass: (A)→33%, (A,C)→66.7%, (A,C,E)→100%, (A,B)→0%, (A,C,B)→0%, (B,D)→0%, (nothing)→0% | [x] |
| T-B2 | Unit test `scoreAnswer()` — edge: single correct answer | 1 correct of 1 = 100%, 0 of 1 = 0% | [x] |
| T-B3 | Unit test `calculateWeights()` — case 1 (never seen) | Returns 0.70 | [x] |
| T-B4 | Unit test `calculateWeights()` — case 2 (with confidence) | Matches formula: 0.40×diff + 0.35×forget + 0.25×uncertainty | [x] |
| T-B5 | Unit test `calculateWeights()` — case 3 (no confidence) | Matches formula: 0.53×diff + 0.47×forget | [x] |
| T-B6 | Unit test `calculateWeights()` — false certainty bonus | Weight × 1.5, capped at 1.0 | [x] |
| T-B7 | Unit test `weightedSampleWithoutReplacement()` | Returns N unique questions, all from pool | [x] |
| T-B8 | Unit test proposition shuffler | All choices present, order changed | [x] |
| T-B9 | Deploy `select-questions` + test via Supabase MCP | Creates session, returns SafeChoice (verify NO `is_correct` field) | [x] |
| T-B10 | Deploy `validate-answer` + test via Supabase MCP | Returns correction data, session_answer row created, counters updated | [x] |
| T-B11 | Anti-cheat test | Verify client response from `select-questions` contains zero `is_correct` fields | [x] |
| T-B12 | `npm run validate` | Type-check + lint = 0 errors | [x] |

### Review (2 agents in parallel)

- **Agent 1 — Tech reviewer:** Anti-cheat verification (no `is_correct` leaks in any response), scoring formula correctness vs §5bis, weight formula correctness vs §5.2, Edge Function auth checks, RLS compliance, SQL injection prevention, session counter atomicity
- **Agent 2 — QA reviewer:** Test coverage completeness (all scoring edge cases), selection algorithm fairness (verify weights distribute correctly), verify session lifecycle (create → answer → complete), check error handling (invalid session_id, double-answer same question, etc.)

### Fix

Address all blockers/important, re-run tests.

---

## Phase C: UI Components

**Status:** COMPLETE ✓

### Implement

| # | Task | Details | Done |
|---|------|---------|------|
| C1 | `hooks/useTopics.ts` | Fetch topic tree from Supabase, shared utilities, question count via RPC | [x] |
| C2 | `components/ui/TopicTree.tsx` | Recursive accordion, question count badges, 44px touch targets, aria-expanded | [x] |
| C3 | `/topics` page | Full page with TopicTree, skeleton, retry on error | [x] |
| C4 | `/quiz/setup/[topicId]` page | Two-step flow (select count → [Démarrer]), subtopics toggle, exam mode link | [x] |
| C5 | `hooks/useQuiz.ts` | Full quiz state, safe_choices view, timer (Date.now delta), focus management | [x] |
| C6 | `components/quiz/QuestionCard.tsx` | Progress bar (X/N), timer (MM:SS), question text, images via getPublicUrl | [x] |
| C7 | `components/quiz/ChoiceList.tsx` | SafeChoice checkboxes, post-validation coloring, correct-reveal/wrong-shake animations | [x] |
| C8 | `components/ui/ConfidenceSelector.tsx` | 3 toggle buttons per BRAND.md, role="group", aria-pressed | [x] |
| C9 | `components/quiz/CorrectionView.tsx` | Score feedback, partial message, DOMPurify (isomorphic), aria-live | [x] |
| C10 | `/quiz/play/[sessionId]` page | Full quiz flow with focus management, empty submission guard, active:scale-[0.97] | [x] |
| C11 | `components/quiz/SessionSummary.tsx` | Semantic score color, stats breakdown, expandable failed questions, 3 action buttons | [x] |
| C12 | `/quiz/results/[sessionId]` page | Parallel data fetch via RPC, sorted answers/choices, retry on error | [x] |
| C13 | All BRAND.md compliance | Colors, animations, shadows, fonts, spacing, border-radius all verified | [x] |

### Test

| # | Test | Expected result | Pass |
|---|------|-----------------|------|
| T-C1 | `npm run type-check` | 0 errors | [x] |
| T-C2 | `npm run lint` | 0 errors, 0 warnings | [x] |
| T-C3 | `npm run build` | All routes compile successfully | [x] |
| T-C4 | Playwright E2E: Login + `/topics` page | Topic tree renders, 15 topic links, question count badges visible | [x] |
| T-C5 | Playwright E2E: quiz setup → start session | Session created, redirects to play page, choices visible | [x] |
| T-C6a | Playwright E2E: validate button disabled (no choice) | Button disabled when no choice selected | [x] |
| T-C6b | Playwright E2E: select + validate + correction | CorrectionView with score + "Question suivante" button | [x] |
| T-C7 | Playwright E2E: complete quiz + results | Score %, Correctes/Partielles/Incorrectes stats, expandable failed questions | [x] |
| T-C8 | Playwright E2E: mobile responsive (375px) | All buttons ≥ 40px touch target, no horizontal scroll | [x] |
| T-C9 | Visual check: BRAND.md compliance | Deferred to Phase E final review | [pending] |

### Review (6 agents — 2 per cluster)

All reviews completed. See `docs/PROGRESS.md` for detailed findings per cluster.

### Fix

All blockers and important issues fixed across 3 clusters. See PROGRESS.md for full list.

---

## Phase D: Pause/Resume + Dashboard

**Status:** COMPLETE ✓

### Implement

| # | Task | Details | Done |
|---|------|---------|------|
| D1 | `lib/pause-manager.ts` | Atomic conditional pause/resume, `isAbandoned()` (7-day threshold) | [x] |
| D2 | Pause button in quiz header | Training mode only. Clicking pauses + redirects to dashboard | [x] |
| D3 | Auto-pause hooks | `visibilitychange` → pause when tab hidden (training only). `sendBeacon` rejected (POST-only, no auth) | [x] |
| D4 | `/dashboard` page | Paused sessions, recent completed (with timestamps), aggregated weak questions (top 3 + expand), quick-start | [x] |
| D5 | Resume flow | Auto-resume on play page load, timer continues from `baseElapsedRef` | [x] |
| D6 | Abandoned check | >7 days paused → "Session expirée" message + redirect to topics | [x] |
| D7 | Effective duration in summary | `duration_seconds - total_pause_seconds` displayed on results page | [x] |

### Test

| # | Test | Expected result | Pass |
|---|------|-----------------|------|
| T-D1 | `npm run validate` | 0 errors | [x] |
| T-D2 | `npm run build` | Compiles | [x] |
| T-D3 | Manual test: pause mid-quiz | Session saved, dashboard shows paused session | [x] |
| T-D4 | Manual test: resume | Quiz resumes at correct question, timer accounts for pause | [x] |
| T-D5 | Manual test: auto-pause (switch tab) | `visibilitychange` fires, session paused | [x] |
| T-D6 | Manual test: dashboard | Shows paused sessions + recent sessions + weak questions | [x] |
| T-D7 | Unit test `pause-manager.ts` | 6 tests: `isAbandoned` boundary cases — all passing | [x] |

### Review (2 agents in parallel)

- **Agent 1 — Tech reviewer:** 2 blockers fixed (sendBeacon removal, race condition → atomic conditional UPDATE), 2 important fixed (error handling, timer race)
- **Agent 2 — QA reviewer:** 3 important fixed (timer in training mode, back navigation, 0% score display), minor French copy fixes

### Fix

All blockers and important issues fixed. 2 rounds of user feedback addressed. App renamed to "Les Incollables".

---

## Phase E: Final Sprint Review + Documentation

**Status:** TO DO

| # | Task | Done |
|---|------|------|
| E1 | `npm run validate` — 0 errors | [ ] |
| E2 | `npm run build` — compiles | [ ] |
| E3 | Full end-to-end walkthrough: register → topics → setup → play quiz → validate answers → correction → summary → pause → resume → complete | [ ] |
| E4 | Update `docs/PROGRESS.md`: planned vs done, all test results, issues found/fixed per phase, deviations from architecture | [ ] |

---

## Reference sections in architecture doc

- §2.2-2.4: Word format, preprocessing rules, image handling
- §5.1-5.5: Selection algorithm (3 modes, weight formula, sampling)
- §5bis: Scoring rules (partial scoring formula, 7 examples)
- §5ter: Pause/Resume (behavior, edge cases, UI)
- §9.1: Screen flow (student journey)
- §11: File structure
- §12: Security & anti-cheat
- Sprint 2 tasks: line 1751

## Critical rules (from CLAUDE.md)

- **NEVER send `is_correct` to client** — use `SafeChoice` type
- **Validation ONLY via Edge Function** — no client-side answer checking
- **DOMPurify** for ALL explanation HTML rendering
- **Partial scoring**: 1 wrong answer checked = score 0% (non-negotiable)
- **Answer line always takes precedence** over bold during import
