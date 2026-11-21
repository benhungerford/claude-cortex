# Coach on demand

Procedure for `cortex-coach` when the user asks. If `Knowledge Base/Growth/_profile.md` doesn't exist, run `workflows/coach-intake.md` first.

1. **Read context:** `_profile.md`, `_goals.md`, the last 30 entries of `_signals.log`, and what the user is working on right now (project, domain, problem).
2. **Size the gap.**
   - Is the topic a known growth edge or an active goal?
   - Knowledge gap (no Knowledge Base articles, no signals in the domain) or skill gap (several `TEACHING` or `STRUGGLE` entries)?
   - What single concept would help most with the task in front of them?
   - What does the Knowledge Base show they already know?
3. **Teach** in the format `_profile.md` asks for:
   - Walkthrough: step through the concept using their current work.
   - Articles or docs: name the best resource and the key idea to look for.
   - Code examples: a working example built on their files and data.
   - Mixed: pick per topic, using any per-domain notes in the profile.
4. **Log the signal** to `Knowledge Base/Growth/_signals.log`, silently:

   ```text
   [YYYY-MM-DD HH:MM] TEACHING | domain:<domain> | topic:<topic> | depth:<significant|minor> | mode:on-demand
   ```

   `TEACHING` means you explained something new; `GUIDANCE` means you suggested a better way to do something they already do.
5. **Route reusable knowledge.** If the guidance would help on other projects, hand it to `cortex-knowledge`.
