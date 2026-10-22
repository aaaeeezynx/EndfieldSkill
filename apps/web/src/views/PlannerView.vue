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
        <div class="hero-copy">
          <p class="eyebrow">ENDFIELD // OWNED-ROSTER ORCHESTRATOR</p>
          <h1 class="display-title">
            你的四人，<br />
            <span>才是指令起点。</span>
          </h1>
          <p class="hero-lede">
            不再照抄固定队伍视频。锁定你实际拥有的四名角色，输入等级与剧情进度，
            取得确定性的技能释放条件、共享资源约束，以及通过装备穿戴等级筛选的配装方向。
          </p>
          <div class="hero-tags">
            <span>共享技力</span>
            <span>连携触发窗口</span>
            <span>终结技能量</span>
            <span>装备穿戴等级</span>
            <span>章节 / 配方权限待核验</span>
          </div>
        </div>

        <div class="hero-matrix" aria-label="使用流程">
          <div><span>01</span><strong>锁定四人</strong><small>OWNED ROSTER</small></div>
          <i></i>
          <div><span>02</span><strong>输入进度</strong><small>LEVEL / CHAPTER</small></div>
          <i></i>
          <div><span>03</span><strong>读取循环</strong><small>TRIGGER / WINDOW</small></div>
          <i></i>
          <div><span>04</span><strong>过滤装备</strong><small>FABRICATION GATE</small></div>
        </div>
      </section>

      <div v-if="partialFiles.length" class="partial-banner reveal">
        <span>PARTIAL DATA</span>
        <p>
          数据链路部分缺失：{{ partialFiles.join(' / ') }}。可用资料仍会渲染，缺失字段不会被补造。
        </p>
        <RouterLink to="/data">查看覆盖率 →</RouterLink>
      </div>

      <div v-if="hasUnverifiedProgressData" class="partial-banner progress-warning reveal">
        <span>PROGRESS UNVERIFIED</span>
        <p>
          章节与权限解锁资料尚未核验。你仍可选择四人并依装备穿戴等级生成结果；
          剧情章节、配方权限与“当前能否制造”不会被假装为已确认。
        </p>
        <RouterLink to="/data">查看资料边界 →</RouterLink>
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
            :recommendations="planner.report.equipment"
            :characters="planner.characters"
          />
        </template>

        <section v-else class="awaiting-output panel reveal">
          <div class="awaiting-code">OUTPUT//LOCKED</div>
          <div class="awaiting-body">
            <p class="eyebrow">TACTICAL PAYLOAD</p>
            <h2>等待四人编成与进度门槛。</h2>
            <p>
              结果将分为队伍匹配、技能序列、装备门槛三段。没有完整攻略时仅显示明确标注的规则回退，
              不会把推导结果包装成来源原文。
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
  padding-top: clamp(2rem, 5vw, 4.5rem);
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(330px, 0.8fr);
  align-items: end;
  gap: clamp(2rem, 6vw, 6rem);
  padding: 0.5rem 0 clamp(2rem, 4vw, 3.5rem);
}

.hero h1 {
  max-width: 850px;
  margin-top: 0.75rem;
  font-size: clamp(3.2rem, 7.2vw, 7rem);
}

.hero h1 span {
  color: var(--acid);
}

.hero-lede {
  max-width: 650px;
  margin-top: 1.4rem;
  color: #a8ae9f;
  font-size: clamp(0.78rem, 1.2vw, 0.92rem);
  line-height: 1.85;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 1.2rem;
}

.hero-tags span {
  border: 1px solid #3b4334;
  background: rgba(16, 19, 15, 0.5);
  padding: 0.25rem 0.45rem;
  color: #8d9486;
  font-size: 0.6rem;
}

.hero-matrix {
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  border: 1px solid var(--line);
  background:
    linear-gradient(120deg, rgba(124, 230, 212, 0.06), transparent 46%),
    rgba(16, 19, 15, 0.56);
  padding: 0.7rem 1rem;
}

