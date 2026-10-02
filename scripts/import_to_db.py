#!/usr/bin/env python3
"""
import_to_db.py — Sprint 2, Phase A: Import standardized Word document into Supabase.

Pipeline:
  1. Parse the standardized .docx (chapter headings, questions, propositions, answers)
  2. Build topic hierarchy from chapter headings
  3. Extract images from explanations → upload to Supabase Storage
  4. Convert explanations to HTML via mammoth (with image URL replacement)
  5. Insert topics, questions, choices, question_images into Supabase
  6. Set is_active = false for questions with [MANQUANTE] answers or 0 propositions

Usage:
  python import_to_db.py "PCEM II s def3_standardise.docx" --dry-run
  python import_to_db.py "PCEM II s def3_standardise.docx" --export-json output.json
  python import_to_db.py "PCEM II s def3_standardise.docx" --export-images /path/to/dir

Modes:
  --dry-run       Parse and report counts without any output
  --export-json   Parse and export structured JSON for DB import
  --export-images Extract images to a directory for upload to Storage
"""

import argparse
import html as html_module
import io
import os
import re
import sys
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from copy import deepcopy

from dotenv import load_dotenv
from docx import Document
from docx.oxml.ns import qn

# Load .env from project root (one level up from scripts/)
load_dotenv(Path(__file__).resolve().parent.parent / '.env')


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class ParsedProposition:
    """A single proposition (A, B, C, ...) within a question."""
    letter: str
    text: str


@dataclass
class ParsedQuestion:
    """A parsed question from the standardized document."""
    sequential_number: int = 0
    stem_text: str = ""
    propositions: list = field(default_factory=list)  # list of ParsedProposition
    answer_letters: list = field(default_factory=list)  # ['A', 'C', 'E']
    answer_missing: bool = False  # True if answer is [MANQUANTE]
    has_propositions: bool = True
    explanation_para_indices: list = field(default_factory=list)
    stem_para_indices: list = field(default_factory=list)
    chapter_path: list = field(default_factory=list)  # ['Chapter 1', 'Sub-chapter']


@dataclass
class ParsedTopic:
    """A topic node in the hierarchy."""
    title: str
    level: int  # 1, 2, 3
    sort_order: int = 0
    children: list = field(default_factory=list)  # list of ParsedTopic
    db_id: str = ""  # UUID assigned after insert


# ---------------------------------------------------------------------------
# Parsing the standardized document
# ---------------------------------------------------------------------------

def is_question_heading(text: str) -> tuple:
    """Check if a paragraph is a 'Question N' heading."""
    text = text.strip()
    m = re.match(r'^Question\s+(\d+)\s*$', text)
    if m:
        return True, int(m.group(1))
    return False, None


def is_answer_line(text: str) -> bool:
    """Check if a paragraph is a 'Réponses : ...' line."""
    return bool(re.match(r'^R[ée]ponses?\s*:', text.strip(), re.IGNORECASE))


def is_explanation_marker(text: str) -> bool:
    """Check if a paragraph is 'Explication :'."""
    return bool(re.match(r'^Explication\s*:\s*$', text.strip(), re.IGNORECASE))


def is_separator(text: str) -> bool:
    """Check if a paragraph is the '---' separator."""
    return text.strip() == '---'


def is_valid_chapter_title(text: str) -> bool:
    """Filter out false chapter headings (explanation text with heading styles).
    Real chapter titles are topic names; bogus ones are sentence fragments.
    """
    text = text.strip()
    # Too long for a chapter title
    if len(text) > 70:
        return False
    # Too short
    if len(text) < 3:
        return False
    # Contains answer patterns
    if re.match(r'^R[ée]ponses?\s*:', text, re.IGNORECASE):
        return False
    # Looks like a proposition ("A. text")
    if re.match(r'^[A-Z]\.\s', text):
        return False
    # Starts with lowercase → sentence fragment, not a title
    if text[0].islower():
        return False
    # Contains explanation-like patterns
    lower = text.lower()
    if any(p in lower for p in ['est fausse', 'est vraie', 'est juste']):
        return False
    # Starts with a verb/article pattern typical of sentences, not titles
    sentence_starts = [
        r"^Chez\s", r"^S.accompagne", r"^Peut\s", r"^Est\s",
        r"^Ne\s", r"^Se\s", r"^On\s", r"^Il\s", r"^Elle\s",
    ]
    for pat in sentence_starts:
        if re.match(pat, text, re.IGNORECASE):
            return False
    # Ends with a colon and looks like a question stem
    if text.endswith(':') and len(text) > 40:
        return False
    # Contains "d'où", "car", "donc" — explanatory connectors
    if any(w in lower for w in ["d'où", "entraine", "entraîne"]):
        return False
    return True


