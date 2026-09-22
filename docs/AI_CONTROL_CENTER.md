# Atlas AI Control Center — Cornerstone Document

**Status:** Foundational architecture reference
**Last updated:** 2026-06-18
**Owners:** Lucas Dial (backend/architecture), Ben Rozelle (frontend)

---

## Purpose of This Document

This is the cornerstone reference for the AI Control Center — the section of Atlas
where each organization understands and controls how AI behaves for their church.

It exists so that as Atlas grows and new AI features are added (Universal Referencing,
Atlas AI Chat, Serve, Care, and beyond), the architecture stays coherent and new
features slot in cleanly **without rebuilding the Control Center each time.**

If you are about to build a new AI-powered feature, read this first. The central rule
below is the most important thing in this document.

---

## The Central Rule

> **Every AI feature in Atlas routes through the central AI layer (`src/lib/ai/`).
> Reasoning calls go through `callAI()`. Audio goes through `transcribeAudio()`.
> Nothing calls an AI provider SDK directly.**

Because of this single chokepoint, every feature automatically inherits everything the
AI Control Center governs:

- The organization's **guidelines** (voice, terminology, values, guardrails)
- The organization's **model preference** (tier-bounded)
- **Credit accounting** and usage logging
- **Graceful fallback** when credits are exhausted

New features do **not** re-implement AI configuration. They call the central function
and the configuration applies for free. The Control Center is the authority; features
conform to it — never the other way around.

---

## What the AI Control Center Is

**Location:** Settings → AI Control Center (admin-gated for writes)

It is the org-level home for everything about how AI works for that church. It has
several conceptual jobs, built in layers over time:

| Job | What it does | v1 status |
|-----|--------------|-----------|
| 1. Guidelines | Shapes how AI sounds and what it knows about the org | Built |
| 2. Model preference | Controls quality/speed within tier limits | Built |
| 3. Insights | Shows usage, cost, and effectiveness of AI | Stubbed ("coming soon") |
| 4. Feature scope | Enable/disable AI per feature | Foundation only; no UI yet |
| 5. Privacy controls | Retention, consent, sensitive-content handling | Future |

---

## Job 1 — Guidelines (The Differentiator)

Each church can customize how the AI represents them. This is what makes the AI feel
like *their* assistant rather than a generic tool — a key competitive differentiator.

**Fields (v1):**
- Voice & tone — how the AI should sound
- Terminology — custom vocabulary ("we say 'life groups' not 'small groups'")
- About your church — mission, values, context the AI should be aware of
- Things to avoid — language, topics, or framings the church doesn't want
- Additional guidelines — catch-all free-text field

### The Layering Model (critical for safety)

AI instructions stack in strict priority order:

1. **Atlas base guidelines (ours, non-negotiable)** — safety, accuracy, no fabrication,
   no harmful output, core behavior. Orgs can NEVER override these.
2. **Org guidelines (their customization)** — voice, terminology, values, emphasis.
   Applied only within the bounds the base rules allow.
3. **The specific task prompt** — "summarize this meeting," "extract action items," etc.

**Safety principle:** Org guidelines are *additive customization, not override authority.*
The base prompt frames the org section as "preferences about tone and terminology — follow
them where they don't conflict with the above rules." Even if an org puts something
malicious or jailbreaky in their guidelines, the base rules still win. Org input fields
are bounded by sensible character limits so no one can paste a huge document.

### Application Rule

Guidelines apply **globally by default** to every `callAI()` reasoning call. A church's
voice and terminology should be consistent everywhere — meeting summary or chat response,
it's the same church. An escape hatch exists: a feature can request "skip org guidelines"
for purely mechanical tasks where voice doesn't matter (rare).

### Cost Discipline

Guidelines are injected into the system prompt on every call, which adds tokens. To keep
this nearly free:
- Guidelines sit in the **cached portion** of the system prompt (prompt caching is enabled,
  ~90% cheaper on cached input). They are stable and repeated, so caching is ideal.
- Field character limits prevent runaway token growth.

---

## Job 2 — Model Preference (Tier-Bounded)

Orgs express a preference for how AI balances speed and quality. The preference is an
**abstract value** — never a raw model name — translated by `model-selector.ts` into a
real model **within the org's tier limits.**

