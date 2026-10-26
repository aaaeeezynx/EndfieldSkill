"""Offline tests for the BWiki ``action=raw`` skill-name parser.

Every wikitext sample is embedded in this module and every "network" call goes
through an injected opener, so the suite never contacts wiki.biligame.com.
"""

from __future__ import annotations

import unittest
from unittest.mock import patch

from crawler import bwiki
from crawler.bwiki import (
    BWIKI_RAW_ENDPOINT,
    BWIKI_REFERER,
    BWIKI_SOURCE_ID,
    BWIKI_USER_AGENT,
    CHARACTER_PAGE_TITLES,
    GENERIC_SKILL_NAMES,
    SKILL_TYPES,
    UNRESOLVED_CHARACTER_PAGES,
    RawWikiPage,
    WikiFetchError,
    WikiPageMissingError,
    bwiki_source_record,
    build_raw_request_headers,
    build_raw_url,
    clean_wikitext_text,
    collect_character_skills,
    fetch_character_skills,
    fetch_raw_wikitext,
    is_generic_skill_name,
    normalize_skill_name,
    parse_character_skills,
    to_override_entries,
)


# ---------------------------------------------------------------------------
# Fixtures - realistic BWiki shapes, kept verbatim on purpose
# ---------------------------------------------------------------------------

MULTILINE_TEMPLATE = """{{干员
|干员代号=管理员
|战技名称=构成序列
|战技属性=物理
|战技描述=造成{{颜色|蓝|源石伤害}}并击退目标。
|连携技名称=锁闭序列
|连携技描述=形成闭锁区域。
|终结技名称=轰击序列
|终结技描述=造成大范围伤害。
}}"""

SINGLE_LINE_TEMPLATE = (
    "{{干员|干员代号=陈千语|战技名称=归穹宇|连携技名称=见天河|终结技名称=冽风霜}}"
)

ROW_LABEL_TABLE = """{| class="wikitable"
! 类型 !! 名称 !! 描述
|-
| 战技 || 构成序列 || 造成源石伤害。
|-
| 连携技 || 锁闭序列 || 形成闭锁区域。
|-
| 终结技 || 轰击序列 || 造成大范围伤害。
|}"""

COLUMN_HEADER_TABLE = """{| class="wikitable"
! 战技 !! 连携技 !! 终结技
|-
| 构成序列 || 锁闭序列 || 轰击序列
|}"""

SECTION_PAGE = """== 技能 ==
=== 战技 ===
'''归穹宇'''
=== 连携技 ===
'''见天河'''
=== 终结技 ===
'''冽风霜'''"""

LIST_PAGE = """; 战技 : 归穹宇
* 连携技：见天河
; 终结技 : 冽风霜"""

GENERIC_ONLY_TEMPLATE = """{{干员
|战技名称=战技
|连携技名称=连携技
|终结技名称=终结技
}}"""

EMPTY_NAME_TEMPLATE = """{{干员
|战技名称=
|连携技名称=汤汤
|终结技名称=冽风霜
}}"""

MULTI_VARIANT_TEMPLATE = """{{干员
|战技名称_智=摧玉网格_智
|战技名称_意=摧玉网格_意
|连携技名称=一息万变
|终结技名称=万钧风雷
}}"""

DESCRIPTION_ONLY_TEMPLATE = """{{干员
|战技描述=只有描述没有名称
}}"""

TEMPLATE_WITH_PROSE = """{{干员技能
炸裂射线
|战技名称=归穹宇
|连携技名称=见天河
|终结技名称=冽风霜
}}"""

NESTED_DESCRIPTION_TEMPLATE = """{{干员
|战技名称=构成序列
|战技描述=造成{{颜色|蓝|源石伤害}}与{{异常|猛击}}。
}}"""

MULTILINE_VALUE_TEMPLATE = """{{干员
|战技名称=构成序列
|战技描述=第一行描述
第二行描述
|连携技名称=锁闭序列
}}"""

TEMPLATE_BEATS_TABLE = """{{干员
|战技名称=构成序列
}}
{| class="wikitable"
|-
| 战技 || 归穹宇 || 造成源石伤害。
|}"""

TABLE_BEATS_LIST = """{| class="wikitable"
|-
| 战技 || 归穹宇 || 造成源石伤害。
|}
; 战技 : 列表中的其他名称"""