.hero-matrix::before {
  content: "PROCESS MAP";
  position: absolute;
  top: -1.45rem;
  right: 0;
  color: #646b5e;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.56rem;
  letter-spacing: 0.12em;
}

.hero-matrix div {
  display: grid;
  grid-template-columns: 2rem 1fr auto;
  align-items: center;
  min-height: 49px;
  gap: 0.5rem;
}

.hero-matrix span {
  color: var(--acid);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.68rem;
  font-weight: 600;
}

.hero-matrix strong {
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
}

.hero-matrix small {
  color: #686f61;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.52rem;
  letter-spacing: 0.08em;
}

.hero-matrix i {
  height: 1px;
  background: linear-gradient(90deg, var(--line), transparent);
}

.partial-banner {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 1rem;
  border-left: 2px solid var(--ember);
  background: rgba(255, 156, 102, 0.06);
  padding: 0.65rem 0.8rem;
}

.partial-banner > span {
  flex: 0 0 auto;
  color: var(--ember);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.partial-banner p {
  flex: 1;
  color: #b7a08f;
  font-size: 0.62rem;
  line-height: 1.5;
}

.partial-banner a {
  flex: 0 0 auto;
  color: #c9b6a8;
  font-size: 0.6rem;
  text-decoration: none;
}

.partial-banner.progress-warning {
  border-left-color: var(--acid);
  background: rgba(216, 244, 91, 0.055);
}

.partial-banner.progress-warning > span {
  color: var(--acid);
}

.partial-banner.progress-warning p {
  color: #aeb79f;
}

.partial-banner.progress-warning a {
  color: #b6bea6;
}

.planner-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 350px);
  align-items: start;
  gap: 0.8rem;
}

.output-stack {
  display: grid;
  gap: 0.8rem;
  margin-top: 1.25rem;
  scroll-margin-top: 1rem;
}

.awaiting-output {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  min-height: 245px;
  overflow: hidden;
}

.awaiting-code {
  display: grid;
  place-items: center;
  border-right: 1px solid var(--line);
  color: #596052;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  writing-mode: vertical-rl;
}

.awaiting-body {
  padding: clamp(1.4rem, 4vw, 2.5rem);
}

.awaiting-body h2 {
  margin-top: 0.6rem;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: clamp(1.6rem, 3.5vw, 2.6rem);
  font-weight: 600;
  letter-spacing: -0.02em;
}

.awaiting-body > p {
  max-width: 670px;
  margin-top: 0.7rem;
  color: #858c7e;
  font-size: 0.72rem;
  line-height: 1.7;
}

.output-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 1.2rem;
}

.output-preview span {
  border: 1px solid #343b2e;
  padding: 0.35rem 0.5rem;
  color: #7e8577;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.58rem;
  font-weight: 600;
  letter-spacing: 0.07em;
}

.output-preview i {
  margin-right: 0.25rem;
  color: var(--acid);
  font-style: normal;
}

@media (max-width: 1000px) {
  .hero {
    grid-template-columns: 1fr;
    gap: 2.2rem;
  }

  .hero-matrix {
    max-width: 620px;
  }

  .planner-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .planner-page {
    padding-top: 1.5rem;
  }

  .hero {
    gap: 2rem;
    padding-top: 0;
  }

  .hero h1 {
    font-size: clamp(2.8rem, 15.5vw, 4.3rem);
  }

  .hero-matrix {
    padding: 0.55rem 0.7rem;
  }

  .hero-matrix div {
    grid-template-columns: 1.7rem 1fr;
  }

  .hero-matrix small {
    display: none;
  }

  .partial-banner {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .partial-banner p {
    flex-basis: calc(100% - 5.8rem);
  }

  .awaiting-output {
    grid-template-columns: 1fr;
  }

  .awaiting-code {
    padding: 0.55rem 0.8rem;
    border-right: 0;
    border-bottom: 1px solid var(--line);
    writing-mode: horizontal-tb;
  }
}
</style>
