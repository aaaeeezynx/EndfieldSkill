<script setup lang="ts">
import { computed } from 'vue'
import CharacterPicker from '@/components/CharacterPicker.vue'
import DataPipelineState from '@/components/DataPipelineState.vue'
import EquipmentBoard from '@/components/EquipmentBoard.vue'
import RotationBoard from '@/components/RotationBoard.vue'
import TeamDock from '@/components/TeamDock.vue'
import TeamSummary from '@/components/TeamSummary.vue'
import { usePlannerStore } from '@/stores/planner'
import { getSkillGapCharacters } from '@/lib/skillGap'

const planner = usePlannerStore()
// Player level used to drive the full "every craftable by level" equipment
// board. The board is purely level-gated (story chapters / formula authority
// are never consulted), so we expose the validated level or undefined when
// none is set yet.
const playerLevel = computed(() => planner.validation.playerLevel ?? undefined)
const showPipelineState = computed(
  () => planner.dataState === 'loading' || planner.dataState === 'empty' ||
    planner.dataState === 'error' || !planner.hasCoreData,
)
const partialFiles = computed(() => planner.dataset?.missingFiles ?? [])
const hasUnverifiedProgressData = computed(
  () => planner.characters.length > 0 && !planner.hasChapterData,
)
const squadSize = computed(() => planner.selectedCharacters.length)
// Dynamic list of characters missing a usable 戰技 or 連攜技, derived purely
// from character.skills. Clears itself automatically when data is repaired.
const skillGapCharacters = computed(() =>
  getSkillGapCharacters(planner.characters),
)
const hasSkillGaps = computed(() => skillGapCharacters.value.length > 0)
</script>