class RecordingOpener:
    """Injectable ``PageOpener`` that records the request it received."""

    def __init__(
        self,
        status: int = 200,
        body: bytes | str = "",
        error: BaseException | None = None,
    ) -> None:
        self.status = status
        self.body = body
        self.error = error
        self.calls: list[dict[str, object]] = []

    def __call__(self, url, headers, *, timeout=25.0):
        self.calls.append({"url": url, "headers": dict(headers), "timeout": timeout})
        if self.error is not None:
            raise self.error
        return self.status, self.body


def offline_opener(
    wikitext: str = MULTILINE_TEMPLATE,
    *,
    status: int = 200,
) -> RecordingOpener:
    return RecordingOpener(status=status, body=wikitext.encode("utf-8"))


def parse(wikitext: str, **overrides):
    kwargs = {
        "character_key": "chr_test",
        "page_title": "测试页",
        "source_url": "https://wiki.biligame.com/zmd/index.php?action=raw&title=x",
    }
    kwargs.update(overrides)
    return parse_character_skills(wikitext, **kwargs)


class RawRequestTests(unittest.TestCase):
    def test_build_raw_url_uses_action_raw_and_encodes_title(self) -> None:
        url = build_raw_url("管理员")
        self.assertTrue(url.startswith(BWIKI_RAW_ENDPOINT))
        self.assertIn("action=raw", url)
        self.assertIn("title=%E7%AE%A1%E7%90%86%E5%91%98", url)
        self.assertNotIn(" ", url)

    def test_build_raw_url_honours_custom_endpoint(self) -> None:
        url = build_raw_url("管理员", endpoint="https://example.invalid/raw.php")
        self.assertTrue(url.startswith("https://example.invalid/raw.php?"))
        self.assertIn("action=raw", url)

    def test_request_headers_carry_user_agent_and_referer(self) -> None:
        headers = build_raw_request_headers()
        self.assertEqual(headers["User-Agent"], BWIKI_USER_AGENT)
        self.assertEqual(headers["Referer"], BWIKI_REFERER)
        self.assertIn("User-Agent", headers)
        self.assertTrue(headers["Referer"].startswith("https://wiki.biligame.com/zmd"))
        self.assertTrue(headers["Accept"])

    def test_request_headers_can_be_overridden(self) -> None:
        headers = build_raw_request_headers(
            user_agent="TestAgent/1.0",
            referer="https://example.invalid/",
            accept="text/plain",
        )
        self.assertEqual(headers["User-Agent"], "TestAgent/1.0")
        self.assertEqual(headers["Referer"], "https://example.invalid/")
        self.assertEqual(headers["Accept"], "text/plain")


class TextHelperTests(unittest.TestCase):
    def test_clean_wikitext_text_unwraps_inline_templates(self) -> None:
        self.assertEqual(clean_wikitext_text("造成{{颜色|蓝|源石伤害}}"), "造成源石伤害")

    def test_clean_wikitext_text_unwraps_links_and_strips_tags(self) -> None:
        self.assertEqual(clean_wikitext_text("[[归穹宇|归穹宇]]的伤害"), "归穹宇的伤害")
        self.assertEqual(clean_wikitext_text("伤害<ref>注释</ref>"), "伤害")
        self.assertEqual(clean_wikitext_text("伤害<!-- 隐藏 -->"), "伤害")

    def test_clean_wikitext_text_drops_media_links(self) -> None:
        self.assertEqual(clean_wikitext_text("[[文件:icon.png]]伤害"), "伤害")
        self.assertEqual(clean_wikitext_text("[[File:icon.png]]"), "")

    def test_normalize_skill_name_strips_wiki_formatting(self) -> None:
        self.assertEqual(normalize_skill_name("'''归穹宇'''"), "归穹宇")
        self.assertEqual(normalize_skill_name("  归穹宇\n"), "归穹宇")
        self.assertEqual(normalize_skill_name("|战技名称=归穹宇"), "战技名称=归穹宇")
        self.assertEqual(normalize_skill_name("冽风霜<br/>"), "冽风霜")

    def test_generic_placeholders_are_rejected(self) -> None:
        for placeholder in (
            "战技",
            "戰技",
            "连携技",
            "連攜技",
            "终结技",
            "終結技",
            "大招",
            "技能",
            "普攻",
            "战技名称",
            "待补充",
            "暂无",
            "-",
            "?",
            "",
            "   ",
            None,
        ):
            with self.subTest(placeholder=placeholder):
                self.assertTrue(
                    is_generic_skill_name(placeholder),
                    f"{placeholder!r} should be treated as a generic slot label",
                )

    def test_character_specific_names_are_accepted(self) -> None:
        for name in ("归穹宇", "见天河", "冽风霜", "構成序列", "協議ω·雷擊", "爆裂手雷·β型"):
            with self.subTest(name=name):
                self.assertFalse(is_generic_skill_name(name))

    def test_generic_placeholder_set_is_not_empty(self) -> None:
        self.assertIn("战技", GENERIC_SKILL_NAMES)
        self.assertEqual(SKILL_TYPES, ("battle", "combo", "ultimate"))


