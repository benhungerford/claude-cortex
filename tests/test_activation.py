#!/usr/bin/env python3
"""Tests for boot-context activation resolution (W2.4 / T11).

Covers:
  - git worktree resolution: a registered repo opened via a linked worktree
    still resolves to L3 by walking up the *main* worktree root.
  - default_project: Desktop/iPad sessions with no cwd match reach >= L2.
  - unified path normalization (realpath) parity between resolvers.
  - L1-with-nearby-cortex warning surfaced in output.

Run: python3 tests/test_activation.py
"""
import importlib.util
import os
import subprocess
import sys
import tempfile
import unittest

BC_PATH = os.path.join(os.path.dirname(__file__), "..", "hooks", "lib", "boot-context.py")
spec = importlib.util.spec_from_file_location("boot_context", os.path.abspath(BC_PATH))
bc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bc)


def make_registry(repo_path, vault_path="Work/P", context_file="P — Project Context.md"):
    return {
        "schema_version": 1,
        "projects": [
            {
                "id": "p1",
                "vault_path": vault_path,
                "context_file": context_file,
                "repo_paths": [repo_path],
            }
        ],
    }


class TestExactAndVault(unittest.TestCase):
    """Existing behavior must remain intact."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="cortex-act-")
        self.vault = os.path.join(self.tmp, "vault")
        self.repo = os.path.join(self.tmp, "repo")
        os.makedirs(self.vault)
        os.makedirs(self.repo)

    def test_exact_repo_match_is_l3(self):
        reg = make_registry(self.repo)
        level, proj = bc.resolve_cwd(self.vault, self.repo, reg)
        self.assertEqual(level, 3)
        self.assertEqual(proj["id"], "p1")

    def test_inside_vault_is_l2(self):
        reg = make_registry(self.repo)
        sub = os.path.join(self.vault, "Work")
        os.makedirs(sub)
        level, proj = bc.resolve_cwd(self.vault, sub, reg)
        self.assertEqual(level, 2)
        self.assertIsNone(proj)

    def test_no_match_is_l1(self):
        reg = make_registry(self.repo)
        elsewhere = os.path.join(self.tmp, "elsewhere")
        os.makedirs(elsewhere)
        level, proj = bc.resolve_cwd(self.vault, elsewhere, reg)
        self.assertEqual(level, 1)
        self.assertIsNone(proj)


class TestSymlinkParity(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="cortex-act-sym-")
        self.vault = os.path.join(self.tmp, "vault")
        self.repo = os.path.join(self.tmp, "repo")
        os.makedirs(self.vault)
        os.makedirs(self.repo)

    def test_symlinked_repo_resolves_to_l3(self):
        # A symlink pointing at the registered repo should resolve to L3
        # because both sides normalize via realpath.
        link = os.path.join(self.tmp, "repo-link")
        try:
            os.symlink(self.repo, link)
        except (OSError, NotImplementedError):
            self.skipTest("symlinks unsupported on this platform")
        reg = make_registry(self.repo)
        level, proj = bc.resolve_cwd(self.vault, link, reg)
        self.assertEqual(level, 3)
        self.assertEqual(proj["id"], "p1")


class TestWorktree(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="cortex-act-wt-")
        self.vault = os.path.join(self.tmp, "vault")
        self.repo = os.path.join(self.tmp, "repo")
        os.makedirs(self.vault)
        os.makedirs(self.repo)
        if not self._git_available():
            self.skipTest("git not available")
        self._init_repo()

    def _git_available(self):
        try:
            subprocess.run(["git", "--version"], capture_output=True, check=True)
            return True
        except Exception:
            return False

    def _git(self, *args, cwd=None):
        subprocess.run(
            ["git", *args],
            cwd=cwd or self.repo,
            capture_output=True,
            check=True,
            env={**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t",
                 "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"},
        )

    def _init_repo(self):
        self._git("init", "-q")
        with open(os.path.join(self.repo, "f.txt"), "w") as f:
            f.write("hi\n")
        self._git("add", ".")
        self._git("commit", "-qm", "init")

    def test_worktree_resolves_to_main_root_l3(self):
        # Register the MAIN repo; open a linked worktree elsewhere; it should
        # still resolve to L3 via git-common-dir walk-back.
        wt = os.path.join(self.tmp, "wt")
        self._git("worktree", "add", "-q", wt)
        reg = make_registry(self.repo)
        level, proj = bc.resolve_cwd(self.vault, wt, reg)
        self.assertEqual(level, 3, "worktree should resolve to its main repo's L3")
        self.assertEqual(proj["id"], "p1")


class TestDefaultProject(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="cortex-act-dp-")
        self.vault = os.path.join(self.tmp, "vault")
        self.repo = os.path.join(self.tmp, "repo")
        os.makedirs(self.vault)
        os.makedirs(self.repo)

    def test_default_project_lifts_l1_to_l2(self):
        # Desktop/iPad: no cwd match, but a default_project is configured.
        reg = make_registry(self.repo)
        elsewhere = os.path.join(self.tmp, "elsewhere")
        os.makedirs(elsewhere)
        level, proj = bc.resolve_cwd(self.vault, elsewhere, reg, default_project="p1")
        self.assertGreaterEqual(level, 2, "default_project should yield at least L2")

    def test_default_project_unknown_id_stays_l1(self):
        reg = make_registry(self.repo)
        elsewhere = os.path.join(self.tmp, "elsewhere")
        os.makedirs(elsewhere)
        level, proj = bc.resolve_cwd(self.vault, elsewhere, reg, default_project="nope")
        self.assertEqual(level, 1)

    def test_no_default_project_stays_l1(self):
        reg = make_registry(self.repo)
        elsewhere = os.path.join(self.tmp, "elsewhere")
        os.makedirs(elsewhere)
        level, proj = bc.resolve_cwd(self.vault, elsewhere, reg)
        self.assertEqual(level, 1)


class TestNearbyWarning(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="cortex-act-warn-")

    def test_detects_nearby_cortex_stub(self):
        # A directory holding a Cortex stub CLAUDE.md but not in the registry
        # should produce a warning string.
        d = os.path.join(self.tmp, "orphan")
        os.makedirs(d)
        with open(os.path.join(d, "CLAUDE.md"), "w") as f:
            f.write("<!-- cortex-stub -->\nManaged by Claude Cortex.\n")
        warn = bc.detect_nearby_cortex(d)
        self.assertIsNotNone(warn)
        self.assertIn("L1", warn)

    def test_no_warning_when_nothing_nearby(self):
        d = os.path.join(self.tmp, "plain")
        os.makedirs(d)
        warn = bc.detect_nearby_cortex(d)
        self.assertIsNone(warn)


class TestDormantFeatures(unittest.TestCase):
    """W3.3 (T21): generalized dormant-feature iteration + 7-day suppression."""

    DOC_PERS = (
        "---\n"
        "progressive_features:\n"
        "  active:\n"
        "    - feature: \"memory_management\"\n"
        "  dormant:\n"
        "    - feature: \"meeting_threading\"\n"
        "      cooldown_days: 30\n"
        "    - feature: \"weekly_review\"\n"
        "      cooldown_days: 14\n"
        "---\n"
        "# P\n"
    )

    COMPACT_PERS = (
        "---\n"
        "progressive_features:\n"
        "  active:\n"
        "    - core_capture\n"
        "  dormant:\n"
        "    - name: weekly_review\n"
        "      activation_signal: \"changelog_lines >= 50\"\n"
        "    - name: daily_briefing\n"
        "---\n"
        "# P\n"
    )

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="cortex-dormant-")
        os.makedirs(os.path.join(self.tmp, ".claude", "cortex"))

    def test_parses_both_yaml_shapes(self):
        self.assertEqual(
            bc._parse_dormant_features(self.DOC_PERS),
            ["meeting_threading", "weekly_review"],
        )
        self.assertEqual(
            bc._parse_dormant_features(self.COMPACT_PERS),
            ["weekly_review", "daily_briefing"],
        )

    def test_below_threshold_returns_none(self):
        self.assertIsNone(
            bc.check_dormant_features(self.DOC_PERS, 10, vault_path=self.tmp,
                                      today="2026-06-01")
        )

    def test_iterates_all_features_not_just_weekly_review(self):
        # First eligible feature (declared order) is meeting_threading, NOT the
        # old hardcoded weekly_review.
        s = bc.check_dormant_features(self.DOC_PERS, 60, vault_path=self.tmp,
                                      today="2026-06-01")
        self.assertIn("meeting_threading", s)

    def test_suppresses_then_advances_then_reeligible(self):
        s1 = bc.check_dormant_features(self.DOC_PERS, 60, vault_path=self.tmp,
                                       today="2026-06-01")
        self.assertIn("meeting_threading", s1)
        # Same day: meeting_threading is suppressed; advances to weekly_review.
        s2 = bc.check_dormant_features(self.DOC_PERS, 60, vault_path=self.tmp,
                                       today="2026-06-01")
        self.assertIn("weekly_review", s2)
        # Same day: both suppressed -> None.
        s3 = bc.check_dormant_features(self.DOC_PERS, 60, vault_path=self.tmp,
                                       today="2026-06-01")
        self.assertIsNone(s3)
        # 8 days later: first feature past the 7-day window is eligible again.
        s4 = bc.check_dormant_features(self.DOC_PERS, 60, vault_path=self.tmp,
                                       today="2026-06-09")
        self.assertIn("meeting_threading", s4)

    def test_state_persisted_per_feature(self):
        bc.check_dormant_features(self.DOC_PERS, 60, vault_path=self.tmp,
                                  today="2026-06-01")
        state = bc._read_dormant_state(self.tmp)
        self.assertEqual(state.get("meeting_threading"), "2026-06-01")


class TestConfigDefaultProject(unittest.TestCase):
    def test_read_default_project_from_config(self):
        import json
        fd, p = tempfile.mkstemp(suffix=".json")
        os.close(fd)
        with open(p, "w") as f:
            json.dump({"vault_path": "/v", "default_project": "p1"}, f)
        self.assertEqual(bc.read_config_default_project(p), "p1")

    def test_missing_default_project_is_none(self):
        import json
        fd, p = tempfile.mkstemp(suffix=".json")
        os.close(fd)
        with open(p, "w") as f:
            json.dump({"vault_path": "/v"}, f)
        self.assertIsNone(bc.read_config_default_project(p))


if __name__ == "__main__":
    unittest.main()
