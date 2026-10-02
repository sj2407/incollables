#!/usr/bin/env python3
"""
restore_missing.py — Selective restore of Q1-Q336 without touching existing data.

Parses the full standardized .docx, filters to only questions with
sequential_number <= 336, and inserts them along with their missing topics.
Existing data (Q337-Q465, sessions, answers) is untouched.

Usage:
  python restore_missing.py "PCEM II s def3_standardise.docx" --dry-run
  python restore_missing.py "PCEM II s def3_standardise.docx"
"""

import argparse
import sys
from pathlib import Path

# Reuse everything from the existing import script
from import_to_db import (
    parse_standardized_docx,
    count_topics,
    run_dry_run,
    get_supabase_client,
    extract_images_from_doc,
    process_and_insert_question,
)

import uuid


MAX_QUESTION_NUMBER = 336  # Restore Q1-Q336 only


def get_existing_topics(supabase):
    """Fetch existing topics from DB to avoid duplicates."""
    result = supabase.table('topics').select('id, title, parent_id, level').execute()
    return result.data


def get_existing_question_numbers(supabase):
    """Fetch existing question numbers to skip duplicates."""
    result = supabase.table('questions').select('question_number').execute()
    return {row['question_number'] for row in result.data}


def insert_topics_selective(supabase, topic_roots, existing_topics):
    """Insert only topics that don't already exist. Returns title_path → UUID mapping."""
    # Build a lookup of existing topics by (title, level)
    existing_by_title = {}
    for t in existing_topics:
        existing_by_title[(t['title'], t['level'])] = t['id']

    mapping = {}  # tuple(path) → uuid

    def _insert(nodes, parent_uuid, path_prefix):
        for i, node in enumerate(nodes):
            path_key = tuple(list(path_prefix) + [node.title])
            key = (node.title, node.level)

            if key in existing_by_title:
                # Topic already exists, reuse its ID
                topic_id = existing_by_title[key]
                print(f"  [SKIP] Topic already exists: {node.title} (level {node.level})")
            else:
                # Insert new topic
                topic_id = str(uuid.uuid4())
                row = {
                    'id': topic_id,
                    'parent_id': parent_uuid,
                    'title': node.title,
                    'level': node.level,
                    'sort_order': i,
                    'is_active': True,
                }
                supabase.table('topics').insert(row).execute()
                print(f"  [NEW]  Inserted topic: {node.title} (level {node.level})")

            node.db_id = topic_id
            mapping[path_key] = topic_id

            if node.children:
                _insert(node.children, topic_id, path_key)

    _insert(topic_roots, None, ())
    return mapping


def run_selective_restore(questions, topic_roots, doc, doc_path):
    """Restore only missing questions (Q1-Q336) without touching existing data."""
    supabase = get_supabase_client()

    # Step 1: Check existing data
    print("\nChecking existing data...")
    existing_topics = get_existing_topics(supabase)
    existing_qnums = get_existing_question_numbers(supabase)
    print(f"  Existing topics: {len(existing_topics)}")
    print(f"  Existing questions: {len(existing_qnums)}")

    # Step 2: Filter questions to restore
    to_restore = [q for q in questions
                  if q.sequential_number <= MAX_QUESTION_NUMBER
                  and q.sequential_number not in existing_qnums]
    print(f"\n  Questions to restore (Q1-Q{MAX_QUESTION_NUMBER}, not already in DB): {len(to_restore)}")

    if not to_restore:
        print("\n  Nothing to restore — all questions already exist!")
        return

    # Step 3: Insert missing topics (skip existing ones)
    print("\nInserting missing topics...")
    topic_mapping = insert_topics_selective(supabase, topic_roots, existing_topics)

    # Step 4: Extract images
    print("\nExtracting images from document...")
    all_images = extract_images_from_doc(doc)
    print(f"  Found {len(all_images)} images in document")

    # Step 5: Insert questions
    print(f"\nRestoring {len(to_restore)} questions...")
    stats = {
        'inserted': 0,
        'active': 0,
        'inactive': 0,
        'images_uploaded': 0,
        'with_explanation': 0,
        'no_topic': 0,
    }

    default_topic_id = None

    for qi, question in enumerate(to_restore):
        if (qi + 1) % 50 == 0 or qi == 0:
            print(f"  Processing Q{question.sequential_number} ({qi + 1}/{len(to_restore)})...")

        default_topic_id = process_and_insert_question(
            supabase, question, doc, doc_path, all_images,
            topic_mapping, stats, default_topic_id,
        )

    # Post-import safety checks (only for newly inserted questions)
    print("\nRunning post-import safety checks on restored questions...")
    result = supabase.table('questions').select('id, question_number').eq('is_active', True).execute()
    newly_restored_nums = {q.sequential_number for q in to_restore}
    deactivated = 0
    for q_row in result.data:
        if q_row['question_number'] not in newly_restored_nums:
            continue  # Skip existing questions
        choices_result = supabase.table('choices').select('is_correct').eq('question_id', q_row['id']).execute()
        choice_count = len(choices_result.data)
        correct_count = sum(1 for c in choices_result.data if c['is_correct'])

        if correct_count == 0 or choice_count < 3:
            supabase.table('questions').update({'is_active': False}).eq('id', q_row['id']).execute()
            stats['active'] -= 1
            stats['inactive'] += 1
            deactivated += 1

    if deactivated > 0:
        print(f"  Deactivated {deactivated} questions (no correct answers or <3 propositions)")
    else:
        print("  All checks passed")

    # Summary
    print("\n" + "=" * 60)
    print("SELECTIVE RESTORE COMPLETE")
    print("=" * 60)
    print(f"Questions restored:  {stats['inserted']}")
    print(f"  Active:            {stats['active']}")
    print(f"  Inactive:          {stats['inactive']}")
    print(f"Images uploaded:     {stats['images_uploaded']}")
    print(f"With explanation:    {stats['with_explanation']}")
    print(f"No chapter (→ 'Non classé'): {stats['no_topic']}")
    print(f"Existing data:       UNTOUCHED")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Selectively restore missing questions (Q1-Q336) without touching existing data."
    )
    parser.add_argument(
        'input_file',
        help="Path to the standardized .docx file"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Parse and show what would be restored, without writing to DB"
    )
    args = parser.parse_args()

    input_path = Path(args.input_file).resolve()
    if not input_path.exists():
        print(f"Error: File not found: {input_path}")
        sys.exit(1)

    print(f"Input: {input_path.name}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'SELECTIVE RESTORE (Q1-Q{})'.format(MAX_QUESTION_NUMBER)}")
    print()

    # Parse the full document
    print("Parsing standardized document...")
    questions, topic_roots, doc = parse_standardized_docx(str(input_path))
    print(f"  Parsed {len(questions)} questions, {count_topics(topic_roots)} topics")

    # Filter to show only what we'd restore
    restore_candidates = [q for q in questions if q.sequential_number <= MAX_QUESTION_NUMBER]
    print(f"  Questions in Q1-Q{MAX_QUESTION_NUMBER} range: {len(restore_candidates)}")

    if args.dry_run:
        print("\n--- DRY RUN: Showing what would be restored ---")
        run_dry_run(restore_candidates, topic_roots)
    else:
        run_selective_restore(questions, topic_roots, doc, str(input_path))


if __name__ == '__main__':
    main()