class TemplateStructureTests(unittest.TestCase):
    def test_multiline_template_parses_all_three_skills(self) -> None:
        result = parse(MULTILINE_TEMPLATE)

        self.assertTrue(result.is_complete)
        self.assertEqual(set(result.skills), set(SKILL_TYPES))
        self.assertEqual(result.skills["battle"].name, "构成序列")
        self.assertEqual(result.skills["combo"].name, "锁闭序列")
        self.assertEqual(result.skills["ultimate"].name, "轰击序列")
        for skill in result.skills.values():
            self.assertEqual(skill.structure, "template")
            self.assertEqual(skill.character_key, "chr_test")
            self.assertEqual(skill.source_url, result.source_url)

    def test_skill_descriptions_are_copied_verbatim(self) -> None:
        result = parse(MULTILINE_TEMPLATE)

        battle = result.skills["battle"]
        self.assertEqual(battle.description, "造成源石伤害并击退目标。")
        self.assertEqual(battle.description_raw, "造成{{颜色|蓝|源石伤害}}并击退目标。")
        self.assertIn("{{颜色|蓝|源石伤害}}", battle.description_raw or "")
        self.assertIn("构成序列", battle.raw_block)

    def test_single_line_template_is_supported(self) -> None:
        result = parse(SINGLE_LINE_TEMPLATE)

        self.assertTrue(result.is_complete)
        self.assertEqual(result.skills["battle"].name, "归穹宇")
        self.assertEqual(result.skills["combo"].name, "见天河")
        self.assertEqual(result.skills["ultimate"].name, "冽风霜")

    def test_nested_template_arguments_do_not_split_values(self) -> None:
        result = parse(NESTED_DESCRIPTION_TEMPLATE)

        self.assertIn("battle", result.skills)
        self.assertEqual(result.skills["battle"].name, "构成序列")
        self.assertEqual(result.skills["battle"].description, "造成源石伤害与猛击。")

    def test_multiline_values_are_joined(self) -> None:
        result = parse(MULTILINE_VALUE_TEMPLATE)

        self.assertIn("battle", result.skills)
        self.assertEqual(result.skills["battle"].name, "构成序列")
        self.assertIn("第一行描述", result.skills["battle"].description or "")
        self.assertIn("第二行描述", result.skills["battle"].description or "")

    def test_page_prose_is_never_used_as_a_skill_name(self) -> None:
        result = parse(TEMPLATE_WITH_PROSE)

        self.assertTrue(result.is_complete)
        self.assertEqual(result.skills["battle"].name, "归穹宇")
        for skill in result.skills.values():
            self.assertNotEqual(skill.name, "炸裂射线")
            self.assertNotIn("干员技能", skill.name)

    def test_description_without_name_parameter_is_reported_as_warning(self) -> None:
        result = parse(DESCRIPTION_ONLY_TEMPLATE)

        self.assertFalse(result.is_complete)
        self.assertEqual(set(result.missing), set(SKILL_TYPES))
        self.assertTrue(
            any("沒有對應的名稱參數" in warning for warning in result.warnings),
            result.warnings,
        )

    def test_split_top_level_ignores_nested_separators(self) -> None:
        self.assertEqual(
            bwiki._split_top_level("干员|战技名称={{颜色|蓝|支援晶体}}|连携技名称=见天河"),
            ["干员", "战技名称={{颜色|蓝|支援晶体}}", "连携技名称=见天河"],
        )
        self.assertEqual(
            bwiki._split_top_level("a=[[归穹宇|别名]]|b=1"),
            ["a=[[归穹宇|别名]]", "b=1"],
        )
        self.assertEqual(bwiki._split_top_level("plain"), ["plain"])

    def test_iter_template_bodies_handles_nesting_and_unclosed_braces(self) -> None:
        self.assertEqual(bwiki._iter_template_bodies("{{a|1}}{{b|2}}"), ["a|1", "b|2"])
        self.assertEqual(bwiki._iter_template_bodies("{{a|{{b|1}}}}"), ["a|{{b|1}}"])
        self.assertEqual(bwiki._iter_template_bodies("没有任何模板"), [])
        unclosed = bwiki._iter_template_bodies("{{干员|战技名称=归穹宇")
        self.assertEqual(unclosed, ["干员|战技名称=归穹宇"])

    def test_iter_template_params_skips_the_template_name_segment(self) -> None:
        params = bwiki._iter_template_params(SINGLE_LINE_TEMPLATE)
        keys = [key for key, _value, _raw in params]
        self.assertNotIn("干员", keys)
        self.assertEqual(
            keys,
            ["干员代号", "战技名称", "连携技名称", "终结技名称"],
        )


