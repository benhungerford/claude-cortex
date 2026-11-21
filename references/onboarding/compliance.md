# Onboarding: regulated data, minors, and privacy rules

Read this during onboarding when the user mentions anything regulated, confidential, or involving minors. The signal lists are examples, not a whitelist: if the user says "we have to follow X", add X verbatim. When unsure, ask once whether their work is regulated.

## Signals that mean regulated data

- **Named regulations, any country:** HIPAA, GDPR/DSGVO/RGPD, FERPA, COPPA, CCPA, PIPEDA, PHIPA, LGPD, APPI, PIPL, PDPA, POPIA, DPDP, KVKK, NHS Caldicott, PCI-DSS, PSD2, DORA, MiCA, SOC2, ITAR/EAR, FINRA, SEC, IRS-7216, AML/KYC, FTC Funeral Rule, ISO 9001/27001/45001, IATF 16949, ATEX, 21 CFR Part 11, GxP, PSYPACT, KCSiE, Official Secrets Act, 152-FZ.
- **Words about the people in the data:** patient, advisee, pupil, parishioner, congregant, source, whistleblower, asylum, refugee, minor, donor, beneficiary, casework, classified, NDA, reservist.
- **Privilege:** attorney-client, solicitor-client, notarial secrecy, doctor-patient, seal of confession, Beichtgeheimnis, Seelsorgegeheimnis.
- **Threat model:** source protection, life safety, dissident, OpSec, air-gapped, surveillance, dual-use, export-controlled.

Industries that are regulated by default: law, healthcare (clinical and allied), mental health, finance and insurance, banking, pharma and clinical research, government, defense, journalism, refugee and social services, cybersecurity consulting, education on the institution side, clergy, funeral services, accounting, HR, and nonprofits working with youth.

FERPA protects students from institutions. A student writing about their own coursework is the data subject, so it doesn't apply. It applies to faculty, registrars, principals, and institutional librarians.

## What changes for a regulated user

- `compliance_constraints` lists every regime (stack them across countries).
- Pitch no cloud connectors. The user opts in tool by tool. Anything connected that touches regulated data pulls metadata only (subjects, senders, times; no bodies).
- Default the vault outside any cloud-synced folder, e.g. `~/Cortex/`.
- `trust_register: high_disclosure`: list files and say where data came from, even for a terse user.
- Write `.claude/rules/privacy.md` (variants below).
- In the demo, ask for codes or initials instead of names.

Some tools should not be connected at all, because client or patient data would leave the machine: EHR/EMR systems (Epic, athenahealth, SimplePractice and other practice-management tools), telehealth platforms, student information systems, and safeguarding tools. For journalists and opsec users, don't suggest Signal, SecureDrop, Tails, or password managers as connectors. Record these under `tools.never_connect`.

## Minors

- **The user is under 18** ("I'm 11", "high school senior", "homeschooled"): pause and ask whether a parent or guardian is with them. Add `minor` to `compliance_constraints`. All connectors default off, and each opt-in needs the parent's OK. Under 13 follows COPPA; under 16 in the EU follows GDPR's rules for children. Use plain closing language, no slash commands. Register repos only with a parent's OK.
- **The user works with minors** (tutor, coach, teacher, youth ministry, pediatric clinician, social worker): add `minor_data`. Connectors default off for any tool that touches a minor's messages.

## Audit mode

ISO 9001, IATF 16949, FINRA, SEC, 21 CFR Part 11, GxP, government or charity audits set `audit_mode: true`. `_changelog.txt` becomes append-only: past entries change only with an explicit amendment entry. Add an `audit-trail.md` rule and remind the user that connector calls are audit events.

## Soft constraints

Canon, liturgical rules, halal or kosher requirements, sharia finance, craft tradition, cultural protocol. These bind the user but aren't regulations, so store them in `soft_constraints`, not `compliance_constraints`.

## Other fields

- `exclude_on_ingest`: topics or sources future sessions refuse to take in (e.g. reserve duty, patient session content, classified material). Match in every language the user works in, and tell the user when something is refused.
- `restricted_subnotes`: notes with a private tier (Pastoral, Confessional, Cultural Protocol). Each gets a `_README.md` stating the tier; other skills don't quote them in summaries unless asked.
- `bucket_compliance_overrides`: for mixed exposure, such as one NDA client among several. Flag the bucket in its frontmatter; refuse pulls or exports from it without fresh confirmation each session.

## privacy.md variants

Write `.claude/rules/privacy.md` when `compliance_constraints` or `exclude_on_ingest` is set, or the user is or works with minors. Use every variant that applies.

| Variant | When | Behavior |
|---|---|---|
| Regulatory | HIPAA, GDPR, FINRA, etc. | Refuse PHI/PII pastes; no regulated-system connectors; metadata-only pulls; redact identifiers |
| OpSec | NDA, source protection, cybersecurity, journalism | Aliases only; refuse linking that could re-identify a source; no correlating web searches |
| Clergy | Seal of confession and equivalents | Confessional content is never logged or paraphrased; pastoral notes hold date, codename, and follow-up only; refuse to have an LLM summarize confidential interactions |
| Minor | User under 18 | Connectors off; parent confirms each opt-in; refuse pastes that identify other minors |
| Mixed NDA | Per-bucket exposure | Per-bucket flags; re-confirm before pulling from or exporting an NDA bucket |
| Audit | ISO, FINRA, IATF, CFR Part 11 | Append-only changelog that can be exported as an audit packet |

## Corporate machines

On an IT-managed computer, ask whether app installs are blocked and whether endpoint security watches file writes (Forcepoint, Symantec and similar). If installs are blocked, skip Obsidian and use the folder with any editor. With endpoint monitoring, `.md` files are usually fine; warn against pasting bank, card, or social security numbers.