def clean_chapter_title(text: str) -> str:
    """Clean up chapter title: remove trailing counters, colons, extra spaces."""
    text = text.strip()
    # Remove trailing counter like "(30)" or "120"
    text = re.sub(r'\s*\(\d+\)\s*$', '', text)
    text = re.sub(r'\s+\d+\s*$', '', text)
    # Remove leading roman numeral prefix like "I ", "II ", "III "
    text = re.sub(r'^[IVXLC]+\s+', '', text)
    # Remove trailing colon
    text = text.rstrip(' :')
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def is_heading(para) -> tuple:
    """Check if a paragraph is a heading (Heading 1/2/3). Returns (level, title) or (None, None)."""
    style_name = para.style.name or ""
    if style_name.startswith("Heading"):
        try:
            level = int(style_name.split()[-1])
            if 1 <= level <= 3:
                return level, para.text.strip()
        except (ValueError, IndexError):
            pass
    return None, None


def parse_answer_letters_from_line(text: str) -> tuple:
    """Parse answer letters from 'Réponses : A, C, E' or 'Réponses : [MANQUANTE]'.
    Returns (letters_list, is_missing).
    """
    text = text.strip()
    # Remove prefix
    text = re.sub(r'^R[ée]ponses?\s*:\s*', '', text, flags=re.IGNORECASE).strip()

    if '[MANQUANTE]' in text:
        return [], True

    # Parse comma-separated letters
    letters = []
    parts = re.split(r'[,\s]+', text)
    for part in parts:
        part = part.strip()
        if re.match(r'^[A-Z]$', part):
            letters.append(part)

    return letters, False