class TableStructureTests(unittest.TestCase):
    def test_row_label_table_parses_names_and_descriptions(self) -> None:
        result = parse(ROW_LABEL_TABLE)

        self.assertTrue(result.is_complete)
        self.assertEqual(result.skills["battle"].name, "构成序列")
        self.assertEqual(result.skills["battle"].description, "造成源石伤害。")
        self.assertEqual(result.skills["combo"].name, "锁闭序列")
        self.assertEqual(result.skills["ultimate"].name, "轰击序列")
        for skill in result.skills.values():
            self.assertEqual(skill.structure, "table")

    def test_column_header_table_maps_each_column_to_a_skill_type(self) -> None:
        result = parse(COLUMN_HEADER_TABLE)

        self.assertTrue(result.is_complete)
        self.assertEqual(result.skills["battle"].name, "构成序列")
        self.assertEqual(result.skills["combo"].name, "锁闭序列")
        self.assertEqual(result.skills["ultimate"].name, "轰击序列")

    def test_generic_table_cell_is_not_accepted_as_a_name(self) -> None:
        result = parse(
            """{| class="wikitable"
|-
| 战技 || 战技 || 战技说明
|}
"""
        )

        self.assertFalse(result.is_complete)
        self.assertNotIn("battle", result.skills)
        self.assertIn("通用詞", result.missing["battle"])

    def test_iter_table_blocks_supports_single_line_tables(self) -> None:
        blocks = bwiki._iter_table_blocks('{| class="wikitable"|-| 战技 || 归穹宇 || 说明|}')
        self.assertEqual(len(blocks), 1)
        self.assertIn("归穹宇", blocks[0])


class SectionAndListStructureTests(unittest.TestCase):
    def test_section_headings_resolve_bold_skill_names(self) -> None:
        result = parse(SECTION_PAGE)

        self.assertTrue(result.is_complete)
        self.assertEqual(result.skills["battle"].name, "归穹宇")
        self.assertEqual(result.skills["combo"].name, "见天河")
        self.assertEqual(result.skills["ultimate"].name, "冽风霜")
        for skill in result.skills.values():
            self.assertEqual(skill.structure, "section")

    def test_list_lines_resolve_labelled_skill_names(self) -> None:
        result = parse(LIST_PAGE)

        self.assertTrue(result.is_complete)
        self.assertEqual(result.skills["battle"].name, "归穹宇")
        self.assertEqual(result.skills["combo"].name, "见天河")
        self.assertEqual(result.skills["ultimate"].name, "冽风霜")
        for skill in result.skills.values():
            self.assertEqual(skill.structure, "list")


