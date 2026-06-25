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


class TestSkeleton(unittest.TestCase):
    def setUp(self):
        self.text = read("assets/routine-skeleton.md")

    def test_has_all_seven_locked_parts(self):
        for n in range(0, 7):
            self.assertIn(f"PART {n}", self.text, f"skeleton missing PART {n}")

    def test_unattended_no_questions_rule(self):
        low = self.text.lower()
        self.assertIn("unattended", low)
        self.assertIn("never pause", low)

    def test_dedup_guard_matches_on_id_not_filename(self):
        self.assertIn("MATCH ON THE ID", self.text)
        self.assertIn("_pipeline_state.json", self.text)

    def test_autonomy_rules_present(self):
        low = self.text.lower()
        self.assertIn("_inbox", low)
        self.assertIn("never delete", low)
        self.assertIn("never create a duplicate", low)
        self.assertIn("never overwrite", low)

    def test_has_section_injection_marker(self):
        self.assertIn("<!-- INJECT: SECTION BODIES -->", self.text)

    def test_writes_briefing_and_logs(self):
        low = self.text.lower()
        self.assertIn("daily briefings/", low)
        self.assertIn("append_changelog", low)


class TestCanonicalSections(unittest.TestCase):
    def setUp(self):
        self.text = read("assets/canonical-sections.md")

    def test_default_sections_present(self):
        for s in [
            "Action Items", "Health Flags", "Follow-up", "Pipeline Summary",
            "Email Triage", "Task / PM Activity", "Meetings", "Calendar",
            "Active Project Status", "Inbox Residue", "Changelog",
        ]:
            self.assertIn(s, self.text, f"canonical menu missing: {s}")

    def test_youtube_not_in_default_menu(self):
        # YouTube must not appear inside the default-menu markdown table
        # (the table runs from the "| # |" header to the next ## heading).
        table_match = re.search(r"\| # \|.*?(?=\n##|\Z)", self.text, re.DOTALL)
        if table_match:
            self.assertNotIn(
                "YouTube", table_match.group(),
                "YouTube must not appear in the default-menu table",
            )
        # If YouTube appears anywhere, it must be explicitly marked opt-in nearby.
        if "YouTube" in self.text:
            self.assertRegex(self.text, r"YouTube[\s\S]{0,120}(opt-in|explicit)")

    def test_connector_type_column_present(self):
        for t in ["email", "project-management", "transcript", "calendar"]:
            self.assertIn(t, self.text, f"missing connector type: {t}")


class TestSectionLibrary(unittest.TestCase):
    def setUp(self):
        self.text = read("assets/section-library.md")

    def test_recipe_per_connector_type(self):
        for t in ["email", "project-management", "transcript", "calendar"]:
            self.assertIn(t, self.text, f"no recipe references connector type: {t}")

    def test_vault_internal_recipes_present(self):
        for s in ["Action Items", "Active Project Status", "Inbox Residue"]:
            self.assertIn(s, self.text)

    def test_has_generic_custom_recipe(self):
        self.assertRegex(self.text.lower(), r"custom section")

    def test_youtube_recipe_marked_opt_in(self):
        self.assertIn("YouTube", self.text)
        self.assertRegex(self.text, r"YouTube[\s\S]{0,160}(opt-in|explicit)")

    def test_connector_recipes_note_dedup_inheritance(self):
        # Each connector-typed recipe must state it inherits the PART 2 dedup guard.
        # Split the doc into recipe blocks by "###" headings and check the four
        # connector recipes individually, not just the document as a whole.
        import re as _re
        blocks = _re.split(r"\n###\s+", self.text)
        connector_keywords = ["Email", "Task / PM", "Meetings", "Calendar"]
        for kw in connector_keywords:
            block = next((b for b in blocks if b.startswith(kw)), None)
            self.assertIsNotNone(block, f"no recipe block for: {kw}")
            self.assertIn("part 2", block.lower(),
                          f"recipe '{kw}' must state PART 2 dedup inheritance")


class TestWorkflow(unittest.TestCase):
    def setUp(self):
        self.text = read("workflows/generate-routine.md")
        self.low = self.text.lower()

    def test_seven_runtime_steps(self):
        for kw in ["resolve", "auto-detect", "confirm", "interview",
                   "assemble", "emit", "instruct"]:
            self.assertIn(kw, self.low, f"workflow missing step keyword: {kw}")

    def test_connector_type_detection(self):
        for t in ["email", "project-management", "transcript", "calendar"]:
            self.assertIn(t, self.text)

    def test_saved_copy_path_and_header(self):
        self.assertIn(".claude/cortex/daily-routine.md", self.text)
        self.assertRegex(self.low, r"metadata header")

    def test_diff_refresh_mode(self):
        self.assertIn("diff", self.low)
        self.assertRegex(self.low, r"preserv\w* .*section choices|prior section choices")

    def test_edge_cases_documented(self):
        for kw in ["no connectors", "personality.md", "missing"]:
            self.assertIn(kw, self.low, f"workflow missing edge case: {kw}")

    def test_l1_warns_before_saving(self):
        # Spec: at L1 the skill warns/confirms before writing the saved copy.
        self.assertIn("l1", self.low)
        self.assertRegex(self.low, r"l1[\s\S]{0,200}(warn|confirm)")


class TestWiring(unittest.TestCase):
    def test_trigger_phrases_lists_cortex_daily(self):
        self.assertIn("cortex-daily", read_repo("references/trigger-phrases.md"))

    def test_progressive_features_handoff(self):
        text = read_repo("references/progressive-features.md")
        self.assertIn("cortex-daily", text)
        # handoff must be associated with the daily_briefing feature
        self.assertRegex(text, r"daily_briefing[\s\S]{0,400}cortex-daily")


class TestScenariosDoc(unittest.TestCase):
    def test_scenarios_cover_cortex_daily(self):
        text = read_repo("tests/scenarios.md")
        self.assertIn("cortex-daily", text)
        low = text.lower()
        self.assertIn("refresh", low)
        self.assertIn("no connector", low)

    def test_readme_lists_skill(self):
        self.assertIn("cortex-daily", read_repo("README.md"))

    def test_changelog_mentions_skill(self):
        self.assertIn("cortex-daily", read_repo("CHANGELOG.md"))


if __name__ == "__main__":
    unittest.main()
