from __future__ import annotations

from typing import Any


SOURCE_IDS = {
    "akedatabase": "src_akedatabase",
    "official_battle": "src_official_battle_tutorial",
    "prydwen": "src_prydwen_combat_basics",
    "official_rnd": "src_official_rnd_2674",
    "gamewith_team": "src_gamewith_team_72598",
    "game8_rotation": "src_game8_rotation_577071",
    "game8_gear": "src_game8_gear_576118",
}


SOURCES: list[dict[str, Any]] = [
    {
        "id": SOURCE_IDS["akedatabase"],
        "title": "AKEDatabase game data tables",
        "publisher": "AKEDatabase contributors",
        "url": "https://data.akedata.wiki/manifest.json",
        "sourceType": "structured-community-database",
        "trustLevel": "structured-secondary",
        "isOfficial": False,
        "fields": [
            "characters",
            "character.skills",
            "equipment",
            "equipment.unlock.materials",
            "equipment.stats",
        ],
        "notes": [
            "Game table mirror. Treat names, costs and recipe values as structured secondary data.",
            "The pipeline records the exact manifest version, raw response hash and fetch time.",
        ],
        "required": True,
    },
    {
        "id": SOURCE_IDS["official_battle"],
        "title": "Official battle tutorials",
        "publisher": "Hypergryph / Gryphline",
        "url": "https://endfield.games/zh-Hans/tutorials/battle/",
        "sourceType": "official-guide",
        "trustLevel": "official-primary",
        "isOfficial": True,
        "fields": [
            "mechanics.shared-skill-points",
            "mechanics.combo-trigger",
            "mechanics.energy-generation",
            "mechanics.ultimate-cooldown",
        ],
        "notes": [
            "Battle skills spend shared skill points and have no cooldown.",
            "Combo skills are condition-triggered, spend no skill points and have cooldowns.",
            "Battle skills grant energy to the whole team; combo skills grant energy to the caster.",
            "Ultimates consume energy and enter a short cooldown.",
        ],
        "required": False,
    },
    {
        "id": SOURCE_IDS["prydwen"],
        "title": "Combat Basics",
        "publisher": "Prydwen",
        "url": "https://www.prydwen.gg/arknights-endfield/guides/combat-basics",
        "sourceType": "editorial-guide",
        "trustLevel": "editorial-secondary",
        "isOfficial": False,
        "fields": [
            "mechanics.party-size",
            "mechanics.shared-skill-point-cap",
            "mechanics.approximate-energy-gain",
        ],
        "notes": [
            "Corroborates a four-character party and three shared skill points.",
            "Approximate energy values are not used as exact simulation constants.",
        ],
        "required": False,
    },
    {
        "id": SOURCE_IDS["official_rnd"],
        "title": "Development newsletter 2674",
        "publisher": "Hypergryph",
        "url": "https://endfield.hypergryph.com/news/2674",
        "sourceType": "official-news",
        "trustLevel": "official-primary",
        "isOfficial": True,
        "fields": [
            "equipment.authority-rank-gates",
        ],
        "notes": [
            "Authority ranks 16/17/18 unlock blue equipment originium components.",
            "Authority ranks 28/29/30 unlock purple equipment originium components.",
        ],
        "required": False,
    },
    {
        "id": SOURCE_IDS["gamewith_team"],
        "title": "Best Team Comps | Arknights: Endfield",
        "publisher": "GameWith",
        "url": "https://gamewith.net/akendfield/72598",
        "sourceType": "editorial-guide",
        "trustLevel": "editorial-secondary",
        "isOfficial": False,
        "fields": [
            "teams.pulse-four-character-preset",
            "teams.character-synergy-notes",
        ],
        "notes": [
            "Curated team extract: Zhuang Fangyi, Perlica, Arclight and Antal.",
            "Antal's battle skill is positioned before Zhuang Fangyi's ultimate window.",
        ],
        "required": False,
    },
    {
        "id": SOURCE_IDS["game8_rotation"],
        "title": "Laevatain Best Team Comps | Arknights: Endfield | Game8",
        "publisher": "Game8",
        "url": "https://game8.co/games/Arknights-Endfield/archives/577071",
        "sourceType": "editorial-guide",
        "trustLevel": "editorial-secondary",
        "isOfficial": False,
        "fields": [
            "teams.fire-four-character-preset",
            "rotations.camille-wulfgard-laevatain-ardelia",
        ],
        "notes": [
            "Curated extract assumes a single enemy.",
            "Place Ardelia before Camille so the intended trigger order is preserved.",
            "The source label 'Final Strike' is mapped to Laevatain's ultimate and retained as a note.",
        ],
        "required": False,
    },
    {
        "id": SOURCE_IDS["game8_gear"],
        "title": "Best Gear and Gear Sets for Each Character | Arknights: Endfield | Game8",
        "publisher": "Game8",
        "url": "https://game8.co/games/Arknights-Endfield/archives/576118",
        "sourceType": "editorial-guide",
        "trustLevel": "editorial-secondary",
        "isOfficial": False,
        "fields": [
            "equipment.recommended-sets",
        ],
        "notes": [
            "Only unambiguous English-to-game-suit mappings are emitted as recommendations.",
            "Eternal Xiranite remains unmapped and is not guessed.",
        ],
        "required": False,
    },
]


