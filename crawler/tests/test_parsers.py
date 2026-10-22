from __future__ import annotations

import json
import unittest
from pathlib import Path

from crawler.parsers import parse_rotation_presets


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


if __name__ == "__main__":
    unittest.main()
