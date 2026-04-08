---
description: Processes a meeting transcript into a properly-threaded, filed vault note. Handles series detection, Previous/Next threading, frontmatter, MOC updates, and extracts decisions and blockers into the project hub and Changelog. Usage:/cortex-meeting <transcript or path to transcript file>. If no argument is given, asks for the transcript.
---

# /cortex-meeting

Invoke the `cortex-process-meeting` skill against the input in `$ARGUMENTS`.

**Arguments:** `$ARGUMENTS` — a pasted transcript, a Granola/Fathom export, an email recap, or a filesystem path to a transcript file. Optional. If empty, ask the user "Paste the transcript or give me a path to the transcript file."

**Procedure:**
1. Load `cortex-process-meeting`.
2. If `$ARGUMENTS` is empty: ask the user for the transcript and wait for a response.
3. If `$ARGUMENTS` looks like a filesystem path and the file exists: read it and pass the contents as the transcript.
4. Otherwise pass `$ARGUMENTS` directly as the transcript and run the process-meeting workflow (`workflows/process-meeting.md`).
5. Return the filed path, series threading status (Previous/Next links), and any decisions/blockers extracted into the project hub.

**Failure modes:** delegate to `cortex-process-meeting`'s failure modes — including the project vs. client routing nuance.

**Related:** `skills/cortex-process-meeting/SKILL.md`
