#!/usr/bin/env python3
"""
test_import.py — Unit tests for import_to_db.py

Tests cover:
  - Answer line parsing
  - Chapter title validation and cleaning
  - Question heading detection
  - Topic tree building
  - Inactive question detection
  - Full document parsing (against standardized .docx)
"""

import unittest
from pathlib import Path

from import_to_db import (
    is_question_heading,
    is_answer_line,
    is_explanation_marker,
    is_separator,
    is_valid_chapter_title,
    clean_chapter_title,
    parse_answer_letters_from_line,
    build_topic_tree,
    parse_standardized_docx,
    count_topics,
    ParsedQuestion,
    ParsedProposition,
    ParsedTopic,
)


class TestQuestionHeading(unittest.TestCase):
    def test_valid_question(self):
        is_q, num = is_question_heading("Question 1")
        self.assertTrue(is_q)
        self.assertEqual(num, 1)

    def test_question_large_number(self):
        is_q, num = is_question_heading("Question 465")
        self.assertTrue(is_q)
        self.assertEqual(num, 465)

    def test_not_question(self):
        is_q, _ = is_question_heading("This is not a question")
        self.assertFalse(is_q)

    def test_question_no_number(self):
        is_q, _ = is_question_heading("Question")
        self.assertFalse(is_q)

    def test_question_text_after(self):
        is_q, _ = is_question_heading("Question 1: What is?")
        self.assertFalse(is_q)


class TestAnswerLine(unittest.TestCase):
    def test_standard_answer(self):
        self.assertTrue(is_answer_line("Réponses : A, C, E"))

    def test_singular(self):
        self.assertTrue(is_answer_line("Réponse : A"))

    def test_missing(self):
        self.assertTrue(is_answer_line("Réponses : [MANQUANTE]"))

    def test_not_answer(self):
        self.assertFalse(is_answer_line("This is just text"))

    def test_accent_variant(self):
        self.assertTrue(is_answer_line("Reponse : B"))


class TestParseAnswerLetters(unittest.TestCase):
    def test_single_letter(self):
        letters, missing = parse_answer_letters_from_line("Réponses : A")
        self.assertEqual(letters, ['A'])
        self.assertFalse(missing)

    def test_multiple_letters(self):
        letters, missing = parse_answer_letters_from_line("Réponses : A, C, E")
        self.assertEqual(letters, ['A', 'C', 'E'])
        self.assertFalse(missing)

    def test_missing(self):
        letters, missing = parse_answer_letters_from_line("Réponses : [MANQUANTE]")
        self.assertEqual(letters, [])
        self.assertTrue(missing)

    def test_two_letters(self):
        letters, missing = parse_answer_letters_from_line("Réponses : B, D")
        self.assertEqual(letters, ['B', 'D'])
        self.assertFalse(missing)

    def test_all_five(self):
        letters, missing = parse_answer_letters_from_line("Réponses : A, B, C, D, E")
        self.assertEqual(letters, ['A', 'B', 'C', 'D', 'E'])
        self.assertFalse(missing)


class TestExplanationMarker(unittest.TestCase):
    def test_standard(self):
        self.assertTrue(is_explanation_marker("Explication :"))

    def test_with_space(self):
        self.assertTrue(is_explanation_marker("Explication : "))

    def test_not_marker(self):
        self.assertFalse(is_explanation_marker("Explication du concept"))


class TestSeparator(unittest.TestCase):
    def test_standard(self):
        self.assertTrue(is_separator("---"))

    def test_with_spaces(self):
        self.assertTrue(is_separator("  ---  "))

    def test_not_separator(self):
        self.assertFalse(is_separator("--"))
        self.assertFalse(is_separator("text"))


