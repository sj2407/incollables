# PhysioQuiz

## Project
PWA medical quiz app (Physiology) for med students.
Stack: Next.js 14 + Tailwind CSS + Supabase + TypeScript.
Preprocessing scripts: Python + python-docx.

## Session Continuity
**Always start a new session by reading the "CURRENT STATE" section at the top of `docs/PROGRESS.md`** — it describes:
- The current architecture and active components (DO NOT REVERT)
- What's broken and needs fixing
- What's working and should NOT be changed

### IMPORTANT: Admin "Base de données" architecture
The admin database view uses **AG Grid spreadsheet** (`QuestionGrid.tsx`) with inline editing and popup editors. It does NOT use a side panel for editing existing questions. `QuestionSidePanel.tsx` is ONLY used for creating NEW questions via the "+ Question" button. Do NOT revert to side panel editing — this was an intentional architecture decision.

**FORBIDDEN ACTIONS:**
- Do NOT replace QuestionGrid.tsx with a table or side panel
- Do NOT add row-click handlers that open editing panels
- Do NOT create new "editor" components that replace the spreadsheet
- Do NOT remove or rename QuestionGrid.tsx, PropositionPopup.tsx, CorrectAnswersPopup.tsx, TipTapEditor.tsx, adminAutoSave.ts

Key admin files:
- `src/components/admin/QuestionGrid.tsx` — AG Grid spreadsheet (main editing surface)
- `src/app/(admin)/admin/questions/page.tsx` — page with filters, bulk actions, Synchroniser
- `src/components/admin/PropositionPopup.tsx` — propositions editor
- `src/components/admin/CorrectAnswersPopup.tsx` — correct answers editor
- `src/components/admin/TipTapEditor.tsx` — WYSIWYG explanation editor
- `src/lib/adminAutoSave.ts` — auto-save + draft mode
- `e2e/admin-spreadsheet.spec.ts` — 21 acceptance tests

## Reference Documents
- **Current state & next steps: docs/PROGRESS.md** ← **READ THE "CURRENT STATE" SECTION FIRST every session**
- Architecture (master plan): PhysioQuiz_Architecture_v3_FINALE.md (NOTE: admin section is outdated — the real admin architecture is in PROGRESS.md)
- Error log: docs/ERROR_LOG.md
- Design system: docs/BRAND.md (colors, fonts, sizes — single source of truth)

## Sprint/Phase Workflow (MANDATORY)

Every sprint follows this exact sequence:

### 1. PLAN (before any code)
- Read the relevant section of the architecture doc
- Create a detailed checklist of all tasks
- Identify edge cases, risks, and dependencies
- Present the plan to the user for approval before proceeding

### 2. IMPLEMENT
- Work through the checklist task by task
- Write tests alongside the code whenever possible
- Mark checklist items as done as you go

### 3. TEST
- Run all tests and capture results
- For scripts: run on actual data and verify output
- For frontend: run `npm run validate` (type-check + lint)
- Document which tests passed and which failed

### 4. REVIEW (after implementation is complete)
- Launch 2 review agents **in parallel**:
  - **Agent 1 — Technical reviewer**: checks code quality, spec compliance against the architecture doc, security, correctness
  - **Agent 2 — QA reviewer**: checks edge cases, test coverage, output quality against what we set out to achieve
- Both agents report findings with severity (blocker / important / minor)

### 5. FIX & DOCUMENT
- Fix all blockers and important issues found by reviewers
- Re-run tests to confirm fixes
- Write a summary in docs/PROGRESS.md:
  - What was planned vs what was done
  - Tests that passed
  - Issues found and fixed
  - Any deviations from the architecture doc

## Available Resources & Skills
- **frontend-design skill**: Consult before creating any UI component
- **Supabase MCP**: Use directly for DB operations — don't ask the user to run SQL manually
- **Playwright MCP**: Use for end-to-end testing when available
- If a tool/connector exists that can automate work, ask the user to enable it rather than doing manual workarounds

## Testing Rules (NON-NEGOTIABLE)
- **Always run Playwright E2E tests before asking the user to manually test.** Use the test suite in `e2e/` to catch obvious errors (crashes, broken flows, missing data). Never waste the user's time with bugs that automated tests would have caught.
- Playwright config: `playwright.config.ts`, test user: `teste2e@gmail.com` / `TestPass123`
- After any UI change, run `npx playwright test` to verify nothing is broken before involving the user.

## Problem-Solving Rules
- **Never guess**: If anything is unclear about requirements, data format, or expected behavior — ask the user
- **Don't loop on errors**: If the same error occurs 3+ times, search online (dev forums, GitHub issues, Stack Overflow) for solutions. Do not retry the same failing approach endlessly
- **Error log**: Keep a running log of errors and their correct solutions in `docs/ERROR_LOG.md` so we don't repeat mistakes

## Design Consistency
- All UI must follow `docs/BRAND.md` (primary colors, secondary colors, fonts, sizes, spacing, border radius, shadows)
- Never hardcode one-off colors or font sizes — always reference the design system
- If BRAND.md doesn't exist yet, create it at Sprint 1 and get user approval on the palette before building UI

## Git Rules
- **Never push to git or ask to push** — the user will push when they decide to

## Critical Rules (NON-NEGOTIABLE)
- Original Word document is NEVER modified (always work on a copy)
- NEVER send correct answers to the client before validation
- Validation happens ONLY via server-side Edge Functions
- Partial scoring: 1 wrong answer checked = score 0%
- Exam mode: server-side timer, NO pause allowed
- Admin view: aggregated metrics ONLY, no individual tracking
- All dynamic HTML MUST go through DOMPurify
