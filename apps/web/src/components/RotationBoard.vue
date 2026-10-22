<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CharacterFact, RotationChoice, RotationStep } from '@/types/domain'

const props = defineProps<{
  choices: RotationChoice[]
  characters: CharacterFact[]
}>()

const activeChoiceId = ref(props.choices[0]?.id ?? '')

watch(
  () => props.choices,
  (choices) => {
    if (!choices.some((choice) => choice.id === activeChoiceId.value)) {
      activeChoiceId.value = choices[0]?.id ?? ''
    }
  },
)

const activeChoice = computed(
  () => props.choices.find((choice) => choice.id === activeChoiceId.value) ?? props.choices[0] ?? null,
)

const characterById = computed(
  () => new Map(props.characters.map((character) => [character.id, character])),
)

const orderedSteps = computed(() =>
  [...(activeChoice.value?.steps ?? [])].sort((a, b) => a.order - b.order),
)

const typeLabel = (step: RotationStep): string => {
  if (step.skillType === 'battle') return '战技'
  if (step.skillType === 'combo') return '连携技'
  if (step.skillType === 'ultimate') return '终结技'
  return '其他'
}

const resourceLabels = (step: RotationStep): string[] => {
  const labels: string[] = []
  if (step.skillType === 'battle') {
    labels.push(
      step.sharedSkillPointCost === null
        ? '共享技力 · 消耗未标注'
        : `共享技力 ${step.sharedSkillPointCost}`,
    )
  }
  if (step.skillType === 'combo') labels.push('不耗共享技力')
  if (step.skillType === 'ultimate') {
    labels.push(step.energyCost === null ? '终结技能量 · 需求未标注' : `终结技能量 ${step.energyCost}`)
  }
  if (step.cooldownSeconds !== null) labels.push(`冷却 ${step.cooldownSeconds}s`)
  if (step.skillType === 'combo') {
    labels.push(
      step.comboWindowSeconds === null
        ? '连携窗口 · 来源未标注'
        : `连携窗口 ${step.comboWindowSeconds}s`,
    )
  }
  return labels
}

const characterName = (characterId: string): string =>
  characterById.value.get(characterId)?.name ?? characterId
</script>

<template>
  <section v-if="activeChoice" class="rotation-board panel reveal">
    <div class="rotation-head">
      <div>
        <p class="eyebrow">05 / EXECUTION SEQUENCE</p>
        <h2>技能释放顺序</h2>
      </div>
      <div class="rotation-kind" :class="activeChoice.kind">
        <span>{{ activeChoice.kind === 'source-backed' ? 'SOURCE BACKED' : 'RULE FALLBACK' }}</span>
        <strong>{{ activeChoice.kind === 'source-backed' ? '攻略预设' : '规则生成' }}</strong>
      </div>
    </div>

    <div class="resource-doctrine" aria-label="战斗资源约束">
      <article>
        <span class="resource-code">SP</span>
        <div>
          <strong>共享技力</strong>
          <p>战技无常规冷却，但全队共用技力；每一步先确认余量。</p>
        </div>
      </article>
      <article>
        <span class="resource-code combo">TRG</span>
        <div>
          <strong>条件触发</strong>
          <p>连携技不耗技力，只在角色条件与连携窗口成立时接续。</p>
        </div>
      </article>
      <article>
        <span class="resource-code energy">EN</span>
        <div>
          <strong>终结能量</strong>
          <p>终结技依赖能量，不能只按普通秒表时间轴安排。</p>
        </div>
      </article>
      <a
        href="https://endfield.games/zh-Hans/tutorials/battle/"
        target="_blank"
        rel="noreferrer"
        class="doctrine-source"
      >
        官方战斗机制说明 ↗
      </a>
    </div>

    <div class="rotation-tabs" role="tablist" aria-label="循环方案">
      <button
        v-for="choice in choices"
        :key="choice.id"
        type="button"
        role="tab"
        :aria-selected="activeChoice.id === choice.id"
        :class="{ active: activeChoice.id === choice.id }"
        @click="activeChoiceId = choice.id"
      >
        <span>{{ choice.kind === 'source-backed' ? 'SOURCE' : 'RULE' }}</span>
        {{ choice.name }}
      </button>
    </div>

    <div v-if="activeChoice.kind === 'rule-generated'" class="fallback-banner">
      <span>RULE GENERATED / 待核对</span>
      <p>
        当前四人没有完整攻略循环。下面是按职业、技能类型、效果标签与技能顺序生成的确定性回退方案，
        不是攻略原文，也不代表帧级最优。
      </p>
    </div>

    <div class="rotation-overview">
      <p>{{ activeChoice.description }}</p>
      <div>
        <span>{{ orderedSteps.length }} STEPS</span>
        <span v-if="activeChoice.confidence !== null">CONFIDENCE {{ activeChoice.confidence }}</span>
        <span>NO AI RUNTIME</span>
      </div>
    </div>

    <ol v-if="orderedSteps.length" class="step-list">
      <li v-for="step in orderedSteps" :key="step.id" class="step-card">
        <div class="step-rail">
          <span class="step-number">{{ String(step.order).padStart(2, '0') }}</span>
          <i aria-hidden="true"></i>
        </div>

        <div class="step-content">
          <div class="step-title-row">
            <div>
              <span class="phase-label">{{ step.phase || '未标注阶段' }}</span>
              <h3>
                <span class="operator">{{ characterName(step.characterId) }}</span>
                <span class="skill-divider">/</span>
                {{ step.skillName }}
              </h3>
            </div>
            <span class="skill-type" :class="step.skillType">{{ typeLabel(step) }}</span>
          </div>

          <div class="resource-badges">
            <span v-for="label in resourceLabels(step)" :key="label">{{ label }}</span>
          </div>

          <div class="condition-grid">
            <div>
              <span>触发条件</span>
              <p>{{ step.triggerCondition || '来源未标注触发条件' }}</p>
            </div>
            <div>
              <span>等待条件</span>
              <p>{{ step.waitFor || '来源未标注等待条件' }}</p>
            </div>
          </div>

          <p v-if="step.note" class="step-note">{{ step.note }}</p>
          <ul v-if="step.warnings.length" class="step-warnings">
            <li v-for="warning in step.warnings" :key="warning">{{ warning }}</li>
          </ul>
        </div>
      </li>
    </ol>

    <div v-else class="rotation-empty">
      <strong>NO EXECUTABLE STEPS</strong>
      <p>当前数据没有可展示的技能步骤。等待技能字段补齐后再编排。</p>
    </div>

    <div v-if="activeChoice.warnings.length" class="rotation-warnings">
      <p v-for="warning in activeChoice.warnings" :key="warning"><span>!</span>{{ warning }}</p>
    </div>

    <p class="source-line">
      {{ activeChoice.sourceIds.length ? `SOURCES ${activeChoice.sourceIds.join(' / ')}` : 'SOURCES 未标注 · 规则生成' }}
    </p>
  </section>