class MissingDataTests(unittest.TestCase):
    def test_generic_only_values_are_reported_as_missing(self) -> None:
        result = parse(GENERIC_ONLY_TEMPLATE)

        self.assertFalse(result.is_complete)
        self.assertEqual(set(result.missing), set(SKILL_TYPES))
        for skill_type in SKILL_TYPES:
            self.assertIn("通用詞", result.missing[skill_type])
        self.assertEqual(result.skills, {})

    def test_blank_name_field_is_reported_as_empty(self) -> None:
        result = parse(EMPTY_NAME_TEMPLATE)

        self.assertFalse(result.is_complete)
        self.assertIn("欄位為空", result.missing["battle"])
        self.assertNotIn("battle", result.skills)
        self.assertEqual(result.skills["combo"].name, "汤汤")
        self.assertEqual(result.skills["ultimate"].name, "冽风霜")

    def test_unrelated_wikitext_reports_every_skill_type_missing(self) -> None:
        result = parse("{{干员|干员代号=测试}}\n这是一个没有任何技能资料的页面。")

        self.assertFalse(result.is_complete)
        self.assertEqual(set(result.missing), set(SKILL_TYPES))
        for reason in result.missing.values():
            self.assertIn("未提供", reason)

    def test_empty_wikitext_is_reported_as_missing(self) -> None:
        for value in ("", "   \n  "):
            with self.subTest(value=value):
                result = parse(value)
                self.assertFalse(result.is_complete)
                self.assertEqual(set(result.missing), set(SKILL_TYPES))
                self.assertTrue(all("為空" in reason for reason in result.missing.values()))

    def test_missing_reasons_name_the_skill_slot_and_structure(self) -> None:
        empty = {structure: {} for structure in ("template", "table", "section", "list")}
        for skill_type, label in (("battle", "战技"), ("combo", "连携技"), ("ultimate", "终结技")):
            with self.subTest(skill_type=skill_type):
                self.assertIn(label, bwiki._missing_reason(skill_type, empty))

    def test_missing_reason_distinguishes_generic_from_unusable_values(self) -> None:
        candidate = bwiki._Candidate(
            name="待补充",
            description=None,
            description_raw=None,
            raw_block="|战技名称=待补充",
        )
        parsed = {"template": {"battle": [candidate]}, "table": {}, "section": {}, "list": {}}
        self.assertIn("通用詞", bwiki._missing_reason("battle", parsed))

        long_candidate = bwiki._Candidate(
            name="。" * 40,
            description=None,
            description_raw=None,
            raw_block="|战技名称=。",
        )
        parsed["template"]["battle"] = [long_candidate]
        self.assertIn("無法作為技能名稱", bwiki._missing_reason("battle", parsed))


class MultiVariantTests(unittest.TestCase):
    def test_multi_form_template_keeps_every_variant_and_warns(self) -> None:
        result = parse(MULTI_VARIANT_TEMPLATE)

        self.assertTrue(result.is_complete)
        battle = result.skills["battle"]
        self.assertEqual(battle.name, "摧玉网格_智")
        self.assertEqual(
            [(variant.label, variant.name) for variant in battle.variants],
            [("智", "摧玉网格_智"), ("意", "摧玉网格_意")],
        )
        self.assertTrue(
            any("多形態" in warning for warning in result.warnings),
            result.warnings,
        )

    def test_single_form_skills_expose_a_default_variant(self) -> None:
        result = parse(MULTILINE_TEMPLATE)

        variants = result.skills["combo"].variants
        self.assertEqual(len(variants), 1)
        self.assertEqual(variants[0].label, "default")
        self.assertEqual(variants[0].name, "锁闭序列")

    def test_variant_descriptions_are_not_cross_assigned(self) -> None:
        result = parse(
            """{{干员
|战技名称_智=摧玉网格_智
|战技描述_智=智形态描述
|战技名称_意=摧玉网格_意
|战技描述_意=意形态描述
}}"""
        )

        variants = {variant.label: variant for variant in result.skills["battle"].variants}
        self.assertEqual(variants["智"].description, "智形态描述")
        self.assertEqual(variants["意"].description, "意形态描述")


