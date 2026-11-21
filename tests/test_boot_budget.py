#!/usr/bin/env python3
"""Tests for boot-context token-budget behavior (W1.4)."""
import importlib.util
import json
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


    def test_default_budget_is_8000(self):
        self.assertEqual(bc.DEFAULT_BUDGET_CHARS, 8000)

    def test_render_overhead_counts_against_budget(self):
        out = base_output()
        out["personality"] = "P" * 3000
        out["memory"] = "M" * 3000
        out["recent_activity"] = ""
        # 6000 chars of fields fit an 8000 budget only if the rendered text
        # around them is ignored; with the overhead counted, memory is trimmed.
        bc.apply_token_budget(out, 8000 - 1000)
        self.assertIn("memory", out["_budget"]["truncated"])


PERSONALITY = '''---
identity:
  name: "Ada Example"
  role: "Developer"
  company: "Acme"
mental_model:
  bucket_term: "client"
  project_term: "project"
  hierarchy_pattern: "Work/<Client>/<Project>/"
  buckets:
    - name: "Alpha"
      type: "Active Project"
communication_preferences:
  general:
    - rule: "No em dashes in emails."
  monday_updates:
    - "Keep it short."
    - "Lead with what you did."
---

# Body that should not be injected
''' + ("long body text " * 1000)


class TestSummaries(unittest.TestCase):
    def test_personality_summary_is_short_and_keeps_rules(self):
        s = bc.summarize_personality(PERSONALITY)
        self.assertLess(len(s), 1000)
        self.assertIn("Ada Example, Developer (Acme)", s)
        self.assertIn("Work/<Client>/<Project>/", s)
        self.assertIn("No em dashes in emails.", s)
        self.assertIn("Monday updates: Keep it short; Lead with what you did.", s)
        self.assertNotIn("long body text", s)

    def test_personality_without_frontmatter_is_capped(self):
        self.assertLessEqual(len(bc.summarize_personality("x" * 5000)), 600)

    def test_memory_index_and_tail_fallback(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "memory.md"), "w") as f:
                f.write("# Memory\n## Facts\n- a\n- b\n## Log\n### S1\nx\n### S2\ny\n")
            s = bc.summarize_memory(d)
            self.assertIn("memory.md has 9 lines", s)
            self.assertIn("- Facts (lines 2-4)", s)
            self.assertIn("- Log (lines 5-9, 2 entries)", s)
            with open(os.path.join(d, "memory.md"), "w") as f:
                f.write("".join(f"line {i}\n" for i in range(150)))
            tail = bc.summarize_memory(d, cap=100)
            self.assertIn("line 149", tail)
            self.assertNotIn("line 49\n", tail)


class TestDecisionCap(unittest.TestCase):
    def test_recent_decisions_capped_at_200_chars(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            proj = os.path.join(d, "Work", "P")
            os.makedirs(proj)
            with open(os.path.join(proj, "P — Project Context.md"), "w") as f:
                f.write("# P\n")
            with open(os.path.join(proj, "Changelog.md"), "w") as f:
                f.write("short one\n" + ("D" * 1500) + "\n")
            hub = bc.parse_hub(d, {"vault_path": "Work/P", "context_file": "P — Project Context.md"})
            # Undated lines fall back to the file's tail, newest (last) first.
            self.assertEqual(hub["recent_decisions"][1], "short one")
            self.assertLessEqual(len(hub["recent_decisions"][0]), 200)
            self.assertTrue(hub["recent_decisions"][0].endswith("…"))

    def test_nearby_stub_note_is_optional_wording(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "CLAUDE.md"), "w") as f:
                f.write("Cortex stub\n")
            note = bc.detect_nearby_cortex(d)
            self.assertIn("If the user asks about this repo, offer /cortex-register-repo", note)


