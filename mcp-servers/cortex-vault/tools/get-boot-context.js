'use strict';

// get_boot_context — pure-JS reproduction of hooks/lib/boot-context.py's main()
// output dict, exposed as an MCP tool.
//
// WHY: Cortex boot normally runs via the bash hook hooks/session-start, which
// shells out to python3 (hooks/lib/boot-context.py) to inject the
// <cortex-session> block. On shell-less / python-less platforms (iPad, some
// Cowork Desktop), no block is injected. This tool returns the same JSON over
// MCP so Claude can boot from it instead; its description carries the
// level guidance the session block would have given. (audit finding T12 /
// improvement W1.3; the cortex-boot skill was removed in 2.0.0)
//
// CONTRACT — keys/semantics mirror boot-context.py main():
//   vault_path, activation_level (1|2|3), personality (string),
//   memory (string), learner_profile (string), recent_activity (string),
//   inbox_count (int), active_projects (string|null), project (null unless L3),
//   feature_suggestion (string|null).
//
// DEVIATIONS from boot-context.py (intentional):
//   * The token-budget (_budget) logic is OMITTED. MCP-first boot is the
//     fallback path; truncation is a session-block concern owned by the hook /
//     session-start. The full content is returned here verbatim.
//   * personality and memory are the full files here. In the hook they are
//     summaries (summarize_personality / summarize_memory in boot-context.py).
//   * Open Questions & Blockers are parsed via lib/hub-schema.js
//     (parseQuestionBlockerRows + classifyRows) — the SAME parser read-hub.js
//     uses — rather than re-implementing parse_hub's regex. This guarantees
//     read-side parser agreement (the classification rules are identical).
//   * cwd resolution reuses lib/registry.js findProjectByCwd (path.normalize
//     walk-up) instead of realpath walk-up. This is robust to non-existent /
//     not-yet-created paths and matches the existing find_project_by_cwd tool.

const fs = require('node:fs');
const path = require('node:path');

const { readFile } = require('../lib/file-ops.js');
const { loadRegistry, findProjectByCwd } = require('../lib/registry.js');
const { parseQuestionBlockerRows, classifyRows } = require('../lib/hub-schema.js');

const MEMORY_CAP = 100;
const CHANGELOG_TAIL = 15;

// ── Vault file readers (mirror read_personality / read_memory / etc.) ────────

function readPersonality(vault) {
  return readFile(path.join(vault, 'personality.md'));
}

function readMemory(vault, cap = MEMORY_CAP) {
  const content = readFile(path.join(vault, 'memory.md'));
  if (content === null) return '';
  const lines = content.split('\n');
  // The python helper keeps trailing newline structure via readlines(); we
  // re-join with '\n'. Tail-cap at `cap` lines.
  const kept = lines.length > cap ? lines.slice(lines.length - cap) : lines;
  return kept.join('\n');
}

function readLearnerProfile(vault) {
  const content = readFile(
    path.join(vault, 'Knowledge Base', 'Growth', '_profile.md')
  );
  return content === null ? '' : content;
}

// Returns [recentActivity:string, totalLines:int]
function readChangelog(vault, tail = CHANGELOG_TAIL) {
  const content = readFile(path.join(vault, '_changelog.txt'));
  if (content === null) return ['', 0];
  // Mirror python readlines(): split keeping logical lines, ignore a trailing
  // empty element produced by a final newline.
  let lines = content.split('\n');
  if (lines.length && lines[lines.length - 1] === '') lines = lines.slice(0, -1);
  const total = lines.length;
  const tailLines = lines.slice(Math.max(0, total - tail));
  return [tailLines.join('\n').replace(/\n+$/, ''), total];
}

function countInbox(vault) {
  const inbox = path.join(vault, '_Inbox');
  let entries;
  try {
    entries = fs.readdirSync(inbox);
  } catch {
    return 0;
  }
  return entries.filter((f) => f.endsWith('.md')).length;
}

// Extract a "Name (Type)" list from personality.md's frontmatter buckets.
// Mirrors python extract_buckets: only reads buckets declared inside the YAML
// frontmatter `buckets:` block (name/type pairs). Returns '' if none found.
function extractBuckets(personalityContent) {
  if (!personalityContent) return '';
  const fmMatch = personalityContent.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return '';
  const fm = fmMatch[1];
  const bucketsMatch = fm.match(/  buckets:\s*\n((?:(?:    | {6,}).*\n)*)/);
  if (!bucketsMatch) return '';
  const block = bucketsMatch[1];
  const re = /-\s+name:\s*"([^"]+)"[\s\S]*?type:\s*"([^"]+)"/g;
  const out = [];
  let m;
  while ((m = re.exec(block)) !== null) {
    out.push(`${m[1]} (${m[2]})`);
  }
  return out.join(', ');
}

// Suggest a dormant feature when the changelog is mature. Mirrors python
// check_dormant_features (only the weekly_review case is reproduced, as in the
// python source).
function checkDormantFeatures(personalityContent, changelogTotal) {
  if (changelogTotal < 50) return null;
  if (!personalityContent) return null;
  const fmMatch = personalityContent.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];
  const dormantMatch = fm.match(/dormant:\s*\n((?:\s+- .*\n)*)/);
  if (dormantMatch && dormantMatch[1].includes('weekly_review')) {
    return `weekly_review may be ready to activate (changelog has ${changelogTotal}+ entries)`;
  }
  return null;
}

