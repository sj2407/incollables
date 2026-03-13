#!/usr/bin/env python3
"""
Tests for preprocessing.py
"""

import hashlib
import os
import sys
import unittest
from pathlib import Path

# Add scripts dir to path
sys.path.insert(0, str(Path(__file__).parent))

from preprocessing import (
    parse_answer_letters,
    is_question_heading,
    is_answer_line,
    is_answer_missing,
    strip_chapter_counter,
    compute_file_hash,
)


class TestIsQuestionHeading(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(is_question_heading("Question 1"), (True, "1"))
        self.assertEqual(is_question_heading("Question 25"), (True, "25"))
        self.assertEqual(is_question_heading("Question"), (True, ""))

    def test_whitespace(self):
        self.assertEqual(is_question_heading("Question  9"), (True, "9"))
        self.assertEqual(is_question_heading("  Question 1  "), (True, "1"))

    def test_case_insensitive(self):
        self.assertEqual(is_question_heading("question 5"), (True, "5"))
        self.assertEqual(is_question_heading("QUESTION 3"), (True, "3"))

    def test_not_question(self):
        self.assertEqual(is_question_heading("Question about something"), (False, None))
        self.assertEqual(is_question_heading("Réponse : A"), (False, None))
        self.assertEqual(is_question_heading(""), (False, None))


class TestIsAnswerLine(unittest.TestCase):
    def test_standard(self):
        self.assertTrue(is_answer_line("Réponse : A, C, E"))
        self.assertTrue(is_answer_line("Réponse : B"))
        self.assertTrue(is_answer_line("Réponses : A et D"))

    def test_variants(self):
        self.assertTrue(is_answer_line("Réponse :A"))
        self.assertTrue(is_answer_line("Réponse: A"))
        self.assertTrue(is_answer_line("Réponse  :  D"))
        self.assertTrue(is_answer_line("réponse : C"))
        self.assertTrue(is_answer_line("Réponse : …………………………"))
        self.assertTrue(is_answer_line("Réponse :"))

    def test_not_answer(self):
        self.assertFalse(is_answer_line("Question 1"))
        self.assertFalse(is_answer_line("Le neurone fonctionne"))
        self.assertFalse(is_answer_line(""))


class TestIsAnswerMissing(unittest.TestCase):
    def test_dots(self):
        self.assertTrue(is_answer_missing("Réponse : …………………………….."))
        self.assertTrue(is_answer_missing("Réponse :…………………………….."))
        self.assertTrue(is_answer_missing("Réponse ……………………………………………"))

    def test_empty(self):
        self.assertTrue(is_answer_missing("Réponse :"))
        self.assertTrue(is_answer_missing("Réponse :  "))

    def test_not_missing(self):
        self.assertFalse(is_answer_missing("Réponse : A, C"))
        self.assertFalse(is_answer_missing("Réponse : B"))


class TestParseAnswerLetters(unittest.TestCase):
    def test_standard_format(self):
        self.assertEqual(parse_answer_letters("Réponse : A, C, E")[0], ['A', 'C', 'E'])
        self.assertEqual(parse_answer_letters("Réponse : B")[0], ['B'])

    def test_et_separator(self):
        self.assertEqual(parse_answer_letters("Réponse : B et E")[0], ['B', 'E'])
        self.assertEqual(parse_answer_letters("Réponse : A, C et E")[0], ['A', 'C', 'E'])
        self.assertEqual(parse_answer_letters("Réponse : B, C et E")[0], ['B', 'C', 'E'])

    def test_concatenated(self):
        self.assertEqual(parse_answer_letters("Réponse : ACE")[0], ['A', 'C', 'E'])
        self.assertEqual(parse_answer_letters("Réponse : BCE")[0], ['B', 'C', 'E'])

    def test_no_colon(self):
        self.assertEqual(parse_answer_letters("Réponse C et E")[0], ['C', 'E'])
        self.assertEqual(parse_answer_letters("Réponse C")[0], ['C'])

    def test_spaces_only(self):
        self.assertEqual(parse_answer_letters("Réponse : A B C")[0], ['A', 'B', 'C'])
        self.assertEqual(parse_answer_letters("Réponse : B E")[0], ['B', 'E'])

    def test_typo_er(self):
        self.assertEqual(parse_answer_letters("Réponse : C er D")[0], ['C', 'D'])
        self.assertEqual(parse_answer_letters("Réponse : A, C er D")[0], ['A', 'C', 'D'])

    def test_trailing_punctuation(self):
        self.assertEqual(parse_answer_letters("Réponse : B et D.")[0], ['B', 'D'])
        self.assertEqual(parse_answer_letters("Réponse : B,")[0], ['B'])

    def test_plural(self):
        self.assertEqual(parse_answer_letters("Réponses : A et D")[0], ['A', 'D'])
        self.assertEqual(parse_answer_letters("Réponses : B, C et E")[0], ['B', 'C', 'E'])

    def test_lowercase(self):
        self.assertEqual(parse_answer_letters("Réponse : c et E")[0], ['C', 'E'])
        self.assertEqual(parse_answer_letters("réponse : C")[0], ['C'])

    def test_extra_spaces(self):
        self.assertEqual(parse_answer_letters("Réponse :  C D et E")[0], ['C', 'D', 'E'])
        self.assertEqual(parse_answer_letters("Réponse : B et  D")[0], ['B', 'D'])

    def test_missing_dots(self):
        self.assertEqual(parse_answer_letters("Réponse : ……………………………..")[0], [])
        self.assertEqual(parse_answer_letters("Réponse :")[0], [])

    def test_no_comma_between(self):
        self.assertEqual(parse_answer_letters("Réponse :A,C")[0], ['A', 'C'])
        self.assertEqual(parse_answer_letters("Réponse :B,C et D")[0], ['B', 'C', 'D'])

    def test_roman_numeral_rejected(self):
        # "II" should NOT be parsed as two "I" letters
        letters, _ = parse_answer_letters("Réponse : II")
        self.assertNotIn('I', letters)

    def test_inline_explanation(self):
        letters, explanation = parse_answer_letters(
            "Réponse :seule la réponse  A est juste car c'est un réflexe"
        )
        self.assertEqual(letters, ['A'])
        self.assertIn("réflexe", explanation)

    def test_merged_question(self):
        letters, remaining = parse_answer_letters("Réponse : A, B et   Question")
        self.assertEqual(letters, ['A', 'B'])
        self.assertIn("Question", remaining)

    def test_letter_beyond_e(self):
        self.assertEqual(parse_answer_letters("Réponse : B, D et F")[0], ['B', 'D', 'F'])


class TestStripChapterCounter(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(strip_chapter_counter("Transmission synaptique (30)"), "Transmission synaptique")
        self.assertEqual(strip_chapter_counter("Le cervelet (14)"), "Le cervelet")

    def test_no_counter(self):
        self.assertEqual(strip_chapter_counter("Physiologie du système nerveux"), "Physiologie du système nerveux")

    def test_counter_in_middle(self):
        # Only strip at end
        self.assertEqual(strip_chapter_counter("Section (3) details"), "Section (3) details")


class TestOriginalFileIntegrity(unittest.TestCase):
    """Test that the original .doc file is never modified."""

    def test_original_unchanged(self):
        doc_path = Path(__file__).parent.parent / "PCEM II s def3.doc"
        if not doc_path.exists():
            self.skipTest("Original .doc file not found")

        hash_before = compute_file_hash(str(doc_path))

        # Import and run parse (report only, no output)
        from preprocessing import parse_document
        from docx import Document

        docx_path = doc_path.with_suffix('.docx')
        if docx_path.exists():
            doc = Document(str(docx_path))
            parse_document(doc)

        hash_after = compute_file_hash(str(doc_path))
        self.assertEqual(hash_before, hash_after, "Original .doc file was modified!")


class TestEndToEnd(unittest.TestCase):
    """End-to-end test on the actual document."""

    @classmethod
    def setUpClass(cls):
        docx_path = Path(__file__).parent.parent / "PCEM II s def3.docx"
        if not docx_path.exists():
            raise unittest.SkipTest("Converted .docx not found")

        from preprocessing import parse_document, standardize_questions
        from docx import Document

        doc = Document(str(docx_path))
        cls.questions, cls.chapters, cls.stats = parse_document(doc)
        cls.questions = standardize_questions(cls.questions)
        cls.doc = doc

    def test_question_count_reasonable(self):
        """Should find between 400 and 500 questions."""
        self.assertGreaterEqual(len(self.questions), 400)
        self.assertLessEqual(len(self.questions), 500)

    def test_most_questions_have_5_propositions(self):
        """Most questions should have 5 propositions."""
        count_5 = sum(1 for q in self.questions if len(q.propositions) == 5)
        self.assertGreater(count_5, 350, "Expected >350 questions with 5 propositions")

    def test_no_question_has_more_than_10_propositions(self):
        """No question should have more than 10 propositions (sanity check)."""
        for q in self.questions:
            if len(q.propositions) > 10:
                self.fail(
                    f"Q{q.sequential_number} has {len(q.propositions)} propositions — "
                    f"likely a parsing runaway."
                )

    def test_most_questions_have_answers(self):
        """At least 90% of questions should have answers."""
        with_answers = sum(1 for q in self.questions if q.answer_letters)
        ratio = with_answers / len(self.questions)
        self.assertGreater(ratio, 0.90, f"Only {ratio:.0%} of questions have answers")

    def test_answer_letters_are_uppercase(self):
        """All answer letters should be uppercase."""
        for q in self.questions:
            for letter in q.answer_letters:
                self.assertTrue(letter.isupper(), f"Q{q.sequential_number}: '{letter}' not uppercase")

    def test_sequential_numbering(self):
        """Questions should be numbered 1 to N sequentially."""
        for i, q in enumerate(self.questions):
            self.assertEqual(q.sequential_number, i + 1)

    def test_no_bold_answer_letter_i(self):
        """The letter 'I' should not appear as an answer (likely roman numeral confusion)."""
        for q in self.questions:
            if 'I' in q.answer_letters and q.answer_source != 'line':
                self.fail(f"Q{q.sequential_number}: 'I' in answers — likely roman numeral confusion")

    def test_zero_prop_questions_under_15(self):
        """Very few questions should have 0 propositions."""
        zero_prop = sum(1 for q in self.questions if len(q.propositions) == 0)
        self.assertLess(zero_prop, 15, f"{zero_prop} questions have 0 propositions")


if __name__ == '__main__':
    unittest.main(verbosity=2)
