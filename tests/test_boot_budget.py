#!/usr/bin/env python3
"""Tests for boot-context token-budget behavior (W1.4)."""
import importlib.util
import os
import sys
import unittest

BC_PATH = os.path.join(os.path.dirname(__file__), "..", "hooks", "lib", "boot-context.py")
spec = importlib.util.spec_from_file_location("boot_context", os.path.abspath(BC_PATH))
bc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bc)


def base_output():
    return {
        "vault_path": "/v",
        "activation_level": 1,
        "personality": "P" * 5000,
        "memory": "M" * 5000,
        "learner_profile": "",
        "recent_activity": "R" * 5000,
        "inbox_count": 3,
        "active_projects": "Alpha (Active Project), Beta (Ongoing Support)",
        "project": None,
        "feature_suggestion": None,
    }


class TestBudget(unittest.TestCase):
    def test_bucket_list_survives_tiny_budget(self):
        out = base_output()
        bc.apply_token_budget(out, 500)
        # The bucket list (project-name anchor) must NOT be stubbed away.
        self.assertEqual(out["active_projects"], "Alpha (Active Project), Beta (Ongoing Support)")

    def test_overflow_string_dropped_to_none_not_stub(self):
        out = base_output()
        bc.apply_token_budget(out, 500)
        # recent_activity can't fit; it must be None (so session-start prints no
        # fake "Recent activity:" header), never a leftover stub string.
        self.assertIsNone(out["recent_activity"])

    def test_budget_metadata_lists_truncated_fields(self):
        out = base_output()
        bc.apply_token_budget(out, 500)
        self.assertIn("_budget", out)
        self.assertTrue(len(out["_budget"]["truncated"]) > 0)

    def test_disabled_budget_keeps_everything(self):
        out = base_output()
        bc.apply_token_budget(out, 0)
        self.assertNotIn("_budget", out)
        self.assertEqual(len(out["personality"]), 5000)


if __name__ == "__main__":
    unittest.main()
