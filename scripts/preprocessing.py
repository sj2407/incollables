#!/usr/bin/env python3
"""
preprocessing.py — Sprint 0: Transform original Word document into standardized copy.

Pipeline:
  1. Convert .doc to .docx via LibreOffice (if needed)
  2. PASS 1: Reconstruct missing answers from bold formatting
  3. PASS 2: Standardize format (normalize answers, remove bold, renumber, etc.)
  4. Write standardized .docx output

The original file is NEVER modified.
"""

import argparse
import hashlib
import os
import re
import subprocess
import sys
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Pt, Inches


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class Proposition:
    """A single proposition (A, B, C, ...) within a question."""
    letter: str          # 'A', 'B', 'C', ...
    text: str            # proposition text (without the letter prefix)
    is_bold: bool        # whether the proposition was bold in the original
    para_indices: list    # paragraph indices in the source document


@dataclass
class Question:
    """A parsed question block."""
    original_number: str          # number as found in the original (may be empty)
    sequential_number: int = 0    # assigned during Pass 2
    stem_text: str = ""           # the question stem/énoncé
    propositions: list = field(default_factory=list)  # list of Proposition
    answer_line: str = ""         # raw answer line from original
    answer_letters: list = field(default_factory=list)  # parsed answer letters ['A', 'C', 'E']
    answer_source: str = ""       # 'line', 'bold', 'both', 'none'
    explanation_text: str = ""    # explanation text (may be empty)
    warnings: list = field(default_factory=list)
    # Paragraph ranges in the source document
    start_para: int = 0
    end_para: int = 0
    answer_para_index: int = -1   # paragraph index of the answer line (-1 if none)
    stem_para_indices: list = field(default_factory=list)  # para indices for stem
    explanation_para_indices: list = field(default_factory=list)  # para indices in explanation zone
    chapter_path: list = field(default_factory=list)  # hierarchy of chapter titles


