"""Regression tests for the reviewed BWiki skill overrides.

``EXPECTED_NAMES`` is a fixed transcript of the BWiki ``action=raw`` wikitext
that was reviewed for these characters. BWiki (``wiki.biligame.com/zmd``) is a
community-maintained wiki, so every value below is ``community-secondary`` and
must never be presented as official data.

The tests only assert facts that were actually verifiable: character-specific
skill names, the extra community source id, and that stable ids / numeric
fields are never rewritten. Characters whose wiki page cannot be expressed as a
single battle/combo/ultimate triple are listed in ``SKIPPED_CHARACTER_IDS`` and
must stay untouched instead of being guessed.
"""

from __future__ import annotations

import copy
import json
import re
import unittest
from pathlib import Path

from crawler.reviewed_overrides import (
    BWIKI_SKILL_DATABASE,
    REVIEWED_SKILL_OVERRIDES,
    STRUCTURED_SKILL_SOURCE_IDS,
    WULFA_SOURCE_IDS,
    apply_reviewed_skill_overrides,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CANONICAL_DATA = PROJECT_ROOT / "data" / "v1"

SKILL_TYPES = ("battle", "combo", "ultimate")
SKILL_SUFFIXES = {
    "battle": "_normal_skill",
    "combo": "_combo_skill",
    "ultimate": "_ultimate_skill",
}

# Generic skill words are placeholders, never character-specific names.
PLACEHOLDER_NAMES = frozenset(
    {"战技", "连携技", "终结技", "戰技", "連攜技", "終結技"}
)

# ``apply_reviewed_skill_overrides`` may only replace these keys.
ALLOWED_OVERRIDE_FIELDS = frozenset(
    {
        "name",
        "description",
        "sourceIds",
        "triggerConditions",
        "cooldownSeconds",
        "energyCost",
        "sharedSkillPointCost",
    }
)

# Fields that carry the reviewed numbers and must survive an override untouched.
PRESERVED_FIELDS = ("cooldownSeconds", "energyCost", "sharedSkillPointCost", "resource", "tags")

# Simplified-only code points: none of them can appear in correct Traditional
# Chinese, so their presence means the s2tw transcription was skipped somewhere.
SIMPLIFIED_ONLY_CHARACTERS = frozenset(
    "战连终术击锋卫辅输据职级队选释顺荐备资伤门关见风敌发时数说躯绝断满导师"
)

# Half-width punctuation directly after a Han character is a transcription
# artefact; the reviewed text uses full-width forms.
HALF_WIDTH_PUNCTUATION_AFTER_HAN = re.compile(r"[\u4e00-\u9fff][:;,?!]")

# Characters that a simplified -> traditional pass can pick the wrong variant
# for. The reviewed transcript uses the corrected form everywhere.
CONVERSION_TYPOS = ("強製", "回複", "回覆", "入力", "発動")

# Names reviewed from BWiki raw wikitext (community-secondary), Traditional Chinese.
EXPECTED_NAMES: dict[str, dict[str, str]] = {
    "chr_0002_endminm": {
        "battle": "構成序列",
        "combo": "鎖閉序列",
        "ultimate": "轟擊序列"
    },
    "chr_0004_pelica": {
        "battle": "協議ω·雷擊",
        "combo": "即時協議·閃鏈",
        "ultimate": "協議ε·70.41κ"
    },
    "chr_0005_chen": {
        "battle": "歸穹宇",
        "combo": "見天河",
        "ultimate": "冽風霜"
    },
    "chr_0006_wolfgd": {
        "battle": "灼熱彈痕",
        "combo": "爆裂手雷·β型",
        "ultimate": "狼之怒"
    },
    "chr_0007_ikut": {
        "battle": "疾風迅雷",
        "combo": "鳴雷",
        "ultimate": "轟雷掣電"
    },
    "chr_0009_azrila": {
        "battle": "進軍",
        "combo": "前線援護",
        "ultimate": "重燃誓約"
    },
    "chr_0011_seraph": {
        "battle": "分佈式拒絕服務",
        "combo": "壓力測試",
        "ultimate": "棧溢出"
    },
    "chr_0012_avywen": {
        "battle": "雷槍·截回",
        "combo": "雷槍·掣擊",
        "ultimate": "雷槍·決顫"
    },
    "chr_0013_aglina": {
        "battle": "秘杖·引力模式",
        "combo": "秘杖·矩陣位移",
        "ultimate": "秘杖·重力場"
    },
    "chr_0014_aurora": {
        "battle": "飽和性防禦",
        "combo": "極地救援",
        "ultimate": "凜冽寒霜"
    },
    "chr_0015_lifeng": {
        "battle": "蕩濁身",
        "combo": "忿怒相",
        "ultimate": "不動心"
    },
    "chr_0016_laevat": {
        "battle": "焚滅",
        "combo": "沸騰",
        "ultimate": "黃昏"
    },
    "chr_0017_yvonne": {
        "battle": "冰冰彈·β型",
        "combo": "速凍仔·υ37",
        "ultimate": "冷凍射手"
    },
    "chr_0018_dapan": {
        "battle": "顛勺！",
        "combo": "加料！",
        "ultimate": "切絲入鍋！"
    },
    "chr_0019_karin": {
        "battle": "熱情迸發",
        "combo": "快閃衝擊",
        "ultimate": "小隊，集結！"
    },
    "chr_0020_meurs": {
        "battle": "剛性阻擊",
        "combo": "即時壓制",
        "ultimate": "教科書式猛攻"
    },
    "chr_0021_whiten": {
        "battle": "凝聲",
        "combo": "失真",
        "ultimate": "震音"
    },
    "chr_0022_bounda": {
        "battle": "小驚喜",
        "combo": "免費贈禮",
        "ultimate": "巔峰鬧劇"
    },
    "chr_0023_antal": {
        "battle": "指定研究對象",
        "combo": "磁暴試驗場",
        "ultimate": "超頻時刻"
    },
    "chr_0024_deepfin": {
        "battle": "非常規路亞",
        "combo": "鑿孔底釣術",
        "ultimate": "大鱗，上鉤！"
    },
    "chr_0025_ardelia": {
        "battle": "奔騰的多利",
        "combo": "火山蘑菇雲",
        "ultimate": "毛茸茸派對"
    },
    "chr_0026_lastrite": {
        "battle": "塞什卡的秘傳",
        "combo": "噬冬",
        "ultimate": "臨終別禮"
    },
    "chr_0028_wulfa": {
        "battle": "血紅之影",
        "combo": "燎影時刻",
        "ultimate": "「利爪」奇襲"
    },
    "chr_0029_pograni": {
        "battle": "粉碎陣線",
        "combo": "盈月邀擊",
        "ultimate": "盾衛旗隊，上前"
    },
    "chr_0030_zhuangfy": {
        "battle": "驚霆訣",
        "combo": "一息萬變",
        "ultimate": "萬鈞風雷"
    },
    "chr_0031_mifu": {
        "battle": "清波三藝",
        "combo": "拳出無悔",
        "ultimate": "絕心"
    },
    "chr_0033_camille": {
        "battle": "驅火焚影",
        "combo": "錐心之棘",
        "ultimate": "猩紅墜雨"
    }
}

# No single battle/combo/ultimate triple can represent these pages, so no
# override may be invented for them:
#   chr_0032_lizhiyan - 战技名称_智 / 战技名称_意 dual forms (智 / 意)
#   chr_0027_tangtang / chr_0035_liino - wiki skill section is empty
#   chr_0036_jsspsi / chr_0038_purrche - no wiki page
#   chr_0034_typhoea - no wiki page, ultimate stays unverified
SKIPPED_CHARACTER_IDS = frozenset(
    {
        "chr_0027_tangtang",
        "chr_0032_lizhiyan",
        "chr_0034_typhoea",
        "chr_0035_liino",
        "chr_0036_jsspsi",
        "chr_0038_purrche",
    }
)


class ReviewedOverrideTableTests(unittest.TestCase):
    def test_covers_exactly_the_reviewed_characters(self) -> None:
        self.assertEqual(set(REVIEWED_SKILL_OVERRIDES), set(EXPECTED_NAMES))
        self.assertEqual(len(REVIEWED_SKILL_OVERRIDES), 27)

    def test_every_character_overrides_the_three_skill_types(self) -> None:
        for character_id, skills in REVIEWED_SKILL_OVERRIDES.items():
            with self.subTest(character=character_id):
                self.assertEqual(set(skills), set(SKILL_TYPES))

    def test_names_match_the_reviewed_transcript(self) -> None:
        for character_id, expected in EXPECTED_NAMES.items():
            for skill_type, name in expected.items():
                with self.subTest(character=character_id, skill=skill_type):
                    self.assertEqual(
                        REVIEWED_SKILL_OVERRIDES[character_id][skill_type]["name"],
                        name,
                    )

    def test_names_are_character_specific_and_traditional(self) -> None:
        for character_id, skills in REVIEWED_SKILL_OVERRIDES.items():
            for skill_type, override in skills.items():
                with self.subTest(character=character_id, skill=skill_type):
                    name = override["name"]
                    self.assertNotIn(name, PLACEHOLDER_NAMES)
                    self.assertTrue(name.strip())

    def test_override_text_is_traditional_and_uses_full_width_punctuation(self) -> None:
        offenders: list[str] = []
        for character_id, skills in REVIEWED_SKILL_OVERRIDES.items():
            for skill_type, override in skills.items():
                texts = [override["name"]]
                if override.get("description"):
                    texts.append(override["description"])
                texts.extend(override.get("triggerConditions") or [])
                for text in texts:
                    found = sorted(SIMPLIFIED_ONLY_CHARACTERS.intersection(text))
                    if found:
                        offenders.append(
                            f"{character_id}.{skill_type} simplified {found}"
                        )
                    for match in HALF_WIDTH_PUNCTUATION_AFTER_HAN.finditer(text):
                        offenders.append(
                            f"{character_id}.{skill_type} half-width {match.group(0)!r}"
                        )
        self.assertEqual([], offenders)

    def test_skipped_characters_are_never_guessed(self) -> None:
        for character_id in SKIPPED_CHARACTER_IDS:
            self.assertNotIn(character_id, REVIEWED_SKILL_OVERRIDES)

    def test_override_text_has_no_conversion_typos(self) -> None:
        offenders: list[str] = []
        for character_id, skills in REVIEWED_SKILL_OVERRIDES.items():
            for skill_type, override in skills.items():
                texts = [override["name"]]
                if override.get("description"):
                    texts.append(override["description"])
                texts.extend(override.get("triggerConditions") or [])
                for text in texts:
                    for typo in CONVERSION_TYPOS:
                        if typo in text:
                            offenders.append(
                                f"{character_id}.{skill_type} {typo}"
                            )
        self.assertEqual([], offenders)

    def test_overrides_only_carry_allowed_fields(self) -> None:
        for character_id, skills in REVIEWED_SKILL_OVERRIDES.items():
            for skill_type, override in skills.items():
                with self.subTest(character=character_id, skill=skill_type):
                    self.assertLessEqual(set(override), ALLOWED_OVERRIDE_FIELDS)
                    self.assertNotIn("id", override)
                    self.assertNotIn("type", override)
                    self.assertNotIn("tags", override)

    def test_every_override_credits_the_community_wiki(self) -> None:
        for character_id, skills in REVIEWED_SKILL_OVERRIDES.items():
            for skill_type, override in skills.items():
                with self.subTest(character=character_id, skill=skill_type):
                    sources = override["sourceIds"]
                    self.assertEqual(len(sources), len(set(sources)))
                    if character_id == "chr_0028_wulfa":
                        # Documented exception: crawler/tests/test_parsers.py
                        # pins wulfa's community source set verbatim.
                        self.assertEqual(sources, list(WULFA_SOURCE_IDS))
                        continue
                    self.assertIn(BWIKI_SKILL_DATABASE, sources)
                    # The wiki record is appended so the structured numeric
                    # sources stay authoritative for costs and cooldowns.
                    self.assertEqual(sources[-1], BWIKI_SKILL_DATABASE)

    def test_existing_structured_numeric_sources_are_kept(self) -> None:
        for character_id, skills in REVIEWED_SKILL_OVERRIDES.items():
            for skill_type, override in skills.items():
                with self.subTest(character=character_id, skill=skill_type):
                    sources = override["sourceIds"]
                    if character_id == "chr_0028_wulfa":
                        # Wulfa has no structured table row; its numbers come
                        # from the previously reviewed community databases and
                        # those ids must survive the skill text override.
                        expected = [
                            "src_canmoe_wulfa_chr_0028",
                            "src_gamekee_wulfa_695986",
                            "src_warfarin_rossi",
                        ]
                    else:
                        expected = list(STRUCTURED_SKILL_SOURCE_IDS)
                    for source_id in expected:
                        self.assertIn(source_id, sources)

    def test_combo_overrides_document_a_trigger_condition(self) -> None:
        for character_id, override in REVIEWED_SKILL_OVERRIDES.items():
            with self.subTest(character=character_id):
                conditions = override["combo"]["triggerConditions"]
                self.assertTrue(conditions)
                self.assertTrue(all(condition.strip() for condition in conditions))


class ApplyReviewedOverridesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        payload = json.loads((CANONICAL_DATA / "characters.json").read_text(encoding="utf-8"))
        cls.characters = payload["characters"]
        cls.by_id = {character["id"]: character for character in cls.characters}

    def test_every_reviewed_character_exists_in_canonical_data(self) -> None:
        missing = [cid for cid in REVIEWED_SKILL_OVERRIDES if cid not in self.by_id]
        self.assertEqual(missing, [])

    def test_apply_replaces_placeholder_names_and_keeps_ids(self) -> None:
        updated = apply_reviewed_skill_overrides(self.characters)
        by_id = {character["id"]: character for character in updated}
        for character_id, expected in EXPECTED_NAMES.items():
            original = {skill["type"]: skill for skill in self.by_id[character_id]["skills"]}
            for skill_type, name in expected.items():
                with self.subTest(character=character_id, skill=skill_type):
                    skill = {s["type"]: s for s in by_id[character_id]["skills"]}[skill_type]
                    self.assertEqual(skill["id"], f"{character_id}{SKILL_SUFFIXES[skill_type]}")
                    self.assertEqual(skill["name"], name)
                    self.assertEqual(skill["type"], skill_type)
                    self.assertEqual(skill["resource"], original[skill_type]["resource"])
                    for field in PRESERVED_FIELDS:
                        self.assertEqual(
                            skill.get(field),
                            original[skill_type].get(field),
                            msg=f"{character_id}:{skill_type} changed {field}",
                        )

    def test_apply_preserves_all_skills_and_does_not_mutate_input(self) -> None:
        snapshot = copy.deepcopy(self.characters)
        updated = apply_reviewed_skill_overrides(self.characters)
        self.assertEqual(self.characters, snapshot)
        self.assertEqual(len(updated), len(snapshot))
        for original, result in zip(snapshot, updated):
            self.assertEqual(len(result["skills"]), len(original["skills"]))
            self.assertEqual(
                [skill["id"] for skill in result["skills"]],
                [skill["id"] for skill in original["skills"]],
            )

    def test_apply_is_idempotent(self) -> None:
        once = apply_reviewed_skill_overrides(self.characters)
        twice = apply_reviewed_skill_overrides(once)
        for character_id in REVIEWED_SKILL_OVERRIDES:
            original = {skill["type"]: skill for skill in once[self._index(once, character_id)]["skills"]}
            redone = {skill["type"]: skill for skill in twice[self._index(twice, character_id)]["skills"]}
            for skill_type in SKILL_TYPES:
                with self.subTest(character=character_id, skill=skill_type):
                    self.assertEqual(redone[skill_type]["description"], original[skill_type]["description"])

    def test_numeric_stat_lines_in_descriptions_are_kept(self) -> None:
        crafted = [
            {
                "id": "chr_0002_endminm",
                "skills": [
                    {
                        "id": "chr_0002_endminm_normal_skill",
                        "name": "战技",
                        "type": "battle",
                        "resource": "shared_skill_points",
                        "description": "伤害倍率：156%；失衡值：10",
                        "tags": ["shared_skill_points"],
                        "triggerConditions": [],
                        "cooldownSeconds": 0,
                        "energyCost": None,
                        "sharedSkillPointCost": 100,
                        "sourceIds": ["src_akedatabase"],
                    }
                ],
            }
        ]
        updated = apply_reviewed_skill_overrides(crafted)
        description = updated[0]["skills"][0]["description"]
        reviewed_text = REVIEWED_SKILL_OVERRIDES["chr_0002_endminm"]["battle"]["description"]
        self.assertTrue(description.startswith(reviewed_text))
        self.assertIn("伤害倍率：156%；失衡值：10", description)
        self.assertEqual(updated[0]["skills"][0]["cooldownSeconds"], 0)
        self.assertEqual(updated[0]["skills"][0]["sharedSkillPointCost"], 100)

    @staticmethod
    def _index(characters: list[dict], character_id: str) -> int:
        return next(index for index, character in enumerate(characters) if character["id"] == character_id)


if __name__ == "__main__":
    unittest.main()