</template>

<style scoped>
.rotation-board {
  padding: clamp(1rem, 2.5vw, 1.6rem);
}

.rotation-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--line);
}

.rotation-head h2 {
  margin-top: 0.2rem;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  font-weight: 700;
}

.rotation-kind {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
  color: var(--acid);
}

.rotation-kind.rule-generated {
  color: var(--ember);
}

.rotation-kind span {
  font-family: "Rajdhani", sans-serif;
  font-size: 0.56rem;
  font-weight: 700;
  letter-spacing: 0.13em;
}

.rotation-kind strong {
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1rem;
  font-weight: 600;
}

.resource-doctrine {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  gap: 1px;
  margin-top: 1rem;
  border: 1px solid var(--line);
  background: var(--line);
}

.resource-doctrine article {
  display: flex;
  min-width: 0;
  gap: 0.6rem;
  background: #171a15;
  padding: 0.75rem;
}

.resource-code {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--acid);
  color: var(--acid);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.63rem;
  font-weight: 700;
}

.resource-code.combo {
  border-color: var(--cyan);
  color: var(--cyan);
}

.resource-code.energy {
  border-color: var(--ember);
  color: var(--ember);
}

.resource-doctrine strong {
  font-size: 0.68rem;
  font-weight: 600;
}

.resource-doctrine p {
  margin-top: 0.18rem;
  color: #858c7e;
  font-size: 0.58rem;
  line-height: 1.5;
}

.doctrine-source {
  display: grid;
  place-items: center;
  background: #171a15;
  padding: 0.75rem;
  color: var(--cyan);
  font-size: 0.62rem;
  text-align: center;
  text-decoration: none;
}

.doctrine-source:hover {
  background: #20261d;
  color: var(--paper);
}

.rotation-tabs {
  display: flex;
  gap: 0.35rem;
  margin-top: 1rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  scrollbar-color: var(--line) transparent;
}

.rotation-tabs button {
  flex: 0 0 auto;
  border: 1px solid #3d4537;
  background: transparent;
  padding: 0.48rem 0.7rem;
  color: #969d8f;
  font-size: 0.65rem;
  cursor: pointer;
}

.rotation-tabs button span {
  margin-right: 0.35rem;
  color: #656c5e;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.53rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.rotation-tabs button.active {
  border-color: var(--acid);
  background: rgba(216, 244, 91, 0.06);
  color: var(--paper);
}

.rotation-tabs button.active span {
  color: var(--acid);
}

.fallback-banner {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.8rem;
  margin-top: 0.7rem;
  border-left: 2px solid var(--ember);
  background: rgba(255, 156, 102, 0.07);
  padding: 0.7rem 0.8rem;
}

