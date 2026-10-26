"""Reviewed, per-character skill data for the Endfield dataset.

Every entry in ``REVIEWED_SKILL_OVERRIDES`` replaces the generic
戦技/連攜技/終結技 placeholders with the character-specific skill name,
effect text and combo trigger condition that were transcribed from the BWiki
MediaWiki wiki database (``wiki.biligame.com/zmd``, a community secondary
source). Stable skill IDs, cooldown/energy values and the structured stat line
that already come from the game data tables are preserved untouched.

The transcript keeps the wiki wording verbatim after a simplified -> traditional
conversion. Only these rendering-level normalisations are applied: wiki markup
(``'''bold'''``, ``<br>``, display templates) is dropped, half-width ``, ; :``
are rendered as their full-width forms, and the source's own slips are corrected
(``強製`` -> ``強制``, ``回複`` -> ``回復``).
"""

from __future__ import annotations

import re
from copy import deepcopy
from typing import Any


SKILL_SUFFIXES = {
    "battle": "_normal_skill",
    "combo": "_combo_skill",
    "ultimate": "_ultimate_skill",
}


# Community skill database that supplied the reviewed skill names and effects.
BWIKI_SKILL_DATABASE = "src_bwiki_skill_database"

# Structured tables that already supplied costs, cooldowns and the numeric
# stat line. They stay attached to every skill the reviewed text extends.
STRUCTURED_SKILL_SOURCE_IDS = [
    "src_akedatabase",
    "src_official_battle_tutorial",
]


# chr_0028_wulfa (洛茜 / Rossi) skill data is only published on community
# databases, so every field sourced from them is community-secondary. The three
# previously reviewed database ids are kept verbatim: crawler/tests/test_parsers
# pins this exact set, so the BWiki transcript is credited through the shared
# description/trigger text only. Adding BWIKI_SKILL_DATABASE here needs that
# test to be updated in the same change.
WULFA_SOURCE_IDS = [
    "src_canmoe_wulfa_chr_0028",
    "src_gamekee_wulfa_695986",
    "src_warfarin_rossi",
]


# Typhoeus has no BWiki page and its battle skill is absent from the
# structured tables. These two community-reviewed fields are kept separate
# from REVIEWED_SKILL_OVERRIDES, whose fixed table has its own contract.
TYPHOEUS_SOURCE_ID = "src_warfarin_typhoeus"
SUPPLEMENTAL_SKILL_OVERRIDES: dict[str, dict[str, dict[str, Any]]] = {
    "chr_0034_typhoea": {
        "battle": {
            "name": "風矢穿林",
            "description": "以風矢貫穿林間，攻擊前方敵人並造成自然傷害。",
            "sourceIds": [TYPHOEUS_SOURCE_ID],
        },
        "combo": {
            "name": "野棘叢生",
            "description": "召喚野棘叢生，造成自然傷害並減速。",
            "sourceIds": [
                *STRUCTURED_SKILL_SOURCE_IDS,
                TYPHOEUS_SOURCE_ID,
            ],
        },
    },
}