// Derive a human-readable project name from the registry entry.
// Mirrors python derive_project_name.
function deriveProjectName(entry) {
  const cf = entry.context_file || '';
  // Match both em-dash forms used across the codebase.
  for (const sep of [' — Project Context', ' — Project Context']) {
    if (cf.includes(sep)) return cf.split(sep)[0];
  }
  const vp = entry.vault_path || '';
  return vp.includes('/') ? vp.split('/').pop() : entry.id;
}

// Compute activation level + matched project for a cwd. Mirrors python
// resolve_cwd: L3 if cwd (or an ancestor) is a registered repo_path; L2 if cwd
// is inside the vault; else L1. Uses path.normalize comparison (registry.js)
// rather than realpath so missing paths don't throw.
function resolveCwd(vault, cwd, registry) {
  const cwdNorm = path.normalize(cwd);
  const vaultNorm = path.normalize(vault);
  const insideVault =
    cwdNorm === vaultNorm || cwdNorm.startsWith(vaultNorm + path.sep);

  const project = findProjectByCwd(registry, cwd);
  if (project) return { level: 3, project };
  if (insideVault) return { level: 2, project: null };
  return { level: 1, project: null };
}

// Parse a project hub for stage, blockers, open_questions, recent_decisions.
// Open Questions & Blockers use the shared hub-schema parser (read-hub parity).
// Stage Tracker + recent_decisions mirror parse_hub.
function parseHub(vault, entry) {
  const hubPath = path.join(vault, entry.vault_path, entry.context_file);
  const content = readFile(hubPath);
  if (content === null) return null;

  const result = {
    stage: null,
    blockers: [],
    open_questions: [],
    recent_decisions: [],
  };

  // ── Stage Tracker table (mirror parse_hub regex semantics) ──
  const stageSection = content.match(
    /## Stage Tracker\s*\n\|[^\n]*\n\|[-| ]+\n((?:\|[^\n]*\n)*)/
  );
  if (stageSection) {
    const rows = stageSection[1].trim().split('\n');
    // First pass: "In Progress" or "Current".
    for (const row of rows) {
      const cells = row.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length >= 2 && (cells[1] === 'In Progress' || cells[1] === 'Current')) {
        result.stage = cells[0];
        break;
      }
    }
    // Fallback: last row with a non-empty, non-"Not Started" status.
    if (!result.stage) {
      for (let i = rows.length - 1; i >= 0; i--) {
        const cells = rows[i].split('|').slice(1, -1).map((c) => c.trim());
        if (cells.length >= 2 && cells[1] && cells[1] !== 'Not Started') {
          result.stage = cells[0];
          break;
        }
      }
    }
  }

  // ── Open Questions & Blockers (shared parser — read-hub parity) ──
  const { openQuestions, blockers } = classifyRows(
    parseQuestionBlockerRows(content)
  );
  result.open_questions = openQuestions;
  result.blockers = blockers;

  // ── Recent decisions from the project Changelog.md (last 5 non-blank lines) ──
  const changelog = readFile(path.join(vault, entry.vault_path, 'Changelog.md'));
  if (changelog !== null) {
    const lines = changelog
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    result.recent_decisions = lines.slice(-5);
  }

  return result;
}

// ── Setup check (mirror of check_setup in boot-context.py) ──────────────────
// Only a missing config.json, or a readable vault with no personality.md, is
// "not set up". A config that won't parse, a vault folder that is missing or
// unreadable (unmounted drive, unsynced iCloud, OS permission), or a
// personality.md that can't be read is "unreadable": the user already has a
// vault, so onboarding (which builds a new one and rewrites config.json) must
// not be offered.