**The three preferences (church-friendly framing):**
- **Speed** — "Faster responses, lighter processing"
- **Balanced** — "A good mix of speed and depth" (default)
- **Quality** — "Most thorough and detailed"

### Why Abstract + Tier-Bounded (protects the cost model)

Free model selection would break Atlas's economics: a Workspace org ($29.99) picking Opra
(~5x cost) would destroy margins. So the preference maps to models *within tier bounds*:

| Tier | Speed | Balanced | Quality |
|------|-------|----------|---------|
| Workspace | Haiku | Haiku | Haiku (show upgrade nudge) |
| Suite | Haiku (simple) → Sonnet | Sonnet | Sonnet |
| Ultimate | Haiku (simple) → Sonnet | Sonnet | Opus (complex tasks) |

No matter what an org picks, they stay within their tier's cost envelope. For lower tiers,
the preference doubles as a **soft upsell** ("upgrade to unlock higher-quality AI").

### What the Preference Does NOT Touch

- **Transcription** (audio → text) is always OpenAI Whisper. Not a choice — Anthropic has
  no transcription model. Infrastructure, not preference.
- **Credit-exhaustion fallback** is always the cheap OpenAI model (gpt-5-nano / gpt-4o-mini),
  automatic and invisible. Orgs do not manage it.

The preference dial affects only **Claude reasoning model selection.**

---

## Provider Roles (Settled Architecture)

| Job | Provider | User-facing? |
|-----|----------|--------------|
| Reasoning (summaries, chat, extraction) | Anthropic Claude (Haiku/Sonnet/Opus) | Yes — via model preference |
| Transcription (audio → text) | OpenAI Whisper | No — always, infrastructure |
| Credit-exhaustion fallback | OpenAI (gpt-5-nano / gpt-4o-mini) | No — automatic, invisible |

**Why Claude for all reasoning:** A consistent model family keeps the AI's voice
consistent, which is essential for the guidelines feature to work well. Mixing providers
in user-facing reasoning would muddy the custom-voice experience and confuse churches.
OpenAI stays in its two specific roles (transcription + safety-net fallback).

---

## Job 3 — Insights (Stubbed in v1)

The Control Center is where churches will understand how effective their AI is. Built
later, when real usage data exists to make it meaningful (an empty dashboard teaches
nothing). Planned metrics:

**Usage & cost:**
- Credits used vs. limit, with end-of-month projection
- Breakdown by feature (transcription vs. summary vs. chat)
- Cost trend over time; heaviest users/departments

**Effectiveness (the most valuable signal):**
- **Acceptance rate** — when AI suggests action items/decisions, how often are they
  accepted vs. edited vs. rejected? This is the single best "is the AI actually working"
  signal. Data already exists (`huddle_action_items.status`).
- **Time saved** estimate — meetings processed, hours of transcription/summarization
- **Feature adoption** — are AI features used or ignored?

**Health:**
- Fallback rate (high = org needs a bigger tier)
- Error/failure rate

All insights read from the existing `ai_usage_log` table and the **feature registry**
(see below), so new features appear in insights automatically once registered.

---

## Job 4 — Per-Feature AI Scope (Foundation Only in v1)

Churches will likely want to enable AI for some features but not others — especially
sensitive areas. Example: AI for Huddles summaries, but NOT for Care notes (confidential
pastoral content).

**v1 approach:** Build the *foundation* to support this (the feature registry and a data
model that can express per-feature settings), but expose only a **global `ai_enabled`
master switch** in the UI. Do not build per-feature toggle UI for features that don't
exist yet — that would be building UI for hypotheticals.

**When a future feature needs its own toggle:** It's already in the registry; you surface
one control. No rebuild.

---

## The Feature Registry (Single Source of Truth)

A canonical list of every AI feature, with metadata. This is what lets the Control Center
**grow gracefully.** Each entry should carry roughly:

- `key` — matches the `feature` value logged to `ai_usage_log` (and its CHECK constraint)
- `displayName` — human label for insights and toggles
- `description` — what the feature does
- `minTier` — which tier unlocks it (if gated)
- `canToggle` — whether orgs may enable/disable it (drives future per-feature toggles)
- `usesGuidelines` — whether org guidelines apply (default true; escape hatch)

