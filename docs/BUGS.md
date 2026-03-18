# Les Incollables — Bug Tracker

---

## BUG 1 — CRITICAL: Admin changes are immediately visible to students without Synchroniser

**Status:** OPEN — NOT FIXED
**Severity:** CRITICAL
**Discovered:** 2026-03-18

### Description
When the admin changes chapter/sub-chapter assignments in the admin dashboard, the changes are immediately visible in the student "S'entraîner" view. The Synchroniser button shows "À jour ✓" even though changes were just made and NOT published.

### What should happen
Admin edits should be invisible to students until the admin explicitly clicks "Synchroniser → Publier". The student view should show the LAST PUBLISHED state, not the current admin working state.

### Root cause
The student quiz flow (`select-questions` edge function and `useTopics` hook) reads directly from the `questions` and `topics` tables. When the admin changes `topic_id` on a question, the change is immediate in the DB. The `is_draft` flag was supposed to filter out unpublished questions, but:
1. The hash-based trigger sets `is_draft = true` only when `published_hash` differs — but the migration set `published_hash = current_hash` as baseline, so all recent changes are considered "published"
2. The student topic tree (`useTopics.ts`) queries the `topics` table directly — there's no "published topics" concept
3. The `select-questions` edge function filters `.eq('is_draft', false)` but since the trigger only sets `is_draft = true` when `current_hash != published_hash`, and we just baseline'd everything, no questions are flagged

### What needs to change
The entire architecture needs a "published snapshot" that students read from, separate from the admin's working copy. Options:
- A) Shadow tables (`published_questions`, `published_choices`, `published_topics`) that students read from. Admin edits the main tables. Synchroniser copies main → shadow.
- B) A `published_` prefix on key columns (e.g., `published_topic_id`) that the student view reads. Admin edits the main columns. Synchroniser copies main → published.
- C) Row versioning with a `version` column — students read the latest published version.

### Impact
Students currently see:
- New chapter "Système nerveux" with 140 questions (admin just reclassified these)
- Old sub-chapters with "0 questions" (questions were moved away)
- New sub-chapters that shouldn't be visible yet

---

## BUG 2 — Session topic_id mismatch after reclassification

**Status:** OPEN — NOT FIXED
**Severity:** HIGH
**Discovered:** 2026-03-18

### Description
When admin moves questions from one sub-chapter to another, the `sessions` table still references the OLD `topic_id`. This creates a mismatch:
- Session says student practiced "Transmission synaptique"
- But that topic now has 0 questions
- The actual questions are under "Neurone et Transmission synaptique"

### Affected data
- 41 sessions reference "Préface" (level 1) — 32 empty, 7 single-topic, 2 mixed
- 1 session references "Le cervelet latéral" (old, 0 questions) — should point to new "Le cervelet latéral" under Système nerveux
- 2 sessions reference "Transmission synaptique" (0 questions) — should point to "Neurone et Transmission synaptique"

### What needs to change
One-time surgical SQL update to reassign session topic_ids to match where their questions currently live. Then ongoing: when questions are moved via Modifier, sessions are NOT affected (sessions are historical records). But the student stats page should handle orphaned topics gracefully.

### Impact
Student stats page may show confusing mix of old and new chapter names.

---

## BUG 3 — "Gérer chapitres" cannot delete topics with sessions

**Status:** OPEN — NOT FIXED
**Severity:** MEDIUM
**Discovered:** 2026-03-18

### Description
In "Gérer les chapitres", the admin cannot delete old sub-chapters (like "Transmission synaptique" under Préface) even though they have 0 questions. The error says "Ce chapitre a des sessions associées. Désactivez-le plutôt."

### Root cause
`TopicManagerPanel.tsx` checks for sessions referencing the topic before deleting. The `sessions.topic_id` has `ON DELETE CASCADE`, so deleting a topic would cascade-delete all its sessions — losing student progress data.

### What needs to change
After BUG 2 is fixed (sessions reassigned), the old topics will have 0 sessions and become deletable. Alternatively, the delete logic could offer to reassign sessions before deleting.

---

## BUG 4 — TipTap editor strips images on save (PARTIALLY FIXED)

**Status:** PARTIALLY FIXED — image extension installed on feature branch
**Severity:** HIGH
**Discovered:** 2026-03-18

### Description
The TipTap explanation editor didn't include the `@tiptap/extension-image`. When loading HTML with `<img>` tags, TipTap silently dropped them. If the admin opened an explanation and clicked "Enregistrer", the image was permanently deleted.

### Fix applied (feature branch `fix/tiptap-image-extension`)
- Installed `@tiptap/extension-image@2.27.2`
- Added `Image.configure({ inline: false, allowBase64: false })` to TipTap extensions
- Added CSS to normalize heading sizes in explanations

### Remaining issues
- 6 questions have `<h1>` wrappers around content (from Word import) — CSS fix applied but data not cleaned
- 5 questions have `.wmf` images — browsers can't render WMF natively, shows broken image icon
- 41 questions with 52 images total — all preserved, none lost

---

## BUG 5 — Font size inconsistency in TipTap editor (FIXED)

**Status:** FIXED on feature branch
**Severity:** LOW
**Discovered:** 2026-03-18

### Description
Some explanations display with huge text in the TipTap editor due to `<h1>` tags from the Word import. CSS normalization added: `[&_h1]:text-base [&_h1]:font-normal`.

---

## Priority order for fixes

1. **BUG 1** — CRITICAL: Student view must not show unpublished changes. Requires architecture change (shadow tables or similar).
2. **BUG 2** — HIGH: Session reassignment. One-time SQL fix, surgical.
3. **BUG 3** — MEDIUM: Depends on BUG 2 being fixed first.
4. **BUG 4** — PARTIALLY FIXED: Image extension on feature branch, needs merge to main.
5. **BUG 5** — FIXED: On feature branch.
