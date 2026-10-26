"""Extract character-specific skill names from BWiki ``action=raw`` wikitext.

The module only reads the raw wikitext of a page. It never infers, translates or
invents a skill name: when a value cannot be found reliably the skill type is
reported in ``SkillParseResult.missing`` together with the reason.

Source policy
-------------
``wiki.biligame.com/zmd`` is a community-maintained wiki, so everything produced
here must be labelled ``community-secondary`` / ``community-database`` and must
not be presented as official data. ``bwiki_source_record()`` returns the record
the pipeline should publish next to the extracted values.

Supported wikitext structures (highest priority first)
------------------------------------------------------
1. ``template``  - ``{{干员|战技名称=归穹宇|...}}`` parameters, including the
   multi-form ``战技名称_智=`` / ``战技名称_意=`` variant suffix.
2. ``table``     - ``{| ... |}`` wikitable rows or skill-typed header columns.
3. ``section``   - ``=== 战技 ===`` heading followed by ``'''归穹宇'''``.
4. ``list``      - ``; 战技 : 归穹宇`` / ``* 战技：归穹宇`` style lines.

Generic words such as ``战技`` / ``连携技`` / ``终结技`` are placeholders, not
character-specific names, and are always rejected.

The parser is read-only: it copies the wiki name and description verbatim and
never derives trigger conditions, cooldowns or damage numbers. Callers must show
anything absent from ``skills`` as ``missing`` instead of filling it in.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


BWIKI_SITE = "https://wiki.biligame.com/zmd"
BWIKI_RAW_ENDPOINT = f"{BWIKI_SITE}/index.php"
BWIKI_REFERER = f"{BWIKI_SITE}/"
BWIKI_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0 Safari/537.36 EndfieldSkill/1.0"
)
BWIKI_ACCEPT = "text/x-wiki,text/plain;q=0.9,*/*;q=0.1"

# Kept in sync with crawler.reviewed_overrides.BWIKI_SKILL_DATABASE so the
# published source record and the per-skill sourceIds refer to one entry.
BWIKI_SOURCE_ID = "src_bwiki_skill_database"

# Canonical skill types shared with crawler.parsers / reviewed_overrides.
SKILL_TYPES: tuple[str, ...] = ("battle", "combo", "ultimate")

# Traditional and simplified spellings seen in wikitext, plus the longer
# "…技能" forms used by some templates.
SKILL_TYPE_LABELS: dict[str, tuple[str, ...]] = {
    "battle": ("战技", "戰技", "战斗技能", "戰鬥技能"),
    "combo": ("连携技", "連攜技", "连携技能", "連攜技能"),
    "ultimate": ("终结技", "終結技", "终结技能", "終結技能", "大招"),
}

TEMPLATE_NAME_KEYS: dict[str, tuple[str, ...]] = {
    "battle": ("战技名称", "戰技名稱", "战斗技能名称"),
    "combo": ("连携技名称", "連攜技名稱", "连携技能名称"),
    "ultimate": ("终结技名称", "終結技名稱", "终结技能名称", "大招名称"),
}

TEMPLATE_DESCRIPTION_KEYS: dict[str, tuple[str, ...]] = {
    "battle": ("战技描述", "戰技描述", "战技说明", "战技說明"),
    "combo": ("连携技描述", "連攜技描述", "连携技说明", "连携技說明"),
    "ultimate": ("终结技描述", "終結技描述", "终结技说明", "终结技說明"),
}

# Values that describe the slot instead of the character-specific skill.
GENERIC_SKILL_NAMES: frozenset[str] = frozenset(
    {
        "战技",
        "戰技",
        "战斗技能",
        "戰鬥技能",
        "连携技",
        "連攜技",
        "连携技能",
        "連攜技能",
        "终结技",
        "終結技",
        "终结技能",
        "終結技能",
        "技能",
        "普攻",
        "普通攻击",
        "普通攻擊",
        "战技名称",
        "连携技名称",
        "终结技名称",
        "戰技名稱",
        "連攜技名稱",
        "終結技名稱",
        "待补充",
        "待補充",
        "待定",
        "未知",
        "暂无",
        "暫無",
        "无",
        "無",
        "-",
        "--",
        "—",
        "?",
        "??",
        "tbd",
        "n/a",
    }
)

MAX_SKILL_NAME_LENGTH = 30

# Verified against ``|干员代号=`` on BWiki on 2026-10-26. Characters that could
# not be verified are deliberately absent; they must be reported as missing
# instead of being mapped to a guessed page title.
CHARACTER_PAGE_TITLES: dict[str, str] = {
    "chr_0002_endminm": "管理员",
    "chr_0004_pelica": "佩丽卡",
    "chr_0005_chen": "陈千语",
    "chr_0006_wolfgd": "狼卫",
    "chr_0007_ikut": "弧光",
    "chr_0009_azrila": "余烬",
    "chr_0011_seraph": "赛希",
    "chr_0012_avywen": "艾维文娜",
    "chr_0013_aglina": "洁尔佩塔",
    "chr_0014_aurora": "昼雪",
    "chr_0015_lifeng": "黎风",
    "chr_0016_laevat": "莱万汀",
    "chr_0017_yvonne": "伊冯",
    "chr_0018_dapan": "大潘",
    "chr_0019_karin": "秋栗",
    "chr_0020_meurs": "卡契尔",
    "chr_0021_whiten": "埃特拉",
    "chr_0022_bounda": "萤石",
    "chr_0023_antal": "安塔尔",
    "chr_0024_deepfin": "阿列什",
    "chr_0025_ardelia": "艾尔黛拉",
    "chr_0026_lastrite": "别礼",
    "chr_0027_tangtang": "汤汤",
    "chr_0028_wulfa": "洛茜",
    "chr_0029_pograni": "骏卫",
    "chr_0030_zhuangfy": "庄方宜",
    "chr_0031_mifu": "弭弗",
    "chr_0032_lizhiyan": "诀",
    "chr_0033_camille": "卡缪",
    "chr_0035_liino": "梨诺",
}

# Characters without a usable BWiki page on 2026-10-26. Recorded so the
# pipeline can explain the gap instead of silently dropping the character.
UNRESOLVED_CHARACTER_PAGES: dict[str, str] = {
    "chr_0034_typhoea": "BWiki 無「提弗洛斯」頁面（HTTP 404），技能名稱需改用其他來源。",
    "chr_0036_jsspsi": "BWiki 無「祀」頁面（HTTP 404），技能名稱需改用其他來源。",
    "chr_0038_purrche": "BWiki 無「噗切娜」頁面（HTTP 404），技能名稱需改用其他來源。",
}


class BWikiError(RuntimeError):
    """Base class for BWiki access problems."""


class WikiFetchError(BWikiError):
    """Raised when the wiki response is not a usable 200 response."""


class WikiPageMissingError(BWikiError):
    """Raised when the wiki reports the page as missing or empty."""

    def __init__(self, page_title: str, url: str, reason: str) -> None:
        super().__init__(f"{page_title}: {reason} ({url})")
        self.page_title = page_title
        self.url = url
        self.reason = reason


@dataclass(frozen=True)
class RawWikiPage:
    """A raw wikitext response together with its traceability metadata."""

    page_title: str
    url: str
    status: int
    wikitext: str


@dataclass
class SkillVariant:
    """One named form of a skill (for example 诀's 智／意 forms)."""

    label: str
    name: str
    description: str | None = None
    description_raw: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "name": self.name,
            "description": self.description,
            "descriptionRaw": self.description_raw,
        }