class TestValidChapterTitle(unittest.TestCase):
    def test_valid_short(self):
        self.assertTrue(is_valid_chapter_title("Transmission synaptique"))

    def test_valid_with_article(self):
        self.assertTrue(is_valid_chapter_title("Les réflexes médullaires"))

    def test_valid_uppercase(self):
        self.assertTrue(is_valid_chapter_title("PHYSIOLOGIE ENDOCRINIENNE"))

    def test_reject_lowercase_start(self):
        self.assertFalse(is_valid_chapter_title("la valeur de consigne est imposée"))

    def test_reject_too_long(self):
        self.assertFalse(is_valid_chapter_title("A" * 71))

    def test_reject_too_short(self):
        self.assertFalse(is_valid_chapter_title("AB"))

    def test_reject_answer_line(self):
        self.assertFalse(is_valid_chapter_title("Réponse : A et E"))

    def test_reject_proposition(self):
        self.assertFalse(is_valid_chapter_title("A. texte de proposition"))

    def test_reject_sentence_chez(self):
        self.assertFalse(is_valid_chapter_title("Chez l'Homme, le potentiel membranaire"))

    def test_reject_sentence_saccompagne(self):
        self.assertFalse(is_valid_chapter_title("S'accompagne d'une amélioration"))

    def test_reject_est_fausse(self):
        self.assertFalse(is_valid_chapter_title("La proposition E est fausse"))

    def test_reject_long_with_colon(self):
        self.assertFalse(is_valid_chapter_title("Au niveau du système nerveux central, l'angiotensine 2 :"))


class TestCleanChapterTitle(unittest.TestCase):
    def test_strip_counter_parens(self):
        self.assertEqual(clean_chapter_title("Motricité digestive (56)"), "Motricité digestive")

    def test_strip_trailing_number(self):
        self.assertEqual(clean_chapter_title("PHYSIOLOGIE ENDOCRINIENNE 120"), "PHYSIOLOGIE ENDOCRINIENNE")

    def test_strip_trailing_colon(self):
        self.assertEqual(clean_chapter_title("Le cervelet latéral :"), "Le cervelet latéral")

    def test_strip_roman_numeral(self):
        self.assertEqual(
            clean_chapter_title("I Régulations enzymatiques et hormonales"),
            "Régulations enzymatiques et hormonales"
        )

    def test_normalize_whitespace(self):
        self.assertEqual(
            clean_chapter_title("PHYSIOLOGIE   ENDOCRINIENNE  120"),
            "PHYSIOLOGIE ENDOCRINIENNE"
        )

    def test_no_change_needed(self):
        self.assertEqual(clean_chapter_title("Transmission synaptique"), "Transmission synaptique")


class TestBuildTopicTree(unittest.TestCase):
    def test_single_level(self):
        questions = [
            ParsedQuestion(chapter_path=["Chapter A"]),
            ParsedQuestion(chapter_path=["Chapter A"]),
            ParsedQuestion(chapter_path=["Chapter B"]),
        ]
        roots = build_topic_tree(questions)
        self.assertEqual(len(roots), 2)
        self.assertEqual(roots[0].title, "Chapter A")
        self.assertEqual(roots[1].title, "Chapter B")

    def test_two_levels(self):
        questions = [
            ParsedQuestion(chapter_path=["Parent", "Child 1"]),
            ParsedQuestion(chapter_path=["Parent", "Child 2"]),
        ]
        roots = build_topic_tree(questions)
        self.assertEqual(len(roots), 1)
        self.assertEqual(roots[0].title, "Parent")
        self.assertEqual(len(roots[0].children), 2)
        self.assertEqual(roots[0].children[0].title, "Child 1")

    def test_empty(self):
        questions = [ParsedQuestion(chapter_path=[])]
        roots = build_topic_tree(questions)
        self.assertEqual(len(roots), 0)

    def test_no_duplicates(self):
        questions = [
            ParsedQuestion(chapter_path=["A", "B"]),
            ParsedQuestion(chapter_path=["A", "B"]),
            ParsedQuestion(chapter_path=["A", "B"]),
        ]
        roots = build_topic_tree(questions)
        self.assertEqual(count_topics(roots), 2)  # A + B


class TestInactiveDetection(unittest.TestCase):
    def test_missing_answer(self):
        q = ParsedQuestion(answer_missing=True, has_propositions=True)
        self.assertTrue(q.answer_missing)

    def test_zero_propositions(self):
        q = ParsedQuestion(answer_missing=False, has_propositions=False)
        self.assertFalse(q.has_propositions)

    def test_active_question(self):
        q = ParsedQuestion(answer_missing=False, has_propositions=True)
        is_active = not q.answer_missing and q.has_propositions
        self.assertTrue(is_active)

    def test_both_inactive(self):
        q = ParsedQuestion(answer_missing=True, has_propositions=False)
        is_active = not q.answer_missing and q.has_propositions
        self.assertFalse(is_active)


