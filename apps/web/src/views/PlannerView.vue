<script setup lang="ts">
import { computed } from 'vue'
import CharacterPicker from '@/components/CharacterPicker.vue'
import DataPipelineState from '@/components/DataPipelineState.vue'
import EquipmentBoard from '@/components/EquipmentBoard.vue'
import RotationBoard from '@/components/RotationBoard.vue'
import TeamDock from '@/components/TeamDock.vue'
import TeamSummary from '@/components/TeamSummary.vue'
import { usePlannerStore } from '@/stores/planner'

const planner = usePlannerStore()

const showPipelineState = computed(
  () =>
    planner.dataState === 'loading' ||
    planner.dataState === 'empty' ||
    planner.dataState === 'error' ||
    !planner.hasCoreData,
)

const partialFiles = computed(() => planner.dataset?.missingFiles ?? [])
const hasUnverifiedProgressData = computed(
  () => planner.characters.length > 0 && !planner.hasChapterData,
)
</script>

<template>
  <div class="container-shell planner-page">
    <DataPipelineState v-if="showPipelineState" />

    <template v-else>
      <section class="hero reveal">
        <!-- Original schematic; no official character key visual is loaded. -->
        <div class="hero-visual" aria-hidden="true">
          <span class="hero-grid"></span>
          <span class="schematic-header">
            <b>ROSTER TERMINAL</b>
            <i>ROSTER / 04</i>
          </span>
          <span class="schematic-column schematic-column--a">
            <b>UNIT-A</b>
            <small>BATTLE</small>
          </span>
          <span class="schematic-column schematic-column--b">
            <b>UNIT-B</b>
            <small>COMBO</small>
          </span>
          <span class="schematic-column schematic-column--c">
            <b>UNIT-C</b>
            <small>SUPPORT</small>
          </span>
          <span class="schematic-column schematic-column--d">
            <b>UNIT-D</b>
            <small>ULT</small>
          </span>
          <span class="schematic-link schematic-link--battle"></span>
          <span class="schematic-link schematic-link--combo"></span>
          <span class="schematic-link schematic-link--support"></span>
          <span class="schematic-link schematic-link--ultimate"></span>
          <span class="schematic-console">
            <span>BATTLE SKILL / SHARED SP</span>
            <span>COMBO / CONDITION</span>
            <span>ULTIMATE / ENERGY</span>
            <span>EQUIPMENT / GATE</span>
          </span>
        </div>

        <div class="hero-copy">
          <p class="eyebrow">ENDFIELD // OWNED-ROSTER ORCHESTRATOR</p>
          <h1 class="display-title">
            你的四人，<br />
            <span>才是指令起點。</span>
          </h1>
          <p class="hero-lede">
            不必再照抄固定隊伍攻略。鎖定你實際擁有的四名角色，輸入等級與劇情進度，
            取得可追溯的技能釋放條件、共享資源約束，以及依裝備穿戴門檻篩選的配裝方向。
          </p>
          <div class="hero-tags" aria-label="分析範圍">
            <span>共享技力</span>
            <span>連攜觸發窗口</span>
            <span>終結技能量</span>
            <span>裝備穿戴等級</span>
            <span>章節／配方權限待核驗</span>
          </div>
          <a class="hero-action" href="#recommendation-output">
            <span>建立我的四人編成</span>
            <b aria-hidden="true">↓</b>
          </a>
        </div>

        <div class="hero-matrix" aria-label="使用流程">
          <div><span>01</span><strong>鎖定四人</strong><small>OWNED ROSTER</small></div>
          <i></i>
          <div><span>02</span><strong>輸入進度</strong><small>LEVEL / CHAPTER</small></div>
          <i></i>
          <div><span>03</span><strong>讀取循環</strong><small>TRIGGER / WINDOW</small></div>
          <i></i>
          <div><span>04</span><strong>篩選裝備</strong><small>FABRICATION GATE</small></div>
        </div>
      </section>

      <div v-if="partialFiles.length" class="partial-banner reveal">
        <span>PARTIAL DATA</span>
        <p>
          資料鏈路部分缺失：{{ partialFiles.join(' / ') }}。可用資料仍會呈現，缺失欄位不會被補造。
        </p>
        <RouterLink to="/data">查看覆蓋率 →</RouterLink>
      </div>

      <div v-if="hasUnverifiedProgressData" class="partial-banner progress-warning reveal">
        <span>PROGRESS UNVERIFIED</span>
        <p>
          章節與權限解鎖資料尚未核驗。你仍可選擇四人並依裝備穿戴等級產生結果；
          劇情章節、配方權限與「目前能否製造」不會被標示為已確認。
        </p>
        <RouterLink to="/data">查看資料邊界 →</RouterLink>
      </div>

      <div class="planner-layout">
        <CharacterPicker
          :characters="planner.characters"
          :selected-ids="planner.selectedCharacterIds"
          @toggle="planner.toggleCharacter"
        />
        <TeamDock />
      </div>

      <section id="recommendation-output" class="output-stack">
        <template v-if="planner.report">
          <TeamSummary :report="planner.report" :characters="planner.characters" />
          <RotationBoard
            :choices="planner.report.rotations"
            :characters="planner.characters"
          />
          <EquipmentBoard
            :loadouts="planner.report.equipment"
            :characters="planner.characters"
          />
        </template>

        <section v-else class="awaiting-output panel reveal">
          <div class="awaiting-code">OUTPUT//LOCKED</div>
          <div class="awaiting-body">
            <p class="eyebrow">TACTICAL PAYLOAD</p>
            <h2>等待四人編成與進度門檻。</h2>
            <p>
              結果將分為隊伍匹配、技能序列、裝備門檻三段。沒有完整攻略時僅顯示明確標註的規則回退，
              不會把推導結果包裝成來源原文。
            </p>
            <div class="output-preview">
              <span><i>04</i> SQUAD MATCH</span>
              <span><i>05</i> SKILL SEQUENCE</span>
              <span><i>06</i> EQUIPMENT GATES</span>
            </div>
          </div>
        </section>
      </section>
    </template>
  </div>
