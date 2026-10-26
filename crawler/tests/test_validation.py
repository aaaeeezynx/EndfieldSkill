from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from crawler.validation import validate_against_schema, validate_dataset


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CANONICAL_DATA = PROJECT_ROOT / "data" / "v1"
SCHEMA_DATA = PROJECT_ROOT / "data" / "schemas"


class ValidationTests(unittest.TestCase):
    def test_canonical_dataset_passes(self) -> None:
        result = validate_dataset(CANONICAL_DATA, SCHEMA_DATA)

        self.assertTrue(result.ok, result.format())
        self.assertEqual(33, result.record_counts["characters"])
        self.assertEqual(276, result.record_counts["equipment"])
        self.assertGreaterEqual(result.record_counts["rotationSteps"], 1)
        self.assertGreaterEqual(result.record_counts["rotations"], 6)
        characters = json.loads(
            (CANONICAL_DATA / "characters.json").read_text(encoding="utf-8")
        )["characters"]
        character_ids = {character["id"] for character in characters}
        self.assertIn("chr_0002_endminm", character_ids)
        self.assertNotIn("chr_0003_endminf", character_ids)
        wulfa = next(
            character for character in characters if character["id"] == "chr_0028_wulfa"
        )
        wulfa_combo = {
            skill["type"]: skill for skill in wulfa["skills"]
        }["combo"]
        self.assertEqual("chr_0028_wulfa_combo_skill", wulfa_combo["id"])
        self.assertEqual("燎影時刻", wulfa_combo["name"])
        progressions = json.loads(
            (CANONICAL_DATA / "progressions.json").read_text(encoding="utf-8")
        )
        self.assertEqual([], progressions["chapters"])
        self.assertEqual("unavailable", progressions["chapterGateStatus"])

    def test_wulfa_community_sources_are_marked_non_official(self) -> None:
        result = validate_dataset(CANONICAL_DATA, SCHEMA_DATA)
        self.assertTrue(result.ok, result.format())
        sources = json.loads(
            (CANONICAL_DATA / "sources.json").read_text(encoding="utf-8")
        )["sources"]
        by_id = {source["id"]: source for source in sources}
        for source_id in (
            "src_canmoe_wulfa_chr_0028",
            "src_gamekee_wulfa_695986",
            "src_warfarin_rossi",
        ):
            source = by_id[source_id]
            self.assertFalse(source["isOfficial"])
            self.assertEqual("community-database", source["sourceType"])
            self.assertEqual("community-secondary", source["trustLevel"])

    def test_unresolved_nested_source_reference_is_an_error(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            data_dir = Path(temporary) / "data" / "v1"
            schema_dir = Path(temporary) / "data" / "schemas"
            shutil.copytree(CANONICAL_DATA, data_dir)
            shutil.copytree(SCHEMA_DATA, schema_dir)
            path = data_dir / "characters.json"
            payload = json.loads(path.read_text(encoding="utf-8"))
            payload["characters"][0]["skills"][0]["sourceIds"] = ["src_missing"]
            path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )

            result = validate_dataset(data_dir, schema_dir)

            self.assertFalse(result.ok)
            self.assertTrue(
                any("src_missing" in error for error in result.errors),
                result.format(),
            )

    def test_built_in_schema_validator_rejects_unknown_property(self) -> None:
        errors = validate_against_schema(
            {"name": "valid", "unexpected": True},
            {
                "type": "object",
                "additionalProperties": False,
                "required": ["name"],
                "properties": {"name": {"type": "string"}},
            },
        )

        self.assertEqual(1, len(errors))
        self.assertIn("unexpected property", errors[0])


if __name__ == "__main__":
    unittest.main()