def parse_standardized_docx(doc_path: str) -> tuple:
    """
    Parse a standardized .docx file.
    Returns (questions, topic_tree_roots, doc).

    Two-pass approach:
      Pass 1: Identify real chapter headings (those that appear between
              question blocks, not inside explanation content).
      Pass 2: Parse questions using the identified chapter context.
    """
    doc = Document(doc_path)
    paragraphs = doc.paragraphs
    total = len(paragraphs)

    # --- PASS 1: Find question boundaries and real chapter headings ---
    # A "real" chapter heading is a Heading 1/2/3 that appears OUTSIDE
    # any question block (i.e., before the first question, or between
    # a "---" separator and the next "Question N" heading).

    question_starts = []  # list of (para_index, question_number)
    separator_indices = set()

    for i, para in enumerate(paragraphs):
        text = para.text.strip()
        is_q, q_num = is_question_heading(text)
        if is_q and q_num is not None:
            question_starts.append((i, q_num))
        if is_separator(text):
            separator_indices.add(i)

    # Determine which paragraphs are "inside" question blocks.
    # Inside = from "Question N" heading to the "---" separator (or next question).
    # Outside = before first question, or between "---" and next "Question N".
    inside_question = set()
    for qi, (start_i, _) in enumerate(question_starts):
        # Find the end: first separator after start_i, or next question start
        if qi + 1 < len(question_starts):
            next_q = question_starts[qi + 1][0]
        else:
            next_q = total

        # Find first separator between start_i and next_q
        end_i = next_q
        for si in range(start_i + 1, next_q):
            if si in separator_indices:
                end_i = si + 1  # include the separator itself
                break

        for j in range(start_i, end_i):
            inside_question.add(j)

    # Collect real chapter headings (outside question blocks, passing filters)
    real_chapter_headings = {}  # para_index → (level, title)
    for i, para in enumerate(paragraphs):
        if i in inside_question:
            continue
        heading_level, heading_title = is_heading(para)
        if heading_level is not None and heading_title:
            is_q, _ = is_question_heading(heading_title)
            if not is_q and is_valid_chapter_title(heading_title):
                clean_title = clean_chapter_title(heading_title)
                if clean_title:
                    real_chapter_headings[i] = (heading_level, clean_title)

    # --- PASS 2: Parse questions with chapter context ---
    questions = []
    current_chapter_path = []

    i = 0
    while i < total:
        # Update chapter context from real headings
        if i in real_chapter_headings:
            level, title = real_chapter_headings[i]
            if level == 1:
                current_chapter_path = [title]
            elif level == 2:
                current_chapter_path = current_chapter_path[:1] + [title]
            elif level == 3:
                current_chapter_path = current_chapter_path[:2] + [title]
            i += 1
            continue

        # Check for question heading
        text = paragraphs[i].text.strip()
        is_q, q_num = is_question_heading(text)
        if is_q and q_num is not None:
            question = ParsedQuestion(
                sequential_number=q_num,
                chapter_path=list(current_chapter_path),
            )

            i += 1  # skip "Question N" heading
            state = 'stem'

            while i < total:
                para = paragraphs[i]
                text = para.text.strip()

                # End of question block?
                if is_separator(text):
                    i += 1
                    break

                # Next question heading?
                next_is_q, _ = is_question_heading(text)
                if next_is_q:
                    break

                # Warning/mismatch lines from preprocessing
                if text.startswith('[WARNING]') or text.startswith('Answer mismatch:'):
                    i += 1
                    continue

                # Explanation marker
                if is_explanation_marker(text):
                    state = 'explanation'
                    i += 1
                    continue

                # Answer line
                if is_answer_line(text):
                    letters, is_missing = parse_answer_letters_from_line(text)
                    question.answer_letters = letters
                    question.answer_missing = is_missing
                    state = 'post_answer'
                    i += 1
                    continue

                # Proposition line: "A. text"
                prop_match = re.match(r'^([A-Z])\.\s*(.*)', text)
                if prop_match and state in ('stem', 'propositions'):
                    state = 'propositions'
                    letter = prop_match.group(1)
                    prop_text = prop_match.group(2).strip()
                    question.propositions.append(
                        ParsedProposition(letter=letter, text=prop_text)
                    )
                    i += 1
                    continue

                # Content based on state
                if state == 'stem':
                    question.stem_para_indices.append(i)
                    if text:
                        if question.stem_text:
                            question.stem_text += " " + text
                        else:
                            question.stem_text = text
                elif state in ('explanation', 'post_answer'):
                    question.explanation_para_indices.append(i)

                i += 1

            question.has_propositions = len(question.propositions) > 0
            questions.append(question)
            continue

        i += 1

    # Build topic tree from chapter paths
    topic_roots = build_topic_tree(questions)

    return questions, topic_roots, doc


def build_topic_tree(questions: list) -> list:
    """Build a topic tree from question chapter_paths.
    Returns list of root ParsedTopic nodes.
    """
    roots = []
    # Track unique paths to avoid duplicates
    seen_paths = {}  # tuple(path) → ParsedTopic

    for q in questions:
        if not q.chapter_path:
            continue

        # Build/find nodes for each level
        for depth in range(len(q.chapter_path)):
            path_key = tuple(q.chapter_path[:depth + 1])
            if path_key in seen_paths:
                continue

            title = q.chapter_path[depth]
            node = ParsedTopic(
                title=title,
                level=depth + 1,
                sort_order=len(seen_paths),
            )
            seen_paths[path_key] = node

            if depth == 0:
                roots.append(node)
            else:
                parent_key = tuple(q.chapter_path[:depth])
                parent = seen_paths.get(parent_key)
                if parent:
                    parent.children.append(node)

    return roots