class StructurePriorityTests(unittest.TestCase):
    def test_template_wins_over_table_and_warns_about_the_conflict(self) -> None:
        result = parse(TEMPLATE_BEATS_TABLE)

        self.assertIn("battle", result.skills)
        self.assertEqual(result.skills["battle"].name, "构成序列")
        self.assertEqual(result.skills["battle"].structure, "template")
        self.assertTrue(
            any(
                "名稱衝突" in warning and "採用 template" in warning
                for warning in result.warnings
            ),
            result.warnings,
        )

    def test_table_wins_over_list(self) -> None:
        result = parse(TABLE_BEATS_LIST)

        self.assertEqual(result.skills["battle"].name, "归穹宇")
        self.assertEqual(result.skills["battle"].structure, "table")
        self.assertTrue(
            any("名稱衝突" in warning for warning in result.warnings),
            result.warnings,
        )

    def test_identical_names_across_structures_do_not_warn(self) -> None:
        result = parse(LIST_PAGE + "\n{| class=\"wikitable\"\n|-\n| 战技 || 归穹宇 || 说明\n|}\n")

        self.assertEqual(result.skills["battle"].structure, "table")
        self.assertEqual(result.warnings, [])


class HttpAccessTests(unittest.TestCase):
    def test_fetch_raw_wikitext_returns_page_metadata(self) -> None:
        opener = offline_opener()

        page = fetch_raw_wikitext("管理员", opener=opener)

        self.assertIsInstance(page, RawWikiPage)
        self.assertEqual(page.status, 200)
        self.assertEqual(page.page_title, "管理员")
        self.assertEqual(page.wikitext, MULTILINE_TEMPLATE)
        self.assertIn("action=raw", page.url)
        self.assertTrue(page.url.startswith(BWIKI_RAW_ENDPOINT))

    def test_fetch_raw_wikitext_sends_user_agent_and_referer(self) -> None:
        opener = offline_opener()

        fetch_raw_wikitext("管理员", opener=opener)

        self.assertEqual(len(opener.calls), 1)
        headers = opener.calls[0]["headers"]
        self.assertEqual(headers["User-Agent"], BWIKI_USER_AGENT)
        self.assertEqual(headers["Referer"], BWIKI_REFERER)
        self.assertEqual(opener.calls[0]["timeout"], 25.0)

    def test_fetch_raw_wikitext_404_raises_page_missing(self) -> None:
        opener = RecordingOpener(status=404, body=b"not found")

        with self.assertRaises(WikiPageMissingError) as context:
            fetch_raw_wikitext("提弗洛斯", opener=opener)

        self.assertEqual(context.exception.page_title, "提弗洛斯")
        self.assertIn("404", context.exception.reason)
        self.assertIn("action=raw", context.exception.url)

    def test_fetch_raw_wikitext_empty_body_raises_page_missing(self) -> None:
        with self.assertRaises(WikiPageMissingError):
            fetch_raw_wikitext("空页", opener=RecordingOpener(status=200, body=b"   \n"))

    def test_fetch_raw_wikitext_http_error_raises_fetch_error(self) -> None:
        with self.assertRaises(WikiFetchError):
            fetch_raw_wikitext("坏页", opener=RecordingOpener(status=500, body=b"boom"))

    def test_fetch_raw_wikitext_transport_error_raises_fetch_error(self) -> None:
        opener = RecordingOpener(error=OSError("connection reset"))

        with self.assertRaises(WikiFetchError):
            fetch_raw_wikitext("管理员", opener=opener)

    def test_fetch_character_skills_parses_injected_page(self) -> None:
        opener = offline_opener()

        result = fetch_character_skills("陈千语", character_key="chr_0005_chen", opener=opener)

        self.assertTrue(result.is_complete)
        self.assertEqual(result.character_key, "chr_0005_chen")
        self.assertEqual(result.page_title, "陈千语")
        self.assertIn("action=raw", result.source_url or "")
        self.assertEqual(result.source_id, BWIKI_SOURCE_ID)

    def test_fetch_character_skills_404_reports_missing_without_raising(self) -> None:
        opener = RecordingOpener(status=404, body=b"not found")

        result = fetch_character_skills("提弗洛斯", character_key="chr_0034_typhoea", opener=opener)

        self.assertFalse(result.is_complete)
        self.assertEqual(set(result.missing), set(SKILL_TYPES))
        for reason in result.missing.values():
            self.assertIn("頁面缺失", reason)
        self.assertTrue(result.warnings)

    def test_fetch_character_skills_transport_failure_reports_missing(self) -> None:
        opener = RecordingOpener(error=OSError("timeout"))

        result = fetch_character_skills("管理员", opener=opener)

        self.assertFalse(result.is_complete)
        self.assertTrue(all("抓取失敗" in reason for reason in result.missing.values()))

    def test_collect_character_skills_keys_by_character_and_title(self) -> None:
        opener = offline_opener()

        results = collect_character_skills(
            {"chr_0002_endminm": "管理员"},
            titles=["陈千语"],
            opener=opener,
        )

        self.assertEqual(set(results), {"chr_0002_endminm", "title:陈千语"})
        self.assertTrue(results["chr_0002_endminm"].is_complete)
        self.assertTrue(results["title:陈千语"].is_complete)
        self.assertIsNone(results["title:陈千语"].character_key)
        self.assertEqual(len(opener.calls), 2)

    def test_injected_opener_keeps_the_default_opener_unused(self) -> None:
        with patch.object(bwiki, "default_open", side_effect=AssertionError("no network")):
            result = fetch_character_skills("管理员", opener=offline_opener())

        self.assertTrue(result.is_complete)