<template>
  <div class="container-shell planner-page">
    <DataPipelineState v-if="showPipelineState" />
    <template v-else>
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-grid" aria-hidden="true"></div>
        <div class="hero-contours" aria-hidden="true">
          <svg viewBox="0 0 620 420" preserveAspectRatio="none">
            <path d="M-30 300C70 120 160 450 270 275S420 20 670 135" />
            <path d="M-30 325C75 145 165 475 280 300S440 45 680 160" />
            <path d="M-30 350C80 170 170 500 290 325S460 70 690 185" />
            <path d="M-30 375C85 195 175 525 300 350S480 95 700 210" />
            <path d="M-30 400C90 220 180 550 310 375S500 120 710 235" />
          </svg>
        </div>
        <p class="hero-wordmark" aria-hidden="true">終末地</p>
        <div class="hero-content">
          <div class="hero-topline">
            <span>ENDFIELD / TACTICAL ORCHESTRATOR</span>
            <span class="hero-state"><i></i>規則資料已連線</span>
          </div>
          <div class="hero-layout">
            <div class="hero-copy">
              <p class="hero-eyebrow">01—04 / 彈性隊伍編排</p>
              <h1 id="hero-title" class="display-title">你的隊伍，<br /><span>每一步都有依據。</span></h1>
              <p class="hero-lede">選擇 1～4 名已擁有角色，依據可核驗來源重組隊伍技能釋放順序，並列出目前等級可製造的裝備。缺少的資料會清楚標示，絕不假造規則。</p>
              <a class="hero-action" href="#roster">開始建立編成 <span aria-hidden="true">↓</span></a>
            </div>
            <div class="roster-status" aria-label="目前編成狀態">
              <div class="status-heading"><span>SQUAD / INPUT</span><strong>1～4 人彈性編成</strong></div>
              <div class="roster-count"><span>目前選擇</span><strong>{{ squadSize }}<small>/ 04</small></strong></div>
              <div class="roster-slots" aria-label="四個可選席位">
                <span v-for="index in 4" :key="index" :class="{ filled: index <= squadSize }">0{{ index }}<i>{{ index <= squadSize ? '已選' : '可選' }}</i></span>
              </div>
              <p>一名角色即可生成，最多四名；技能釋放順序由所選 1～4 名角色重組可核驗來源循環，而非固定隊伍或機械排列。</p>
            </div>
          </div>
          <ol class="workflow" aria-label="編排流程">
            <li><span>01</span><div><strong>選角色</strong><small>從已擁有名單編成 1～4 人</small></div></li>
            <li><span>02</span><div><strong>設等級</strong><small>決定可製造裝備門檻</small></div></li>
            <li><span>03</span><div><strong>排技能</strong><small>重組來源循環順序</small></div></li>
            <li><span>04</span><div><strong>篩裝備</strong><small>列出等級可製造清單</small></div></li>
          </ol>
        </div>
      </section>

      <div
        v-if="hasSkillGaps"
        class="partial-banner skill-warning reveal"
        role="status"
        aria-live="polite"
      >
        <span>SKILL GAPS</span>
        <p>
          <strong>技能資料缺失提示：</strong>下列角色在可核驗資料中缺少
          <template v-for="(entry, index) in skillGapCharacters" :key="entry.id"
            ><strong>「{{ entry.name }}」</strong>{{ index < skillGapCharacters.length - 1 ? '、' : '' }}<span class="gap-types">{{ entry.missingLabels.join('／') }}</span></template>
          。本工具嚴守客觀資料邊界，缺失部分清楚標明，絕不憑空虛構。
        </p>
        <RouterLink to="/data">查看資料邊界 →</RouterLink>
      </div>

      <div v-if="partialFiles.length" class="partial-banner reveal">
        <span>PARTIAL DATA</span>
        <p>資料鏈路部分缺失：{{ partialFiles.join(' / ') }}。可用資料仍會呈現，缺失欄位不會被補造。</p>
        <RouterLink to="/data">查看覆蓋率 →</RouterLink>
      </div>
      <div v-if="hasUnverifiedProgressData" class="partial-banner progress-warning reveal">
        <span>PROGRESS UNVERIFIED</span>
        <p>章節與權限解鎖資料尚未核驗，但不影響本輪結果。裝備篩選只依可製造等級，章節、配方權限不參與；你仍可選擇 1～4 名角色並依可製造等級產生結果。</p>
        <RouterLink to="/data">查看資料邊界 →</RouterLink>
      </div>

      <div id="roster" class="planner-layout">
        <CharacterPicker :characters="planner.characters" :selected-ids="planner.selectedCharacterIds" @toggle="planner.toggleCharacter" />
        <TeamDock />
      </div>

      <section id="recommendation-output" class="output-stack">
        <template v-if="planner.report">
          <TeamSummary :report="planner.report" :characters="planner.characters" />
          <RotationBoard :choices="planner.report.rotations" :characters="planner.characters" />
          <EquipmentBoard
            :loadouts="planner.report.equipment"
            :characters="planner.characters"
            :equipment="planner.dataset?.equipment ?? []"
            :player-level="playerLevel"
          />
        </template>
        <section v-else class="awaiting-output panel reveal">
          <div class="awaiting-code">OUTPUT//LOCKED</div>
          <div class="awaiting-body">
            <p class="eyebrow">TACTICAL PAYLOAD</p>
            <h2>等待隊伍編成與玩家等級。</h2>
            <p>結果分為隊伍匹配、技能序列、裝備門檻三段。資料不足時明確標示，不以規則冒充可核驗攻略。</p>
            <div class="output-preview"><span><i>04</i> SQUAD MATCH</span><span><i>05</i> SKILL SEQUENCE</span><span><i>06</i> EQUIPMENT GATES</span></div>
          </div>
        </section>
      </section>
    </template>
  </div>
</template>

