from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


DATA_FILES = {
    "meta": "meta.json",
    "characters": "characters.json",
    "equipment": "equipment.json",
    "progressions": "progressions.json",
    "team-presets": "team-presets.json",
    "rotation-presets": "rotation-presets.json",
    "sources": "sources.json",
}
SCHEMA_FILES = {
    name: f"{name}.schema.json" for name in DATA_FILES
}
SKILL_TYPES = {"battle", "combo", "ultimate"}


@dataclass
class ValidationResult:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    record_counts: dict[str, int] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.errors

    def format(self) -> str:
        status = "PASS" if self.ok else "FAIL"
        lines = [f"{status}: data/v1 ({len(self.errors)} errors, {len(self.warnings)} warnings)"]
        for name, count in self.record_counts.items():
            lines.append(f"  {name}: {count}")
        for warning in self.warnings:
            lines.append(f"WARNING: {warning}")
        for error in self.errors:
            lines.append(f"ERROR: {error}")
        return "\n".join(lines)


def _type_matches(value: Any, expected: str) -> bool:
    if expected == "null":
        return value is None
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "string":
        return isinstance(value, str)
    if expected == "array":
        return isinstance(value, list)
    if expected == "object":
        return isinstance(value, dict)
    return True


def _json_pointer(path: str, token: str) -> str:
    return f"{path}.{token}"