# ---------------------------------------------------------------------------
# Image extraction
# ---------------------------------------------------------------------------

def extract_images_from_doc(doc: Document) -> dict:
    """Extract all images from the document.
    Returns dict: relationship_id → (image_bytes, content_type, extension).
    """
    images = {}
    for rel_id, rel in doc.part.rels.items():
        if "image" in rel.reltype:
            try:
                blob = rel.target_part.blob
                content_type = rel.target_part.content_type
                ext = str(rel.target_part.partname).rsplit('.', 1)[-1].lower()
                images[rel_id] = (blob, content_type, ext)
            except Exception:
                pass
    return images


def get_image_rel_ids_for_paragraphs(doc: Document, para_indices: list) -> list:
    """Get image relationship IDs referenced by the given paragraph indices.
    Returns list of (rel_id, sort_order) tuples.
    """
    paragraphs = doc.paragraphs
    rel_ids = []
    sort_order = 0

    for pi in para_indices:
        if pi >= len(paragraphs):
            continue
        para = paragraphs[pi]
        # Find a:blip elements with r:embed
        for blip in para._element.findall('.//' + qn('a:blip')):
            r_embed = blip.get(qn('r:embed'))
            if r_embed:
                rel_ids.append((r_embed, sort_order))
                sort_order += 1

    return rel_ids


def get_body_elements_for_explanation(doc: Document, para_indices: list) -> list:
    """Get body element indices that cover the explanation paragraphs,
    including interleaved tables.
    """
    if not para_indices:
        return []

    body = doc.element.body
    # Build para_index → body_index map
    para_to_body = {}
    para_idx = 0
    for body_idx, child in enumerate(body):
        if child.tag == qn('w:p'):
            para_to_body[para_idx] = body_idx
            para_idx += 1

    first_pi = para_indices[0]
    last_pi = para_indices[-1]

    first_bi = para_to_body.get(first_pi)
    last_bi = para_to_body.get(last_pi)

    if first_bi is None or last_bi is None:
        return []

    return list(range(first_bi, last_bi + 1))


# ---------------------------------------------------------------------------
# Explanation → HTML via mammoth
# ---------------------------------------------------------------------------