</template>

<style scoped>
.planner-page {
  /* Keep PlannerView body text at APCA 75+ and UI lines at 45+ on light surfaces. */
  --planner-body-muted: #4a4a4a;
  --planner-ui-line: #767676;
  --planner-warning-line: #8a3400;
  --planner-progress-line: #6b6000;
  background: #ffffff;
  padding-top: clamp(1rem, 3vw, 2.2rem);
}

.hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(320px, 0.82fr);
  grid-template-rows: minmax(360px, 31vw) auto;
  overflow: hidden;
  border: 1px solid var(--planner-ui-line);
  border-top: 6px solid var(--color-text-primary);
  background: #ffffff;
}

.hero-visual {
  position: relative;
  grid-column: 1 / -1;
  min-height: 0;
  overflow: hidden;
  background: #f5f3ea;
  background-image:
    linear-gradient(rgba(25, 25, 25, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(25, 25, 25, 0.05) 1px, transparent 1px);
  background-size: 34px 34px;
}

.hero-grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(25, 25, 25, 0.04), transparent 60%),
    linear-gradient(0deg, #fff 0, transparent 46%);
  pointer-events: none;
}

.schematic-header {
  position: absolute;
  top: 1.15rem;
  left: 50%;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  width: min(560px, 68%);
  border-top: 2px solid var(--color-text-primary);
  transform: translateX(-50%);
  padding-top: 0.35rem;
}