def validate_against_schema(
    instance: Any,
    schema: dict[str, Any],
    *,
    path: str = "$",
) -> list[str]:
    """Validate the JSON Schema subset used by data/schemas.

    This intentionally avoids a runtime jsonschema dependency. Unsupported
    annotation keywords are ignored because they do not affect data validity.
    """

    errors: list[str] = []

    if "const" in schema and instance != schema["const"]:
        errors.append(f"{path}: expected constant {schema['const']!r}")
    if "enum" in schema and instance not in schema["enum"]:
        errors.append(f"{path}: value {instance!r} is not in enum")

    if "allOf" in schema:
        for index, item in enumerate(schema["allOf"]):
            errors.extend(
                validate_against_schema(instance, item, path=f"{path}.allOf[{index}]")
            )
    if "anyOf" in schema:
        branches = [
            validate_against_schema(instance, item, path=path)
            for item in schema["anyOf"]
        ]
        if all(branch for branch in branches):
            errors.append(f"{path}: value does not match anyOf")
    if "oneOf" in schema:
        matches = sum(
            not validate_against_schema(instance, item, path=path)
            for item in schema["oneOf"]
        )
        if matches != 1:
            errors.append(f"{path}: value must match exactly one oneOf branch")

    expected_types = schema.get("type")
    if expected_types is not None:
        if isinstance(expected_types, str):
            expected_types = [expected_types]
        if not any(_type_matches(instance, item) for item in expected_types):
            errors.append(f"{path}: expected type {expected_types}, got {type(instance).__name__}")
            return errors

    if isinstance(instance, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in instance:
                errors.append(f"{path}: missing required property {key!r}")
        properties = schema.get("properties", {})
        for key, value in instance.items():
            if key in properties:
                errors.extend(
                    validate_against_schema(
                        value,
                        properties[key],
                        path=_json_pointer(path, key),
                    )
                )
                continue
            additional = schema.get("additionalProperties", True)
            if additional is False:
                errors.append(f"{path}: unexpected property {key!r}")
            elif isinstance(additional, dict):
                errors.extend(
                    validate_against_schema(
                        value,
                        additional,
                        path=_json_pointer(path, key),
                    )
                )

    if isinstance(instance, list):
        if len(instance) < schema.get("minItems", 0):
            errors.append(f"{path}: fewer than {schema['minItems']} items")
        if "maxItems" in schema and len(instance) > schema["maxItems"]:
            errors.append(f"{path}: more than {schema['maxItems']} items")
        if schema.get("uniqueItems"):
            canonical = [
                json.dumps(item, ensure_ascii=False, sort_keys=True) for item in instance
            ]
            if len(canonical) != len(set(canonical)):
                errors.append(f"{path}: items must be unique")
        if isinstance(schema.get("items"), dict):
            for index, item in enumerate(instance):
                errors.extend(
                    validate_against_schema(
                        item,
                        schema["items"],
                        path=f"{path}[{index}]",
                    )
                )

    if isinstance(instance, str):
        if len(instance) < schema.get("minLength", 0):
            errors.append(f"{path}: string is shorter than {schema['minLength']}")
        if "maxLength" in schema and len(instance) > schema["maxLength"]:
            errors.append(f"{path}: string is longer than {schema['maxLength']}")

    if isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if "minimum" in schema and instance < schema["minimum"]:
            errors.append(f"{path}: value is below {schema['minimum']}")
        if "maximum" in schema and instance > schema["maximum"]:
            errors.append(f"{path}: value is above {schema['maximum']}")

    return errors


def _read_json(path: Path, errors: list[str]) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        errors.append(f"missing file: {path}")
    except (OSError, ValueError) as exc:
        errors.append(f"cannot parse {path}: {exc}")
    return None


def _as_records(dataset: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = dataset.get(key, {})
    if key == "meta":
        return []
    if not isinstance(value, dict):
        return []
    records = value.get(key if key != "team-presets" else "teams")
    if key == "equipment":
        records = value.get("equipment")
    elif key == "characters":
        records = value.get("characters")
    elif key == "rotation-presets":
        records = value.get("rotations")
    elif key == "sources":
        records = value.get("sources")
    return records if isinstance(records, list) else []


def _duplicates(values: list[str]) -> set[str]:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for value in values:
        if value in seen:
            duplicates.add(value)
        seen.add(value)
    return duplicates


def _source_references(value: Any, path: str = "$") -> list[tuple[str, str]]:
    references: list[tuple[str, str]] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = _json_pointer(path, key)
            if key in {"sourceIds", "recommendedSourceIds"} and isinstance(child, list):
                references.extend(
                    (f"{child_path}[{index}]", source_id)
                    for index, source_id in enumerate(child)
                    if isinstance(source_id, str)
                )
            references.extend(_source_references(child, child_path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            references.extend(_source_references(child, f"{path}[{index}]"))
    return references


def validate_dataset(
    data_dir: Path | str,
    schemas_dir: Path | str | None = None,
) -> ValidationResult:
    """Validate all seven canonical files and their cross-file references."""

    data_dir = Path(data_dir)
    schemas_dir = Path(schemas_dir) if schemas_dir else data_dir.parent / "schemas"
    result = ValidationResult()
    dataset: dict[str, Any] = {}
    schemas: dict[str, Any] = {}

    for name, filename in DATA_FILES.items():
        schema_name = SCHEMA_FILES[name]
        schema_path = schemas_dir / schema_name
        data_path = data_dir / filename
        schema = _read_json(schema_path, result.errors)
        data = _read_json(data_path, result.errors)
        if schema is not None:
            schemas[name] = schema
        if data is not None:
            dataset[name] = data
        if schema is not None and data is not None:
            result.errors.extend(
                validate_against_schema(
                    data,
                    schema,
                    path=f"$({filename})",
                )
            )

    sources = _as_records(dataset, "sources")
    characters = _as_records(dataset, "characters")
    equipment = _as_records(dataset, "equipment")
    teams = _as_records(dataset, "team-presets")
    rotations = _as_records(dataset, "rotation-presets")
    progressions = dataset.get("progressions", {})
    meta = dataset.get("meta", {})

    source_ids = [item.get("id") for item in sources if isinstance(item, dict)]
    source_id_set = {value for value in source_ids if isinstance(value, str)}
    for duplicate in _duplicates([str(value) for value in source_ids]):
        result.errors.append(f"sources.json: duplicate source id {duplicate}")

    character_ids = [item.get("id") for item in characters if isinstance(item, dict)]
    character_id_set = {value for value in character_ids if isinstance(value, str)}
    for duplicate in _duplicates([str(value) for value in character_ids]):
        result.errors.append(f"characters.json: duplicate character id {duplicate}")

    equipment_ids = [item.get("id") for item in equipment if isinstance(item, dict)]
    for duplicate in _duplicates([str(value) for value in equipment_ids]):
        result.errors.append(f"equipment.json: duplicate equipment id {duplicate}")

    team_ids = [item.get("id") for item in teams if isinstance(item, dict)]
    team_id_set = {value for value in team_ids if isinstance(value, str)}
    for duplicate in _duplicates([str(value) for value in team_ids]):
        result.errors.append(f"team-presets.json: duplicate team id {duplicate}")

    rotation_ids = [item.get("id") for item in rotations if isinstance(item, dict)]
    for duplicate in _duplicates([str(value) for value in rotation_ids]):
        result.errors.append(f"rotation-presets.json: duplicate rotation id {duplicate}")

    if isinstance(meta, dict) and meta.get("sourceCount") != len(sources):
        result.errors.append(
            "meta.json: sourceCount does not match sources.json record count"
        )

    skill_ids: set[str] = set()
    skills_by_character: dict[str, dict[str, dict[str, Any]]] = {}
    for character in characters:
        if not isinstance(character, dict):
            continue
        character_id = character.get("id")
        character_skills: dict[str, dict[str, Any]] = {}
        for skill in character.get("skills", []):
            if not isinstance(skill, dict):
                continue
            skill_id = skill.get("id")
            if isinstance(skill_id, str):
                if skill_id in skill_ids:
                    result.errors.append(f"duplicate skill id: {skill_id}")
                skill_ids.add(skill_id)
            skill_type = skill.get("type")
            if isinstance(skill_type, str):
                character_skills[skill_type] = skill
        if isinstance(character_id, str):
            skills_by_character[character_id] = character_skills

    referenced_source_ids: set[str] = set()
    for path, source_id in _source_references(dataset):
        if source_id not in source_id_set:
            result.errors.append(
                f"{path}: unresolved sourceId {source_id!r}"
            )
        else:
            referenced_source_ids.add(source_id)

    for team in teams:
        if not isinstance(team, dict):
            continue
        ids = team.get("characterIds", [])
        if len(ids) != 4 or len(set(ids)) != 4:
            result.errors.append(f"team {team.get('id')}: must contain four unique characters")
        for character_id in ids:
            if character_id not in character_id_set:
                result.errors.append(
                    f"team {team.get('id')}: unresolved characterId {character_id}"
                )

    for rotation in rotations:
        if not isinstance(rotation, dict):
            continue
        rotation_id = rotation.get("id")
        if rotation.get("teamPresetId") not in team_id_set:
            result.errors.append(
                f"rotation {rotation_id}: unresolved teamPresetId "
                f"{rotation.get('teamPresetId')!r}"
            )
        steps = rotation.get("steps", [])
        orders = [step.get("order") for step in steps if isinstance(step, dict)]
        if orders != list(range(1, len(orders) + 1)):
            result.errors.append(f"rotation {rotation_id}: orders must be sequential from 1")
        for step in steps:
            if not isinstance(step, dict):
                continue
            step_id = step.get("id")
            character_id = step.get("characterId")
            skill_id = step.get("skillId")
            skill_type = step.get("skillType")
            if character_id not in character_id_set:
                result.errors.append(
                    f"rotation step {step_id}: unresolved characterId {character_id!r}"
                )
                continue
            if skill_type not in SKILL_TYPES:
                result.errors.append(
                    f"rotation step {step_id}: invalid skillType {skill_type!r}"
                )
            skill = skills_by_character.get(character_id, {}).get(skill_type)
            if not isinstance(skill_id, str) or skill is None or skill.get("id") != skill_id:
                result.errors.append(
                    f"rotation step {step_id}: skillId does not resolve for "
                    f"{character_id}:{skill_type}"
                )
            for field_name in ("triggerCondition", "waitFor"):
                if field_name not in step:
                    result.errors.append(
                        f"rotation step {step_id}: missing {field_name}"
                    )
            for source_id in step.get("sourceIds", []):
                if source_id not in source_id_set:
                    result.errors.append(
                        f"rotation step {step_id}: unresolved sourceId {source_id!r}"
                    )

    if isinstance(progressions, dict):
        gate_status = progressions.get("chapterGateStatus")
        chapter_count = len(progressions.get("chapters", []))
        if chapter_count == 0 and gate_status != "unavailable":
            result.errors.append(
                "progressions.json: empty chapters require chapterGateStatus=unavailable"
            )
        if chapter_count > 0 and gate_status == "unavailable":
            result.errors.append(
                "progressions.json: chapterGateStatus cannot be unavailable when chapters exist"
            )
        for gate in progressions.get("playerLevelGates", []):
            if isinstance(gate, dict) and gate.get("kind") != "equipment_wear_level":
                result.errors.append(
                    f"progression gate {gate.get('level')}: unsupported gate kind"
                )

    for source in sources:
        if not isinstance(source, dict) or source.get("id") not in referenced_source_ids:
            continue
        if not source.get("url"):
            result.errors.append(f"source {source.get('id')}: missing URL")
        if not source.get("fetchedAt"):
            result.warnings.append(
                f"source {source.get('id')}: referenced but has no successful fetch time"
            )

    result.record_counts = {
        "characters": len(characters),
        "skills": len(skill_ids),
        "equipment": len(equipment),
        "teams": len(teams),
        "rotations": len(rotations),
        "rotationSteps": sum(
            len(item.get("steps", [])) for item in rotations if isinstance(item, dict)
        ),
        "sources": len(sources),
    }
    return result


def require_valid_dataset(
    data_dir: Path | str,
    schemas_dir: Path | str | None = None,
) -> ValidationResult:
    result = validate_dataset(data_dir, schemas_dir)
    if not result.ok:
        raise ValueError(result.format())
    return result