@dataclass
class ParsedSkill:
    """A character-specific skill name recovered from wikitext."""

    character_key: str | None
    skill_type: str
    name: str
    structure: str
    source_url: str | None = None
    description: str | None = None
    description_raw: str | None = None
    raw_block: str = ""
    variants: list[SkillVariant] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "characterKey": self.character_key,
            "skillType": self.skill_type,
            "name": self.name,
            "description": self.description,
            "descriptionRaw": self.description_raw,
            "structure": self.structure,
            "sourceUrl": self.source_url,
            "rawBlock": self.raw_block,
            "variants": [variant.to_dict() for variant in self.variants],
        }


@dataclass
class SkillParseResult:
    """Parsed skills plus an explicit record of everything that is missing."""

    character_key: str | None
    page_title: str | None = None
    source_url: str | None = None
    source_id: str | None = BWIKI_SOURCE_ID
    skills: dict[str, ParsedSkill] = field(default_factory=dict)
    missing: dict[str, str] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    @property
    def is_complete(self) -> bool:
        return all(skill_type in self.skills for skill_type in SKILL_TYPES)

    def to_dict(self) -> dict[str, Any]:
        return {
            "characterKey": self.character_key,
            "pageTitle": self.page_title,
            "sourceId": self.source_id,
            "sourceUrl": self.source_url,
            "isComplete": self.is_complete,
            "skills": {
                skill_type: skill.to_dict()
                for skill_type, skill in sorted(self.skills.items())
            },
            "missing": dict(sorted(self.missing.items())),
            "warnings": list(self.warnings),
        }


