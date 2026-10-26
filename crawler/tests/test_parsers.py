from __future__ import annotations

import json
import unittest
from pathlib import Path

from crawler.parsers import parse_characters, parse_rotation_presets
from crawler.reviewed_overrides import apply_reviewed_skill_overrides


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CANONICAL_DATA = PROJECT_ROOT / "data" / "v1"


class RotationParserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        characters_payload = json.loads(
            (CANONICAL_DATA / "characters.json").read_text(encoding="utf-8")
        )
        cls.characters = characters_payload["characters"]

    def test_rotation_steps_include_frontend_contract_fields(self) -> None:
        rotations = parse_rotation_presets(self.characters)

        self.assertGreaterEqual(len(rotations), 1)
        for rotation in rotations:
            for step in rotation["steps"]:
                for key in (
                    "characterId",
                    "skillId",
                    "skillName",
                    "skillType",
                    "order",
                    "triggerCondition",
                    "waitFor",
                    "sourceIds",
                ):
                    self.assertIn(key, step)
                self.assertIsInstance(step["skillId"], str)
                self.assertTrue(step["skillName"])
                self.assertTrue(step["triggerCondition"])
                self.assertTrue(step["waitFor"])
                self.assertTrue(step["sourceIds"])

    def test_generated_steps_resolve_to_character_skills(self) -> None:
        rotations = parse_rotation_presets(self.characters)
        skill_ids = {
            skill["id"]
            for character in self.characters
            for skill in character["skills"]
        }

        for rotation in rotations:
            self.assertEqual(
                list(range(1, len(rotation["steps"]) + 1)),
                [step["order"] for step in rotation["steps"]],
            )
            for step in rotation["steps"]:
                self.assertIn(step["skillId"], skill_ids)

    def test_reviewed_skill_overrides_fill_missing_character_skills(self) -> None:
        characters = apply_reviewed_skill_overrides(self.characters)
        by_id = {character["id"]: character for character in characters}

        mifu_skills = {skill["type"]: skill for skill in by_id["chr_0031_mifu"]["skills"]}
        self.assertEqual("清波三藝", mifu_skills["battle"]["name"])
        self.assertEqual("拳出無悔", mifu_skills["combo"]["name"])

        typhoeus_skills = {
            skill["type"]: skill for skill in by_id["chr_0034_typhoea"]["skills"]
        }
        self.assertEqual("風矢穿林", typhoeus_skills["battle"]["name"])
        self.assertEqual("野棘叢生", typhoeus_skills["combo"]["name"])

    def test_wulfa_combo_override_fills_verified_community_data(self) -> None:
        characters = apply_reviewed_skill_overrides(self.characters)
        by_id = {character["id"]: character for character in characters}

        wulfa_skills = {
            skill["type"]: skill for skill in by_id["chr_0028_wulfa"]["skills"]
        }
        self.assertEqual("血紅之影", wulfa_skills["battle"]["name"])
        self.assertEqual("燎影時刻", wulfa_skills["combo"]["name"])
        self.assertEqual("「利爪」奇襲", wulfa_skills["ultimate"]["name"])
        self.assertEqual("chr_0028_wulfa_combo_skill", wulfa_skills["combo"]["id"])
        self.assertEqual(
            ["當有敵人同時處於破防和法術附著狀態時可以發動。"],
            wulfa_skills["combo"]["triggerConditions"],
        )
        self.assertEqual(14, wulfa_skills["combo"]["cooldownSeconds"])
        self.assertEqual(
            {
                "src_canmoe_wulfa_chr_0028",
                "src_gamekee_wulfa_695986",
                "src_warfarin_rossi",
            },
            set(wulfa_skills["combo"]["sourceIds"]),
        )

    def test_wulfa_team_rotations_split_burst_and_charge_axes(self) -> None:
        characters = apply_reviewed_skill_overrides(self.characters)
        rotations = {
            rotation["id"]: rotation
            for rotation in parse_rotation_presets(characters)
        }

        burst = rotations["rotation_wulfa_team_burst_202601"]
        charge = rotations["rotation_wulfa_team_charge_202601"]
        self.assertEqual("complete", burst["matchType"])
        self.assertEqual("complete", charge["matchType"])

        # Source order: 駿衛大招 → 秋栗戰技 → 管理員戰技 → 洛茜戰技 → 洛茜連攜 …
        burst_order = [step["order"] for step in burst["steps"]]
        self.assertEqual(list(range(1, len(burst["steps"]) + 1)), burst_order)
        self.assertEqual("chr_0029_pograni", burst["steps"][0]["characterId"])
        self.assertEqual("ultimate", burst["steps"][0]["skillType"])
        self.assertEqual("chr_0019_karin", burst["steps"][1]["characterId"])
        self.assertEqual("chr_0002_endminm", burst["steps"][2]["characterId"])
        self.assertEqual("chr_0028_wulfa", burst["steps"][3]["characterId"])

        # The two Rossi combo steps reuse the same combo skill id, split by note.
        wulfa_combo_steps = [
            step
            for step in burst["steps"]
            if step["characterId"] == "chr_0028_wulfa" and step["skillType"] == "combo"
        ]
        self.assertEqual(2, len(wulfa_combo_steps))
        self.assertEqual(
            1, len({step["skillId"] for step in wulfa_combo_steps})
        )
        self.assertEqual(
            "chr_0028_wulfa_combo_skill", wulfa_combo_steps[0]["skillId"]
        )
        self.assertTrue(all(step["note"] for step in wulfa_combo_steps))
        self.assertNotEqual(
            wulfa_combo_steps[0]["note"], wulfa_combo_steps[1]["note"]
        )

        # 主控重擊 is not a character skill, so no step may fabricate it.
        self.assertFalse(
            any("重擊" in step["skillName"] for step in burst["steps"])
        )
        self.assertFalse(
            any("重擊" in (step.get("note") or "") and step["skillId"] is None
                for step in burst["steps"])
        )

        charge_order = [step["order"] for step in charge["steps"]]
        self.assertEqual(list(range(1, len(charge["steps"]) + 1)), charge_order)
        self.assertEqual("chr_0019_karin", charge["steps"][0]["characterId"])
        self.assertEqual("chr_0029_pograni", charge["steps"][6]["characterId"])
        self.assertEqual("chr_0029_pograni", charge["steps"][8]["characterId"])
        self.assertNotIn(
            "ultimate",
            [step["skillType"] for step in charge["steps"]],
        )
        self.assertTrue(any("主控重擊" in warning for warning in charge["warnings"]))


class CharacterParserTests(unittest.TestCase):
    def test_parse_characters_keeps_a_form_and_excludes_non_playable_forms(self) -> None:
        character_rows = {}
        for character_id in (
            "chr_0002_endminm",
            "chr_0003_endminf",
            "chr_9000_endmin",
        ):
            character_rows[character_id] = {
                "charId": character_id,
                "sortOrder": len(character_rows),
                "profession": "1",
                "name": {"id": f"name_{character_id}"},
                "engName": character_id,
                "rarity": 6,
                "charTypeId": "Physical",
                "charBattleTagIds": [],
            }

        tables = {
            "CharacterTable": character_rows,
            "CharProfessionTable": {"1": {"name": {"id": "profession_guard"}}},
            "SkillPatchTable": {},
            "I18nTextTable_CN": {
                "profession_guard": "近卫",
                **{
                    f"name_{character_id}": character_id
                    for character_id in character_rows
                },
            },
        }

        characters = parse_characters(tables)

        self.assertEqual(["chr_0002_endminm"], [item["id"] for item in characters])


if __name__ == "__main__":
    unittest.main()