function checkSetup(configPath, vaultOverride) {
  let vault = vaultOverride || null;
  if (!vault) {
    if (!fs.existsSync(configPath)) {
      return { status: 'not_set_up', reason: 'no config.json' };
    }
    let cfg;
    try {
      cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      return { status: 'unreadable', reason: `config.json could not be read (${e.name})` };
    }
    vault = cfg && typeof cfg.vault_path === 'string' ? cfg.vault_path : null;
    if (!vault) return { status: 'unreadable', reason: 'config.json has no vault_path' };
  }
  let stat;
  try {
    stat = fs.statSync(vault);
  } catch {
    return { status: 'unreadable', vault, reason: 'vault folder not found (drive unmounted or moved?)' };
  }
  if (!stat.isDirectory()) {
    return { status: 'unreadable', vault, reason: 'vault path is not a folder' };
  }
  try {
    fs.readdirSync(vault);
  } catch (e) {
    return { status: 'unreadable', vault, reason: `vault folder not readable (${e.code || e.name})` };
  }
  const pPath = path.join(vault, 'personality.md');
  if (!fs.lstatSync(pPath, { throwIfNoEntry: false })) {
    return { status: 'not_set_up', vault, reason: 'no personality.md' };
  }
  if (!fs.statSync(pPath, { throwIfNoEntry: false })?.isFile()) {
    return { status: 'unreadable', vault, reason: 'personality.md is not a regular file' };
  }
  let personality;
  try {
    personality = fs.readFileSync(pPath, 'utf8');
  } catch (e) {
    return { status: 'unreadable', vault, reason: `personality.md could not be read (${e.code || e.name})` };
  }
  if (!personality.trim()) {
    return { status: 'unreadable', vault, reason: 'personality.md is empty' };
  }
  return { status: 'ok', vault, personality };
}

function setupError(setup) {
  const text = setup.status === 'not_set_up'
    ? `Cortex is not set up (${setup.reason}). Offer /cortex-onboard once.`
    : `Cortex could not read the vault${setup.vault ? ` at ${setup.vault}` : ''} ` +
      `(${setup.reason}). The vault is set up, so don't offer onboarding; tell the ` +
      'user in one line and suggest checking that the folder is mounted and readable.';
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: setup.status, reason: setup.reason, vault_path: setup.vault || null, message: text }) }],
    isError: true,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

async function handler(args, vaultOverride) {
  const cwd = (args && typeof args.cwd === 'string' && args.cwd) || process.cwd();

  const configPath = (args && typeof args.config_path === 'string' && args.config_path) ||
    path.join(process.env.HOME || '', '.claude', 'cortex', 'config.json');
  const setup = checkSetup(configPath, vaultOverride);
  if (setup.status !== 'ok') return setupError(setup);
  const vault = setup.vault;
  const personality = setup.personality;

  const memory = readMemory(vault);
  const learnerProfile = readLearnerProfile(vault);
  const [recentActivity, changelogTotal] = readChangelog(vault);
  const inboxCount = countInbox(vault);

  const registry = loadRegistry(vault);
  const { level: activationLevel, project: projectEntry } = resolveCwd(
    vault,
    cwd,
    registry
  );

  let project = null;
  if (activationLevel === 3 && projectEntry) {
    const hubData = parseHub(vault, projectEntry);
    project = {
      id: projectEntry.id,
      name: deriveProjectName(projectEntry),
      vault_path: projectEntry.vault_path,
      ...(hubData || {
        stage: null,
        blockers: [],
        open_questions: [],
        recent_decisions: [],
      }),
    };
  }

  const featureSuggestion = checkDormantFeatures(personality, changelogTotal);
  const activeProjects = activationLevel < 3 ? extractBuckets(personality) : null;

  const output = {
    vault_path: vault,
    activation_level: activationLevel,
    personality,
    memory,
    learner_profile: learnerProfile,
    recent_activity: recentActivity,
    inbox_count: inboxCount,
    active_projects: activeProjects,
    project,
    feature_suggestion: featureSuggestion,
  };

  // NOTE: token-budget (_budget) logic from boot-context.py is intentionally
  // omitted here — see the file header.

  return {
    content: [{ type: 'text', text: JSON.stringify(output) }],
  };
}

module.exports = {
  name: 'get_boot_context',
  description:
    'Returns the Cortex boot context as JSON (vault_path, activation_level, ' +
    'personality, memory, recent_activity, inbox_count, active_projects, ' +
    'project, feature_suggestion). Call it once when no <cortex-session> block ' +
    'was injected (hookless surfaces such as iPad or Cowork). Use ' +
    'activation_level: L1 answer directly; L2 mention only a stale blocker or ' +
    'urgent inbox item; L3 open with one line (project, stage, blocker count). ' +
    'Hooks are not running on such a surface, so after a direct vault write ' +
    'that skipped a Cortex write path, call append_changelog. Capture ' +
    'decisions and blockers per references/capture-rules.md. On an error, ' +
    'read its "error" field: hand off to cortex-onboarding only for ' +
    '"not_set_up". For "unreadable" the vault exists but could not be read ' +
    '(unmounted, unsynced, permission); tell the user that in one line and ' +
    'do not offer onboarding.',
  inputSchema: {
    type: 'object',
    properties: {
      cwd: {
        type: 'string',
        description:
          'Working directory to resolve to an activation level / project. ' +
          'Defaults to the server process cwd.',
      },
      config_path: {
        type: 'string',
        description:
          'Optional path to a Cortex config.json to read vault_path from. ' +
          'Defaults to the canonical ~/.claude/cortex/config.json resolution.',
      },
    },
  },
  handler,
};