@dataclass
class Chapter:
    """A chapter/section heading."""
    title: str
    level: int           # 1, 2, 3, ...
    para_index: int
    original_title: str  # before stripping counters


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def compute_file_hash(filepath: str) -> str:
    """Compute SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()


def convert_doc_to_docx(doc_path: str) -> str:
    """Convert .doc to .docx using LibreOffice. Returns path to .docx."""
    doc_path = Path(doc_path)
    docx_path = doc_path.with_suffix('.docx')

    if docx_path.exists():
        # Warn if .docx is older than .doc
        if docx_path.stat().st_mtime < doc_path.stat().st_mtime:
            print(f"  WARNING: {docx_path.name} is older than {doc_path.name}. Consider re-converting.")
        print(f"  .docx already exists: {docx_path.name}")
        return str(docx_path)

    print(f"  Converting {doc_path.name} to .docx via LibreOffice...")
    result = subprocess.run(
        ['soffice', '--headless', '--convert-to', 'docx', str(doc_path),
         '--outdir', str(doc_path.parent)],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice conversion failed: {result.stderr}")

    if not docx_path.exists():
        raise FileNotFoundError(f"Expected output not found: {docx_path}")

    print(f"  Converted: {docx_path.name}")
    return str(docx_path)


def is_question_heading(text: str) -> tuple:
    """Check if a paragraph is a question heading. Returns (True, number_str) or (False, None).
    Matches: "Question 1", "Question", "Question (guenard)", "Question  9",
    "Question :", "Question 37:", "Question n°1"
    """
    text = text.strip()
    # Standard: "Question" optionally followed by a number and optional colon
    m = re.match(r'^question\s*(\d+)?\s*:?\s*$', text, re.IGNORECASE)
    if m:
        return True, m.group(1) or ""
    # Variant: "Question (source)" or "Question (guenard)"
    m = re.match(r'^question\s*\([^)]*\)\s*$', text, re.IGNORECASE)
    if m:
        return True, ""
    # Variant: "Question n°1", "Question n° 2"
    m = re.match(r'^question\s*n[°o]\s*(\d+)\s*$', text, re.IGNORECASE)
    if m:
        return True, m.group(1)
    return False, None


def is_answer_line(text: str) -> bool:
    """Check if a paragraph is an answer line."""
    return bool(re.match(r'r[ée]ponses?\s*:?\s', text.strip(), re.IGNORECASE)) or \
           bool(re.match(r'r[ée]ponses?\s*:\s*$', text.strip(), re.IGNORECASE)) or \
           bool(re.match(r'r[ée]ponses?\s*:[A-Za-z]', text.strip(), re.IGNORECASE))


def is_answer_missing(text: str) -> bool:
    """Check if an answer line has placeholder dots or is empty."""
    text = text.strip()
    # Empty after colon
    if re.match(r'r[ée]ponses?\s*:\s*$', text, re.IGNORECASE):
        return True
    # Dots/ellipsis
    if re.match(r'r[ée]ponses?\s*:?\s*[\.…]+\s*$', text, re.IGNORECASE):
        return True
    return False


def parse_answer_letters(text: str) -> tuple:
    """
    Parse answer letters from a raw answer line.
    Returns (letters_list, remaining_text_after_letters).
    """
    text = text.strip()
    # Remove the "Réponse(s) :" prefix
    text = re.sub(r'^r[ée]ponses?\s*:?\s*', '', text, flags=re.IGNORECASE).strip()

    if not text or re.match(r'^[\.…]+$', text):
        return [], ""

    # Handle merged "Question" at end: "A, B et   Question" -> extract letters before "Question"
    remaining = ""
    question_merge = re.search(r'\s+Question\s*\d*\s*$', text, re.IGNORECASE)
    if question_merge:
        remaining = text[question_merge.start():].strip()
        text = text[:question_merge.start()].strip()

    # Handle inline explanation: "seule la réponse A est juste car..."
    inline_match = re.match(r'seule\s+la\s+r[ée]ponse\s+([A-Z])\s+(.*)', text, re.IGNORECASE)
    if inline_match:
        letter = inline_match.group(1).upper()
        explanation = inline_match.group(2).strip()
        return [letter], explanation

    # Extract all uppercase letters A-Z (we don't limit to A-E)
    # First, normalize typos: "er" -> "et"
    text = re.sub(r'\b([A-Za-z])\s+er\s+([A-Za-z])\b', r'\1 et \2', text)
    text = re.sub(r',\s*er\s+', ', et ', text)

    # Remove trailing punctuation
    text = text.rstrip('.,;: ')

    # Try to find letters: could be "ACE", "A, C, E", "A et C", "A, B et C", etc.
    # Strategy: find all single uppercase letters that are answer candidates
    letters = []

    # Pattern 1: concatenated letters "ACE", "BCE" — but NOT roman numerals like "II", "IV"
    concat_match = re.match(r'^([A-Z]{2,})\s*$', text)
    if concat_match:
        candidate = concat_match.group(1)
        # Reject if it looks like a roman numeral (only I, V, X, L, C, D, M)
        if not re.match(r'^[IVXLCDM]+$', candidate):
            letters = list(candidate)
            return [l.upper() for l in letters], remaining

    # Pattern 2: letters separated by commas, spaces, "et"
    # Extract all single letters that appear to be answer choices
    # Split on separators
    parts = re.split(r'[,\s]+(?:et\s+)?|(?:\s+et\s+)', text)
    for part in parts:
        part = part.strip().rstrip('.,;:')
        if re.match(r'^[A-Za-z]$', part):
            letters.append(part.upper())

    if letters:
        # Check if there's explanation text after the last letter
        # Find position after the last letter in original text
        last_letter_pos = 0
        for letter in letters:
            pos = text.rfind(letter)
            if pos > last_letter_pos:
                last_letter_pos = pos
        after_letters = text[last_letter_pos + 1:].strip()
        after_letters = re.sub(r'^[\s,\.;:]+', '', after_letters).strip()
        after_letters = re.sub(r'^et\s*$', '', after_letters).strip()
        if after_letters and not re.match(r'^[A-Z]$', after_letters):
            if remaining:
                remaining = after_letters + " " + remaining
            else:
                remaining = after_letters
        return letters, remaining

    # If we couldn't parse anything, return empty
    return [], text if text else remaining


def has_numpr(para) -> bool:
    """Check if a paragraph has Word auto-numbering."""
    numPr = para._element.find('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}numPr')
    return numPr is not None


def is_proposition_bold(para) -> bool:
    """
    Determine if a proposition is bold (= correct answer).

    For auto-numbered list items: check if the first run with text is bold.
    For explicit letter items: check if any content run (after the letter) is bold.
    """
    runs_with_text = [r for r in para.runs if r.text.strip()]
    if not runs_with_text:
        return False

    text = para.text.strip()

    # Explicit letter prefix (e.g., "A. text" or "B.text")
    if re.match(r'^[A-Za-z][\.\)]\s*', text):
        # Check if content after the letter is bold
        found_letter = False
        for r in runs_with_text:
            rt = r.text.strip()
            if not found_letter and re.match(r'^[A-Za-z][\.\)]?\s*$', rt):
                found_letter = True
                continue
            if found_letter or not re.match(r'^[A-Za-z][\.\)]', rt):
                if r.bold is True:
                    return True
        # Also check: sometimes the letter + content is in one run
        if len(runs_with_text) == 1:
            r = runs_with_text[0]
            if r.bold is True:
                return True
        return False

    # Auto-numbered list item: check if first run is bold
    first_run = runs_with_text[0]
    return first_run.bold is True


def is_chapter_title(para, text: str) -> bool:
    """
    Strict heuristic: is this paragraph a chapter/section title?
    Only matches known patterns like "Transmission synaptique (30)" or
    "Les réflexes médullaires (33)" — bold text with optional counter.
    """
    if not text:
        return False
    # Too long for a title
    if len(text) > 80:
        return False
    # Is it a question or answer line?
    if re.match(r'(question|r[ée]ponses?)', text, re.IGNORECASE):
        return False
    # Must be on Normal or similar style (not list items)
    if para.style.name in ("Paragraphe de liste",):
        return False
    # Is all text bold?
    runs_with_text = [r for r in para.runs if r.text.strip()]
    if not runs_with_text:
        return False
    all_bold = all(r.bold is True for r in runs_with_text)
    if not all_bold:
        return False
    # Structural detection: bold paragraph starting with "Chapitre" or "Sous chapitre"
    if re.match(r'^(Sous\s+)?Chapitre\b', text, re.IGNORECASE):
        return True
    # Additional filter: must contain a counter like (30) OR be a known section pattern
    # (short title, no punctuation except colon, no proposition-like text)
    has_counter = bool(re.search(r'\(\d+\)', text))
    # Known section keywords
    is_known = any(kw in text.lower() for kw in [
        'physiologie', 'endocrinologie', 'digestive', 'nerveux', 'système',
        'transmission', 'synaptique', 'réflexes', 'médullaires', 'cervelet',
        'noyaux gris', 'equilibration', 'équilibration', 'plaque motrice',
        'thyroïde', 'médullosurrénale', 'glycémie', 'voies', 'sensibilité',
        'motricité', 'corticale', 'pyramidal', 'extrapyramidal',
        'préface', 'recommandations', 'références', 'liens utiles',
    ])
    return has_counter or is_known


def strip_chapter_counter(title: str) -> str:
    """Remove counter like '(30)' or '(14)' from chapter titles."""
    return re.sub(r'\s*\(\d+\)\s*$', '', title).strip()


# ---------------------------------------------------------------------------
# PASS 1: Parse document and reconstruct missing answers from bold
# ---------------------------------------------------------------------------

def parse_document(doc: Document) -> tuple:
    """
    Parse the Word document into structured data.
    Returns (questions, chapters, stats).
    """
    paragraphs = doc.paragraphs
    total_paras = len(paragraphs)

    questions = []
    chapters = []
    current_chapter_path = []
    stats = {
        'total_paragraphs': total_paras,
        'total_questions': 0,
        'answers_from_line': 0,
        'answers_from_bold': 0,
        'answers_from_both': 0,
        'answers_missing': 0,
        'warnings': [],
    }

    # First pass: identify all question start positions
    question_starts = []
    for i, para in enumerate(paragraphs):
        text = para.text.strip()
        is_q, q_num = is_question_heading(text)
        if is_q:
            question_starts.append((i, q_num))

    # For each question, parse its block
    for q_idx, (start_i, q_num) in enumerate(question_starts):
        # Determine end of this question block
        if q_idx + 1 < len(question_starts):
            end_i = question_starts[q_idx + 1][0]
        else:
            end_i = total_paras

        # Update chapter context: scan from previous question end to this question start
        prev_end = question_starts[q_idx - 1][0] if q_idx > 0 else 0
        for ci in range(prev_end, start_i):
            para = paragraphs[ci]
            text = para.text.strip()
            if not text:
                continue

            if para.style.name == "Heading 1" and not is_question_heading(text)[0]:
                # Heading 1 that's not a question = chapter title
                clean_title = strip_chapter_counter(text)
                if clean_title:
                    current_chapter_path = [clean_title]
                    chapters.append(Chapter(
                        title=clean_title, level=1,
                        para_index=ci, original_title=text
                    ))
            elif is_chapter_title(para, text) and not is_answer_line(text):
                clean_title = strip_chapter_counter(text)
                if clean_title and len(clean_title) > 3:
                    # Determine level based on context
                    chapters.append(Chapter(
                        title=clean_title, level=2,
                        para_index=ci, original_title=text
                    ))
                    if len(current_chapter_path) < 2:
                        current_chapter_path.append(clean_title)
                    else:
                        current_chapter_path[-1] = clean_title

        # Parse the question block
        question = parse_question_block(
            paragraphs, start_i, end_i, q_num, list(current_chapter_path)
        )
        questions.append(question)

    stats['total_questions'] = len(questions)

    # Classify answer sources
    for q in questions:
        if q.answer_source == 'line':
            stats['answers_from_line'] += 1
        elif q.answer_source == 'bold':
            stats['answers_from_bold'] += 1
        elif q.answer_source == 'both':
            stats['answers_from_both'] += 1
        else:
            stats['answers_missing'] += 1
        stats['warnings'].extend(q.warnings)

    return questions, chapters, stats


def parse_question_block(paragraphs, start_i: int, end_i: int,
                         q_num: str, chapter_path: list) -> Question:
    """Parse a single question block from start_i to end_i."""
    question = Question(
        original_number=q_num,
        start_para=start_i,
        end_para=end_i,
        chapter_path=chapter_path,
    )

    # States: 'stem', 'propositions', 'answer', 'explanation'
    state = 'stem'
    current_prop_letter_index = 0  # 0=A, 1=B, 2=C, ...
    stem_parts = []
    explanation_parts = []
    answer_line_raw = ""
    props_in_list = []  # collect list paragraphs to assign letters

    i = start_i + 1  # skip the "Question X" heading itself

    while i < end_i:
        para = paragraphs[i]
        text = para.text.strip()

        # Skip empty paragraphs — but track them in stem/explanation (images are in empty paras)
        if not text:
            if state == 'explanation':
                question.explanation_para_indices.append(i)
            elif state == 'stem':
                question.stem_para_indices.append(i)
            i += 1
            continue

        # Check if this is another question heading (merged question edge case)
        is_q, _ = is_question_heading(text)
        if is_q:
            break

        # Check for answer line
        if is_answer_line(text):
            state = 'answer'
            question.answer_para_index = i
            answer_line_raw = text

            # Check for merged question: "Réponse : A, B et   Question 15"
            q_merge = re.search(r'\s+(Question\s*\d*)\s*$', text, re.IGNORECASE)
            if q_merge:
                answer_line_raw = text[:q_merge.start()].strip()
                # The merged question will be handled by the main parser

            i += 1
            # Everything after the answer line (until end or next question) is explanation
            state = 'explanation'
            continue

        # Detect propositions: auto-numbered (any style with numPr) or explicit letter
        has_num = has_numpr(para)
        is_list_item = has_num  # Any style with numPr = auto-numbered proposition
        is_explicit_letter = bool(re.match(r'^[A-Za-z][\.\)]\s*\w', text)) and not has_num
        is_list_style = para.style.name in ("Paragraphe de liste", "pl")
        is_continuation = is_list_style and not has_num

        if state == 'explanation':
            # We're past the answer line — collect all until end of question block.
            # The end_i boundary (next question start) prevents bleeding.
            # Skip chapter markers — they are structural, not explanation content.
            if is_chapter_title(para, text):
                i += 1
                continue
            explanation_parts.append(text)
            question.explanation_para_indices.append(i)
            i += 1
            continue

        if is_list_item or is_explicit_letter:
            state = 'propositions'

            letter_chr = chr(ord('A') + current_prop_letter_index)

            # Get the proposition text (strip letter prefix if explicit)
            prop_text = text
            if is_explicit_letter:
                prop_text = re.sub(r'^[A-Za-z][\.\)]\s*', '', text)
                # Use the letter from the text
                letter_match = re.match(r'^([A-Za-z])', text)
                if letter_match:
                    letter_chr = letter_match.group(1).upper()

            bold = is_proposition_bold(para)

            prop = Proposition(
                letter=letter_chr,
                text=prop_text,
                is_bold=bold,
                para_indices=[i],
            )
            question.propositions.append(prop)
            current_prop_letter_index += 1
            i += 1
            continue

        if is_continuation and state == 'propositions' and question.propositions:
            # Continuation of previous proposition
            question.propositions[-1].text += " " + text
            question.propositions[-1].para_indices.append(i)
            # Check if continuation is bold
            if is_proposition_bold(para):
                question.propositions[-1].is_bold = True
            i += 1
            continue

        if state == 'stem':
            stem_parts.append(text)
            question.stem_para_indices.append(i)
            i += 1
            continue

        # Default: if we haven't hit the answer line yet and we're in propositions,
        # this might be a stem continuation or explanation without answer line
        if state == 'propositions':
            # Could be explanation if no answer line exists
            explanation_parts.append(text)
            question.explanation_para_indices.append(i)
            i += 1
            continue

        stem_parts.append(text)
        i += 1

    question.stem_text = " ".join(stem_parts).strip()
    question.explanation_text = "\n".join(explanation_parts).strip()

    # --- PASS 1 LOGIC: Determine answer letters ---
    answer_line_raw = answer_line_raw.strip()
    question.answer_line = answer_line_raw

    line_letters = []
    remaining_text = ""
    if answer_line_raw and not is_answer_missing(answer_line_raw):
        line_letters, remaining_text = parse_answer_letters(answer_line_raw)
        if remaining_text:
            # Inline explanation found in the answer line
            if question.explanation_text:
                question.explanation_text = remaining_text + "\n" + question.explanation_text
            else:
                question.explanation_text = remaining_text

    bold_letters = [p.letter for p in question.propositions if p.is_bold]
    prop_letters = {p.letter for p in question.propositions}

    if line_letters and bold_letters:
        # Both sources available
        if set(line_letters) == set(bold_letters):
            question.answer_letters = sorted(line_letters)
            question.answer_source = 'both'
        else:
            # Mismatch — answer line (Réponse) ALWAYS takes precedence
            question.answer_letters = sorted(line_letters)
            question.answer_source = 'line'
            question.warnings.append(
                f"Answer mismatch: line says {line_letters}, bold says {bold_letters}. Using line."
            )
    elif line_letters:
        question.answer_letters = sorted(line_letters)
        question.answer_source = 'line'
    elif bold_letters:
        question.answer_letters = sorted(bold_letters)
        question.answer_source = 'bold'
    else:
        question.answer_letters = []
        question.answer_source = 'none'
        question.warnings.append(
            "[WARNING] No answer found: neither answer line nor bold propositions."
        )

    # Validate: answer letters should be among proposition letters
    for al in question.answer_letters:
        if prop_letters and al not in prop_letters:
            question.warnings.append(
                f"[WARNING] Answer letter '{al}' not found among propositions {sorted(prop_letters)}."
            )

    return question


# ---------------------------------------------------------------------------
# PASS 2: Standardize and generate output
# ---------------------------------------------------------------------------

def standardize_questions(questions: list) -> list:
    """Apply Pass 2 standardization to all questions."""
    for i, q in enumerate(questions):
        q.sequential_number = i + 1

        # Uppercase all answer letters
        q.answer_letters = [l.upper() for l in q.answer_letters]

        # Uppercase all proposition letters
        for p in q.propositions:
            p.letter = p.letter.upper()

    return questions


def build_body_element_map(doc: Document) -> tuple:
    """
    Build mappings between paragraph indices and body element indices.
    Returns (para_to_body, body_to_para) dicts.
    Body elements include both paragraphs (w:p) and tables (w:tbl).
    """
    body = doc.element.body
    para_to_body = {}
    body_to_para = {}
    para_idx = 0
    for body_idx, child in enumerate(body):
        if child.tag == qn('w:p'):
            para_to_body[para_idx] = body_idx
            body_to_para[body_idx] = para_idx
            para_idx += 1
    return para_to_body, body_to_para


def copy_body_element(src_doc: Document, dst_doc: Document,
                      element, rId_map: dict) -> None:
    """
    Deep-copy a body element (paragraph or table) from src to dst document,
    remapping image relationships so embedded images are preserved.

    rId_map is a dict tracking old_rId -> new_rId to reuse relationships
    when the same image appears in multiple paragraphs.
    """
    from docx.opc.constants import RELATIONSHIP_TYPE as RT
    from docx.opc.packuri import PackURI
    from docx.opc.part import Part

    new_el = deepcopy(element)

    # Find all inline image references (a:blip elements with r:embed)
    for blip in new_el.iter(qn('a:blip')):
        old_rId = blip.get(qn('r:embed'))
        if not old_rId:
            continue

        if old_rId in rId_map:
            # Already copied this image — reuse the new rId
            blip.set(qn('r:embed'), rId_map[old_rId])
            continue

        if old_rId not in src_doc.part.rels:
            continue

        rel = src_doc.part.rels[old_rId]
        image_blob = rel.target_part.blob
        content_type = rel.target_part.content_type

        # Generate a unique partname for the image in the destination
        existing_img_count = sum(
            1 for r in dst_doc.part.rels.values()
            if 'image' in r.reltype
        )
        ext = str(rel.target_part.partname).rsplit('.', 1)[-1]
        new_partname = PackURI(f'/word/media/image{existing_img_count + 1}.{ext}')

        # Create image part in destination package
        new_image_part = Part(
            new_partname, content_type, image_blob, dst_doc.part.package
        )
        new_rId = dst_doc.part.relate_to(new_image_part, rel.reltype)

        blip.set(qn('r:embed'), new_rId)
        rId_map[old_rId] = new_rId

    # Insert before sectPr so element ordering is correct
    sectPr = dst_doc.element.body.find(qn('w:sectPr'))
    if sectPr is not None:
        sectPr.addprevious(new_el)
    else:
        dst_doc.element.body.append(new_el)


def get_explanation_body_range(question: Question, para_to_body: dict,
                               body_children) -> list:
    """
    Get the body element indices for a question's explanation zone.
    Includes interleaved tables between explanation paragraphs.
    """
    if not question.explanation_para_indices:
        return []

    first_para = question.explanation_para_indices[0]
    last_para = question.explanation_para_indices[-1]

    first_body = para_to_body.get(first_para)
    last_body = para_to_body.get(last_para)

    if first_body is None or last_body is None:
        return []

    # Include all body elements in the range (paragraphs AND tables)
    return list(range(first_body, last_body + 1))


def write_standardized_docx(questions: list, chapters: list, output_path: str,
                            source_doc: Document):
    """
    Write the standardized .docx file.
    Preserves images and tables from explanation sections.
    """
    out_doc = Document()

    # Set default font
    style = out_doc.styles['Normal']
    font = style.font
    font.size = Pt(11)

    # Build body element map for copying rich content
    para_to_body, body_to_para = build_body_element_map(source_doc)
    body_children = list(source_doc.element.body)

    # Shared rId map for image deduplication across all copies
    rId_map = {}

    # Track which chapter we're in
    last_chapter_path = []

    for q in questions:
        # Add chapter headings if changed
        if q.chapter_path != last_chapter_path:
            for level_idx, title in enumerate(q.chapter_path):
                if level_idx >= len(last_chapter_path) or \
                   last_chapter_path[level_idx] != title:
                    heading_level = level_idx + 1
                    out_doc.add_heading(title, level=min(heading_level, 3))
            last_chapter_path = list(q.chapter_path)

        # Question heading
        out_doc.add_heading(f"Question {q.sequential_number}", level=4)

        # Question stem — copy originals if they contain images, else write text
        stem_has_images = False
        if q.stem_para_indices:
            for spi in q.stem_para_indices:
                sbi = para_to_body.get(spi)
                if sbi is not None and sbi < len(body_children):
                    blips = body_children[sbi].findall('.//' + qn('a:blip'))
                    if blips:
                        stem_has_images = True
                        break
        if stem_has_images:
            for spi in q.stem_para_indices:
                sbi = para_to_body.get(spi)
                if sbi is not None and sbi < len(body_children):
                    copy_body_element(source_doc, out_doc, body_children[sbi], rId_map)
        elif q.stem_text:
            out_doc.add_paragraph(q.stem_text)

        # Propositions — no bold, with explicit letter labels
        for prop in q.propositions:
            p = out_doc.add_paragraph(f"{prop.letter}. {prop.text}")
            # Ensure NO bold
            for run in p.runs:
                run.bold = False

        # Answer line — always "Réponses : A, C, E" (plural, standardized)
        if q.answer_letters:
            answer_text = f"Réponses : {', '.join(q.answer_letters)}"
        else:
            answer_text = "Réponses : [MANQUANTE]"
        answer_para = out_doc.add_paragraph(answer_text)
        for run in answer_para.runs:
            run.bold = False

        # Explanation — copy original elements to preserve images and tables
        expl_body_range = get_explanation_body_range(q, para_to_body, body_children)
        # Only write explanation if there's actual content (text, images, or tables)
        has_expl_content = False
        if expl_body_range:
            for body_idx in expl_body_range:
                if body_idx < len(body_children):
                    el = body_children[body_idx]
                    # Check for text content
                    if el.tag == qn('w:tbl'):
                        has_expl_content = True
                        break
                    text_content = ''.join(
                        node.text or '' for node in el.iter(qn('w:t'))
                    ).strip()
                    if text_content:
                        has_expl_content = True
                        break
                    # Check for images
                    if el.findall('.//' + qn('a:blip')):
                        has_expl_content = True
                        break

        if has_expl_content:
            out_doc.add_paragraph("Explication :")
            for body_idx in expl_body_range:
                if body_idx < len(body_children):
                    copy_body_element(source_doc, out_doc, body_children[body_idx], rId_map)
        elif q.explanation_text:
            # Fallback: inline explanation from answer line parsing (text only)
            out_doc.add_paragraph("Explication :")
            out_doc.add_paragraph(q.explanation_text)

        # Warnings as comments
        for w in q.warnings:
            wp = out_doc.add_paragraph(w)
            for run in wp.runs:
                run.italic = True

        # Separator
        out_doc.add_paragraph("---")

    out_doc.save(output_path)
    print(f"  Standardized document saved: {output_path}")


def print_report(questions: list, chapters: list, stats: dict):
    """Print a summary report to console."""
    print("\n" + "=" * 60)
    print("PREPROCESSING REPORT")
    print("=" * 60)
    print(f"Total paragraphs parsed:     {stats['total_paragraphs']}")
    print(f"Total questions found:       {stats['total_questions']}")
    print(f"Total chapters found:        {len(chapters)}")
    print(f"")
    print(f"Answer sources:")
    print(f"  From answer line only:     {stats['answers_from_line']}")
    print(f"  From bold only:            {stats['answers_from_bold']}")
    print(f"  From both (consistent):    {stats['answers_from_both']}")
    print(f"  Missing (no source):       {stats['answers_missing']}")
    print(f"")

    # Proposition count distribution
    prop_counts = {}
    for q in questions:
        n = len(q.propositions)
        prop_counts[n] = prop_counts.get(n, 0) + 1
    print(f"Propositions per question:")
    for n in sorted(prop_counts):
        print(f"  {n} propositions: {prop_counts[n]} questions")
    print()

    # Warnings — collected per question to avoid dedup issues
    total_warnings = 0
    warning_lines = []
    for q in questions:
        for w in q.warnings:
            total_warnings += 1
            warning_lines.append(
                f"  {total_warnings}. Q{q.sequential_number} (orig: {q.original_number or 'no num'}): {w}"
            )
    if warning_lines:
        print(f"WARNINGS ({total_warnings}):")
        print("-" * 40)
        for line in warning_lines:
            print(line)
        print()

    # Chapters
    print(f"CHAPTERS ({len(chapters)}):")
    print("-" * 40)
    for ch in chapters:
        indent = "  " * ch.level
        counter_note = ""
        if ch.original_title != ch.title:
            counter_note = f" (was: '{ch.original_title}')"
        print(f"  {indent}{ch.title}{counter_note}")

    print("\n" + "=" * 60)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Preprocess Word document into standardized format."
    )
    parser.add_argument(
        'input_file',
        help="Path to the original .doc or .docx file"
    )
    parser.add_argument(
        '-o', '--output',
        help="Output path for standardized .docx (default: <input>_standardise.docx)"
    )
    parser.add_argument(
        '--report-only',
        action='store_true',
        help="Only print the report, don't generate the output file"
    )
    args = parser.parse_args()

    input_path = Path(args.input_file).resolve()
    if not input_path.exists():
        print(f"Error: File not found: {input_path}")
        sys.exit(1)

    # Record original file hash
    original_hash = compute_file_hash(str(input_path))
    print(f"Original file: {input_path.name}")
    print(f"Original hash: {original_hash[:16]}...")

    # Convert .doc to .docx if needed
    if input_path.suffix.lower() == '.doc':
        docx_path = convert_doc_to_docx(str(input_path))
    else:
        docx_path = str(input_path)

    # Determine output path
    if args.output:
        output_path = args.output
    else:
        docx_p = Path(docx_path)
        output_path = str(docx_p.parent / f"{docx_p.stem}_standardise.docx")

    print(f"Output will be: {Path(output_path).name}")
    print()

    # Load document
    print("Loading document...")
    doc = Document(docx_path)
    print(f"  Loaded: {len(doc.paragraphs)} paragraphs")

    # Count images and tables for preservation check
    image_count = sum(1 for rel in doc.part.rels.values() if "image" in rel.reltype)
    table_count = len(doc.tables)
    print(f"  Images: {image_count}, Tables: {table_count}")
    print()

    # PASS 1: Parse and reconstruct
    print("PASS 1: Parsing questions and reconstructing missing answers...")
    questions, chapters, stats = parse_document(doc)
    print(f"  Found {len(questions)} questions in {len(chapters)} chapters")
    print()

    # PASS 2: Standardize
    print("PASS 2: Standardizing format...")
    questions = standardize_questions(questions)
    print(f"  Renumbered {len(questions)} questions sequentially")
    print()

    # Diagnostic: find unmatched "Question" paragraphs
    matched_starts = {q.start_para for q in questions}
    unmatched = []
    for i, para in enumerate(doc.paragraphs):
        text = para.text.strip()
        if re.search(r'\bquestion\b', text, re.IGNORECASE) and i not in matched_starts:
            if len(text) < 50 and not is_answer_line(text):
                unmatched.append((i, text))

    if unmatched:
        print(f"\nDIAGNOSTIC: {len(unmatched)} unmatched 'Question' paragraphs (not parsed as questions):")
        for idx, (pi, txt) in enumerate(unmatched[:20]):
            print(f"  para {pi}: '{txt}'")
        if len(unmatched) > 20:
            print(f"  ... and {len(unmatched) - 20} more")
        print()

    # Report
    print_report(questions, chapters, stats)

    # Generate correction file for manual review
    correction_path = Path(output_path).parent / "questions_a_corriger.txt"
    with open(correction_path, 'w', encoding='utf-8') as f:
        f.write("=== QUESTIONS REQUIRING MANUAL CORRECTION ===\n\n")

        # Zero-proposition questions
        zero_prop = [q for q in questions if len(q.propositions) == 0]
        f.write(f"--- ZERO PROPOSITIONS ({len(zero_prop)}) ---\n")
        for q in zero_prop:
            f.write(f"  Q{q.sequential_number} (orig: {q.original_number or 'no num'}): "
                    f"stem='{q.stem_text[:80]}'\n")
        f.write("\n")

        # Missing answers
        no_answer = [q for q in questions if not q.answer_letters]
        f.write(f"--- MISSING ANSWERS ({len(no_answer)}) ---\n")
        for q in no_answer:
            f.write(f"  Q{q.sequential_number} (orig: {q.original_number or 'no num'}): "
                    f"stem='{q.stem_text[:80]}'\n")
        f.write("\n")

        # Answer mismatches
        mismatch = [q for q in questions if any("mismatch" in w.lower() for w in q.warnings)]
        f.write(f"--- ANSWER MISMATCHES ({len(mismatch)}) ---\n")
        for q in mismatch:
            for w in q.warnings:
                if "mismatch" in w.lower():
                    f.write(f"  Q{q.sequential_number}: {w}\n")
        f.write("\n")

        # Questions with >6 propositions
        too_many = [q for q in questions if len(q.propositions) > 6]
        f.write(f"--- UNUSUAL PROPOSITION COUNT (>6) ({len(too_many)}) ---\n")
        for q in too_many:
            f.write(f"  Q{q.sequential_number}: {len(q.propositions)} propositions — "
                    f"stem='{q.stem_text[:80]}'\n")

    print(f"Correction list saved: {correction_path.name}")

    # Generate output
    if not args.report_only:
        print("Generating standardized document...")
        write_standardized_docx(questions, chapters, output_path, doc)
        print()

    # Verify original file unchanged
    final_hash = compute_file_hash(str(input_path))
    if final_hash == original_hash:
        print("Original file integrity: OK (unchanged)")
    else:
        print("ERROR: Original file was modified!")
        sys.exit(2)

    print("\nDone.")


if __name__ == '__main__':
    main()