SOURCE_BY_ID = {source["id"]: source for source in SOURCES}


COMMUNITY_PAGE_FETCHES: dict[str, tuple[str, str]] = {
    "official_battle": (
        "https://endfield.games/zh-Hans/tutorials/battle/",
        "sources/official_battle_tutorial.html",
    ),
    "prydwen": (
        "https://www.prydwen.gg/arknights-endfield/guides/combat-basics",
        "sources/prydwen_combat_basics.html",
    ),
    "official_rnd": (
        "https://endfield.hypergryph.com/news/2674",
        "sources/official_rnd_2674.html",
    ),
    "gamewith_team": (
        "https://gamewith.net/akendfield/72598",
        "sources/gamewith_team_72598.html",
    ),
    "game8_rotation": (
        "https://game8.co/games/Arknights-Endfield/archives/577071",
        "sources/game8_rotation_577071.html",
    ),
    "game8_gear": (
        "https://game8.co/games/Arknights-Endfield/archives/576118",
        "sources/game8_gear_576118.html",
    ),
}


# These are reviewed extracts, not runtime summarization. Each item remains tied
# to a source URL through sourceIds.
GAME8_GEAR_SET_RECOMMENDATIONS: dict[str, list[str]] = {
    "suit_expend_spell01": ["chr_0030_zhuangfy"],
    "suit_pulse_cryst01": ["chr_0004_pelica"],
    "suit_atb01": ["chr_0007_ikut", "chr_0033_camille"],
    "suit_fire_natr01": ["chr_0016_laevat", "chr_0006_wolfgd"],
}


TEAM_EXTRACTS: list[dict[str, Any]] = [
    {
        "id": "team_gamewith_pulse_72598",
        "name": "GameWith pulse team",
        "description": (
            "Reviewed four-character team: Zhuang Fangyi, Perlica, Arclight and Antal. "
            "Antal's battle skill is used before Zhuang Fangyi's ultimate window."
        ),
        "characterIds": [
            "chr_0030_zhuangfy",
            "chr_0004_pelica",
            "chr_0007_ikut",
            "chr_0023_antal",
        ],
        "alternatives": {},
        "tags": ["guide-backed", "pulse"],
        "sourceIds": [SOURCE_IDS["gamewith_team"], SOURCE_IDS["akedatabase"]],
        "confidence": 0.8,
    },
    {
        "id": "team_game8_fire_577071",
        "name": "Game8 Laevatain team",
        "description": (
            "Reviewed four-character team: Laevatain, Camille, Wulfgard and Ardelia. "
            "The guide assumes a single enemy."
        ),
        "characterIds": [
            "chr_0016_laevat",
            "chr_0033_camille",
            "chr_0006_wolfgd",
            "chr_0025_ardelia",
        ],
        "alternatives": {},
        "tags": ["guide-backed", "fire", "single-target"],
        "sourceIds": [SOURCE_IDS["game8_rotation"], SOURCE_IDS["akedatabase"]],
        "confidence": 0.78,
    },
]


