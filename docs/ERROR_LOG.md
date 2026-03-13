# Les Incollables — Error Log

## Sprint 0

### E1: Python 3.13 regex `(?i)` inline flag error
- **Error:** `re.PatternError: global flags not at the start of the expression`
- **Cause:** Python 3.13 no longer allows `(?i)` inline flags in the middle of patterns.
- **Fix:** Replaced all `(?i)` with `re.IGNORECASE` flag parameter on 9 regex calls.

### E2: 128 questions with 0 propositions
- **Error:** Most questions had no propositions detected.
- **Cause:** Only checked `Paragraphe de liste` and `pl` styles for propositions. Many use `Normal` or `Footer` style with `numPr`.
- **Fix:** Changed detection to `is_list_item = has_num` — check `numPr` on ANY style, not just list styles.

### E3: "I" parsed as answer letter
- **Error:** Letter "I" appearing in answer sets (e.g., "Réponse : A, I et E").
- **Cause:** Typo in original document (I instead of D), or roman numeral "II" split into two "I"s.
- **Fix:** (1) Reject concatenated roman numerals in `parse_answer_letters`. (2) When line answers contain invalid letters and bold doesn't, prefer bold source.

### E4: 926 false chapter detections
- **Error:** `is_chapter_title()` matched nearly every bold paragraph as a chapter.
- **Cause:** Heuristic too aggressive — any bold paragraph was treated as a chapter.
- **Fix:** Strict heuristic: max 80 chars, not list style, must have counter `(30)` or known medical keyword.

### E5: Q8 repeated 30+ times in warnings
- **Error:** `print_report()` output flooded with Q8 warnings.
- **Cause:** Bug searched all questions for each warning string; Q8's warning text matched multiple questions.
- **Fix:** Collect warnings per-question directly instead of searching.

### E6: `UnboundLocalError: prop_letters`
- **Error:** Variable used before assignment in answer resolution logic.
- **Cause:** `prop_letters` was defined after the if/elif block that used it.
- **Fix:** Moved `prop_letters = {p.letter for p in question.propositions}` before the answer resolution logic.

### E7: 442 questions instead of 465
- **Error:** 23 questions not detected.
- **Cause:** `is_question_heading` regex only matched `^question\s*(\d+)?\s*$`. Missed variants: "Question :", "Question n°1", "Question (guenard)".
- **Fix:** Added patterns for colon suffix and `n°N` format. Also added diagnostic to find unmatched "Question" paragraphs.

### E8: `is_answer_line` missed "Réponse:A"
- **Error:** Answer lines without space after colon not detected.
- **Cause:** Regex required whitespace after colon.
- **Fix:** Added third regex branch: `r'r[ée]ponses?\s*:[A-Za-z]'`.

### E9: Images and tables lost in standardized output (B2)
- **Error:** 54 images and 4 tables from original document missing in standardized .docx.
- **Cause:** `write_standardized_docx()` created a new Document from scratch, writing only text. Image-only paragraphs (empty text) were skipped by `if not text: continue`.
- **Fix:** (1) Track explanation and stem paragraph indices during parsing. (2) Build paragraph→body-element map to capture interleaved tables. (3) Deep-copy original XML elements with image relationship remapping (`copy_body_element`). (4) Don't skip empty paragraphs in explanation/stem states.

### E10: `is_chapter_title()` break causing lost explanation content
- **Error:** Q2's explanation lost paragraphs 76-81 (including a nerve conduction diagram image).
- **Cause:** Para 76 "Zone de conduction de l'influx nerveux :" matched `is_chapter_title()` (keyword "nerveux" + bold), causing premature `break` from explanation state.
- **Fix:** Removed `is_chapter_title()` break from explanation state — the `end_i` boundary (next question start) is sufficient. Trade-off: some inter-question chapter titles now appear in explanation zones.