PageOpener = Callable[..., tuple[int, bytes | str]]


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------


_COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
_REF_RE = re.compile(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", re.S | re.I)
_BR_RE = re.compile(r"<br\s*/?>", re.I)
_TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")
_LINK_RE = re.compile(r"\[\[([^\[\]]*?)\]\]")
_TEMPLATE_RE = re.compile(r"\{\{([^{}]*)\}\}")
_BOLD_RE = re.compile(r"'{2,5}")
_WHITESPACE_RE = re.compile(r"\s+")
_MEDIA_LINK_PREFIXES = ("file:", "image:", "文件:", "檔案:", "档案:")


def clean_wikitext_text(value: str) -> str:
    """Reduce a wikitext fragment to the plain text a wiki page would render."""

    if not value:
        return ""
    text = _COMMENT_RE.sub("", value)
    text = _REF_RE.sub("", text)
    text = _BR_RE.sub(" ", text)
    text = _TAG_RE.sub("", text)

    def _replace_link(match: re.Match[str]) -> str:
        target = match.group(1)
        if "|" not in target and target.strip().lower().startswith(_MEDIA_LINK_PREFIXES):
            return ""
        return target.split("|")[-1]

    previous = None
    while previous != text:
        previous = text
        text = _LINK_RE.sub(_replace_link, text)

    def _replace_template(match: re.Match[str]) -> str:
        arguments = match.group(1).split("|")
        if not arguments:
            return ""
        # Inline templates such as {{颜色|蓝|阵诀·智}} carry the rendered text
        # in their last positional argument.
        return arguments[-1]

    previous = None
    while previous != text:
        previous = text
        text = _TEMPLATE_RE.sub(_replace_template, text)

    text = _BOLD_RE.sub("", text)
    text = html.unescape(text)
    text = text.replace("\u00a0", " ")
    return text


def normalize_skill_name(value: str) -> str:
    """Normalize a candidate skill name for display and validation."""

    text = clean_wikitext_text(value)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    return text.strip(" \t\r\n|=-—*#:;[]{}<>\"'")


def is_generic_skill_name(name: str | None) -> bool:
    """Return True when the value names the slot instead of the skill."""

    if not name:
        return True
    normalized = normalize_skill_name(name)
    if not normalized:
        return True
    collapsed = normalized.replace(" ", "").lower()
    if collapsed in GENERIC_SKILL_NAMES:
        return True
    for labels in SKILL_TYPE_LABELS.values():
        for label in labels:
            if collapsed == label.lower():
                return True
    # "战技名称" style keys that leaked into a value.
    if any(collapsed == f"{label}名称" for labels in SKILL_TYPE_LABELS.values() for label in labels):
        return True
    return False


def _is_plausible_skill_name(name: str) -> bool:
    if is_generic_skill_name(name):
        return False
    stripped = name.strip()
    if len(stripped) > MAX_SKILL_NAME_LENGTH:
        return False
    if not any(character.isalnum() or "\u4e00" <= character <= "\u9fff" for character in stripped):
        return False
    # A sentence is a description, not a name.
    if any(mark in stripped for mark in ("。", "\n")):
        return False
    # Skill names may contain digits/greek letters but never wiki syntax.
    if any(mark in stripped for mark in ("{", "}", "[[", "]]", "|", "=")):
        return False
    return True


def _skill_type_from_label(value: str | None) -> str | None:
    """Map a short wikitext label such as ``战技名称`` to a skill type."""

    if not value:
        return None
    cleaned = normalize_skill_name(value)
    if not cleaned or len(cleaned) > 10:
        return None
    collapsed = cleaned.replace(" ", "")
    for skill_type, labels in SKILL_TYPE_LABELS.items():
        for label in labels:
            if label in collapsed:
                return skill_type
    return None


# ---------------------------------------------------------------------------
# HTTP access
# ---------------------------------------------------------------------------


def build_raw_url(page_title: str, *, endpoint: str = BWIKI_RAW_ENDPOINT) -> str:
    """Build the MediaWiki ``action=raw`` URL for a page title."""

    return f"{endpoint}?{urlencode({'title': page_title, 'action': 'raw'})}"


def build_raw_request_headers(
    *,
    user_agent: str = BWIKI_USER_AGENT,
    referer: str = BWIKI_REFERER,
    accept: str = BWIKI_ACCEPT,
) -> dict[str, str]:
    """Headers required by BWiki: an explicit User-Agent and a same-site Referer."""

    return {
        "User-Agent": user_agent,
        "Referer": referer,
        "Accept": accept,
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7",
    }


def default_open(
    url: str,
    headers: Mapping[str, str],
    *,
    timeout: float = 25.0,
) -> tuple[int, bytes]:
    """Default opener using urllib. Injectable so tests never touch the network."""

    request = Request(url, headers=dict(headers))
    try:
        with urlopen(request, timeout=timeout) as response:
            return int(response.status), response.read()
    except HTTPError as exc:
        body = exc.read()
        return int(exc.code), body or b""


def fetch_raw_wikitext(
    page_title: str,
    *,
    opener: PageOpener | None = None,
    user_agent: str = BWIKI_USER_AGENT,
    referer: str = BWIKI_REFERER,
    timeout: float = 25.0,
    endpoint: str = BWIKI_RAW_ENDPOINT,
) -> RawWikiPage:
    """Fetch ``action=raw`` wikitext for ``page_title``.

    Raises :class:`WikiPageMissingError` for missing/empty pages and
    :class:`WikiFetchError` for any other unusable response.
    """

    url = build_raw_url(page_title, endpoint=endpoint)
    headers = build_raw_request_headers(user_agent=user_agent, referer=referer)
    open_page = opener or default_open
    try:
        status, body = open_page(url, headers, timeout=timeout)
    except BWikiError:
        raise
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise WikiFetchError(f"{page_title}: 抓取失敗 {exc} ({url})") from exc
    except Exception as exc:  # noqa: BLE001 - injected openers may raise anything
        raise WikiFetchError(f"{page_title}: 抓取失敗 {exc} ({url})") from exc

    status = int(status)
    text = (
        bytes(body).decode("utf-8", errors="replace")
        if isinstance(body, (bytes, bytearray))
        else str(body)
    )
    if status == 404:
        raise WikiPageMissingError(page_title, url, "HTTP 404，頁面不存在")
    if status != 200:
        raise WikiFetchError(f"{page_title}: HTTP {status} ({url})")
    if not text.strip():
        raise WikiPageMissingError(page_title, url, "回應為空，頁面不存在或尚無內容")
    return RawWikiPage(page_title=page_title, url=url, status=status, wikitext=text)


# ---------------------------------------------------------------------------
# Wikitext structure parsers
# ---------------------------------------------------------------------------


@dataclass
class _Candidate:
    name: str
    description: str | None
    description_raw: str | None
    raw_block: str
    variant: str | None = None


_PARAM_KEY_RE = re.compile(r"^[^|=\n{}<>\[\]]{1,40}$")


def _split_top_level(text: str, separator: str = "|") -> list[str]:
    """Split ``text`` on ``separator`` outside nested templates and links."""

    parts: list[str] = []
    stack: list[str] = []
    current: list[str] = []
    index = 0
    length = len(text)
    while index < length:
        if text.startswith("{{", index):
            stack.append("}}")
            current.append("{{")
            index += 2
            continue
        if text.startswith("[[", index):
            stack.append("]]")
            current.append("[[")
            index += 2
            continue
        if stack and text.startswith(stack[-1], index):
            current.append(stack.pop())
            index += 2
            continue
        if not stack and text.startswith(separator, index):
            parts.append("".join(current))
            current = []
            index += len(separator)
            continue
        current.append(text[index])
        index += 1
    parts.append("".join(current))
    return parts


def _iter_template_bodies(wikitext: str) -> list[str]:
    """Return the body of every outermost ``{{...}}`` block."""

    bodies: list[str] = []
    depth = 0
    start = -1
    index = 0
    length = len(wikitext)
    while index < length:
        if wikitext.startswith("{{", index):
            if depth == 0:
                start = index + 2
            depth += 1
            index += 2
            continue
        if wikitext.startswith("}}", index) and depth:
            depth -= 1
            if depth == 0:
                bodies.append(wikitext[start:index])
            index += 2
            continue
        index += 1
    if depth and start >= 0:
        bodies.append(wikitext[start:])
    return bodies


def _iter_template_params(wikitext: str) -> list[tuple[str, str, str]]:
    """Return ``(key, value, raw_block)`` for every template parameter.

    Splitting happens on top-level ``|`` characters only, so single-line
    templates such as ``{{干员|战技名称=归穹宇}}`` and multi-line templates
    behave the same, and ``|`` characters nested in another template (for
    example ``{{颜色|蓝|支援晶体}}``) never split a value apart.
    """

    params: list[tuple[str, str, str]] = []
    for body in _iter_template_bodies(wikitext):
        segments = _split_top_level(body)
        current_key: str | None = None
        current_value = ""
        continuation = ""

        def flush() -> None:
            if current_key is None:
                return
            params.append(
                (
                    current_key,
                    (current_value + continuation).strip(),
                    f"|{current_key}={current_value}{continuation}",
                )
            )

        for position, segment in enumerate(segments):
            candidate_key, separator, candidate_value = segment.partition("=")
            stripped_key = candidate_key.strip()
            is_param = bool(separator) and bool(_PARAM_KEY_RE.match(stripped_key))
            if position == 0 and not is_param:
                # The first segment is the template name (plus any page prose a
                # bulleted template keeps there), never a value.
                continue
            if is_param:
                flush()
                current_key = stripped_key
                current_value = candidate_value
                continuation = ""
                continue
            continuation += f"|{segment}"
        flush()
    return params


def _split_template_key(key: str) -> tuple[str, str | None]:
    """Split ``战技名称_智`` into ``("战技名称", "智")``."""

    if "_" not in key:
        return key, None
    base, _, suffix = key.partition("_")
    return base.strip(), suffix.strip() or None


def _parse_template_skills(wikitext: str) -> tuple[dict[str, list[_Candidate]], list[str]]:
    """Parse ``{{干员|战技名称=...}}`` style parameters."""

    warnings: list[str] = []
    found: dict[str, list[_Candidate]] = {}
    descriptions: dict[tuple[str, str | None], str] = {}

    for key, value, raw_block in _iter_template_params(wikitext):
        base_key, variant = _split_template_key(key)
        for skill_type, name_keys in TEMPLATE_NAME_KEYS.items():
            if base_key not in name_keys:
                continue
            found.setdefault(skill_type, []).append(
                _Candidate(
                    name=value,
                    description=None,
                    description_raw=None,
                    raw_block=raw_block,
                    variant=variant,
                )
            )
        for skill_type, description_keys in TEMPLATE_DESCRIPTION_KEYS.items():
            if base_key in description_keys and value:
                descriptions.setdefault((skill_type, variant), value)

    for skill_type, candidates in found.items():
        for candidate in candidates:
            description = descriptions.get((skill_type, candidate.variant))
            if description is None:
                description = descriptions.get((skill_type, None))
            if description:
                candidate.description_raw = description
                candidate.description = clean_wikitext_text(description)

    for skill_type in SKILL_TYPES:
        if found.get(skill_type):
            continue
        if any(key[0] == skill_type for key in descriptions):
            warnings.append(
                f"{skill_type}: 找到{SKILL_TYPE_LABELS[skill_type][0]}描述，"
                f"但沒有對應的名稱參數。"
            )
    return found, warnings


def _strip_cell_attributes(cell: str) -> str:
    if "|" not in cell:
        return cell
    head, _, tail = cell.rpartition("|")
    if "=" in head and ("\"" in head or "'" in head or ":" in head):
        return tail
    return cell


def _split_row_cells(line: str) -> list[str]:
    stripped = line.strip()
    if not stripped or stripped.startswith("|-") or stripped.startswith("|}"):
        return []
    if stripped.startswith("|+"):
        return []
    marker = stripped[0]
    if marker not in "|!":
        return []
    body = stripped[1:]
    cells = re.split(r"\|\||!!", body)
    return [_strip_cell_attributes(cell.strip()) for cell in cells if cell.strip()]


def _iter_table_blocks(wikitext: str) -> list[str]:
    # ``\n`` before the closing ``|}`` is optional: single-line tables and
    # tables whose last row has trailing whitespace are valid wikitext too.
    return re.findall(r"\{\|(.*?)\|\}", wikitext, flags=re.S)


def _parse_table_skills(wikitext: str) -> dict[str, list[_Candidate]]:
    """Parse wikitables that list skills either per row or per typed column."""

    found: dict[str, list[_Candidate]] = {}
    for block in _iter_table_blocks(wikitext):
        column_map: dict[int, str] = {}
        for chunk in re.split(r"^\s*\|-+.*$", block, flags=re.M):
            header_cells: list[str] = []
            data_cells: list[str] = []
            for line in chunk.splitlines():
                stripped = line.strip()
                if not stripped:
                    continue
                if stripped.startswith("!"):
                    header_cells.extend(_split_row_cells(stripped))
                elif stripped.startswith("|"):
                    data_cells.extend(_split_row_cells(stripped))

            if header_cells:
                mapping = {}
                for index, cell in enumerate(header_cells):
                    skill_type = _skill_type_from_label(cell)
                    if skill_type:
                        mapping[index] = skill_type
                if len(mapping) >= 2:
                    column_map = mapping

            if not data_cells:
                continue

            row_label_handled = False
            for index, cell in enumerate(data_cells):
                skill_type = _skill_type_from_label(cell)
                if not skill_type or index + 1 >= len(data_cells):
                    continue
                name_raw = data_cells[index + 1]
                description_raw = data_cells[index + 2] if index + 2 < len(data_cells) else None
                found.setdefault(skill_type, []).append(
                    _Candidate(
                        name=name_raw,
                        description=clean_wikitext_text(description_raw) if description_raw else None,
                        description_raw=description_raw,
                        raw_block=f"| {cell} || {name_raw}",
                    )
                )
                row_label_handled = True
                break
            if row_label_handled or not column_map:
                continue
            if any(_skill_type_from_label(cell) for cell in data_cells):
                continue
            for index, skill_type in column_map.items():
                if index >= len(data_cells):
                    continue
                name_raw = data_cells[index]
                found.setdefault(skill_type, []).append(
                    _Candidate(
                        name=name_raw,
                        description=None,
                        description_raw=None,
                        raw_block=" | ".join(data_cells),
                    )
                )
    return found


_HEADING_RE = re.compile(r"^(={2,6})\s*(.*?)\s*\1\s*$")
_LABEL_VALUE_RE = re.compile(r"^(?P<label>[^:：=]{1,12}?)\s*[:：＝=]\s*(?P<value>.+)$")


def _parse_section_skills(wikitext: str) -> dict[str, list[_Candidate]]:
    """Parse ``=== 战技 ===`` headings followed by a bolded skill name."""

    found: dict[str, list[_Candidate]] = {}
    pending: str | None = None
    pending_heading = ""

    for line in wikitext.splitlines():
        stripped = line.strip()
        match = _HEADING_RE.match(stripped)
        if match:
            pending_heading = match.group(2)
            pending = _skill_type_from_label(pending_heading)
            if pending:
                inline = _LABEL_VALUE_RE.match(normalize_skill_name(pending_heading))
                if inline and _skill_type_from_label(inline.group("label")):
                    found.setdefault(pending, []).append(
                        _Candidate(
                            name=inline.group("value"),
                            description=None,
                            description_raw=None,
                            raw_block=stripped,
                        )
                    )
                    pending = None
                continue
            continue
        if pending is None:
            continue
        if not stripped or stripped.startswith(("|", "{", "}", "[", "!")):
            continue
        candidate = _Candidate(
            name=normalize_skill_name(stripped),
            description=None,
            description_raw=stripped,
            raw_block=f"{pending_heading} -> {stripped}",
        )
        if _is_plausible_skill_name(candidate.name):
            found.setdefault(pending, []).append(candidate)
        pending = None
    return found


def _parse_list_skills(wikitext: str) -> dict[str, list[_Candidate]]:
    """Parse ``; 战技 : 归穹宇`` and ``* 战技：归穹宇`` style lines."""

    found: dict[str, list[_Candidate]] = {}
    for line in wikitext.splitlines():
        stripped = line.strip()
        if not stripped or stripped[0] in "|{}[":
            continue
        body = stripped.lstrip("*#:;").strip()
        if not body:
            continue
        match = _LABEL_VALUE_RE.match(normalize_skill_name(body))
        if not match:
            continue
        skill_type = _skill_type_from_label(match.group("label"))
        if not skill_type:
            continue
        found.setdefault(skill_type, []).append(
            _Candidate(
                name=match.group("value"),
                description=None,
                description_raw=None,
                raw_block=stripped,
            )
        )
    return found


# ---------------------------------------------------------------------------
# Public parsing API
# ---------------------------------------------------------------------------


_STRUCTURE_PRIORITY: tuple[str, ...] = ("template", "table", "section", "list")


def parse_character_skills(
    wikitext: str,
    *,
    character_key: str | None = None,
    page_title: str | None = None,
    source_url: str | None = None,
    source_id: str | None = BWIKI_SOURCE_ID,
) -> SkillParseResult:
    """Extract battle/combo/ultimate names from one character page wikitext."""

    result = SkillParseResult(
        character_key=character_key,
        page_title=page_title,
        source_url=source_url,
        source_id=source_id,
    )

    if not wikitext or not wikitext.strip():
        for skill_type in SKILL_TYPES:
            result.missing[skill_type] = "wikitext 為空，無法解析角色技能名稱"
        return result

    template_candidates, template_warnings = _parse_template_skills(wikitext)
    parsed: dict[str, dict[str, list[_Candidate]]] = {
        "template": template_candidates,
        "table": _parse_table_skills(wikitext),
        "section": _parse_section_skills(wikitext),
        "list": _parse_list_skills(wikitext),
    }
    result.warnings.extend(template_warnings)

    # Template parameters can repeat per form (战技名称_智 / 战技名称_意), so keep
    # the full ordered candidate list per skill type.
    winners: dict[str, tuple[str, _Candidate]] = {}
    descriptions: dict[str, _Candidate] = {}

    for structure in _STRUCTURE_PRIORITY:
        for skill_type in SKILL_TYPES:
            candidates = [
                candidate
                for candidate in parsed[structure].get(skill_type, [])
                if _is_plausible_skill_name(normalize_skill_name(candidate.name))
            ]
            if not candidates:
                continue
            if skill_type not in winners:
                winners[skill_type] = (structure, candidates[0])
                for candidate in candidates:
                    if candidate.description and skill_type not in descriptions:
                        descriptions[skill_type] = candidate
                if len(candidates) > 1 and structure == "template":
                    variants = [normalize_skill_name(item.name) for item in candidates]
                    if len(set(variants)) > 1:
                        result.warnings.append(
                            f"{skill_type}: 偵測到多形態技能名稱（{' / '.join(variants)}），"
                            "請確認要顯示的形態。"
                        )
                continue
            existing_structure, existing = winners[skill_type]
            existing_name = normalize_skill_name(existing.name)
            for candidate in candidates:
                candidate_name = normalize_skill_name(candidate.name)
                if candidate_name == existing_name:
                    continue
                result.warnings.append(
                    f"{skill_type}: 名稱衝突，{existing_structure}「{existing_name}」"
                    f" vs {structure}「{candidate_name}」，採用 {existing_structure}。"
                )

    for skill_type in SKILL_TYPES:
        if skill_type not in winners:
            continue
        structure, candidate = winners[skill_type]
        name = normalize_skill_name(candidate.name)
        description_raw = candidate.description_raw
        description = candidate.description
        if not description and skill_type in descriptions:
            fallback = descriptions[skill_type]
            description_raw = fallback.description_raw
            description = fallback.description or clean_wikitext_text(fallback.description_raw or "")
        if description is None and description_raw:
            description = clean_wikitext_text(description_raw)
        variants: list[SkillVariant] = []
        if structure == "template":
            for item in parsed["template"].get(skill_type, []):
                item_name = normalize_skill_name(item.name)
                if not _is_plausible_skill_name(item_name):
                    continue
                label = item.variant or _template_variant_label(wikitext, item_name)
                variants.append(
                    SkillVariant(
                        label=label or "default",
                        name=item_name,
                        description=item.description
                        or (clean_wikitext_text(item.description_raw) if item.description_raw else None),
                        description_raw=item.description_raw,
                    )
                )
        result.skills[skill_type] = ParsedSkill(
            character_key=character_key,
            skill_type=skill_type,
            name=name,
            structure=structure,
            source_url=source_url,
            description=description,
            description_raw=description_raw,
            raw_block=candidate.raw_block,
            variants=variants,
        )

    for skill_type in SKILL_TYPES:
        if skill_type in result.skills:
            continue
        result.missing[skill_type] = _missing_reason(skill_type, parsed)
    return result


def _template_variant_label(wikitext: str, name: str) -> str | None:
    for key, value, _raw in _iter_template_params(wikitext):
        base_key, variant = _split_template_key(key)
        if variant and value.strip() == name:
            _ = base_key
            return variant
    return None


def _missing_reason(skill_type: str, parsed: dict[str, dict[str, list[_Candidate]]]) -> str:
    label = SKILL_TYPE_LABELS[skill_type][0]
    for structure in _STRUCTURE_PRIORITY:
        candidates = parsed[structure].get(skill_type)
        if not candidates:
            continue
        values = [normalize_skill_name(candidate.name) for candidate in candidates]
        named = [value for value in values if value]
        if not named:
            return f"{structure} 結構中「{label}」欄位為空"
        joined = "、".join(named)
        if all(is_generic_skill_name(value) for value in named):
            return f"{structure} 結構中僅有通用詞「{joined}」，不是角色專屬名稱"
        return f"{structure} 結構中的「{label}」值無法作為技能名稱：{joined}"
    return f"wikitext 未提供「{label}」的模板參數、表格、章節或列表資料"


def bwiki_source_record() -> dict[str, Any]:
    """Source record to publish alongside BWiki-derived values."""

    return {
        "id": BWIKI_SOURCE_ID,
        "title": "終末地 BWiki 幹員技能頁",
        "publisher": "BWiki (biligame) 社群編輯",
        "url": f"{BWIKI_SITE}/",
        "sourceType": "community-database",
        "trustLevel": "community-secondary",
        "isOfficial": False,
        "fields": [
            "character.skills.battle.name",
            "character.skills.combo.name",
            "character.skills.ultimate.name",
        ],
        "notes": [
            "Community-maintained wiki. Skill names are community-secondary data.",
            "Only the raw wikitext of each character page is parsed; values are never inferred.",
        ],
        "required": False,
    }


def to_override_entries(
    result: SkillParseResult,
    *,
    include_descriptions: bool = True,
) -> dict[str, dict[str, Any]]:
    """Convert a parse result into ``reviewed_overrides``-style entries."""

    entries: dict[str, dict[str, Any]] = {}
    for skill_type, skill in result.skills.items():
        entry: dict[str, Any] = {"name": skill.name}
        if include_descriptions and skill.description:
            entry["description"] = skill.description
        entry["sourceIds"] = [result.source_id] if result.source_id else []
        entries[skill_type] = entry
    return entries


def fetch_character_skills(
    page_title: str,
    *,
    character_key: str | None = None,
    opener: PageOpener | None = None,
    source_id: str | None = BWIKI_SOURCE_ID,
    user_agent: str = BWIKI_USER_AGENT,
    referer: str = BWIKI_REFERER,
    timeout: float = 25.0,
    endpoint: str = BWIKI_RAW_ENDPOINT,
) -> SkillParseResult:
    """Fetch and parse one character page, reporting failures as missing data."""

    url = build_raw_url(page_title, endpoint=endpoint)
    try:
        page = fetch_raw_wikitext(
            page_title,
            opener=opener,
            user_agent=user_agent,
            referer=referer,
            timeout=timeout,
            endpoint=endpoint,
        )
    except WikiPageMissingError as exc:
        result = SkillParseResult(
            character_key=character_key,
            page_title=page_title,
            source_url=exc.url or url,
            source_id=source_id,
        )
        for skill_type in SKILL_TYPES:
            result.missing[skill_type] = f"頁面缺失：{exc.reason}"
        result.warnings.append(f"{page_title}: {exc.reason}")
        return result
    except WikiFetchError as exc:
        result = SkillParseResult(
            character_key=character_key,
            page_title=page_title,
            source_url=url,
            source_id=source_id,
        )
        for skill_type in SKILL_TYPES:
            result.missing[skill_type] = "抓取失敗，無法取得頁面內容"
        result.warnings.append(str(exc))
        return result

    return parse_character_skills(
        page.wikitext,
        character_key=character_key,
        page_title=page_title,
        source_url=page.url,
        source_id=source_id,
    )


def collect_character_skills(
    page_titles: Mapping[str, str] | None = None,
    *,
    opener: PageOpener | None = None,
    source_id: str | None = BWIKI_SOURCE_ID,
    user_agent: str = BWIKI_USER_AGENT,
    referer: str = BWIKI_REFERER,
    timeout: float = 25.0,
    endpoint: str = BWIKI_RAW_ENDPOINT,
    titles: Sequence[str] | None = None,
) -> dict[str, SkillParseResult]:
    """Fetch several character pages. ``page_titles`` maps character key to title."""

    if page_titles is None:
        page_titles = dict(CHARACTER_PAGE_TITLES)
    results: dict[str, SkillParseResult] = {}
    for character_key, page_title in page_titles.items():
        results[character_key] = fetch_character_skills(
            page_title,
            character_key=character_key,
            opener=opener,
            source_id=source_id,
            user_agent=user_agent,
            referer=referer,
            timeout=timeout,
            endpoint=endpoint,
        )
    if titles:
        for title in titles:
            results[f"title:{title}"] = fetch_character_skills(
                title,
                character_key=None,
                opener=opener,
                source_id=source_id,
                user_agent=user_agent,
                referer=referer,
                timeout=timeout,
                endpoint=endpoint,
            )
    return results