class TestCountTopics(unittest.TestCase):
    def test_flat(self):
        roots = [ParsedTopic(title="A", level=1), ParsedTopic(title="B", level=1)]
        self.assertEqual(count_topics(roots), 2)

    def test_nested(self):
        child = ParsedTopic(title="C", level=2)
        root = ParsedTopic(title="A", level=1, children=[child])
        self.assertEqual(count_topics([root]), 2)

    def test_empty(self):
        self.assertEqual(count_topics([]), 0)


# ---------------------------------------------------------------------------
# Integration test: parse the actual standardized document
# ---------------------------------------------------------------------------

STANDARDIZED_DOC = Path(__file__).resolve().parent.parent / "PCEM II s def3_standardise.docx"


@unittest.skipUnless(STANDARDIZED_DOC.exists(), "Standardized doc not found")
class TestFullParsing(unittest.TestCase):
    """Integration tests against the actual standardized document."""

    @classmethod
    def setUpClass(cls):
        cls.questions, cls.topic_roots, cls.doc = parse_standardized_docx(str(STANDARDIZED_DOC))

    def test_question_count(self):
        self.assertEqual(len(self.questions), 465)

    def test_topic_count(self):
        self.assertEqual(count_topics(self.topic_roots), 15)

    def test_active_count(self):
        """Parser detects 434 active; post-import safety checks reduce to 427."""
        active = sum(1 for q in self.questions if not q.answer_missing and q.has_propositions)
        self.assertEqual(active, 434)  # parser-level count before DB safety checks

    def test_inactive_missing_answers(self):
        missing = sum(1 for q in self.questions if q.answer_missing)
        self.assertEqual(missing, 30)

    def test_inactive_zero_props(self):
        zero = sum(1 for q in self.questions if not q.has_propositions)
        self.assertEqual(zero, 10)

    def test_no_orphan_questions(self):
        """All questions should have a chapter path."""
        orphans = sum(1 for q in self.questions if not q.chapter_path)
        self.assertEqual(orphans, 0)

    def test_sequential_numbering(self):
        """Questions should be numbered 1..465."""
        numbers = [q.sequential_number for q in self.questions]
        self.assertEqual(numbers, list(range(1, 466)))

    def test_five_propositions_majority(self):
        """Most questions should have 5 propositions."""
        five_prop = sum(1 for q in self.questions if len(q.propositions) == 5)
        self.assertGreater(five_prop, 400)

    def test_questions_with_explanations(self):
        with_expl = sum(1 for q in self.questions if q.explanation_para_indices)
        self.assertGreaterEqual(with_expl, 110)

    def test_first_question_content(self):
        q1 = self.questions[0]
        self.assertEqual(q1.sequential_number, 1)
        self.assertIn("neurone", q1.stem_text.lower())
        self.assertEqual(len(q1.propositions), 5)
        self.assertIn('A', q1.answer_letters)
        self.assertIn('C', q1.answer_letters)
        self.assertIn('E', q1.answer_letters)

    def test_topic_tree_structure(self):
        """Root topics should exist."""
        root_titles = [r.title for r in self.topic_roots]
        self.assertIn("Préface", root_titles)
        self.assertIn("Motricité digestive", root_titles)

    def test_proposition_letters(self):
        """All propositions should have valid letters."""
        for q in self.questions:
            for prop in q.propositions:
                self.assertRegex(prop.letter, r'^[A-Z]$')

    def test_answer_letters_subset_of_propositions(self):
        """Answer letters should be among proposition letters (for active questions).
        Known exceptions from Sprint 0: some original doc answer lines reference
        letters beyond A-E (data quality issue in source material).
        """
        # Known bad questions from the original document — answer letters
        # reference propositions that don't exist (data quality issues in source).
        # These were flagged in questions_a_corriger.txt from Sprint 0.
        known_exceptions = {49, 140, 143, 201, 298, 378, 379, 384, 392, 399}

        mismatches = []
        for q in self.questions:
            if q.answer_missing or not q.has_propositions:
                continue
            if q.sequential_number in known_exceptions:
                continue
            prop_letters = {p.letter for p in q.propositions}
            for al in q.answer_letters:
                if al not in prop_letters:
                    mismatches.append(
                        f"Q{q.sequential_number}: answer '{al}' not in {prop_letters}"
                    )
        self.assertEqual(mismatches, [], f"Unexpected mismatches: {mismatches}")


if __name__ == '__main__':
    unittest.main()
