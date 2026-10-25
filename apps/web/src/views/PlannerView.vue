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
        <div class="hero-topline">
          <p>終末地 / 四人隊伍編排終端</p>
          <p><span class="hero-status-dot"></span>規則模式 · 等待建立隊伍</p>
        </div>

        <div class="hero-layout">
          <div class="hero-copy">
            <p class="eyebrow">四人隊伍編排流程</p>
            <h1 class="display-title">
              你的四人，<br />
              <span>共同承接每一道門檻。</span>
            </h1>
            <p class="hero-lede">
              從已擁有的四名角色開始，依等級與劇情進度設定門檻，排列技能釋放循環，
              最後檢查裝備穿戴與製造條件。每一步都留下可追溯的輸入與輸出。
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
              <svg viewBox="0 0 18 18" aria-hidden="true">
                <path d="M9 2v12M4 10l5 5 5-5" />
              </svg>
            </a>
          </div>

          <div class="hero-terminal" aria-label="四人隊伍編排流程圖">
            <div class="terminal-head">
              <div>
                <p class="terminal-overline">流程總線</p>
                <strong>四人隊伍編排</strong>
              </div>
              <span class="terminal-state">四槽 / 共同承接</span>
            </div>

            <ol class="flow-track" aria-label="編排流程方向">
              <li class="flow-step flow-step--select">
                <span class="flow-number">01</span>
                <div>
                  <strong>選擇 4 名已擁有角色</strong>
                  <small>先鎖定可用角色池</small>
                </div>
              </li>
              <li class="flow-connector" aria-hidden="true">
                <svg viewBox="0 0 32 16">
                  <path d="M2 8h22M19 3l5 5-5 5" />
                </svg>
              </li>
              <li class="flow-step flow-step--threshold">
                <span class="flow-number">02</span>
                <div>
                  <strong>設定等級／劇情門檻</strong>
                  <small>依進度限定可用條件</small>
                </div>
              </li>
              <li class="flow-connector" aria-hidden="true">
                <svg viewBox="0 0 32 16">
                  <path d="M2 8h22M19 3l5 5-5 5" />
                </svg>
              </li>
              <li class="flow-step flow-step--rotation">
                <span class="flow-number">03</span>
                <div>
                  <strong>排列技能釋放循環</strong>
                  <small>對齊戰技、連攜與終結</small>
                </div>
              </li>
              <li class="flow-connector" aria-hidden="true">
                <svg viewBox="0 0 32 16">
                  <path d="M2 8h22M19 3l5 5-5 5" />
                </svg>
              </li>
              <li class="flow-step flow-step--equipment">
                <span class="flow-number">04</span>
                <div>
                  <strong>檢查裝備穿戴與製造</strong>
                  <small>確認門檻與配方權限</small>
                </div>
              </li>
            </ol>

            <div class="terminal-divider">
              <span>四個角色槽 → 共同約束</span>
            </div>

            <div class="terminal-map">
              <section class="slot-bank">
                <div class="map-heading">
                  <strong>角色槽位</strong>
                  <span>04 個</span>
                </div>
                <div class="slot-grid">
                  <div class="role-slot">
                    <b>01</b>
                    <strong>已擁有</strong>
                    <small>待選擇</small>
                  </div>
                  <div class="role-slot">
                    <b>02</b>
                    <strong>已擁有</strong>
                    <small>待選擇</small>
                  </div>
                  <div class="role-slot">
                    <b>03</b>
                    <strong>已擁有</strong>
                    <small>待選擇</small>
                  </div>
                  <div class="role-slot">
                    <b>04</b>
                    <strong>已擁有</strong>
                    <small>待選擇</small>
                  </div>
                </div>
                <p>四個槽位都進入同一條技能與裝備檢查鏈。</p>
              </section>

              <div class="map-bridge" aria-hidden="true">
                <span></span>
                <svg viewBox="0 0 28 16">
                  <path d="M2 8h18M15 3l5 5-5 5" />
                </svg>
                <span></span>
              </div>

              <section class="gate-bank">
                <div class="map-heading">
                  <strong>共同承接</strong>
                  <span>輸出門</span>
                </div>
                <div class="gate-list">
                  <div class="gate-row gate-row--blue">
                    <i>技</i>
                    <div><strong>戰技</strong><small>共享技力與冷卻</small></div>
                    <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 9h12M10 4l5 5-5 5" /></svg>
                  </div>
                  <div class="gate-row gate-row--blue">
                    <i>連</i>
                    <div><strong>連攜</strong><small>觸發窗口與順序</small></div>
                    <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 9h12M10 4l5 5-5 5" /></svg>
                  </div>
                  <div class="gate-row gate-row--blue">
                    <i>終</i>
                    <div><strong>終結</strong><small>能量條件與釋放點</small></div>
                    <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 9h12M10 4l5 5-5 5" /></svg>
                  </div>
                  <div class="gate-row gate-row--orange">
                    <i>裝</i>
                    <div><strong>裝備門檻</strong><small>穿戴等級與製造條件</small></div>
                    <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 9h12M10 4l5 5-5 5" /></svg>
                  </div>
                </div>
              </section>
            </div>

            <div class="terminal-legend" aria-label="顏色圖例">
              <span class="legend-item legend-item--yellow"><i></i>黃色：選擇／重點</span>
              <span class="legend-item legend-item--blue"><i></i>藍色：技能流</span>
              <span class="legend-item legend-item--orange"><i></i>橘色：裝備門檻</span>
              <span class="legend-item legend-item--black"><i></i>黑色：主要資訊</span>
            </div>
          </div>

          <p class="hero-disclaimer">
            流程圖說明工具運作方式，不代表固定隊伍或固定技能順序。
          </p>
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
  gap: clamp(1.1rem, 2.6vw, 2.2rem);
  overflow: hidden;
  border: 1px solid var(--planner-ui-line);
  border-top: 6px solid var(--color-text-primary);
  background: #ffffff;
  padding: clamp(1.25rem, 3vw, 2.6rem);
}