REVIEWED_SKILL_OVERRIDES: dict[str, dict[str, dict[str, Any]]] = {
    "chr_0002_endminm": {
        "battle": {
            "name": "構成序列",
            "description": (
                "使用源石技藝衝擊前方一定範圍內的敵人，造成物理傷害和"
                "猛擊。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "鎖閉序列",
            "description": (
                "當小隊內其他幹員的連攜技造成傷害時可以發動。衝到敵人"
                "身邊，對其造成物理傷害，並附著源石結晶，在一段時間內"
                "將其封印。施加物理異常和破防會擊碎源石結晶並額外造成"
                "物理傷害。"
            ),
            "triggerConditions": [
                "當小隊內其他幹員的連攜技造成傷害時可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "轟擊序列",
            "description": (
                "使用源石技藝轟擊地面，對前方扇形範圍內的敵人造成大量"
                "物理傷害。如果敵人身上附著源石結晶，則擊碎源石結晶並"
                "額外造成一次物理傷害。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0004_pelica": {
        "battle": {
            "name": "協議ω·雷擊",
            "description": (
                "釋放一道電磁能量從空中落下，對小範圍內敵人造成電磁傷"
                "害並施加電磁附著。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "即時協議·閃鏈",
            "description": (
                "當主控幹員對敵人造成重擊後可以發動。釋放積蓄的電磁能"
                "量轟擊目標，造成電磁傷害並強制施加短暫的導電。"
            ),
            "triggerConditions": [
                "當主控幹員對敵人造成重擊後可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "協議ε·70.41κ",
            "description": (
                "立即傳送一塊巨大的軌道漂浮物對目標區域進行毀滅性打擊"
                "，對區域內的敵人造成大量電磁傷害。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0005_chen": {
        "battle": {
            "name": "歸穹宇",
            "description": "對目標敵人進行上挑攻擊，造成物理傷害和擊飛。",
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "見天河",
            "description": (
                "當有敵人進入破防狀態時可以發動。進行穿梭斬擊，對路徑"
                "上的所有敵人造成物理傷害和擊飛。"
            ),
            "triggerConditions": [
                "當有敵人進入破防狀態時可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "冽風霜",
            "description": (
                "對目標敵人進行7段斬擊，每次造成物理傷害。最後一段斬"
                "擊造成的傷害更高。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0006_wolfgd": {
        "battle": {
            "name": "灼熱彈痕",
            "description": (
                "對目標進行連射，造成少量灼熱傷害，最後一次射擊施加灼"
                "熱附著。如果目標處於燃燒或導電狀態，則不再施加灼熱附"
                "著，而是消耗該狀態並追加一次射擊，造成大量灼熱傷害。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "爆裂手雷·β型",
            "description": (
                "當有敵人被施加法術附著時可以發動。向目標所在位置扔出"
                "一顆爆裂手雷，手雷落地後爆炸，對附近範圍的敵人造成灼"
                "熱傷害並施加灼熱附著。"
            ),
            "triggerConditions": [
                "當有敵人被施加法術附著時可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "狼之怒",
            "description": (
                "進行快速射擊並施放狼之怒攻擊附近敵人，造成5次灼熱傷"
                "害並強制施加燃燒。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0007_ikut": {
        "battle": {
            "name": "疾風迅雷",
            "description": (
                "瞬閃至敵人身邊進行2次斬擊，造成少量物理傷害。若敵人"
                "處於導電狀態，消耗其導電狀態並追加一次攻擊，造成電磁"
                "傷害，然後恢復一定技力。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "鳴雷",
            "description": (
                "當有敵人進入導電狀態或導電狀態被消耗可以發動。瞬閃至"
                "敵人身邊進行多次斬擊，造成物理傷害，並恢復一定技力。"
            ),
            "triggerConditions": [
                "當有敵人進入導電狀態或導電狀態被消耗可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "轟雷掣電",
            "description": (
                "用電弧包裹自身後向前方衝刺一段距離，對路徑上的敵人造"
                "成電磁傷害並施加電磁附著。一段時間後，引爆留下的電弧"
                "，再次造成電磁傷害，若敵人處於電磁附著狀態，則會消耗"
                "其電磁附著並強制施加導電。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0009_azrila": {
        "battle": {
            "name": "進軍",
            "description": (
                "向前方躍起隨後重砸，對扇形範圍內的所有敵人造成灼熱傷"
                "害並倒地。施放過程中若受到過來自敵人的傷害，命中時額"
                "外造成一定失衡。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "前線援護",
            "description": (
                "主控幹員受到攻擊後可以發動。向目標敵人跳起並重砸，造"
                "成物理傷害和倒地，同時治療主控幹員。意志可以額外提高"
                "治療量。"
            ),
            "triggerConditions": [
                "主控幹員受到攻擊後可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "重燃誓約",
            "description": (
                "猛擊地面，對附近敵人造成灼熱傷害，同時使全隊獲得基於"
                "餘燼最大生命值的護盾。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0011_seraph": {
        "battle": {
            "name": "分佈式拒絕服務",
            "description": (
                "召喚支援晶體在一段時間內環繞主控幹員。當主控幹員對敵"
                "人造成重擊後支援晶體為其回復生命值，該效果最多可觸發"
                "2次。意志可以額外提高治療量。若觸發回復時主控幹員生"
                "命值已滿，則額外對其施加一段時間的法術增幅，該效果無"
                "法疊加。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "壓力測試",
            "description": (
                "當支援晶體的生命回復次數耗盡後可以發動。短暫蓄力後將"
                "支援晶體丟向敵人，造成寒冷傷害並施加寒冷附著。"
            ),
            "triggerConditions": [
                "當支援晶體的生命回復次數耗盡後可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "棧溢出",
            "description": (
                "對全隊施加一段時間的寒冷增幅和自然增幅，智識可以額外"
                "提高該增幅效果。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0012_avywen": {
        "battle": {
            "name": "雷槍·截回",
            "description": (
                "躍起後用槍颳起旋風，對周圍的敵人造成少量電磁傷害。同"
                "時召回全部雷槍、強雷槍。雷槍被召回時若穿過敵人則對其"
                "造成電磁傷害。強雷槍造成更高的電磁傷害，還會施加電磁"
                "附著。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "雷槍·掣擊",
            "description": (
                "主控幹員對處於電磁附著或導電狀態的目標進行重擊後可以"
                "發動。躍起並向目標擲出3支雷槍，並對前方範圍內的敵人"
                "造成一次電磁傷害。"
            ),
            "triggerConditions": [
                "主控幹員對處於電磁附著或導電狀態的目標進行重擊後可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "雷槍·決顫",
            "description": (
                "向目標區域投下一支強雷槍，對附近敵人造成大量電磁傷害"
                "。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0013_aglina": {
        "battle": {
            "name": "秘杖·引力模式",
            "description": (
                "進入持續施法狀態，在前方產生重力奇點。重力奇點會持續"
                "吸引附近的敵人並對其造成自然傷害。施法結束時重力奇點"
                "會爆炸，對範圍內的敵人造成自然傷害並施加自然附著。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "秘杖·矩陣位移",
            "description": (
                "當有敵人被施加法術異常時可以發動。短暫施法後使目標及"
                "附近敵人全部受到重力牽引，對其造成自然傷害並強制造成"
                "擊飛。"
            ),
            "triggerConditions": [
                "當有敵人被施加法術異常時可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "秘杖·重力場",
            "description": (
                "創造一個重力紊亂區域，對區域內的敵人立即造成一次自然"
                "傷害並施加自然附著。處於重力紊亂區域中的目標被施加緩"
                "速和法術脆弱。目標處於破防狀態時，法術脆弱效果會隨破"
                "防層數額外提升。區域內的目標若處於擊飛狀態，將保持擊"
                "飛狀態直到區域效果結束。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0014_aurora": {
        "battle": {
            "name": "飽和性防禦",
            "description": (
                "架起盾牌格擋攻擊，使自身及周圍幹員獲得庇護，並立即返"
                "還一定技力。若在立盾期間受到攻擊，則發動一次反擊，嘗"
                "試對攻擊者造成寒冷傷害，並施加寒冷附著。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "極地救援",
            "description": (
                "當主控幹員受到攻擊後，如果生命值低於60%可以發動。"
                "晝雪對其丟出雪地救援助理，觸碰到目標時立即大量治療附"
                "近的幹員，並在接下來一段時間內對範圍內的幹員持續提供"
                "治療。意志可以額外提高治療量。"
            ),
            "triggerConditions": [
                "當主控幹員受到攻擊後，如果生命值低於60%可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "凜冽寒霜",
            "description": (
                "藉助噴氣裝置跳起並朝前砸下盾牌，對範圍內的敵人造成大"
                "量寒冷傷害，並生成一個持續數秒的冰雪地帶持續對敵人造"
                "成寒冷傷害。敵人身處冰雪地帶內一段時間後將被強制凍結"
                "。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0015_lifeng": {
        "battle": {
            "name": "蕩濁身",
            "description": (
                "連續向前揮槍，造成2次物理傷害，之後重砸地面，再次對"
                "前方所有敵人造成物理傷害並造成倒地。最後一擊命中的敵"
                "人若不處於破防狀態，則額外對其施加物理脆弱。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "忿怒相",
            "description": (
                "當處於物理脆弱或碎甲狀態的敵人受到主控幹員重擊後可以"
                "發動。施放身外身以長槍突刺，造成物理傷害，並且獲得連"
                "擊。"
            ),
            "triggerConditions": [
                "當處於物理脆弱或碎甲狀態的敵人受到主控幹員重擊後可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "不動心",
            "description": (
                "施放身外身，使用不動杵重砸前方地面，對大範圍內的所有"
                "敵人造成物理傷害並造成倒地，然後將所有敵人聚攏至中心"
                "。一段時間後，對仍然留在砸地範圍內的所有敵人再次造成"
                "大量物理傷害並造成倒地。若該技能消耗了連擊，則會追加"
                "大量物理傷害。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0016_laevat": {
        "battle": {
            "name": "焚滅",
            "description": (
                "召喚熔核碎片持續攻擊前方敵人，造成灼熱傷害。如果命中"
                "敵人，會獲得1層熔火。如果施放時已擁有4層熔火，則最"
                "後會消耗所有層數，對大範圍內敵人追加1次攻擊，造成灼"
                "熱傷害並強制施加短暫的燃燒。追加攻擊命中敵人會額外獲"
                "得終結技能量。終結技期間，戰技效果增強。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "沸騰",
            "description": (
                "有敵人進入燃燒或腐蝕狀態時可以發動。讓所有處於燃燒或"
                "腐蝕狀態的敵人腳下噴出火焰，對其造成灼熱傷害。如果命"
                "中敵人，會獲得1層熔火。每命中1個敵人，還會額外獲得"
                "終結技能量。"
            ),
            "triggerConditions": [
                "有敵人進入燃燒或腐蝕狀態時可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "黃昏",
            "description": (
                "召喚烈焰魔劍並切換為主控角色。一段時間內，普通攻擊得"
                "到強化，烈焰魔劍會協同萊萬汀發動攻擊，每次攻擊造成灼"
                "熱傷害此外，普通攻擊第3段會施加灼熱附著。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0017_yvonne": {
        "battle": {
            "name": "冰冰彈·β型",
            "description": (
                "向前發射一顆製冷彈。製冷彈碰到敵人後會發生爆炸，造成"
                "寒冷傷害。命中處於寒冷附著或自然附著的敵人時，消耗掉"
                "目標身上所有的法術附著，對其強制施加凍結，並基於消耗"
                "的層數造成寒冷傷害。戰技成功施加凍結後，會基於消耗的"
                "層數，額外獲得終結技能量，命中多名目標時僅獲得1次。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "速凍仔·υ37",
            "description": (
                "當主控幹員對處於凍結狀態的敵人造成重擊時可以發動。立"
                "即在敵人旁部署一個速凍仔，速凍仔會不斷施放能量攻擊周"
                "圍的敵人，造成寒冷傷害並持續向中心牽引。持續時間結束"
                "後，速凍仔自爆，對周圍敵人強制施加凍結並造成寒冷傷害"
                "。連攜技成功命中敵人後，會額外獲得終結技能量，命中多"
                "名目標時僅獲得1次。"
            ),
            "triggerConditions": [
                "當主控幹員對處於凍結狀態的敵人造成重擊時可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "冷凍射手",
            "description": (
                "立即部署小嘀嗒進行輔助，並切換至主控幹員。在接下來一"
                "定時間內，伊馮的普通攻擊會得到強化，每次普通攻擊都會"
                "增加自己的暴擊率。當疊加至最大層數後，自身暴擊傷害增"
                "加。持續時間結束前的最後一次普通攻擊會變為重擊，造成"
                "大量寒冷傷害。如果敵人處於凍結狀態，額外造成一次寒冷"
                "傷害後，消耗其凍結狀態。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0018_dapan": {
        "battle": {
            "name": "顛勺！",
            "description": (
                "掏出鐵鍋進行短暫蓄力後，用力向上顛勺，對敵人造成物理"
                "傷害與擊飛。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "加料！",
            "description": (
                "當有敵人達到4層破防時可以發動。掄起鐵鍋對敵人造成大"
                "量物理傷害並猛擊，本次猛擊的傷害獲得額外提升。"
            ),
            "triggerConditions": [
                "當有敵人達到4層破防時可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "切絲入鍋！",
            "description": (
                "猛拍砧板，立即對前方範圍內的敵人強制造成擊飛。隨後發"
                "動6段連續斬擊，造成物理傷害，最後將所有敵人一併擊墜"
                "，強制造成倒地，造成大量物理傷害"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0019_karin": {
        "battle": {
            "name": "熱情迸發",
            "description": "向前方揮斬，造成灼熱傷害並施加灼熱附著。",
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "快閃衝擊",
            "description": (
                "當有敵人失衡，或觸發失衡節點時可以發動。進行來回2段"
                "突刺，每段造成物理傷害，並恢復一定技力。"
            ),
            "triggerConditions": [
                "當有敵人失衡，或觸發失衡節點時可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "小隊，集結！",
            "description": (
                "進入持續施法狀態，發射3枚集結信號彈，每次發射恢復一"
                "定技力。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0020_meurs": {
        "battle": {
            "name": "剛性阻擊",
            "description": (
                "架起盾牌格擋攻擊，使自身及周圍幹員獲得庇護，並立即返"
                "還一定技力。若在立盾期間受到攻擊，則發動一次反擊，嘗"
                "試對敵人造成物理傷害並施加1層破防。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "即時壓制",
            "description": (
                "當敵人開始蓄力，或主控幹員受到攻擊後生命值低於40%"
                "可以發動。揮拳向前用力扣下，對敵人造成物理傷害，並使"
                "自身和另一名友方幹員（主控幹員優先）獲得護盾。防禦力"
                "可以額外提高護盾值。"
            ),
            "triggerConditions": [
                "當敵人開始蓄力，或主控幹員受到攻擊後生命值低於40%可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "教科書式猛攻",
            "description": (
                "揮動大劍快速向前斬擊2次，造成物理傷害並施加虛弱。最"
                "後向下猛砸，對目標範圍內的所有敵人造成大量物理傷害並"
                "造成倒地。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0021_whiten": {
        "battle": {
            "name": "凝聲",
            "description": (
                "向前刺出長槍，激發出一道製冷聲波，對一條直線上的敵人"
                "造成寒冷傷害並施加寒冷附著。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "失真",
            "description": (
                "當有敵人進入凍結狀態時可以發動。迅速移動到敵人身邊，"
                "對小範圍內的敵人造成物理傷害並強制造成擊飛。如果命中"
                "處於凍結狀態的敵人，還會造成額外傷害並施加物理脆弱。"
            ),
            "triggerConditions": [
                "當有敵人進入凍結狀態時可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "震音",
            "description": (
                "耗盡全身力氣，用力下砸槍柄，對自身附近圓形範圍的敵人"
                "造成物理傷害。如果敵人處於物理脆弱狀態，則對其強制造"
                "成擊飛。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0022_bounda": {
        "battle": {
            "name": "小驚喜",
            "description": (
                "踢出自製炸彈將其黏附在目標身上，並施加緩速，短暫延遲"
                "後爆炸對範圍內的敵人造成自然傷害並施加自然附著。若黏"
                "附目標被擊敗則自製炸彈提前爆炸。場上同時只能存在一個"
                "自製炸彈。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "免費贈禮",
            "description": (
                "當敵人進入2層及以上寒冷附著或自然附著時可以發動。射"
                "擊目標敵人，引發一次特殊爆炸，造成自然傷害並施加該法"
                "術附著。"
            ),
            "triggerConditions": [
                "當敵人進入2層及以上寒冷附著或自然附著時可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "巔峰鬧劇",
            "description": (
                "螢石以弧形軌跡高速運動並向弧內目標快速射擊，造成4段"
                "自然傷害，若命中目標身上粘有自製炸彈，則立刻將其引爆"
                "並提升爆炸傷害及範圍。若最後一段傷害命中處於2層及以"
                "上寒冷附著或自然附著的目標，則再次施加該法術附著。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0023_antal": {
        "battle": {
            "name": "指定研究對象",
            "description": (
                "對敵人施加長時間聚焦，造成電磁傷害，被聚焦的敵人受到"
                "電磁脆弱和灼熱脆弱，同時最多聚焦1個敵人。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "磁暴試驗場",
            "description": (
                "當被聚焦的敵人進入物理異常或法術附著狀態時可以發動。"
                "在該敵人身上引發1次能量爆炸，造成電磁傷害並再次對其"
                "施加該物理異常或法術附著。"
            ),
            "triggerConditions": [
                "當被聚焦的敵人進入物理異常或法術附著狀態時可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "超頻時刻",
            "description": "對全隊施加一段時間的電磁增幅和灼熱增幅。",
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0024_deepfin": {
        "battle": {
            "name": "非常規路亞",
            "description": (
                "勾起冰塊砸擊面前的敵人，對目標造成物理傷害。命中處於"
                "寒冷附著狀態的目標時，消耗掉目標身上所有寒冷附著，對"
                "其強制施加凍結，並基於消耗層數恢復技力，命中多名目標"
                "時僅恢復1次。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "鑿孔底釣術",
            "description": (
                "當附近目標的法術異常或源石結晶被消耗時可以發動。在敵"
                "人腳下開洞垂釣，造成物理傷害，並恢復一定技力，有一定"
                "概率能釣出珍鱗，大幅增加傷害並額外恢復技力。"
            ),
            "triggerConditions": [
                "當附近目標的法術異常或源石結晶被消耗時可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "大鱗，上鉤！",
            "description": (
                "釣起超乎想象的大鱗砸擊面前的所有敵人，造成大範圍的寒"
                "冷傷害，施加寒冷附著並恢復一定技力，每擊敗一個目標將"
                "額外恢復一定技力。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0025_ardelia": {
        "battle": {
            "name": "奔騰的多利",
            "description": (
                "騎上多利先生衝撞目標，對目標造成自然傷害，若目標處於"
                "腐蝕狀態，消耗其腐蝕狀態，並對其施加物理脆弱與法術脆"
                "弱"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "火山蘑菇雲",
            "description": (
                "當主控幹員對不處於破防或法術附著狀態的敵人造成重擊後"
                "可以發動。發射一團火山雲拋向目標敵人，到達目標身邊後"
                "對目標造成自然傷害。火山雲會跟蹤目標，短暫延遲後爆炸"
                "，對周圍其他敵人造成一半的自然傷害，並強制施加短暫的"
                "腐蝕。"
            ),
            "triggerConditions": [
                "當主控幹員對不處於破防或法術附著狀態的敵人造成重擊後可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "毛茸茸派對",
            "description": (
                "艾爾黛拉進入可移動的持續施法狀態，召喚多利先生的幫助"
                "，隨機向四周散射多利先生的分身。每個分身命中敵人時對"
                "其造成自然傷害，每個敵人每0.3秒最多受到一次傷害。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0026_lastrite": {
        "battle": {
            "name": "塞什卡的秘傳",
            "description": (
                "對主控幹員的武器進行低溫灌注，並返還一定技力。一段時"
                "間內，當前主控幹員接下來的1次重擊會生成別禮的幻影，"
                "對目標進行追擊，造成寒冷傷害，施加寒冷附著。主控幹員"
                "為別禮時，施放該戰技不會中斷普通攻擊。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "噬冬",
            "description": (
                "當有敵人進入3層及以上寒冷附著狀態時可以發動。在目標"
                "敵人身上凝結冰錐，隨後將其斬碎，消耗敵人身上的所有寒"
                "冷附著，對其造成基於其寒冷附著層數的寒冷傷害，並且根"
                "據消耗的層數獲得終結技能量。"
            ),
            "triggerConditions": [
                "當有敵人進入3層及以上寒冷附著狀態時可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "臨終別禮",
            "description": (
                "披著霜鎧，凝結冰鐮，對前方進行三次斬擊，該狀態下免疫"
                "所有傷害。每次斬擊造成大量寒冷傷害。別禮只能從自身的"
                "戰技、連攜技中獲得終結技能量。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0029_pograni": {
        "battle": {
            "name": "粉碎陣線",
            "description": (
                "對前方範圍的敵人進行兩次斬擊，造成物理傷害並施加碎甲"
                "，同時基於消耗的破防層數恢復技力，命中多名目標時僅恢"
                "復1次。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "盈月邀擊",
            "description": (
                "當有敵人被猛擊或者碎甲消耗破防層數後可以發動。根據消"
                "耗的最高。破防層數，對敵人進行相同次數的斬擊（最多3"
                "次），造成物理傷害並恢復一定技力，每一擊的傷害和技力"
                "恢復效果都更強。若消耗4層破防，第3次斬擊將獲得強化"
                "。"
            ),
            "triggerConditions": [
                "當有敵人被猛擊或者碎甲消耗破防層數後可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "盾衛旗隊，上前",
            "description": (
                "以目標為中心，召喚四名盾衛向目標進軍，並將進軍途中的"
                "敵人往目標方向推動，造成物理傷害的同時生成5點鐵誓。"
                "當有敵人受到物理異常效果或駿衛的連攜技傷害後，消耗1"
                "點鐵誓召喚一名盾衛對其發動襲擾，造成物理傷害並恢復一"
                "定技力。當消耗的鐵誓是最後一點時，四名盾衛發動決勝，"
                "對其造成大量物理傷害並恢復大量技力。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0028_wulfa": {
        "battle": {
            "name": "血紅之影",
            "description": (
                "衝向目標，造成物理傷害並施加擊飛。若目標已經擁有破防，"
                "則會額外釋放狼之珀衝向目標，造成灼熱傷害。"
            ),
            "sourceIds": list(WULFA_SOURCE_IDS),
        },
        "combo": {
            "name": "燎影時刻",
            "description": (
                "當有敵人同時處於破防和法術附著狀態時可以發動。洛茜的"
                "連攜技可連續發動兩次，第一次會對目標造成物理傷害。第"
                "二次將消耗目標全部的法術附著，對其造成基於消耗層數的"
                "物理傷害並造成一次擊飛，同時在一段時間內提升自身的暴"
                "擊率和暴擊傷害。當第二次連攜技精準銜接時，可以額外施"
                "加1層破防。"
            ),
            "triggerConditions": ["當有敵人同時處於破防和法術附著狀態時可以發動。"],
            "cooldownSeconds": 14,
            "sourceIds": list(WULFA_SOURCE_IDS),
        },
        "ultimate": {
            "name": "「利爪」奇襲",
            "description": (
                "揮動披風迅捷戳擊，在短時間內對目標造成多段灼熱傷害，"
                "之後使用匕首進行兩段斬擊，造成大量灼熱傷害並施加灼熱附著。"
                "本次技能將在暴擊時造成更高的暴擊傷害。"
            ),
            "sourceIds": list(WULFA_SOURCE_IDS),
        },
    },
    "chr_0030_zhuangfy": {
        "battle": {
            "name": "驚霆訣",
            "description": (
                "消耗目標的導電狀態，使本次戰技傷害倍率提高，並生成相"
                "當於所消耗導電的異常等級+1柄青霆劍，若現存的青霆劍"
                "少於3柄，即使未消耗目標的導電狀態仍能生成1柄青霆劍"
                "。隨後引導附近的青霆劍依次雷擊目標，造成電磁傷害並額"
                "外獲得終結技能量，最後一次雷擊造成6倍傷害。一次戰技"
                "最多生成3柄青霆劍。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "一息萬變",
            "description": (
                "主控幹員的重擊或處決，命中處於電磁附著狀態的敵人後可"
                "以發動。構造息雷陣法攻擊敵人，造成電磁傷害。命中處於"
                "電磁附著的敵人時，消耗其電磁附著，強制施加導電，並基"
                "於消耗的層數額外獲得終結技能量。若強制施加導電時，敵"
                "人已處於導電狀態，則所施加導電的異常等級+1。"
            ),
            "triggerConditions": [
                "主控幹員的重擊或處決，命中處於電磁附著狀態的敵人後可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "萬鈞風雷",
            "description": (
                "進入天理合真狀態：普通攻擊得到強化。自身行動更不容易"
                "被打斷。戰技驚霆訣傷害倍率提高，傷害範圍擴大，最後一"
                "次雷擊命中時施加電磁附著。連攜技一息萬變對一定範圍內"
                "的敵人生效，傷害倍率提高，冷卻恢復速度提升至原本的4"
                "倍。首次施放戰技驚霆訣不消耗技力與導電，若存在目標，"
                "則無論其是否處於導電狀態，必定生成3柄青霆劍。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
    "chr_0031_mifu": {
        "battle": {
            "name": "清波三藝",
            "description": (
                "連續施放可最多施放3段不同招式，初始戰技為斷雲。斷雲"
                "：消耗100技力，施放後返還50技力。從拳套中發射出"
                "拘束索，對目標及其附近敵人造成物理傷害並嘗試將其拉取"
                "至自身附近。施放後戰技在一段時間內替換為追形。追形："
                "消耗50技力。朝前方連續揮拳造成物理傷害，最後一拳額"
                "外造成猛擊。如果本次猛擊消耗的最大破防層數不少於3層"
                "，戰技在一段時間內替換為開天。開天：消耗50技力，朝"
                "前方範圍造成大量物理傷害。本次傷害類型不屬於戰技傷害"
                "，而是視為猛擊傷害。"
            ),
            "sourceIds": [
                *STRUCTURED_SKILL_SOURCE_IDS,
                "src_warfarin_mifu",
                BWIKI_SKILL_DATABASE,
            ],
        },
        "combo": {
            "name": "拳出無悔",
            "description": (
                "當有敵人達到3層及以上破防時可以發動。使用上勾拳痛擊"
                "前方的敵人，對其造成物理傷害，同時施加一定時間的物理"
                "脆弱。施放後戰技在一段時間內替換為追形。"
            ),
            "triggerConditions": [
                "當有敵人達到3層及以上破防時可以發動。",
            ],
            "sourceIds": [
                *STRUCTURED_SKILL_SOURCE_IDS,
                "src_warfarin_mifu",
                BWIKI_SKILL_DATABASE,
            ],
        },
        "ultimate": {
            "name": "絕心",
            "description": (
                "短暫蓄力後朝前方衝刺，對身前目標強制造成擊飛，隨後將"
                "其砸向地面造成物理傷害。施放後戰技在一段時間內替換為"
                "追形。"
            ),
            "sourceIds": [
                *STRUCTURED_SKILL_SOURCE_IDS,
                "src_warfarin_mifu",
                BWIKI_SKILL_DATABASE,
            ],
        },
    },
    "chr_0033_camille": {
        "battle": {
            "name": "驅火焚影",
            "description": (
                "召喚銜火血翼飛向敵人，對小範圍敵人造成灼熱傷害並施加"
                "灼熱附著。隨後銜火血翼將在目標周圍盤桓一段時間，期間"
                "對目標施加虛弱和灼熱脆弱。目標被擊敗時，銜火血翼會飛"
                "向附近的另一個敵人，對目標造成灼熱傷害，施加灼熱附著"
                "、虛弱和灼熱脆弱。銜火血翼盤桓的敵人被卡繆的連攜技命"
                "中時，將在短暫延遲後發生一次爆裂，受到額外的灼熱傷害"
                "。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "combo": {
            "name": "錐心之棘",
            "description": (
                "當有敵人的灼熱附著被消耗或吸收後可以發動。來回穿梭，"
                "造成灼熱傷害並恢復一定技力。"
            ),
            "triggerConditions": [
                "當有敵人的灼熱附著被消耗或吸收後可以發動。",
            ],
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
        "ultimate": {
            "name": "猩紅墜雨",
            "description": (
                "卡繆飛向空中，落下槍雨並銜接橫掃攻擊，對命中的目標造"
                "成灼熱傷害並施加灼熱附著，同時恢復一定技力。施放後一"
                "段時間內下一次戰技會被替換為追獵，追獵視為連攜技，不"
                "消耗技力。追獵：來回穿梭，造成灼熱傷害並恢復一定技力"
                "。"
            ),
            "sourceIds": [*STRUCTURED_SKILL_SOURCE_IDS, BWIKI_SKILL_DATABASE],
        },
    },
}


# The structured tables describe each action with a numeric stat line such as
# "伤害倍率：156%；失衡值：10". Reviewed effect text is prepended to it so the
# numbers stay available instead of being replaced.
_STAT_LINE_PATTERN = re.compile(r"[：:]\s*\d")


def _is_stat_line(description: Any) -> bool:
    return isinstance(description, str) and bool(_STAT_LINE_PATTERN.search(description))


def _merge_description(existing: Any, override: Any) -> Any:
    """Adopt the reviewed effect text while keeping the verified stat line."""
    if not override:
        return existing
    if not isinstance(existing, str) or existing == override:
        return override
    if existing.startswith(override):
        # Already merged by an earlier run; never append the stat line twice.
        return existing
    if _is_stat_line(existing):
        return f"{override} {existing}"
    return override


def _apply_skill_overrides(
    characters: list[dict[str, Any]],
    overrides: dict[str, dict[str, dict[str, Any]]],
) -> list[dict[str, Any]]:
    result = deepcopy(characters)
    by_id = {character["id"]: character for character in result}
    for character_id, skill_overrides in overrides.items():
        character = by_id.get(character_id)
        if not character:
            continue
        skills = {skill["type"]: skill for skill in character.get("skills", [])}
        for skill_type, override in skill_overrides.items():
            skill = skills.get(skill_type)
            if not skill:
                skill_id = f"{character_id}{SKILL_SUFFIXES[skill_type]}"
                skill = {
                    "id": skill_id,
                    "name": override["name"],
                    "type": skill_type,
                    "resource": (
                        "shared_skill_points"
                        if skill_type == "battle"
                        else "none"
                        if skill_type == "combo"
                        else "energy"
                    ),
                    "description": override.get("description"),
                    "tags": [],
                    "triggerConditions": list(override.get("triggerConditions") or []),
                    "cooldownSeconds": override.get("cooldownSeconds"),
                    "energyCost": override.get("energyCost"),
                    "sharedSkillPointCost": override.get("sharedSkillPointCost"),
                    "sourceIds": list(override.get("sourceIds") or []),
                }
                character.setdefault("skills", []).append(skill)
                skills[skill_type] = skill
            else:
                skill["name"] = override["name"]
                skill["description"] = _merge_description(
                    skill.get("description"), override.get("description")
                )
                skill["sourceIds"] = list(
                    override.get("sourceIds") or skill.get("sourceIds") or []
                )
                if override.get("triggerConditions"):
                    skill["triggerConditions"] = list(override["triggerConditions"])
                for optional_field in (
                    "cooldownSeconds",
                    "energyCost",
                    "sharedSkillPointCost",
                    "resource",
                    "tags",
                ):
                    if optional_field in override:
                        skill[optional_field] = override[optional_field]
    return result


def apply_reviewed_skill_overrides(characters: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Apply reviewed character-specific skill data without changing stable IDs."""
    return _apply_skill_overrides(characters, REVIEWED_SKILL_OVERRIDES)


def apply_supplemental_skill_overrides(
    characters: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Fill reviewed skills absent from the structured source tables."""
    return _apply_skill_overrides(characters, SUPPLEMENTAL_SKILL_OVERRIDES)