class TestSetupCheck(unittest.TestCase):
    def setUp(self):
        import tempfile
        self.tmp = tempfile.mkdtemp()
        self.vault = os.path.join(self.tmp, "vault")
        os.makedirs(self.vault)
        self.cfg = os.path.join(self.tmp, "config.json")

    def tearDown(self):
        import shutil
        os.chmod(self.vault, 0o755)
        shutil.rmtree(self.tmp)

    def write_cfg(self, text):
        with open(self.cfg, "w") as f:
            f.write(text)

    def code(self):
        return (bc.check_setup(self.cfg)[2] or (0, ""))[0]

    def test_absent_config_is_not_set_up(self):
        self.assertEqual(self.code(), bc.NOT_SET_UP)

    def test_unparseable_config_is_unreadable(self):
        self.write_cfg('{"vault_path": "/x"')  # caught mid-write
        self.assertEqual(self.code(), bc.UNREADABLE)

    def test_missing_vault_dir_is_unreadable(self):
        self.write_cfg(json.dumps({"vault_path": os.path.join(self.tmp, "gone")}))
        self.assertEqual(self.code(), bc.UNREADABLE)

    def test_permission_denied_vault_is_unreadable(self):
        self.write_cfg(json.dumps({"vault_path": self.vault}))
        os.chmod(self.vault, 0)
        if os.access(self.vault, os.R_OK):
            self.skipTest("running as a user that ignores permissions")
        self.assertEqual(self.code(), bc.UNREADABLE)

    def test_readable_vault_without_personality_is_not_set_up(self):
        self.write_cfg(json.dumps({"vault_path": self.vault}))
        self.assertEqual(self.code(), bc.NOT_SET_UP)

    def test_ok(self):
        self.write_cfg(json.dumps({"vault_path": self.vault}))
        with open(os.path.join(self.vault, "personality.md"), "w") as f:
            f.write("---\nidentity:\n  name: \"A\"\n---\n")
        vp, pers, fail = bc.check_setup(self.cfg)
        self.assertIsNone(fail)
        self.assertEqual(vp, self.vault)


class TestNearbyHome(unittest.TestCase):
    def test_home_config_dir_is_not_a_vault_marker(self):
        import tempfile
        from unittest import mock
        with tempfile.TemporaryDirectory() as home:
            os.makedirs(os.path.join(home, ".claude", "cortex"))
            sub = os.path.join(home, "scratch")
            os.makedirs(sub)
            with mock.patch.dict(os.environ, {"HOME": home}):
                self.assertIsNone(bc.detect_nearby_cortex(sub))
                self.assertIsNone(bc.detect_nearby_cortex(home))


class TestHubFormats(unittest.TestCase):
    HUB = (
        "# P\n\n## 📦 Project Stage Tracker\n\n| Stage | Status | Notes |\n|---|---|---|\n"
        "| Discovery | 🟢 Done | x |\n| Copy | 🟡 In Progress | y |\n| QA | ⚪ Not Started | |\n\n"
        "## Open Questions\n\n- [ ] **OQ-1** · 2026-04-15 · Webhook auth?\n"
        "- [x] **OQ-2** · 2026-04-08 · Done one\n\n"
        "## Active Blockers\n\n"
        "- **BLK-1** · opened 2026-04-20 · blocks: Launch · attributable-to: Ashley · PO flow not started\n"
        "- **BLK-2** · opened 2026-04-23 · **Resolved 2026-05-11** — done\n"
        "- **BLK-3** · opened 2026-05-07 · self-gate · Waiting until the tag work is resolved\n"
    )
    CHANGELOG = (
        "# Changelog\n\n## 2026-04-22\n- **Decision:** older\n\n"
        "## 2026-11-19 (dev work)\n- newest a\n- newest b\n\n"
        "| Date | Entry |\n|---|---|\n| May 18 2026 | table row |\n"
    )

    def parse(self, hub, changelog=None):
        import tempfile
        d = tempfile.mkdtemp()
        proj = os.path.join(d, "Work", "P")
        os.makedirs(proj)
        with open(os.path.join(proj, "P — Project Context.md"), "w") as f:
            f.write(hub)
        if changelog is not None:
            with open(os.path.join(proj, "Changelog.md"), "w") as f:
                f.write(changelog)
        return bc.parse_hub(d, {"vault_path": "Work/P", "context_file": "P — Project Context.md"})

    def test_emoji_stage_and_hub_format_lists(self):
        h = self.parse(self.HUB, self.CHANGELOG)
        self.assertEqual(h["stage"], "Copy")
        self.assertEqual(h["blockers"], ["BLK-1: PO flow not started",
                                         "BLK-3: Waiting until the tag work is resolved"])
        self.assertEqual(len(h["open_questions"]), 1)
        self.assertEqual(h["parsed"], {"stage": True, "blockers": True})

    def test_decisions_newest_first(self):
        h = self.parse(self.HUB, self.CHANGELOG)
        self.assertEqual(h["recent_decisions"][:4], [
            "2026-11-19: newest a", "2026-11-19: newest b",
            "2026-05-18: table row", "2026-04-22: **Decision:** older"])

    def test_unparsed_sections_flagged_and_rendered(self):
        h = self.parse("# P\n\nFree text only.\n")
        self.assertEqual(h["parsed"], {"stage": False, "blockers": False})
        spec = importlib.util.spec_from_file_location(
            "render_session", os.path.join(os.path.dirname(BC_PATH), "render-session.py"))
        rs = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(rs)
        block = rs.render({"vault_path": "/v", "activation_level": 3,
                           "project": {"id": "p", "name": "P", "vault_path": "Work/P", **h}}, "/plugin")
        self.assertIn("Stage and blockers: not parsed from the hub; call read_hub", block)


