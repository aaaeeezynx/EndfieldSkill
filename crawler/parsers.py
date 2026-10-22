from __future__ import annotations

from collections import Counter
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from .fetch import utc_now
from .sources import (
    GAME8_GEAR_SET_RECOMMENDATIONS,
    ROTATION_EXTRACTS,
    SOURCE_IDS,
    SOURCES,
    TEAM_EXTRACTS,
    UNRESOLVED_EXTRACTS,
)


SCHEMA_VERSION = "1.0.0"
EXCLUDED_CHARACTER_IDS = {"chr_9000_endmin"}
SLOT_NAMES = {0: "body", 1: "hand", 2: "edc"}
SKILL_SUFFIXES = {
    "battle": "_normal_skill",
    "combo": "_combo_skill",
    "ultimate": "_ultimate_skill",
}
SKILL_NAMES = {
    "battle": "战技",
    "combo": "连携技",
    "ultimate": "终结技",
}
PROGRESSION_LEVELS = (10, 20, 28, 36, 50, 60, 70)


def _text(i18n: dict[str, str], value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    text_id = value.get("id")
    if text_id is None:
        return value.get("text") or None
    translated = i18n.get(str(text_id))
    if translated:
        return translated
    fallback = value.get("text")
    return fallback or None


def _number(value: Any) -> int | float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return int(value) if float(value).is_integer() else value


def _skill_entry(
    skill_tables: dict[str, Any], character_id: str, skill_type: str
) -> tuple[str, dict[str, Any]] | None:
    skill_id = f"{character_id}{SKILL_SUFFIXES[skill_type]}"
    bundle = skill_tables.get(skill_id, {}).get("SkillPatchDataBundle", [])
    entries = [entry for entry in bundle if entry.get("level") == 1]
    if not entries:
        return None
    return skill_id, entries[0]


def _skill_description(entry: dict[str, Any], i18n: dict[str, str]) -> str | None:
    translated = _text(i18n, entry.get("description"))
    if translated:
        return translated
    parts: list[str] = []
    for item in entry.get("subDescDataList", []):
        name = _text(i18n, item.get("name"))
        value = item.get("desc")
        if name and value:
            parts.append(f"{name}：{value}")
        elif name:
            parts.append(name)
        elif value:
            parts.append(str(value))
    return "；".join(parts) or None


def _parse_skill(
    character_id: str,
    skill_type: str,
    skill_id: str,
    entry: dict[str, Any],
    i18n: dict[str, str],
) -> dict[str, Any]:
    cooldown = _number(entry.get("coolDown"))
    cost_value = _number(entry.get("costValue"))
    if skill_type == "battle":
        resource = "shared_skill_points"
        shared_cost = cost_value
        energy_cost = None
        trigger_conditions: list[str] = []
        tags = ["shared_skill_points", "team_energy_gain"]
    elif skill_type == "combo":
        resource = "none"
        shared_cost = None
        energy_cost = None
        trigger_conditions = [
            "由角色满足特定条件后触发；角色专属触发条件尚待逐角色核验。"
        ]
        tags = ["condition_triggered", "caster_energy_gain"]
    else:
        resource = "energy"
        shared_cost = None
        energy_cost = cost_value
        trigger_conditions = []
        tags = ["energy_cost", "ultimate"]

    return {
        "id": skill_id,
        "name": SKILL_NAMES[skill_type],
        "type": skill_type,
        "resource": resource,
        "description": _skill_description(entry, i18n),
        "tags": tags,
        "triggerConditions": trigger_conditions,
        "cooldownSeconds": cooldown,
        "energyCost": energy_cost,
        "sharedSkillPointCost": shared_cost,
        "sourceIds": [SOURCE_IDS["akedatabase"], SOURCE_IDS["official_battle"]],
    }


def parse_characters(tables: dict[str, Any]) -> list[dict[str, Any]]:
    character_table = tables["CharacterTable"]
    profession_table = tables["CharProfessionTable"]
    skill_tables = tables["SkillPatchTable"]
    i18n = tables["I18nTextTable_CN"]

    characters: list[dict[str, Any]] = []
    for character_id, row in sorted(
        character_table.items(),
        key=lambda item: (item[1].get("sortOrder", 999999), item[0]),
    ):
        if character_id in EXCLUDED_CHARACTER_IDS or row.get("charId") != character_id:
            continue
        profession = profession_table.get(str(row.get("profession")), {})
        skills: list[dict[str, Any]] = []
        for skill_type in ("battle", "combo", "ultimate"):
            found = _skill_entry(skill_tables, character_id, skill_type)
            if found:
                skill_id, entry = found
                skills.append(
                    _parse_skill(character_id, skill_type, skill_id, entry, i18n)
                )

        characters.append(
            {
                "id": character_id,
                "name": _text(i18n, row.get("name")) or row.get("engName") or character_id,
                "nameEn": row.get("engName") or None,
                "rarity": _number(row.get("rarity")),
                "profession": _text(i18n, profession.get("name")),
                "element": row.get("charTypeId") or None,
                "roles": [],
                "tags": list(row.get("charBattleTagIds") or []),
                "portraitUrl": None,
                "skills": skills,
                "sourceIds": [SOURCE_IDS["akedatabase"]],
            }
        )
    return characters


def _equipment_materials(
    chain: dict[str, Any], item_table: dict[str, Any], i18n: dict[str, str]
) -> list[str]:
    materials: list[str] = []
    item_ids = chain.get("costItemId") or []
    item_counts = chain.get("costItemNum") or []
    for item_id, count in zip(item_ids, item_counts):
        name = _text(i18n, item_table.get(item_id, {}).get("name")) or item_id
        materials.append(f"{name} x{_number(count) or 0}")
    gold_id = chain.get("costGoldId")
    gold_count = _number(chain.get("costGoldNum"))
    if gold_id and gold_count:
        gold_name = _text(i18n, item_table.get(gold_id, {}).get("name")) or gold_id
        materials.append(f"{gold_name} x{gold_count}")
    return materials


def _equipment_stats(equip: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    modifiers = []
    if equip.get("displayBaseAttrModifier"):
        modifiers.append(equip["displayBaseAttrModifier"])
    modifiers.extend(equip.get("displayAttrModifiers") or [])

    stats: dict[str, Any] = {}
    stat_types: dict[str, Any] = {}
    for modifier in modifiers:
        attr_type = modifier.get("attrType")
        value = _number(modifier.get("attrValue"))
        if attr_type is None or value is None:
            continue
        key = f"attrType_{attr_type}"
        if key in stats:
            suffix = 2
            while f"{key}_{suffix}" in stats:
                suffix += 1
            key = f"{key}_{suffix}"
        stats[key] = value
        stat_types[key] = modifier.get("packAttrType") or None
    return stats, stat_types


def parse_equipment(tables: dict[str, Any]) -> list[dict[str, Any]]:
    equip_table = tables["EquipTable"]
    item_table = tables["ItemTable"]
    suit_table = tables["EquipSuitTable"]
    formula_table = tables["EquipFormulaTable"]
    reverse_table = tables["EquipFormulaReverseTable"]
    chain_table = tables["EquipFormulaChainTable"]
    domain_table = tables["DomainDataTable"]
    i18n = tables["I18nTextTable_CN"]

    recommended_by_equipment: dict[str, list[str]] = {}
    for suit_id, character_ids in GAME8_GEAR_SET_RECOMMENDATIONS.items():
        for character_id in character_ids:
            recommended_by_equipment.setdefault(character_id, []).append(suit_id)

    equipment: list[dict[str, Any]] = []
    for equip_id, equip in sorted(equip_table.items()):
        item = item_table.get(equip_id, {})
        suit_id = equip.get("suitID") or None
        suit_entry = (suit_table.get(suit_id, {}).get("list") or [{}])[0] if suit_id else {}
        formula_id = reverse_table.get(equip_id)
        formula = formula_table.get(formula_id, {}) if formula_id else {}
        chains = chain_table.get(str(formula.get("level")), {}).get("chainList", [])
        default_chain = next((chain for chain in chains if chain.get("isDefault")), None)
        materials = (
            _equipment_materials(default_chain, item_table, i18n)
            if default_chain
            else []
        )
        stats, stat_types = _equipment_stats(equip)
        recommended_for = [
            character_id
            for character_id, suit_ids in recommended_by_equipment.items()
            if suit_id in suit_ids
        ]
        domain_id = equip.get("domainId") or None
        domain_name = _text(
            i18n, domain_table.get(domain_id, {}).get("domainName")
        ) if domain_id else None
        unlock_type = formula.get("unlockType")
        authority_rank = (
            _number(formula.get("unlockValue")) if unlock_type == 1 else None
        )
        source_ids = [SOURCE_IDS["akedatabase"]]
        if recommended_for:
            source_ids.append(SOURCE_IDS["game8_gear"])

        equipment.append(
            {
                "id": equip_id,
                "name": _text(i18n, item.get("name")) or equip_id,
                "slot": SLOT_NAMES.get(equip.get("partType")),
                "rarity": _number(item.get("rarity")),
                "setId": suit_id,
                "setName": _text(i18n, suit_entry.get("suitName")),
                "craftable": bool(formula_id and default_chain),
                "unlock": {
                    "playerLevel": _number(equip.get("minWearLv")),
                    "playerLevelKind": "equipment_wear_level",
                    "chapterId": None,
                    "chapterOrder": None,
                    "materials": materials,
                },
                "unlockDetails": {
                    "formulaId": formula_id,
                    "recipeTier": formula.get("level"),
                    "unlockType": unlock_type,
                    "unlockKey": formula.get("unlockKey") or None,
                    "unlockValue": _number(formula.get("unlockValue")),
                    "authorityRank": authority_rank,
                    "domainId": domain_id,
                    "domainName": domain_name,
                },
                "recommendedFor": recommended_for,
                "recommendedSourceIds": (
                    [SOURCE_IDS["game8_gear"]] if recommended_for else []
                ),
                "roleTags": [],
                "elementTags": [],
                "stats": stats,
                "statTypes": stat_types,
                "description": _text(i18n, item.get("desc")),
                "sourceIds": source_ids,
            }
        )
    return equipment


def parse_team_presets() -> list[dict[str, Any]]:
    return deepcopy(TEAM_EXTRACTS)


def parse_rotation_presets(
    characters: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    skills_by_character: dict[str, dict[str, dict[str, Any]]] = {}
    for character in characters:
        skills_by_character[character["id"]] = {
            skill["type"]: skill for skill in character.get("skills", [])
        }

    rotations: list[dict[str, Any]] = []
    for source_rotation in ROTATION_EXTRACTS:
        rotation = {
            key: deepcopy(value)
            for key, value in source_rotation.items()
            if key != "steps"
        }
        steps: list[dict[str, Any]] = []
        for source_step in source_rotation["steps"]:
            step = deepcopy(source_step)
            skill_type = step["skillType"]
            skill = skills_by_character.get(step["characterId"], {}).get(skill_type)
            step_id = f"{source_rotation['id']}-step-{step['order']}"
            steps.append(
                {
                    "id": step_id,
                    "order": step["order"],
                    "phase": step.get("phase"),
                    "characterId": step["characterId"],
                    "skillId": skill.get("id") if skill else None,
                    "skillName": skill.get("name") if skill else SKILL_NAMES[skill_type],
                    "skillType": skill_type,
                    "triggerCondition": step.get("triggerCondition"),
                    "waitFor": step.get("waitFor"),
                    "comboWindowSeconds": None,
                    "sharedSkillPointCost": (
                        skill.get("sharedSkillPointCost") if skill else None
                    ),
                    "energyCost": skill.get("energyCost") if skill else None,
                    "cooldownSeconds": skill.get("cooldownSeconds") if skill else None,
                    "warnings": list(step.get("warnings") or []),
                    "note": step.get("note"),
                    "sourceIds": list(source_rotation.get("sourceIds") or []),
                }
            )
        rotation["steps"] = steps
        rotations.append(rotation)
    return rotations


def build_sources(fetch_meta: dict[str, dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    fetch_meta = fetch_meta or {}
    sources: list[dict[str, Any]] = []
    for source in SOURCES:
        item = deepcopy(source)
        item.pop("required", None)
        meta = fetch_meta.get(source["id"], {})
        item.update(
            {
                "fetchedAt": meta.get("fetchedAt"),
                "sourceType": source.get("sourceType"),
                "trustLevel": source.get("trustLevel"),
                "isOfficial": bool(source.get("isOfficial")),
                "fetchStatus": meta.get("fetchStatus", "not-fetched-in-current-run"),
                "fromCache": meta.get("fromCache"),
                "httpStatus": meta.get("status"),
                "finalUrl": meta.get("finalUrl"),
                "contentType": meta.get("contentType"),
                "bytes": meta.get("bytes"),
                "sha256": meta.get("sha256"),
                "fetchError": meta.get("fetchError"),
                "tableFetch": meta.get("tableFetch"),
            }
        )
        sources.append(item)
    return sources


def build_progressions(equipment: list[dict[str, Any]]) -> dict[str, Any]:
    observed_levels = sorted(
        {
            item["unlock"]["playerLevel"]
            for item in equipment
            if item["unlock"]["playerLevel"] is not None
        }
    )
    return {
        "chapters": [],
        "chapterGateStatus": "unavailable",
        "playerLevelGates": [
            {
                "level": level,
                "kind": "equipment_wear_level",
                "sourceIds": [SOURCE_IDS["akedatabase"]],
            }
            for level in observed_levels
        ],
        "partialCoverage": True,
        "notes": [
            "当前结构化表未提供可核验的剧情章节与装备解锁映射；chapters 保持为空。",
            "chapterGateStatus=unavailable 表示章节门槛未知，不能视为 0 级门槛；前端应跳过章节判断并直接使用装备 wear level 门槛。",
            "玩家等级门槛来自 EquipTable.minWearLv，表示装备穿戴等级，不等同于权限等阶。",
            "unlockDetails.authorityRank 仅表示权限等阶解锁值，不代表装备本身可制造；craftable 另有配方字段决定。",
        ],
        "sourceIds": [SOURCE_IDS["akedatabase"]],
    }


def _coverage(
    characters: list[dict[str, Any]], equipment: list[dict[str, Any]]
) -> dict[str, Any]:
    skill_counts = Counter(
        skill["type"] for character in characters for skill in character["skills"]
    )
    missing_skill_types: list[str] = []
    for character in characters:
        present_types = {skill["type"] for skill in character["skills"]}
        for skill_type in ("battle", "combo", "ultimate"):
            if skill_type not in present_types:
                missing_skill_types.append(f"{character['id']}:{skill_type}")
    return {
        "playableCharacters": len(characters),
        "charactersWithSourceIds": sum(bool(item["sourceIds"]) for item in characters),
        "skills": {
            "battle": skill_counts["battle"],
            "combo": skill_counts["combo"],
            "ultimate": skill_counts["ultimate"],
            "total": sum(skill_counts.values()),
        },
        "equipment": {
            "total": len(equipment),
            "withWearLevelGate": sum(
                item["unlock"]["playerLevel"] is not None for item in equipment
            ),
            "withFormula": sum(item["craftable"] is True for item in equipment),
            "withMaterials": sum(
                bool(item["unlock"]["materials"]) for item in equipment
            ),
            "withSet": sum(item["setName"] is not None for item in equipment),
            "withRecommendation": sum(
                bool(item["recommendedFor"]) for item in equipment
            ),
        },
        "missingSkillTypes": missing_skill_types,
        "partialFields": [
            "characters.roles",
            "characters.portraitUrl",
            "characters.skills[].characterSpecificTrigger",
            "equipment.roleTags",
            "equipment.elementTags",
            "progressions.chapters",
        ],
    }


def mechanics() -> dict[str, Any]:
    return {
        "partySize": {
            "value": 4,
            "sourceIds": [SOURCE_IDS["prydwen"]],
            "isOfficial": False,
        },
        "sharedSkillPoints": {
            "description": "战技消耗全队共享技力；表内战技 costValue 使用 100 点刻度。",
            "tableScale": 100,
            "gaugeBars": 3,
            "gaugeBarsVerified": False,
            "sourceIds": [
                SOURCE_IDS["official_battle"],
                SOURCE_IDS["prydwen"],
            ],
            "isOfficial": True,
        },
        "battleSkill": {
            "resource": "shared_skill_points",
            "cooldownSeconds": 0,
            "grantsEnergyTo": "whole_team",
            "sourceIds": [SOURCE_IDS["official_battle"]],
            "isOfficial": True,
        },
        "comboSkill": {
            "resource": "none",
            "trigger": "character_condition",
            "hasCooldown": True,
            "grantsEnergyTo": "caster",
            "sourceIds": [SOURCE_IDS["official_battle"]],
            "isOfficial": True,
        },
        "ultimate": {
            "resource": "energy",
            "hasCooldown": True,
            "sourceIds": [SOURCE_IDS["official_battle"]],
            "isOfficial": True,
        },
    }


def build_meta(
    *,
    manifest: dict[str, Any],
    characters: list[dict[str, Any]],
    equipment: list[dict[str, Any]],
    team_presets: list[dict[str, Any]],
    rotations: list[dict[str, Any]],
    generated_at: str | None = None,
) -> dict[str, Any]:
    coverage = _coverage(characters, equipment)
    coverage.update(
        {
            "teamPresets": len(team_presets),
            "rotationPresets": len(rotations),
            "rotationSteps": sum(len(item["steps"]) for item in rotations),
            "storyChapters": 0,
        }
    )
    return {
        "schemaVersion": SCHEMA_VERSION,
        "dataVersion": manifest.get("id"),
        "gameVersion": manifest.get("gameVersion"),
        "generatedAt": generated_at or utc_now(),
        "sourceCount": len(SOURCES),
        "database": {
            "manifestId": manifest.get("id"),
            "gameVersion": manifest.get("gameVersion"),
            "hotfixVersion": manifest.get("hotfixVersion"),
            "publishedAt": manifest.get("publishedAt"),
            "tableCfgPath": manifest.get("tableCfgPath"),
        },
        "mechanics": mechanics(),
        "coverage": coverage,
        "unresolved": deepcopy(UNRESOLVED_EXTRACTS),
        "notes": [
            "全部推荐结果由静态 JSON 与确定性规则生成，运行时不调用 AI。",
            "未知字段保留 null 或省略；未验证的剧情章节映射未写入数据。",
            "战技、连携技与终结技的中文名采用通用类型名，游戏表未提供角色专属技能名。",
            "表中战技 costValue 采用 100 点共享技力刻度；三格量表说法仍需游戏内复核。",
        ],
    }


def parse_all(
    tables: dict[str, Any],
    *,
    manifest: dict[str, Any],
    fetch_meta: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    characters = parse_characters(tables)
    equipment = parse_equipment(tables)
    teams = parse_team_presets()
    rotations = parse_rotation_presets(characters)
    progressions = build_progressions(equipment)
    meta = build_meta(
        manifest=manifest,
        characters=characters,
        equipment=equipment,
        team_presets=teams,
        rotations=rotations,
    )
    return {
        "meta": meta,
        "characters": {"characters": characters},
        "equipment": {"equipment": equipment},
        "progressions": progressions,
        "team-presets": {"teams": teams},
        "rotation-presets": {"rotations": rotations},
        "sources": {"sources": build_sources(fetch_meta)},
    }