.fallback-banner span {
  color: var(--ember);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.fallback-banner p {
  color: #c8ad9b;
  font-size: 0.64rem;
  line-height: 1.55;
}

.rotation-overview {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin: 1rem 0 1.2rem;
}

.rotation-overview > p {
  max-width: 700px;
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.65;
}

.rotation-overview > div {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.3rem;
}

.rotation-overview span {
  border: 1px solid #394132;
  padding: 0.18rem 0.35rem;
  color: #747b6d;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.52rem;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.step-list {
  display: grid;
  gap: 0;
  list-style: none;
}

.step-card {
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr);
  min-width: 0;
}

.step-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.step-number {
  display: grid;
  width: 35px;
  height: 35px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--acid);
  background: var(--ink);
  color: var(--acid);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.78rem;
  font-weight: 700;
}

.step-rail i {
  width: 1px;
  min-height: 22px;
  flex: 1;
  background: var(--line);
}

.step-card:last-child .step-rail i {
  background: linear-gradient(var(--line), transparent);
}

.step-content {
  min-width: 0;
  border-top: 1px solid #30372b;
  padding: 0.2rem 0 1.1rem 0.8rem;
}

.step-card:first-child .step-content {
  border-top-color: #48513f;
}

.step-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}

.phase-label {
  color: #737a6c;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.56rem;
  letter-spacing: 0.08em;
}

.step-title-row h3 {
  margin-top: 0.18rem;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.25;
}

.operator {
  color: var(--paper);
}

.skill-divider {
  margin: 0 0.25rem;
  color: var(--acid);
}

.skill-type {
  flex: 0 0 auto;
  border: 1px solid #4d5846;
  padding: 0.18rem 0.38rem;
  color: #afb4a7;
  font-size: 0.56rem;
}

.skill-type.battle {
  border-color: rgba(216, 244, 91, 0.5);
  color: var(--acid);
}

.skill-type.combo {
  border-color: rgba(124, 230, 212, 0.5);
  color: var(--cyan);
}

.skill-type.ultimate {
  border-color: rgba(255, 156, 102, 0.5);
  color: var(--ember);
}

.resource-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem;
  margin-top: 0.45rem;
}

.resource-badges span {
  background: rgba(238, 233, 220, 0.05);
  padding: 0.18rem 0.35rem;
  color: #a5ac9d;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.56rem;
}

.condition-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-top: 0.55rem;
  border: 1px solid #333a2e;
  background: #333a2e;
}

.condition-grid div {
  min-width: 0;
  background: rgba(16, 19, 15, 0.55);
  padding: 0.55rem 0.6rem;
}

.condition-grid span {
  color: #6f7668;
  font-size: 0.54rem;
}

.condition-grid p {
  margin-top: 0.22rem;
  color: #b8bdb0;
  font-size: 0.64rem;
  line-height: 1.55;
}

.step-note {
  margin-top: 0.55rem;
  color: #858c7e;
  font-size: 0.62rem;
  line-height: 1.6;
}

.step-warnings {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.5rem;
  list-style: none;
}

.step-warnings li {
  border-left: 1px solid var(--ember);
  padding-left: 0.35rem;
  color: #c7a08b;
  font-size: 0.56rem;
}

.rotation-warnings {
  display: grid;
  gap: 0.25rem;
  border-top: 1px solid var(--line);
  padding-top: 0.75rem;
}

.rotation-warnings p {
  display: flex;
  gap: 0.4rem;
  color: #b59c8c;
  font-size: 0.62rem;
}

.rotation-warnings span {
  color: var(--ember);
  font-family: "Rajdhani", sans-serif;
  font-weight: 700;
}

.rotation-empty {
  border: 1px dashed #3d4537;
  padding: 2.5rem 1rem;
  text-align: center;
}

.rotation-empty strong {
  color: var(--ember);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
}

.rotation-empty p {
  margin-top: 0.45rem;
  color: var(--muted);
  font-size: 0.68rem;
}

.source-line {
  margin-top: 0.8rem;
  color: #656c5e;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.56rem;
  letter-spacing: 0.08em;
  overflow-wrap: anywhere;
}

@media (max-width: 960px) {
  .resource-doctrine {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .doctrine-source {
    grid-column: 1 / -1;
    min-height: 34px;
  }
}

@media (max-width: 620px) {
  .rotation-head {
    align-items: flex-start;
  }

  .resource-doctrine {
    grid-template-columns: 1fr;
  }

  .rotation-overview {
    flex-direction: column;
  }

  .rotation-overview > div {
    justify-content: flex-start;
  }

  .condition-grid {
    grid-template-columns: 1fr;
  }

  .step-card {
    grid-template-columns: 36px minmax(0, 1fr);
  }

  .step-number {
    width: 29px;
    height: 29px;
    font-size: 0.68rem;
  }

  .step-content {
    padding-left: 0.55rem;
  }

  .fallback-banner {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }
}
</style>