<style scoped>
.planner-page { --planner-ui-line: #767676; background: #fff; padding-top: clamp(1rem, 3vw, 2.2rem); }
.hero { position: relative; isolation: isolate; overflow: hidden; min-height: 520px; border: 1px solid #191919; background: #191919; color: #fff; }
.hero-grid { position: absolute; z-index: -1; inset: 0; background-image: linear-gradient(rgba(255,255,255,.065) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.065) 1px, transparent 1px); background-size: 38px 38px; mask-image: linear-gradient(90deg, transparent 10%, #000 100%); }
.hero-contours { position: absolute; z-index: -1; right: -4%; bottom: -10%; width: 66%; color: #fffa00; opacity: .23; }
.hero-contours svg { display: block; width: 100%; }
.hero-contours path { fill: none; stroke: currentColor; stroke-width: 1; }
.hero-wordmark { position: absolute; z-index: -1; right: clamp(-5rem, -3vw, -1rem); bottom: -0.18em; margin: 0; color: #252525; font-family: var(--font-display); font-size: clamp(5.5rem, 12vw, 11rem); font-weight: 700; letter-spacing: 0; line-height: 1; white-space: nowrap; pointer-events: none; }
.hero-content { position: relative; padding: clamp(1.25rem, 3vw, 2.3rem); animation: hero-enter 480ms ease-out both; }
.hero-topline { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .6rem 1rem; border-bottom: 1px solid #666; padding-bottom: .8rem; color: #fff; font-family: var(--font-display); font-size: .62rem; font-weight: 700; letter-spacing: .1em; }
.hero-state { display: inline-flex; align-items: center; gap: .4rem; }
.hero-state i { width: .4rem; height: .4rem; background: #fffa00; }
.hero-layout { position: relative; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(250px, .65fr); gap: clamp(1.75rem, 4vw, 4.25rem); align-items: center; padding: 2.3rem 0 2rem; }
.hero-copy { max-width: 720px; }
.hero-eyebrow { color: #fffa00; font: 700 .78rem var(--font-display); letter-spacing: .1em; }
.hero h1 { margin: .9rem 0 1.2rem; font-size: clamp(2.5rem, 5.1vw, 4.75rem); }
.hero h1 span { color: #fffa00; }
.hero-lede { max-width: 570px; margin: 0; color: #f2f2f2; font-size: .86rem; line-height: 1.85; }
.hero-action { display: inline-flex; align-items: center; justify-content: space-between; gap: 2rem; margin-top: 1.6rem; border: 1px solid #fffa00; background: #fffa00; padding: .8rem 1.1rem; color: #191919; font: 700 .86rem var(--font-display); text-decoration: none; transition: background-color 160ms ease; }
.hero-action:hover { background: #fff; }
.hero-action span { font-size: 1.2rem; line-height: 1; }
.hero-action:focus-visible { outline-color: #fff; }
.roster-status { position: relative; z-index: 2; border: 1px solid #777; border-top: 5px solid #fffa00; background: #242424; padding: 1.15rem; }
.status-heading { display: flex; justify-content: space-between; gap: .7rem; align-items: baseline; }
.status-heading span { color: #fff; font: 700 .62rem var(--font-display); letter-spacing: .08em; }
.status-heading strong { font-size: .78rem; }
.roster-count { display: flex; align-items: baseline; justify-content: space-between; margin-top: 1.1rem; }
.roster-count > span { color: #fff; font-size: .75rem; }
.roster-count strong { color: #fffa00; font: 700 3.2rem/1 var(--font-display); }
.roster-count small { margin-left: .3rem; color: #fff; font-size: 1.1rem; }
.roster-slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: .35rem; margin-top: .8rem; }
.roster-slots span { display: grid; gap: .2rem; border: 1px solid #929292; padding: .45rem; color: #fff; font: 700 .78rem var(--font-display); }
.roster-slots span.filled { border-color: #fffa00; background: #fffa00; color: #191919; }
.roster-slots i { font: normal .6rem var(--font-body); }
.roster-status > p { margin: 1rem 0 0; color: #fff; font-size: .75rem; line-height: 1.65; }
.workflow { position: relative; z-index: 2; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid #666; list-style: none; }
.workflow li { display: flex; gap: .7rem; padding: 1rem .7rem 0; border-left: 1px solid #666; }
.workflow li:first-child { border-left: 0; padding-left: 0; }
.workflow li > span { color: #fffa00; font: 700 .75rem var(--font-display); }
.workflow strong { display: block; font-size: .82rem; }
.workflow small { display: block; margin-top: .2rem; color: #fff; font-size: .62rem; line-height: 1.5; }
.partial-banner { display: flex; align-items: center; gap: .8rem; margin-top: .9rem; border: 1px solid #8a3400; border-left: 5px solid #8f3f00; background: #fff8f1; padding: .72rem .9rem; }
.partial-banner > span { flex: 0 0 auto; color: #8a3400; font: 700 .75rem var(--font-display); letter-spacing: .1em; }
.partial-banner p { flex: 1; color: #5a3a1a; font-size: .78rem; line-height: 1.6; }
.partial-banner a { flex: 0 0 auto; color: #7a3608; font-size: .76rem; text-decoration: none; }
.partial-banner.skill-warning .gap-types { color: #8a3400; font-weight: 700; margin-left: .15rem; }
.partial-banner.progress-warning { border-color: #6b6000; background: #fffde7; }
.partial-banner.progress-warning > span, .partial-banner.progress-warning a { color: #5a5500; }
.partial-banner.progress-warning p { color: #565015; }
.planner-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 380px); align-items: start; gap: 1rem; margin-top: 1rem; scroll-margin-top: 1rem; }
.output-stack { display: grid; gap: 1rem; margin-top: 1.4rem; scroll-margin-top: 1rem; }
.awaiting-output { display: grid; grid-template-columns: 120px minmax(0, 1fr); min-height: 270px; overflow: hidden; }
.awaiting-code { display: grid; place-items: center; background: #191919; color: #fffa00; font: 700 .75rem var(--font-display); letter-spacing: .12em; writing-mode: vertical-rl; }
.awaiting-body { padding: clamp(1.5rem, 4vw, 2.8rem); }
.awaiting-body h2 { margin-top: .65rem; font: 700 clamp(1.8rem, 3.8vw, 2.9rem) var(--font-display); }
.awaiting-body > p { max-width: 700px; margin-top: .8rem; color: #3f3f3f; font-size: .84rem; line-height: 1.75; }
.output-preview { display: flex; flex-wrap: wrap; gap: .45rem; margin-top: 1.3rem; }
.output-preview span { border: 1px solid #767676; padding: .38rem .55rem; color: #3f3f3f; font: 700 .75rem var(--font-display); }
.output-preview i { margin-right: .3rem; color: #1744ad; font-style: normal; }
@keyframes hero-enter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 1000px) {
  .hero-layout { grid-template-columns: 1fr; gap: 1.5rem; }
  .roster-status { max-width: 500px; }
  .hero-wordmark { right: -0.04em; bottom: .08em; font-size: 9rem; }
  .planner-layout { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .planner-page { padding-top: .75rem; }
  .hero { min-height: 0; }
  .hero-content { padding: 1rem; }
  .hero-topline { font-size: .6rem; }
  .hero-layout { padding: 1.7rem 0 1.5rem; }
  .hero h1 { font-size: clamp(2.1rem, 10.5vw, 3rem); line-height: 1.08; }
  .hero-lede { font-size: .8rem; }
  .hero-action { width: 100%; }
  .hero-wordmark { right: -.06em; bottom: .02em; font-size: 5.4rem; opacity: .72; }
  .hero-contours { width: 130%; right: -38%; bottom: 5%; }
  .workflow { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem 0; }
  .workflow li:nth-child(3) { border-left: 0; padding-left: 0; }
  .workflow li { padding-top: 0; }
  .partial-banner { align-items: flex-start; flex-wrap: wrap; gap: .45rem; }
  .partial-banner p { flex-basis: 100%; }
  .awaiting-output { grid-template-columns: 1fr; }
  .awaiting-code { padding: .65rem .9rem; writing-mode: horizontal-tb; }
}
@media (prefers-reduced-motion: reduce) { .hero-content { animation: none; } }
</style>