RS_PATH = os.path.join(os.path.dirname(os.path.abspath(BC_PATH)), "render-session.py")


def make_vault(hub_text, changelog_extra=""):
    """A temp vault + config + registered repo dir. Returns (tmp, cfg, repo)."""
    import tempfile
    tmp = tempfile.mkdtemp()
    vault, repo = os.path.join(tmp, "vault"), os.path.join(tmp, "repo")
    proj = os.path.join(vault, "Work", "C", "P")
    os.makedirs(proj)
    os.makedirs(repo)
    os.makedirs(os.path.join(vault, ".claude", "cortex"))
    with open(os.path.join(vault, "personality.md"), "w") as f:
        f.write(PERSONALITY)
    with open(os.path.join(vault, "memory.md"), "w") as f:
        f.write("# Memory\n## Filing Decisions\n- a\n## Session Log\n### S1\nx\n")
    with open(os.path.join(vault, "_changelog.txt"), "w") as f:
        f.write("[2026-11-21 10:00] UPDATED | FILE: a.md | DEST: Work/ | NOTE: n" + changelog_extra + "\n")
    with open(os.path.join(proj, "P — Project Context.md"), "wb") as f:
        f.write(hub_text if isinstance(hub_text, bytes) else hub_text.encode("utf-8"))
    with open(os.path.join(vault, ".claude", "cortex", "registry.json"), "w") as f:
        json.dump({"schema_version": 1, "projects": [{
            "id": "p", "vault_path": "Work/C/P", "context_file": "P — Project Context.md",
            "repo_paths": [repo]}]}, f)
    cfg = os.path.join(tmp, "config.json")
    with open(cfg, "w") as f:
        json.dump({"vault_path": vault, "budget_chars": 8000}, f)
    return tmp, cfg, repo


def run_hook(cfg, repo):
    """boot-context.py | render-session.py, as hooks/session-start runs them."""
    import subprocess
    boot = subprocess.run([sys.executable, BC_PATH, "--config", cfg, "--cwd", repo],
                          capture_output=True, text=True, check=True).stdout
    env = dict(os.environ, CLAUDE_PLUGIN_ROOT="/plugin")
    env.pop("CURSOR_PLUGIN_ROOT", None)
    out = subprocess.run([sys.executable, RS_PATH, "/plugin"], input=boot,
                         capture_output=True, text=True, check=True, env=env).stdout
    return out, json.loads(out)["hookSpecificOutput"]["additionalContext"]