**The registry drives:**
- The Insights dashboard (per-feature usage/cost/effectiveness) — automatically
- Future per-feature toggles — automatically
- A single place to add a feature when you build one

**Current/known feature keys** (from Phase 0 `ai_usage_log` CHECK constraint):
`huddle_transcription`, `huddle_summary`, `huddle_action_extraction`, `atlas_ai_chat`,
`announcement_generation`, `sermon_prep`, `care_followup`, `smart_suggestion`, `other`.

---

## The Game Plan — How Future Features Slot In

This is the answer to "do we update the Control Center every time we add a feature?"
**No.** Features conform to the Control Center. Here is the repeatable pattern:

### When building any new AI feature (Universal Referencing, AI Chat, Serve AI, Care AI, …):

1. **Route its AI calls through `callAI()`** (reasoning) or `transcribeAudio()` (audio),
   with the feature's tag (e.g. `feature: 'atlas_ai_chat'`).
2. **Add the feature to the feature registry** (one entry). If it's a new tag, also add it
   to the `ai_usage_log` feature CHECK constraint.
3. The feature **automatically inherits**: org guidelines (voice/terminology), model
   preference (tier-bounded), credit tracking, and fallback. Nothing else to wire.

### As the Control Center matures (future work, not per-feature):

- **Insights** reads the registry → shows per-feature usage/cost/effectiveness automatically.
- **Per-feature toggles** read the registry → surface controls for features marked
  `canToggle` (especially sensitive ones like Care).
- **Per-feature guideline overrides** — the hook exists if ever needed; rarely should be.

### Worked examples

- **Universal Referencing System:** calls `callAI()` with a reference feature tag → AI
  answers about the org's data in *their* voice and terminology automatically.
- **Atlas AI Chat:** calls `callAI()` with `atlas_ai_chat` → inherits voice, model
  preference, credits.
- **Serve module AI** (e.g. assignment suggestions, burnout flags): `callAI()` with a
  serve feature tag → same inheritance.
- **Care module AI** (e.g. follow-up drafting): `callAI()` with `care_followup` → same
  inheritance, and a strong candidate for a per-feature *off* toggle given sensitivity.

---

## Data Model (v1)

Table: `organization_ai_settings` (one row per org)

- `organization_id` (PK → organizations)
- Guidelines: `voice_tone`, `terminology`, `about_church`, `things_to_avoid`,
  `additional_guidelines` (all text, bounded by app-level limits)
- `model_preference` — `'balanced' | 'quality' | 'speed'` (default `'balanced'`)
- `ai_enabled` — boolean master switch (default true)
- `updated_by`, `updated_at`, `created_at`
- RLS: org members may read; writes go through the admin-gated server action via service role

**Designed to grow:** per-feature settings, privacy/retention, and usage-alert preferences
can be added here or in adjacent tables without disturbing the v1 shape.

---

## Design Principles (Carried From the Rest of Atlas)

1. **One chokepoint.** All AI flows through `src/lib/ai/`. No scattered SDK calls.
2. **Base rules always win.** Org customization is additive, never an override of safety.
3. **Tier-bounded everything.** No org-controllable setting can exceed its tier's cost envelope.
4. **Design the container to grow; build only what delivers value now.** (Same philosophy as
   `meeting_source` — architected for 7, exposed 2 — and the avatar system — shared
   component first, upload later.)
5. **Cost discipline.** AI processing is the real cost driver. Cache stable prompt content,
   bound user inputs, keep model selection tier-bounded, and log every call to `ai_usage_log`.
6. **Consistent voice.** Claude for all reasoning so the org's custom voice stays coherent.

---

## Open Questions / Future Decisions

- **Effort/reasoning-level dial** (how hard a model thinks, within a model) — deliberately
  deferred. Possible future Ultimate-tier power feature; most churches won't want a second dial.
- **Per-feature guideline overrides** — hook exists; build only if a real need appears.
- **Per-department credit limits / usage alerts** — candidate for the Insights/controls area.
- **Privacy & retention controls** — natural future home for `default_recording_retention_days`
  and consent settings, especially for sensitive modules (Care).
- **Insights effectiveness metrics** — build when real usage data exists to make them meaningful.

---

*This document is the cornerstone. When in doubt about how a new AI feature should behave or
configure, the answer is almost always: route it through `callAI()`, register it, and let the
Control Center govern it.*
