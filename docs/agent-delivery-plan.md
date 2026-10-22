# Endfield Skill MVP Delivery Plan

## PM Decision

- Product target: a deterministic team-and-rotation guide for players who own four specific characters.
- MVP input: exactly four selected characters, player level, and story chapter.
- MVP output: an executable skill order, timing conditions, and equipment candidates filtered by verified wear-level gates and role tags. Story and recipe-authority gates remain explicit unknowns until source-backed mappings exist.
- Recommendation method: curated source data first, then deterministic tag-and-priority rules. No LLM or generative analysis at runtime.
- Frontend stack: Vue 3, TypeScript, Vite, Pinia, Vue Router, Tailwind CSS.
- Hosting target: GitHub Pages.
- User inventory persistence is out of scope for MVP.

## Repository Layout

```text
.
|-- apps/web/              # Frontend agent only
|-- crawler/               # Data agent only
|-- data/                  # Data agent only
|-- docs/                  # PM-owned planning and contracts
|-- .github/workflows/     # Frontend agent only
`-- README.md              # PM-owned until integration
```

The two agents must not edit each other's directories or the existing files in
`docs/`.

## Data Contract

The initial normalized dataset lives in `data/v1/` and uses these files:

- `meta.json`: dataset version, game version, generation time, source count.
- `characters.json`: playable characters and their roles, elements, and skills.
- `equipment.json`: craftable gear, stats, sets, and unlock conditions.
- `progressions.json`: story chapters and player-level gates.
- `team-presets.json`: source-backed four-character team compositions.
- `rotation-presets.json`: source-backed rotations for known teams.
- `sources.json`: source URL, title, publisher, fetched time, and extracted fields.

All records use stable string IDs. Missing facts must be `null` or omitted, never
invented. Every source-backed record includes `sourceIds`. Rotations include
preconditions and per-step timing instead of relying on seconds alone.

The frontend consumes a mirrored copy under
`apps/web/public/data/v1/`. The frontend build runs a sync script, so the
canonical copy remains in `data/v1/`.

## Minimum Frontend Flow

1. Select exactly four owned characters.
2. Choose player level and story chapter.
3. Generate a team summary and show any missing source-backed assumptions.
4. Show a rotation with ordered skills, trigger conditions, and warnings.
5. Show equipment candidates, known wear-level gates, and alternatives without
   claiming that unresolved story or recipe-authority gates are unlocked.
6. State data version, sources, and the fact that recommendations are
   deterministic.

## Acceptance Criteria

- The frontend is responsive at 390 px and 1440 px widths.
- Invalid team sizes and invalid progress inputs are blocked with clear feedback.
- Data records pass JSON Schema validation.
- The crawler supports cached fetches, output validation, and a one-command update.
- The UI never presents placeholder data as verified game data.
- `npm run build` succeeds for the web app.
- The GitHub Pages build is relative-path safe.

## Non-Goals

- Runtime AI calls.
- Automated reading of a player account.
- Full-frame combat simulation.
- Video-to-rotation extraction without human verification.
- Copying complete third-party articles into the repository.