class TestL3Budget(unittest.TestCase):
    def tearDown(self):
        import shutil
        shutil.rmtree(getattr(self, "tmp", "") or "/nonexistent", ignore_errors=True)

    def test_many_open_questions_keep_counts_and_profile(self):
        oqs = "".join(f"- [ ] **OQ-{i}** · 2026-04-15 · " + ("long question text " * 20) + "\n"
                      for i in range(30))
        blks = "".join(f"- **BLK-{i}** · opened 2026-04-10 · Blocker {i} " + ("x" * 100) + "\n"
                       for i in range(4))
        self.tmp, cfg, repo = make_vault(
            "# P\n\n## Stage Tracker\n| Stage | Status |\n|---|---|\n| Build | In Progress |\n\n"
            "## Open Questions\n\n" + oqs + "\n## Active Blockers\n\n" + blks)
        out, ctx = run_hook(cfg, repo)
        self.assertIn("Blockers (4):", ctx)
        self.assertIn("Open questions: 30", ctx)
        self.assertIn("User: Ada Example", ctx)          # personality survived
        self.assertIn("Filing Decisions (lines", ctx)     # memory survived
        self.assertNotIn("long question text", ctx)       # texts never rendered
        self.assertLessEqual(len(out), 8000)

    def test_300kb_hub_and_huge_stage_cell_stay_under_budget(self):
        hub = ("# P\n\n## Stage Tracker\n| Stage | Status |\n|---|---|\n| " + "S" * 20000
               + " | In Progress |\n\n## Active Blockers\n\n"
               + "".join(f"- **BLK-{i}** · opened 2026-04-10 · " + "b" * 3000 + "\n" for i in range(100)))
        hub += "filler line\n" * (300000 // 12)
        self.tmp, cfg, repo = make_vault(hub)
        out, ctx = run_hook(cfg, repo)
        self.assertLessEqual(len(out), 8000)
        self.assertIn("Blockers (100):", ctx)
        self.assertTrue(ctx.rstrip().endswith("</cortex-session>"))
        stage_line = next(l for l in ctx.split("\n") if l.startswith("Stage: "))
        self.assertLessEqual(len(stage_line), 90)

    def test_hard_cap_trims_any_oversized_block(self):
        spec = importlib.util.spec_from_file_location("rs", RS_PATH)
        rs = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(rs)
        os.environ["CLAUDE_PLUGIN_ROOT"] = "/plugin"
        try:
            out = rs.capped_output("<cortex-session>\n" + "z\x1b" * 20000 + "\n</cortex-session>", 8000)
        finally:
            del os.environ["CLAUDE_PLUGIN_ROOT"]
        self.assertLessEqual(len(out), 8000)
        ctx = json.loads(out)["hookSpecificOutput"]["additionalContext"]
        self.assertTrue(ctx.endswith("</cortex-session>"))
        self.assertIn("Trimmed to fit", ctx)

    def test_non_utf8_hub_still_parses(self):
        self.tmp, cfg, repo = make_vault(
            b"# P\n\xff\xfe bad bytes\n## Stage Tracker\n| Stage | Status |\n|---|---|\n| Build | In Progress |\n")
        _, ctx = run_hook(cfg, repo)
        self.assertIn("Stage: Build", ctx)

    def test_missing_hub_renders_read_hub_hint(self):
        self.tmp, cfg, repo = make_vault("# P\n")
        os.remove(os.path.join(self.tmp, "vault", "Work", "C", "P", "P — Project Context.md"))
        _, ctx = run_hook(cfg, repo)
        self.assertIn("Hub: not found or unreadable; call read_hub", ctx)


class TestHubEdgeCases(TestHubFormats):
    def test_active_blockers_without_blk_ids_is_unparsed(self):
        h = self.parse("# P\n\n## Active Blockers\n\n| # | Blocker |\n|---|---|\n| 1 | Waiting |\n- loose bullet\n")
        self.assertFalse(h["parsed"]["blockers"])

    def test_emoji_open_questions_heading(self):
        h = self.parse("# P\n\n## ❓ Open Questions\n\n- [ ] **OQ-1** · 2026-04-15 · Q one\n- [ ] Q two\n")
        self.assertEqual(h["open_question_count"], 2)


class TestPersonalityEdgeCases(TestSetupCheck):
    def test_empty_personality_is_unreadable(self):
        self.write_cfg(json.dumps({"vault_path": self.vault}))
        open(os.path.join(self.vault, "personality.md"), "w").close()
        self.assertEqual(self.code(), bc.UNREADABLE)

    def test_personality_directory_is_unreadable(self):
        self.write_cfg(json.dumps({"vault_path": self.vault}))
        os.makedirs(os.path.join(self.vault, "personality.md"))
        self.assertEqual(self.code(), bc.UNREADABLE)


if __name__ == "__main__":
    unittest.main()