ROTATION_EXTRACTS: list[dict[str, Any]] = [
    {
        "id": "rotation_game8_laevatain_577071",
        "name": "Game8 Laevatain single-target rotation",
        "teamPresetId": "team_game8_fire_577071",
        "characterIds": [
            "chr_0016_laevat",
            "chr_0033_camille",
            "chr_0006_wolfgd",
            "chr_0025_ardelia",
        ],
        "scenario": "single-enemy",
        "description": (
            "Reviewed order from Game8. Use Ardelia before Camille to preserve the "
            "stated trigger order. Verify the in-game label behind 'Final Strike'."
        ),
        "steps": [
            {
                "order": 1,
                "characterId": "chr_0033_camille",
                "skillType": "battle",
                "triggerCondition": "Open the damage window with Camille's battle skill.",
                "waitFor": "Shared skill points are available.",
            },
            {
                "order": 2,
                "characterId": "chr_0006_wolfgd",
                "skillType": "battle",
                "triggerCondition": "Follow with Wulfgard's battle skill.",
                "waitFor": "Camille's battle-skill setup is active.",
            },
            {
                "order": 3,
                "characterId": "chr_0006_wolfgd",
                "skillType": "combo",
                "triggerCondition": "Use when Wulfgard's combo condition is met.",
                "waitFor": "Combo condition becomes available.",
            },
            {
                "order": 4,
                "characterId": "chr_0016_laevat",
                "skillType": "ultimate",
                "triggerCondition": "Enter Laevatain's burst window.",
                "waitFor": "Ultimate energy is full and the prior setup is active.",
                "note": "Game8 calls this action 'Final Strike'.",
                "warnings": [
                    "Terminology mapping requires in-game verification.",
                ],
            },
            {
                "order": 5,
                "characterId": "chr_0025_ardelia",
                "skillType": "combo",
                "triggerCondition": "Use Ardelia's combo before Camille's combo.",
                "waitFor": "Ardelia's combo condition is met.",
            },
            {
                "order": 6,
                "characterId": "chr_0033_camille",
                "skillType": "combo",
                "triggerCondition": "Use Camille's combo after Ardelia's combo.",
                "waitFor": "Camille's combo condition is met.",
            },
            {
                "order": 7,
                "characterId": "chr_0016_laevat",
                "skillType": "combo",
                "triggerCondition": "Use Laevatain's combo in the active window.",
                "waitFor": "Laevatain's combo condition is met.",
            },
            {
                "order": 8,
                "characterId": "chr_0016_laevat",
                "skillType": "battle",
                "triggerCondition": "Continue the damage window with Laevatain's battle skill.",
                "waitFor": "Shared skill points are available.",
            },
        ],
        "warnings": [
            "Source guide assumes a single enemy.",
            "Timing is condition-based; no frame-perfect seconds are claimed.",
        ],
        "sourceIds": [
            SOURCE_IDS["game8_rotation"],
            SOURCE_IDS["akedatabase"],
            SOURCE_IDS["official_battle"],
        ],
        "confidence": 0.74,
    },
]


UNRESOLVED_EXTRACTS = [
    {
        "field": "equipment.recommended-sets",
        "subject": "Game8 gear set 'Eternal Xiranite'",
        "reason": "No reliable English-to-game-suit ID mapping was verified; recommendation omitted.",
        "sourceIds": [SOURCE_IDS["game8_gear"]],
    },
    {
        "field": "progressions.chapters",
        "subject": "Story chapter gates",
        "reason": "No sufficiently authoritative chapter-to-equipment mapping was verified.",
        "sourceIds": [SOURCE_IDS["akedatabase"]],
    },
]