class PublicationTests(unittest.TestCase):
    def test_source_record_is_labelled_community_secondary(self) -> None:
        record = bwiki_source_record()

        self.assertEqual(record["id"], BWIKI_SOURCE_ID)
        self.assertEqual(record["sourceType"], "community-database")
        self.assertEqual(record["trustLevel"], "community-secondary")
        self.assertFalse(record["isOfficial"])
        self.assertTrue(record["url"].startswith("https://wiki.biligame.com"))
        self.assertIn("character.skills.battle.name", record["fields"])

    def test_override_entries_keep_name_description_and_source_ids(self) -> None:
        result = parse(MULTILINE_TEMPLATE)

        entries = to_override_entries(result)

        self.assertEqual(set(entries), set(SKILL_TYPES))
        self.assertEqual(entries["battle"]["name"], "构成序列")
        self.assertEqual(entries["battle"]["description"], "造成源石伤害并击退目标。")
        self.assertEqual(entries["battle"]["sourceIds"], [BWIKI_SOURCE_ID])

    def test_override_entries_can_omit_descriptions(self) -> None:
        result = parse(MULTILINE_TEMPLATE)

        entries = to_override_entries(result, include_descriptions=False)

        for entry in entries.values():
            self.assertNotIn("description", entry)
            self.assertEqual(entry["sourceIds"], [BWIKI_SOURCE_ID])

    def test_to_dict_is_json_ready(self) -> None:
        result = parse(MULTILINE_TEMPLATE)

        payload = result.to_dict()

        self.assertEqual(payload["characterKey"], "chr_test")
        self.assertTrue(payload["isComplete"])
        self.assertEqual(payload["sourceId"], BWIKI_SOURCE_ID)
        self.assertEqual(payload["missing"], {})
        self.assertEqual(payload["warnings"], [])
        self.assertEqual(
            set(payload["skills"]["battle"]),
            {
                "characterKey",
                "skillType",
                "name",
                "description",
                "descriptionRaw",
                "structure",
                "sourceUrl",
                "rawBlock",
                "variants",
            },
        )

    def test_to_dict_reports_missing_entries(self) -> None:
        payload = parse(GENERIC_ONLY_TEMPLATE).to_dict()

        self.assertFalse(payload["isComplete"])
        self.assertEqual(payload["skills"], {})
        self.assertEqual(set(payload["missing"]), set(SKILL_TYPES))


class CharacterPageMappingTests(unittest.TestCase):
    def test_page_titles_are_unique_and_do_not_overlap_unresolved(self) -> None:
        titles = list(CHARACTER_PAGE_TITLES.values())
        self.assertEqual(len(titles), len(set(titles)))
        self.assertTrue(set(CHARACTER_PAGE_TITLES).isdisjoint(UNRESOLVED_CHARACTER_PAGES))
        self.assertTrue(all(key.startswith("chr_") for key in CHARACTER_PAGE_TITLES))

    def test_unresolved_pages_explain_the_gap(self) -> None:
        self.assertIn("chr_0034_typhoea", UNRESOLVED_CHARACTER_PAGES)
        for reason in UNRESOLVED_CHARACTER_PAGES.values():
            self.assertIn("404", reason)


if __name__ == "__main__":
    unittest.main()