def convert_explanation_to_html(doc: Document, doc_path: str,
                                 para_indices: list,
                                 image_url_map: dict) -> str:
    """Convert explanation paragraphs to HTML using mammoth.

    Strategy: create a temporary .docx containing only the explanation
    paragraphs (including tables), then convert with mammoth.

    image_url_map: rel_id → public_url (from Supabase Storage)
    """
    import mammoth

    if not para_indices:
        return ""

    body = doc.element.body
    body_children = list(body)

    # Build para → body index map
    para_to_body = {}
    para_idx = 0
    for body_idx, child in enumerate(body):
        if child.tag == qn('w:p'):
            para_to_body[para_idx] = body_idx
            para_idx += 1

    # Get range of body elements
    first_bi = para_to_body.get(para_indices[0])
    last_bi = para_to_body.get(para_indices[-1])
    if first_bi is None or last_bi is None:
        # Fallback: just concatenate text
        paragraphs = doc.paragraphs
        texts = []
        for pi in para_indices:
            if pi < len(paragraphs):
                t = paragraphs[pi].text.strip()
                if t:
                    texts.append(f"<p>{html_module.escape(t)}</p>")
        return "\n".join(texts)

    body_range = range(first_bi, last_bi + 1)

    # Create a temporary document with just the explanation elements
    temp_doc = Document()

    # Image relationship mapping for the temp doc
    from docx.opc.constants import RELATIONSHIP_TYPE as RT
    from docx.opc.packuri import PackURI
    from docx.opc.part import Part

    rId_map = {}  # old_rId → new_rId in temp doc
    rId_to_url = {}  # new_rId → public URL
    blob_to_url = {}  # image_bytes → public URL (for mammoth matching)

    for bi in body_range:
        if bi >= len(body_children):
            continue
        element = body_children[bi]
        new_el = deepcopy(element)

        # Remap image relationships
        for blip in new_el.iter(qn('a:blip')):
            old_rId = blip.get(qn('r:embed'))
            if not old_rId:
                continue

            if old_rId in rId_map:
                blip.set(qn('r:embed'), rId_map[old_rId])
                continue

            if old_rId not in doc.part.rels:
                continue

            rel = doc.part.rels[old_rId]
            try:
                image_blob = rel.target_part.blob
                content_type = rel.target_part.content_type
                existing = sum(1 for r in temp_doc.part.rels.values() if 'image' in r.reltype)
                ext = str(rel.target_part.partname).rsplit('.', 1)[-1]
                new_partname = PackURI(f'/word/media/image{existing + 1}.{ext}')
                new_image_part = Part(new_partname, content_type, image_blob, temp_doc.part.package)
                new_rId = temp_doc.part.relate_to(new_image_part, rel.reltype)
                blip.set(qn('r:embed'), new_rId)
                rId_map[old_rId] = new_rId

                # Map new rId to public URL + map blob for mammoth matching
                if old_rId in image_url_map:
                    rId_to_url[new_rId] = image_url_map[old_rId]
                    blob_to_url[image_blob] = image_url_map[old_rId]
            except Exception as e:
                print(f"      Image remap warning: {e}")

        # Insert into temp doc
        sectPr = temp_doc.element.body.find(qn('w:sectPr'))
        if sectPr is not None:
            sectPr.addprevious(new_el)
        else:
            temp_doc.element.body.append(new_el)

    # Save temp doc to bytes
    buf = io.BytesIO()
    temp_doc.save(buf)
    buf.seek(0)

    # Convert with mammoth
    # Track image order for sequential URL assignment
    image_url_queue = list(rId_to_url.values())
    image_queue_index = [0]  # mutable counter for closure

    def convert_image(image):
        """Custom image converter for mammoth — match by content bytes."""
        alt_text = image.alt_text or ""

        with image.open() as img_stream:
            img_bytes = img_stream.read()

        # Match by blob content (exact byte match)
        if img_bytes in blob_to_url:
            return {"src": blob_to_url[img_bytes], "alt": alt_text}

        # Fallback: use sequential order from rId_to_url
        idx = image_queue_index[0]
        if idx < len(image_url_queue):
            image_queue_index[0] += 1
            return {"src": image_url_queue[idx], "alt": alt_text}

        # No URL found — skip the image
        return {"src": "", "alt": alt_text}

    result = mammoth.convert_to_html(buf, convert_image=mammoth.images.img_element(convert_image))
    html = result.value

    # Clean up empty img tags
    html = re.sub(r'<img\s+src=""\s*/?\s*>', '', html)
    html = re.sub(r'<img\s+src=""\s+alt="[^"]*"\s*/?\s*>', '', html)

    return html.strip()


# ---------------------------------------------------------------------------
# Supabase operations
# ---------------------------------------------------------------------------

def get_supabase_client():
    """Create a Supabase client using service_role key (bypasses RLS)."""
    from supabase import create_client

    url = os.environ.get('SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_KEY')

    if not url or not key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.")
        print("  SUPABASE_URL = your project URL (e.g. https://xxx.supabase.co)")
        print("  SUPABASE_SERVICE_KEY = service_role key (from Supabase dashboard > Settings > API)")
        sys.exit(1)

    return create_client(url, key)


