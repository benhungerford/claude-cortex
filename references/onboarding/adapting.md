# Onboarding: adapting to the user and their machine

Detail for `workflows/onboarding.md` Steps 1, 2, and 7.

## Tone register

Set from the first reply and recheck on the Q1 answer; settle it by Q2.

| Signal | Register |
|---|---|
| Three words or fewer, fragments, "skip the pitch" | `terse` |
| Lowercase, emoji, casual | `casual` |
| Full formal sentences, honorifics ("Sie", Mr/Mrs, surname-san) | `formal` |
| Anything else | `warm` (default) |

Match formality but speak naturally; don't copy archaic or dialect forms ("shall I", "thee", honorifics back at them).

Trust register is separate. Regulated, audit-bound, or high-stakes users get `high_disclosure` (file inventories, where each thing came from), even when terse.

Phrases to leave out: "setup wizard", "onboarding flow", "the skill", "the exciting part", "imagine the things you could do", "second brain" after Step 1, and "Sound good?" at the close. You are just Claude.

## Accessibility

| Signal | Field | Adjust |
|---|---|---|
| VoiceOver, NVDA, Orca | `screen_reader` | Narrate file by file; no monospace YAML or path dumps; Obsidian's accessibility is weak, so offer the folder with their usual editor |
| Low vision, large text | `low_vision` | Same, plus Pages or Ulysses as an option |
| Deaf or hard of hearing | `no_audio` | Text only; no audio output; captions for any video |
| Autistic, prefers predictability | `sensory_predictability` | Announce each step change; list files before creating them; offer all five questions up front |
| ADHD, easily distracted | `neurodivergence_signals` | Keep to 2 connectors; narrate progress during the build |
| Writing in a second language | `locale_hint` | Use literal phrases (idiom table in `discovery.md`); after 2-3 non-English terms, ask once: "Want any folder names in <language>, or English everywhere?" |

## Platform

| Detected | Action |
|---|---|
| macOS 11+, Windows 10+, common Linux | Continue |
| iPad, iPhone, Android only | Cortex needs a computer that can write files. An iPad can read the vault through iCloud or Obsidian Sync. Ask whether they have a computer or want to stop |
| Windows XP or 7, very old macOS | Explain that Obsidian and Cortex won't run; offer to pick up on a current machine |
| Chromebook, locked-down work machine | Ask whether any text editor is allowed; fall back to folder-only mode |

Obsidian install:
- macOS: obsidian.md/download, drag to Applications. Gatekeeper says it "cannot check for malicious software": right-click the app, Open, then Open in the dialog.
- Windows: run the installer. SmartScreen: "More info", then "Run anyway".
- Linux: Flatpak (`flatpak install flathub md.obsidian.Obsidian`), AUR (`yay -S obsidian`), AppImage, or Nix, whichever fits the distro.

If install fails, admin rights are missing, or the user prefers another editor, set `obsidian_installed = false` and carry on with the folder.

## Surface

| Surface | Detect | Connectors |
|---|---|---|
| Claude Code | `CLAUDECODE` env, terminal, no GUI | `claude mcp add <name> -- <command>`, then `claude mcp list` |
| Claude Desktop | GUI app | Settings (⌘, or Ctrl+,) → Connectors → Add; sign in in the browser |

Many Mac users are in the desktop app, so ask once if you can't tell.

## Sync

- Before choosing the vault path, check whether `~/Documents/`, `~/Desktop/`, or the chosen folder syncs to iCloud, OneDrive, Dropbox, Google Drive, or Box. If it does and the user is regulated, put the vault outside the sync (e.g. `~/Cortex/`).
- For a second device: Mac to iPad through iCloud Drive or Obsidian Sync; Windows to iPad through OneDrive (if IT allows); Linux to phone through Syncthing.

## Closing lines

Compose from what applies:

- Privacy rules written: "Privacy rules are in `.claude/rules/privacy.md`, so future sessions follow them."
- Pain point from Q5: "The thing you mentioned, <their words>, matches a feature called <feature>." Power users: "Say 'turn on <feature>' when you want it." Low-tech, minor, formal, or second-language users: "Tell me when you want help with <thing>."
- Second device: "On your <device>, open the same folder through <sync>."
- Co-installer: "If you get stuck, <name> can pick this back up. The folder is at `<vault_path>`."
- Audit mode: "The changelog is append-only; your audit trail is `_changelog.txt`."
- Restricted notes: "<Folder> is private and won't be quoted in summaries unless you ask."
- Default: "Drop notes anytime, or ask me what's going on with <first bucket>."