.hero::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(90deg, rgba(25, 25, 25, 0.04) 1px, transparent 1px),
    linear-gradient(0deg, rgba(25, 25, 25, 0.04) 1px, transparent 1px);
  background-size: 34px 34px;
  content: "";
}

.hero-topline,
.hero-layout {
  position: relative;
  z-index: 1;
}

.hero-topline {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  border-bottom: 1px solid var(--planner-ui-line);
  padding-bottom: 0.6rem;
}

.hero-topline p {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--planner-body-muted);
  font-family: var(--font-display);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.hero-status-dot {
  width: 0.7rem;
  height: 0.7rem;
  background: var(--color-accent-orange);
  border: 1px solid var(--color-text-primary);
  content: "";
}

.hero-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.95fr);
  align-items: start;
  gap: clamp(1.2rem, 3vw, 2.6rem);
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

/* ---- Endfield-style hero terminal (replaces the removed key visual) ---- */
.hero-terminal {
  border: 1px solid var(--planner-ui-line);
  border-top: 5px solid var(--color-accent-blue);
  background: #ffffff;
  padding: clamp(1.1rem, 2.4vw, 1.9rem);
}

.terminal-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--planner-ui-line);
  padding-bottom: 0.6rem;
}

.terminal-overline {
  color: var(--planner-body-muted);
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.terminal-head strong {
  display: block;
  margin-top: 0.15rem;
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.terminal-state {
  border: 1px solid var(--planner-ui-line);
  background: var(--color-bg-secondary);
  padding: 0.3rem 0.55rem;
  color: var(--planner-body-muted);
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.flow-track {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: stretch;
  gap: 0.4rem;
  margin-top: 1rem;
}

.flow-connector {
  align-self: center;
  display: grid;
  place-items: center;
  color: var(--color-accent-blue);
}

.flow-connector svg {
  width: 100%;
  height: 16px;
}

.flow-step {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.5rem;
  align-items: start;
  border: 1px solid var(--planner-ui-line);
  border-left-width: 4px;
  background: #ffffff;
  padding: 0.65rem 0.7rem;
}

.flow-step--select { border-left-color: var(--color-accent-primary); }
.flow-step--threshold { border-left-color: var(--color-text-primary); }
.flow-step--rotation { border-left-color: var(--color-accent-blue); }
.flow-step--equipment { border-left-color: var(--color-accent-orange); }

.flow-number {
  display: grid;
  place-items: center;
  width: 1.9rem;
  height: 1.9rem;
  border: 1px solid var(--color-text-primary);
  background: var(--color-text-primary);
  color: #ffffff;
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 700;
}

.flow-step--select .flow-number {
  background: var(--color-accent-primary);
  color: var(--color-text-primary);
}

.flow-step--equipment .flow-number {
  background: var(--color-accent-orange);
  color: #ffffff;
}

.flow-step strong {
  display: block;
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.3;
}

.flow-step small {
  display: block;
  margin-top: 0.2rem;
  color: var(--planner-body-muted);
  font-size: 0.78rem;
  line-height: 1.4;
}

.terminal-divider {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 1.1rem 0 0.9rem;
  color: var(--planner-body-muted);
  font-family: var(--font-display);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.terminal-divider::before,
.terminal-divider::after {
  content: "";
  height: 1px;
  flex: 1;
  background: var(--planner-ui-line);
}

.terminal-map {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1.1fr);
  align-items: stretch;
  gap: 0.8rem;
}

.slot-bank,
.gate-bank {
  border: 1px solid var(--planner-ui-line);
  background: #ffffff;
  padding: 0.8rem 0.9rem;
}

.slot-bank { border-top: 4px solid var(--color-accent-primary); }
.gate-bank { border-top: 4px solid var(--color-accent-blue); }

.map-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  border-bottom: 1px solid var(--planner-ui-line);
  padding-bottom: 0.4rem;
}

.map-heading strong {
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
}

.map-heading span {
  color: var(--planner-body-muted);
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.slot-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 0.7rem;
}

.role-slot {
  display: grid;
  gap: 0.1rem;
  border: 1px solid var(--planner-ui-line);
  border-left-width: 3px;
  border-left-color: var(--color-accent-primary);
  background: #fffdf2;
  padding: 0.45rem 0.55rem;
}

.role-slot b {
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 700;
}

.role-slot strong {
  color: var(--color-text-primary);
  font-size: 0.82rem;
}

.role-slot small {
  color: var(--planner-body-muted);
  font-size: 0.76rem;
}

.slot-bank > p {
  margin-top: 0.7rem;
  color: var(--planner-body-muted);
  font-size: 0.8rem;
  line-height: 1.55;
}

.map-bridge {
  align-self: center;
  display: grid;
  place-items: center;
  gap: 0.2rem;
}

.map-bridge span {
  width: 1px;
  height: 0.6rem;
  background: var(--planner-ui-line);
}

.map-bridge svg {
  width: 28px;
  height: 16px;
  color: var(--color-accent-blue);
}

.gate-list {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.7rem;
}

.gate-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.55rem;
  border: 1px solid var(--planner-ui-line);
  background: #ffffff;
  padding: 0.5rem 0.6rem;
}

.gate-row--blue { border-left-width: 4px; border-left-color: var(--color-accent-blue); }
.gate-row--blue i { background: var(--color-accent-blue); color: #ffffff; }
.gate-row--orange { border-left-width: 4px; border-left-color: var(--color-accent-orange); }
.gate-row--orange i { background: var(--color-accent-orange); color: #ffffff; }

.gate-row strong {
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

.gate-row small {
  display: block;
  margin-top: 0.1rem;
  color: var(--planner-body-muted);
  font-size: 0.76rem;
}

.gate-row svg {
  width: 14px;
  height: 14px;
  color: var(--planner-body-muted);
}

/* Decorative directional arrows: outline-only strokes, no fill. */
.flow-connector svg,
.map-bridge svg,
.gate-row svg,
.hero-action svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.hero-action svg {
  width: 1.1rem;
  height: 1.1rem;
  stroke: var(--color-accent-primary);
}

.terminal-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 1.1rem;
  margin-top: 1.1rem;
  border-top: 1px dashed var(--planner-ui-line);
  padding-top: 0.7rem;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--planner-body-muted);
  font-size: 0.8rem;
}

.legend-item i {
  width: 0.95rem;
  height: 0.95rem;
  border: 1px solid var(--color-text-primary);
}

.legend-item--yellow i { background: var(--color-accent-primary); }
.legend-item--blue i { background: var(--color-accent-blue); }
.legend-item--orange i { background: var(--color-accent-orange); }
.legend-item--black i { background: var(--color-text-primary); }

@media (max-width: 1100px) {
  .hero-layout {
    grid-template-columns: 1fr;
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
    padding: 1.1rem 1rem 1.2rem;
  }

  .hero-topline {
    flex-direction: column;
    gap: 0.3rem;
  }

  .hero h1 {
    margin-top: 0.6rem;
    font-size: clamp(2.65rem, 12vw, 4.1rem);
  }

  .hero-lede {
    margin-top: 0.9rem;
    font-size: 0.9rem;
    line-height: 1.72;
  }

  .hero-tags span {
    font-size: 0.75rem;
  }

  .hero-action {
    width: 100%;
    justify-content: space-between;
    margin-top: 1rem;
  }

  .hero-terminal {
    padding: 1rem;
  }

  .flow-track {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .flow-connector {
    justify-self: start;
    height: 1.3rem;
    transform: rotate(90deg);
  }

  .terminal-map {
    grid-template-columns: 1fr;
    gap: 0.9rem;
  }

  .map-bridge {
    flex-direction: column;
    height: 1.6rem;
  }

  .map-bridge svg {
    transform: rotate(90deg);
  }

  .terminal-legend {
    gap: 0.5rem 0.8rem;
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
