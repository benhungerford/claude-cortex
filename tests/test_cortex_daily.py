#!/usr/bin/env python3
"""Structural tests for the cortex-daily skill assets.

Run: python3 tests/test_cortex_daily.py
"""
import os
import re
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SKILL_DIR = os.path.join(REPO_ROOT, "skills", "cortex-daily")


def read(rel):
    with open(os.path.join(SKILL_DIR, rel), encoding="utf-8") as f:
        return f.read()


def read_repo(rel):
    with open(os.path.join(REPO_ROOT, rel), encoding="utf-8") as f:
        return f.read()


class TestSkillManifest(unittest.TestCase):
    def test_skill_md_exists_with_frontmatter(self):
        text = read("SKILL.md")
        self.assertTrue(text.startswith("---"), "SKILL.md must open with YAML frontmatter")
        fm = text.split("---", 2)[1]
        self.assertIn("name: cortex-daily", fm)
        self.assertRegex(fm, r"description:\s+\S")

    def test_skill_md_declares_triggers(self):
        text = read("SKILL.md").lower()
        for phrase in ["daily routine", "daily briefing", "daily pipeline"]:
            self.assertIn(phrase, text, f"SKILL.md must list trigger: {phrase}")

    def test_skill_md_points_to_workflow(self):
        self.assertIn("workflows/generate-routine.md", read("SKILL.md"))


if __name__ == "__main__":
    unittest.main()