.schematic-header b,
.schematic-column b {
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.schematic-header i {
  color: var(--planner-body-muted);
  font-style: normal;
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.schematic-column {
  position: absolute;
  top: 27%;
  width: clamp(52px, 5vw, 78px);
  border: 1px solid var(--color-text-primary);
  background: #fff;
}

.schematic-column::before {
  display: block;
  height: 8px;
  background: var(--color-accent-primary);
  content: "";
}

.schematic-column::after {
  display: block;
  height: 54px;
  background:
    linear-gradient(90deg, transparent 24%, rgba(25, 25, 25, 0.1) 25% 75%, transparent 76%),
    linear-gradient(0deg, rgba(25, 25, 25, 0.06) 1px, transparent 1px);
  background-size: 10px 10px, 10px 10px;
  content: "";
}

.schematic-column small {
  display: block;
  border-top: 1px solid var(--planner-ui-line);
  background: var(--color-bg-secondary);
  color: var(--planner-body-muted);
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.7;
  text-align: center;
}

.schematic-column--a { left: 14%; transform: translateY(0); }
.schematic-column--b { left: 36%; top: 38%; }
.schematic-column--c { left: 56%; top: 22%; }
.schematic-column--d { left: 77%; top: 35%; }

.schematic-link {
  position: absolute;
  height: 2px;
  background: linear-gradient(90deg, var(--color-accent-blue), rgba(23, 68, 173, 0.18));
}

.schematic-link::before,
.schematic-link::after {
  position: absolute;
  top: -3px;
  width: 8px;
  height: 8px;
  border: 1px solid var(--color-text-primary);
  background: #fff;
  content: "";
  transform: rotate(45deg);
}

.schematic-link::before { left: -4px; }
.schematic-link::after { right: -4px; }

.schematic-link--battle {
  top: 34%;
  left: 17%;
  width: 19%;
  transform: rotate(16deg);
}

.schematic-link--combo {
  top: 44%;
  left: 37%;
  width: 19%;
  transform: rotate(-18deg);
}

.schematic-link--support {
  top: 34%;
  left: 57%;
  width: 20%;
  transform: rotate(12deg);
}

.schematic-link--ultimate {
  top: 46%;
  left: 41%;
  width: 19%;
  height: 8px;
  border: 1px solid var(--planner-warning-line);
  background: transparent;
  transform: rotate(-8deg);
}

.schematic-link--ultimate::before,
.schematic-link--ultimate::after {
  border-color: var(--planner-warning-line);
}

.schematic-console {
  position: absolute;
  right: clamp(1.2rem, 4vw, 3.2rem);
  bottom: 1.25rem;
  display: grid;
  gap: 0.3rem;
  min-width: 225px;
}

.schematic-console span {
  border-left: 4px solid var(--color-accent-blue);
  background: rgba(255, 255, 255, 0.92);
  padding: 0.3rem 0.5rem;
  color: var(--planner-body-muted);
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.hero-copy {
  position: relative;
  z-index: 2;
  align-self: end;
  margin-top: -5rem;
  padding: clamp(1.5rem, 3.5vw, 3.4rem);
}

.hero-copy::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 88px;
  height: 8px;
  background: var(--color-accent-primary);
  content: "";
}

.hero h1 {
  max-width: 850px;
  margin-top: 0.8rem;
  color: var(--color-text-primary);
  font-size: clamp(3.4rem, 7.6vw, 7.4rem);
}

.hero .eyebrow {
  color: var(--planner-body-muted);
}

.hero h1 span {
  position: relative;
  display: inline-block;
  z-index: 0;
}

.hero h1 span::before {
  position: absolute;
  z-index: -1;
  right: -0.12em;
  bottom: 0.02em;
  left: -0.08em;
  height: 0.45em;
  background: var(--color-accent-primary);
  content: "";
  transform: skewX(-8deg);
}

.hero-lede {
  max-width: 680px;
  margin-top: 1.4rem;
  color: var(--planner-body-muted);
  font-size: clamp(0.92rem, 1.25vw, 1.06rem);
  line-height: 1.85;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 1.2rem;
}

.hero-tags span {
  border: 1px solid var(--planner-ui-line);
  background: var(--color-bg-secondary);
  padding: 0.3rem 0.5rem;
  color: var(--planner-body-muted);
  font-size: 0.75rem;
}

.hero-tags span:last-child {
  border-color: var(--planner-warning-line);
  background: #fff7ef;
  color: #8a3400;
}

.hero-action {
  display: inline-flex;
  align-items: center;
  gap: 1.2rem;
  margin-top: 1.5rem;
  border: 1px solid var(--color-text-primary);
  background: var(--color-text-primary);
  padding: 0.7rem 0.85rem 0.7rem 1rem;
  color: #fff;
  font-family: var(--font-display);
  font-size: 0.92rem;
  font-weight: 700;
  text-decoration: none;
}

.hero-action b {
  display: grid;
  width: 1.7rem;
  height: 1.7rem;
  place-items: center;
  background: var(--color-accent-primary);
  color: var(--color-text-primary);
}

.hero-matrix {
  position: relative;
  align-self: end;
  margin: 0 clamp(1.5rem, 3.5vw, 3.4rem) clamp(1.5rem, 3.5vw, 3.4rem);
  border: 1px solid var(--color-text-primary);
  border-top: 5px solid var(--color-accent-blue);
  background: #fff;
}

.hero-matrix::before {
  position: absolute;
  top: -1.7rem;
  right: 0;
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  content: "PROCESS MAP";
}

.hero-matrix div {
  display: grid;
  min-height: 57px;
  grid-template-columns: 2.2rem 1fr auto;
  align-items: center;
  gap: 0.55rem;
  padding: 0 0.8rem;
}

.hero-matrix span {
  display: grid;
  width: 1.65rem;
  height: 1.65rem;
  place-items: center;
  background: var(--color-accent-primary);
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
}

.hero-matrix strong {
  font-family: var(--font-display);
  font-size: 0.94rem;
  font-weight: 700;
}

.hero-matrix small {
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.hero-matrix i {
  display: block;
  height: 1px;
  background: var(--planner-ui-line);
}

.partial-banner {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-top: 0.9rem;
  border: 1px solid var(--planner-warning-line);
  border-left: 5px solid var(--color-accent-orange);
  background: #fff8f1;
  padding: 0.72rem 0.9rem;
}

.partial-banner > span {
  flex: 0 0 auto;
  color: #8a3400;
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.partial-banner p {
  flex: 1;
  color: #5a3a1a;
  font-size: 0.78rem;
  line-height: 1.6;
}

.partial-banner a {
  flex: 0 0 auto;
  color: #7a3608;
  font-size: 0.76rem;
  text-decoration: none;
}

.partial-banner.progress-warning {
  border-color: var(--planner-progress-line);
  border-left-color: var(--planner-progress-line);
  background: #fffde7;
}

.partial-banner.progress-warning > span,
.partial-banner.progress-warning a {
  color: #5a5500;
}

.partial-banner.progress-warning p {
  color: #565015;
}

.planner-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
  align-items: start;
  gap: 1rem;
  margin-top: 1rem;
}

.output-stack {
  display: grid;
  gap: 1rem;
  margin-top: 1.4rem;
  scroll-margin-top: 1rem;
}

.awaiting-output {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  min-height: 270px;
  overflow: hidden;
  border-color: var(--planner-ui-line);
}

.awaiting-code {
  display: grid;
  place-items: center;
  background: var(--color-text-primary);
  color: var(--color-accent-primary);
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  writing-mode: vertical-rl;
}

.awaiting-body {
  padding: clamp(1.5rem, 4vw, 2.8rem);
}

.awaiting-body h2 {
  margin-top: 0.65rem;
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 3.8vw, 2.9rem);
  font-weight: 700;
  letter-spacing: -0.025em;
}

.awaiting-body > p {
  max-width: 700px;
  margin-top: 0.8rem;
  color: var(--color-text-secondary);
  font-size: 0.84rem;
  line-height: 1.75;
}

.output-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 1.3rem;
}

.output-preview span {
  border: 1px solid var(--planner-ui-line);
  padding: 0.38rem 0.55rem;
  color: var(--color-text-secondary);
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.07em;
}

.output-preview i {
  margin-right: 0.3rem;
  color: var(--color-accent-blue);
  font-style: normal;
}

@media (max-width: 1100px) {
  .hero {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(280px, 42vw) auto auto;
  }

  .hero-copy {
    margin-top: -3.5rem;
  }

  .hero-matrix {
    max-width: none;
    margin-top: 0;
  }

  .planner-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .planner-page {
    padding-top: 0.75rem;
  }

  .hero {
    grid-template-rows: 245px auto auto;
    border-top-width: 4px;
  }

  .hero-visual {
    background-size: 24px 24px;
  }

  .schematic-header {
    width: calc(100% - 2rem);
  }

  .schematic-column {
    top: 27%;
    width: 48px;
  }

  .schematic-column::after {
    height: 34px;
  }

  .schematic-column small {
    font-size: 0.7rem;
  }

  .schematic-column--a { left: 9%; }
  .schematic-column--b { left: 30%; top: 38%; }
  .schematic-column--c { left: 51%; top: 24%; }
  .schematic-column--d { left: 71%; top: 36%; }

  .schematic-link--battle {
    top: 33%;
    left: 12%;
    width: 18%;
    transform: rotate(20deg);
  }

  .schematic-link--combo {
    top: 43%;
    left: 31%;
    width: 20%;
    transform: rotate(-20deg);
  }

  .schematic-link--support {
    top: 33%;
    left: 53%;
    width: 18%;
    transform: rotate(14deg);
  }

  .schematic-link--ultimate {
    top: 45%;
    left: 34%;
    width: 32%;
    transform: rotate(-7deg);
  }

  .schematic-console {
    right: 0.65rem;
    bottom: 0.55rem;
    min-width: 160px;
    gap: 0.18rem;
  }

  .schematic-console span {
    padding: 0.18rem 0.35rem;
    font-size: 0.65rem;
    letter-spacing: 0.03em;
  }

  .hero-copy {
    margin-top: -2.5rem;
    padding: 1.15rem 1rem 1.25rem;
  }

  .hero-copy::before {
    width: 58px;
    height: 6px;
  }

  .hero h1 {
    margin-top: 0.6rem;
    font-size: clamp(2.65rem, 14.6vw, 4.1rem);
  }

  .hero-lede {
    margin-top: 0.9rem;
    font-size: 0.86rem;
    line-height: 1.72;
  }

  .hero-tags {
    margin-top: 0.9rem;
  }

  .hero-tags span {
    font-size: 0.75rem;
  }

  .hero-action {
    width: 100%;
    justify-content: space-between;
    margin-top: 1rem;
  }

  .hero-matrix {
    margin: 0 1rem 1rem;
  }

  .hero-matrix::before {
    display: none;
  }

  .hero-matrix div {
    min-height: 50px;
    grid-template-columns: 2rem 1fr;
    padding: 0 0.65rem;
  }

  .hero-matrix small {
    display: none;
  }

  .partial-banner {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .partial-banner p {
    flex-basis: 100%;
  }

  .awaiting-output {
    grid-template-columns: 1fr;
  }

  .awaiting-code {
    padding: 0.65rem 0.9rem;
    writing-mode: horizontal-tb;
  }
}
</style>