def clear_existing_data(supabase):
    """Clear all imported data for re-runnability (idempotency).
    Order matters due to foreign key constraints.
    """
    print("  Clearing existing data...")
    # Delete in reverse dependency order
    supabase.table('question_images').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    supabase.table('choices').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    supabase.table('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    supabase.table('topics').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
    print("  Done.")


def insert_topics(supabase, topic_roots: list, parent_id=None) -> dict:
    """Recursively insert topics and return title_path → UUID mapping."""
    mapping = {}  # tuple(path) → uuid

    def _insert(nodes, parent_uuid, path_prefix):
        for i, node in enumerate(nodes):
            topic_id = str(uuid.uuid4())
            node.db_id = topic_id
            path_key = tuple(list(path_prefix) + [node.title])

            row = {
                'id': topic_id,
                'parent_id': parent_uuid,
                'title': node.title,
                'level': node.level,
                'sort_order': i,
                'is_active': True,
            }
            supabase.table('topics').insert(row).execute()
            mapping[path_key] = topic_id

            if node.children:
                _insert(node.children, topic_id, path_key)

    _insert(topic_roots, parent_id, ())
    return mapping


def upload_image_to_storage(supabase, image_bytes: bytes, content_type: str,
                             ext: str, question_number: int, sort_order: int) -> str:
    """Upload an image to Supabase Storage and return the public URL path."""
    filename = f"q{question_number}/img_{sort_order}.{ext}"

    supabase.storage.from_('question-images').upload(
        path=filename,
        file=image_bytes,
        file_options={"content-type": content_type, "upsert": "true"}
    )

    # Return the storage path (used in question_images table)
    return filename


def get_public_url(supabase, storage_path: str) -> str:
    """Get public URL for a storage file."""
    result = supabase.storage.from_('question-images').get_public_url(storage_path)
    return result


def insert_question(supabase, question: ParsedQuestion, topic_id: str,
                     explanation_html: str) -> str:
    """Insert a question and return its UUID."""
    question_id = str(uuid.uuid4())

    is_active = True
    if question.answer_missing:
        is_active = False
    if not question.has_propositions:
        is_active = False

    row = {
        'id': question_id,
        'topic_id': topic_id,
        'question_number': question.sequential_number,
        'question_text': question.stem_text,
        'explanation_html': explanation_html if explanation_html else None,
        'difficulty': 'medium',
        'is_active': is_active,
    }
    supabase.table('questions').insert(row).execute()
    return question_id


def insert_choices(supabase, question_id: str, question: ParsedQuestion):
    """Insert choices for a question."""
    if not question.propositions:
        return

    rows = []
    answer_set = set(question.answer_letters)

    for i, prop in enumerate(question.propositions):
        rows.append({
            'id': str(uuid.uuid4()),
            'question_id': question_id,
            'label': prop.letter,
            'choice_text': prop.text,
            'is_correct': prop.letter in answer_set,
            'sort_order': i,
        })

    # Batch insert
    if rows:
        supabase.table('choices').insert(rows).execute()


def insert_question_images(supabase, question_id: str,
                            image_records: list):
    """Insert question_images records."""
    rows = []
    for storage_path, original_name, sort_order in image_records:
        rows.append({
            'id': str(uuid.uuid4()),
            'question_id': question_id,
            'storage_path': storage_path,
            'original_name': original_name,
            'sort_order': sort_order,
        })
    if rows:
        supabase.table('question_images').insert(rows).execute()


# ---------------------------------------------------------------------------
# Main import pipeline
# ---------------------------------------------------------------------------

def run_dry_run(questions: list, topic_roots: list):
    """Print stats without writing to DB."""
    print("\n" + "=" * 60)
    print("DRY RUN — No data will be written")
    print("=" * 60)

    print(f"\nTotal questions: {len(questions)}")

    # Count inactive
    missing_answers = sum(1 for q in questions if q.answer_missing)
    zero_props = sum(1 for q in questions if not q.has_propositions)
    both = sum(1 for q in questions if q.answer_missing and not q.has_propositions)
    inactive = missing_answers + zero_props - both
    active = len(questions) - inactive

    print(f"Active questions: {active}")
    print(f"Inactive (missing answers): {missing_answers}")
    print(f"Inactive (zero propositions): {zero_props}")
    print(f"Overlap (both): {both}")
    print(f"Total inactive: {inactive}")

    # Topic tree
    def print_tree(nodes, indent=0):
        for node in nodes:
            print(f"{'  ' * indent}{node.title} (level {node.level})")
            if node.children:
                print_tree(node.children, indent + 1)

    print(f"\nTopic tree ({count_topics(topic_roots)} topics):")
    print("-" * 40)
    print_tree(topic_roots)

    # Proposition distribution
    prop_counts = {}
    for q in questions:
        n = len(q.propositions)
        prop_counts[n] = prop_counts.get(n, 0) + 1
    print(f"\nPropositions per question:")
    for n in sorted(prop_counts):
        print(f"  {n} propositions: {prop_counts[n]} questions")

    # Questions with explanations
    with_expl = sum(1 for q in questions if q.explanation_para_indices)
    print(f"\nQuestions with explanations: {with_expl}")
    print(f"Questions without explanations: {len(questions) - with_expl}")

    # Chapter path coverage
    no_chapter = sum(1 for q in questions if not q.chapter_path)
    print(f"\nQuestions without chapter: {no_chapter}")

    print("\n" + "=" * 60)


def count_topics(nodes: list) -> int:
    """Count total topics in tree."""
    total = 0
    for node in nodes:
        total += 1
        total += count_topics(node.children)
    return total


def run_import(questions: list, topic_roots: list, doc: Document, doc_path: str):
    """Full import pipeline."""
    supabase = get_supabase_client()

    # Step 1: Clear existing data
    clear_existing_data(supabase)

    # Step 2: Insert topics
    print("\nInserting topics...")
    topic_count = count_topics(topic_roots)
    topic_mapping = insert_topics(supabase, topic_roots)
    print(f"  Inserted {topic_count} topics")

    # Step 3: Extract all images from document
    print("\nExtracting images from document...")
    all_images = extract_images_from_doc(doc)
    print(f"  Found {len(all_images)} images in document")

    # Step 4: Process each question
    print(f"\nProcessing {len(questions)} questions...")

    stats = {
        'inserted': 0,
        'active': 0,
        'inactive': 0,
        'images_uploaded': 0,
        'with_explanation': 0,
        'no_topic': 0,
    }

    # Create a default topic for questions without chapter path
    default_topic_id = None

    for qi, question in enumerate(questions):
        if (qi + 1) % 50 == 0 or qi == 0:
            print(f"  Processing question {qi + 1}/{len(questions)}...")

        # Find topic ID
        topic_id = None
        if question.chapter_path:
            # Try to find the most specific topic
            for depth in range(len(question.chapter_path), 0, -1):
                path_key = tuple(question.chapter_path[:depth])
                if path_key in topic_mapping:
                    topic_id = topic_mapping[path_key]
                    break

        if topic_id is None:
            # Create a default "Non classé" topic if needed
            if default_topic_id is None:
                default_topic_id = str(uuid.uuid4())
                supabase.table('topics').insert({
                    'id': default_topic_id,
                    'parent_id': None,
                    'title': 'Non classé',
                    'level': 1,
                    'sort_order': 999,
                    'is_active': True,
                }).execute()
                topic_mapping[('Non classé',)] = default_topic_id
                print("  Created 'Non classé' topic for uncategorized questions")
            topic_id = default_topic_id
            stats['no_topic'] += 1

        # Upload images for this question
        image_url_map = {}  # rel_id → public URL
        image_records = []  # (storage_path, original_name, sort_order) — stem only

        # Gather image rel_ids separately for stem and explanation
        stem_img_rel_ids = set()
        if question.stem_para_indices:
            for rel_id, _ in get_image_rel_ids_for_paragraphs(doc, question.stem_para_indices):
                stem_img_rel_ids.add(rel_id)

        all_para_indices = question.stem_para_indices + question.explanation_para_indices
        img_rel_ids = get_image_rel_ids_for_paragraphs(doc, all_para_indices)

        for rel_id, sort_order in img_rel_ids:
            if rel_id in all_images:
                img_bytes, content_type, ext = all_images[rel_id]
                try:
                    storage_path = upload_image_to_storage(
                        supabase, img_bytes, content_type, ext,
                        question.sequential_number, sort_order
                    )
                    public_url = get_public_url(supabase, storage_path)
                    image_url_map[rel_id] = public_url
                    # Only add stem images to question_images table;
                    # explanation images are embedded in explanation_html
                    if rel_id in stem_img_rel_ids:
                        image_records.append((storage_path, f"img_{sort_order}.{ext}", sort_order))
                    stats['images_uploaded'] += 1
                except Exception as e:
                    print(f"    WARNING: Failed to upload image for Q{question.sequential_number}: {e}")

        # Convert explanation to HTML
        explanation_html = ""
        if question.explanation_para_indices:
            try:
                explanation_html = convert_explanation_to_html(
                    doc, doc_path, question.explanation_para_indices, image_url_map
                )
                if explanation_html:
                    stats['with_explanation'] += 1
            except Exception as e:
                print(f"    WARNING: Failed to convert explanation for Q{question.sequential_number}: {e}")
                # Fallback: plain text
                paragraphs = doc.paragraphs
                texts = []
                for pi in question.explanation_para_indices:
                    if pi < len(paragraphs):
                        t = paragraphs[pi].text.strip()
                        if t:
                            texts.append(f"<p>{html_module.escape(t)}</p>")
                explanation_html = "\n".join(texts)

        # Insert question
        question_id = insert_question(supabase, question, topic_id, explanation_html)

        # Insert choices
        insert_choices(supabase, question_id, question)

        # Insert question images
        if image_records:
            insert_question_images(supabase, question_id, image_records)

        # Track stats
        stats['inserted'] += 1
        is_active = not question.answer_missing and question.has_propositions
        if is_active:
            stats['active'] += 1
        else:
            stats['inactive'] += 1

    # --- Post-import safety checks ---
    print("\nRunning post-import safety checks...")

    # Deactivate questions with no correct answers (data quality issues)
    result = supabase.table('questions').select('id, question_number').eq('is_active', True).execute()
    no_correct = 0
    low_props = 0
    for q_row in result.data:
        choices_result = supabase.table('choices').select('is_correct').eq('question_id', q_row['id']).execute()
        choice_count = len(choices_result.data)
        correct_count = sum(1 for c in choices_result.data if c['is_correct'])

        deactivate = False
        if correct_count == 0:
            no_correct += 1
            deactivate = True
        if choice_count < 3:
            low_props += 1
            deactivate = True

        if deactivate:
            supabase.table('questions').update({'is_active': False}).eq('id', q_row['id']).execute()
            stats['active'] -= 1
            stats['inactive'] += 1

    if no_correct > 0:
        print(f"  Deactivated {no_correct} questions with no correct answers")
    if low_props > 0:
        print(f"  Deactivated {low_props} questions with fewer than 3 propositions")
    if no_correct == 0 and low_props == 0:
        print("  All checks passed")

    # Print summary
    print("\n" + "=" * 60)
    print("IMPORT COMPLETE")
    print("=" * 60)
    print(f"Questions inserted:  {stats['inserted']}")
    print(f"  Active:            {stats['active']}")
    print(f"  Inactive:          {stats['inactive']}")
    print(f"Topics inserted:     {topic_count}")
    print(f"Images uploaded:     {stats['images_uploaded']}")
    print(f"With explanation:    {stats['with_explanation']}")
    print(f"No chapter (→ 'Non classé'): {stats['no_topic']}")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Import standardized Word document into Supabase."
    )
    parser.add_argument(
        'input_file',
        help="Path to the standardized .docx file"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Parse and report counts without writing to DB"
    )
    args = parser.parse_args()

    input_path = Path(args.input_file).resolve()
    if not input_path.exists():
        print(f"Error: File not found: {input_path}")
        sys.exit(1)

    print(f"Input: {input_path.name}")
    print()

    # Parse the standardized document
    print("Parsing standardized document...")
    questions, topic_roots, doc = parse_standardized_docx(str(input_path))
    print(f"  Parsed {len(questions)} questions, {count_topics(topic_roots)} topics")

    if args.dry_run:
        run_dry_run(questions, topic_roots)
    else:
        run_import(questions, topic_roots, doc, str(input_path))


if __name__ == '__main__':
    main()
