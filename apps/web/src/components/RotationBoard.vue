<script lang="ts">
export const clampStepIndex = (index: number, total: number): number => {
  if (total <= 0) return -1
  return Math.min(Math.max(index, 0), total - 1)
}

export const moveStepIndex = (
  current: number,
  total: number,
  direction: -1 | 1,
): number => {
  if (total <= 0) return -1
  const safeCurrent = clampStepIndex(current, total)
  return clampStepIndex(safeCurrent + direction, total)
}
</script>

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
  () =>
    props.choices.find((choice) => choice.id === activeChoiceId.value) ??
    props.choices[0] ??
    null,
)

const characterById = computed(
  () => new Map(props.characters.map((character) => [character.id, character])),
)

const orderedSteps = computed(() =>
  [...(activeChoice.value?.steps ?? [])].sort((a, b) => a.order - b.order),
)

const currentStepIndex = ref(-1)

watch(
  () => activeChoice.value?.id ?? '',
  () => {
    currentStepIndex.value = orderedSteps.value.length ? 0 : -1
  },
  { immediate: true },
)

watch(
  () => orderedSteps.value.length,
  (total) => {
    currentStepIndex.value = total ? clampStepIndex(currentStepIndex.value, total) : -1
  },
)

const currentStep = computed(
  () =>
    currentStepIndex.value >= 0
      ? orderedSteps.value[currentStepIndex.value] ?? null
      : null,
)

const hasPreviousStep = computed(
  () => currentStepIndex.value > 0 && orderedSteps.value.length > 0,
)

const hasNextStep = computed(
  () =>
    currentStepIndex.value >= 0 &&
    currentStepIndex.value < orderedSteps.value.length - 1,
)

const stepPositionLabel = computed(() => {
  if (!orderedSteps.value.length) return '0 / 0'
  return `${currentStepIndex.value + 1} / ${orderedSteps.value.length}`
})

const skillFrequencyAsset = `${import.meta.env.BASE_URL}assets/official/skill-frequency.png`

const selectStep = (index: number): void => {
  currentStepIndex.value = clampStepIndex(index, orderedSteps.value.length)
}

const previousStep = (): void => {
  currentStepIndex.value = moveStepIndex(
    currentStepIndex.value,
    orderedSteps.value.length,
    -1,
  )
}

const nextStep = (): void => {
  currentStepIndex.value = moveStepIndex(
    currentStepIndex.value,
    orderedSteps.value.length,
    1,
  )
}

const firstStep = (): void => {
  selectStep(0)
}

const lastStep = (): void => {
  selectStep(orderedSteps.value.length - 1)
}

const typeLabel = (step: RotationStep): string => {
  if (step.skillType === 'battle') return '戰技'
  if (step.skillType === 'combo') return '連攜技'
  if (step.skillType === 'ultimate') return '終結技'
  return '其他'
}

const resourceLabels = (step: RotationStep): string[] => {
  const labels: string[] = []
  if (step.skillType === 'battle') {
    labels.push(
      step.sharedSkillPointCost === null
        ? '共享技力 · 消耗未標註'
        : `共享技力 ${step.sharedSkillPointCost}`,
    )
  }
  if (step.skillType === 'combo') labels.push('不耗共享技力')
  if (step.skillType === 'ultimate') {
    labels.push(
      step.energyCost === null
        ? '終結技能量 · 需求未標註'
        : `終結技能量 ${step.energyCost}`,
    )
  }
  if (step.cooldownSeconds !== null) labels.push(`冷卻 ${step.cooldownSeconds} 秒`)
  if (step.skillType === 'combo') {
    labels.push(
      step.comboWindowSeconds === null
        ? '連攜窗口 · 來源未標註'
        : `連攜窗口 ${step.comboWindowSeconds} 秒`,
    )
  }
  return labels
}

const characterName = (characterId: string): string => {
  if (characterId === 'chr_0002_endminm') return '管理員'
  return characterById.value.get(characterId)?.name ?? characterId
}
</script>

<template>
  <section v-if="activeChoice" class="rotation-board panel reveal">
    <div class="rotation-head">
      <div>
        <p class="eyebrow">05 / EXECUTION SEQUENCE</p>
        <h2>技能釋放順序</h2>
      </div>
      <div class="rotation-kind" :class="activeChoice.kind">
        <span>{{ activeChoice.kind === 'source-backed' ? 'SOURCE BACKED' : 'RULE FALLBACK' }}</span>
        <strong>{{ activeChoice.kind === 'source-backed' ? '攻略預設' : '規則生成' }}</strong>
      </div>
    </div>

    <div class="resource-doctrine" aria-label="戰鬥資源約束">
      <article>
        <span class="resource-code">SP</span>
        <div>
          <strong>共享技力</strong>
          <p>戰技沒有一般冷卻，但全隊共用技力；每一步先確認剩餘量。</p>
        </div>
      </article>
      <article>
        <span class="resource-code combo">TRG</span>
        <div>
          <strong>條件觸發</strong>
          <p>連攜技不耗技力，只在角色條件與連攜窗口成立時接續。</p>
        </div>
      </article>
      <article>
        <span class="resource-code energy">EN</span>
        <div>
          <strong>終結能量</strong>
          <p>終結技依賴能量，不能只按一般時間軸安排。</p>
        </div>
      </article>
      <a
        href="https://endfield.gryphline.com/zh-tw#home"
        target="_blank"
        rel="noreferrer"
        class="doctrine-source"
      >
        官方戰鬥機制說明 ↗
      </a>
    </div>

    <div class="rotation-tabs" role="tablist" aria-label="循環方案">
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
      <span>RULE GENERATED / 待核對</span>
      <p>
        目前隊伍沒有完整攻略循環。以下依職業、技能類型、效果標籤與技能順序產生確定性回退方案，
        不是攻略原文，也不代表逐幀最佳。
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

    <section
      v-if="orderedSteps.length"
      class="step-controller"
      tabindex="0"
      aria-label="技能循環手動步進控制器"
      @keydown.left.prevent="previousStep"
      @keydown.up.prevent="previousStep"
      @keydown.right.prevent="nextStep"
      @keydown.down.prevent="nextStep"
      @keydown.home.prevent="firstStep"
      @keydown.end.prevent="lastStep"
    >
      <img
        class="frequency-decoration"
        :src="skillFrequencyAsset"
        alt=""
        aria-hidden="true"
      />

      <div class="controller-head">
        <div>
          <span class="controller-kicker">MANUAL STEP / 手動逐步</span>
          <strong>目前第 {{ stepPositionLabel }} 步</strong>
          <p>使用上一步／下一步或方向鍵逐步查看，不自動播放。</p>
        </div>
        <div class="step-controls" role="group" aria-label="目前技能步驟控制">
          <button
            type="button"
            :disabled="!hasPreviousStep"
            aria-controls="rotation-step-list"
            @click="previousStep"
          >
            ← 上一步
          </button>
          <button
            type="button"
            :disabled="!hasNextStep"
            aria-controls="rotation-step-list"
            @click="nextStep"
          >
            下一步 →
          </button>
        </div>
      </div>

      <div
        v-if="currentStep"
        :key="currentStep.id"
        class="current-step-panel"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div class="current-step-marker">
          <span>NOW</span>
          <strong>{{ stepPositionLabel }}</strong>
        </div>
        <div class="current-step-body">
          <div class="current-step-title">
            <div>
              <span>目前步驟</span>
              <h3>
                {{ characterName(currentStep.characterId) }}
                <i aria-hidden="true">/</i>
                {{ currentStep.skillName }}
              </h3>
            </div>
            <span class="skill-type" :class="currentStep.skillType">
              {{ typeLabel(currentStep) }}
            </span>
          </div>
          <dl class="current-step-facts">
            <div>
              <dt>角色</dt>
              <dd>{{ characterName(currentStep.characterId) }}</dd>
            </div>
            <div>
              <dt>技能</dt>
              <dd>{{ currentStep.skillName }}</dd>
            </div>
            <div>
              <dt>觸發條件</dt>
              <dd>{{ currentStep.triggerCondition || '來源未標註觸發條件' }}</dd>
            </div>
            <div>
              <dt>等待／承接時機</dt>
              <dd>{{ currentStep.waitFor || '來源未標註等待／承接時機' }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>

    <ol v-if="orderedSteps.length" id="rotation-step-list" class="step-list">
      <li
        v-for="(step, index) in orderedSteps"
        :key="step.id"
        class="step-card"
        :class="{ 'is-current': currentStepIndex === index }"
        :aria-current="currentStepIndex === index ? 'step' : undefined"
      >
        <div class="step-rail">
          <button
            type="button"
            class="step-number"
            :aria-label="`查看第 ${index + 1} 步：${characterName(step.characterId)}，${step.skillName}`"
            :aria-current="currentStepIndex === index ? 'step' : undefined"
            @click="selectStep(index)"
          >
            {{ String(step.order).padStart(2, '0') }}
          </button>
          <i aria-hidden="true"></i>
        </div>

        <div class="step-content">
          <div class="step-title-row">
            <div>
              <span class="phase-label">{{ step.phase || '未標註階段' }}</span>
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
              <span>觸發條件</span>
              <p>{{ step.triggerCondition || '來源未標註觸發條件' }}</p>
            </div>
            <div>
              <span>等待條件</span>
              <p>{{ step.waitFor || '來源未標註等待條件' }}</p>
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
      <p>目前資料沒有可展示的技能步驟。等待技能欄位補齊後再編排。</p>
    </div>

    <div v-if="activeChoice.warnings.length" class="rotation-warnings">
      <p v-for="warning in activeChoice.warnings" :key="warning">
        <span>!</span>{{ warning }}
      </p>
    </div>

    <p class="source-line">
      {{
        activeChoice.sourceIds.length
          ? `SOURCES ${activeChoice.sourceIds.join(' / ')}`
          : 'SOURCES 未標註 · 規則生成'
      }}
    </p>
  </section>
</template>

<style scoped>
.rotation-board {
  min-width: 0;
  padding: clamp(1.15rem, 2.7vw, 1.8rem);
}

.rotation-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border-primary);
  padding-bottom: 1rem;
}

.rotation-head h2 {
  margin-top: 0.25rem;
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: clamp(1.9rem, 3.6vw, 2.65rem);
  font-weight: 700;
  letter-spacing: -0.025em;
}

.rotation-kind {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
  color: var(--color-accent-blue);
}

.rotation-kind.rule-generated {
  color: #8f3f00;
}

.rotation-kind span {
  font-family: var(--font-display);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.13em;
}

.rotation-kind strong {
  font-family: var(--font-display);
  font-size: 1.08rem;
  font-weight: 700;
}

.resource-doctrine {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
  gap: 1px;
  margin-top: 1rem;
  border: 1px solid var(--color-border-primary);
  background: var(--color-border-primary);
}

.resource-doctrine article {
  display: flex;
  min-width: 0;
  gap: 0.65rem;
  background: #f7f7f7;
  padding: 0.8rem;
}

.resource-code {
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  place-items: center;
  background: var(--color-text-primary);
  color: var(--color-accent-primary);
  font-family: var(--font-display);
  font-size: 0.68rem;
  font-weight: 700;
}

.resource-code.combo {
  background: var(--color-accent-blue);
  color: #fff;
}

.resource-code.energy {
  background: var(--color-accent-orange);
  color: #fff;
}

.resource-doctrine strong {
  color: var(--color-text-primary);
  font-size: 0.78rem;
  font-weight: 700;
}

.resource-doctrine p {
  margin-top: 0.2rem;
  color: var(--color-text-secondary);
  font-size: 0.69rem;
  line-height: 1.55;
}

.doctrine-source {
  display: grid;
  place-items: center;
  background: #fff;
  padding: 0.8rem;
  color: var(--color-accent-blue);
  font-size: 0.7rem;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
}

.doctrine-source:hover {
  background: var(--color-accent-blue);
  color: #fff;
}

.rotation-tabs {
  display: flex;
  gap: 0.4rem;
  max-width: 100%;
  margin-top: 1rem;
  overflow-x: auto;
  padding-bottom: 0.3rem;
  scrollbar-color: #949494 transparent;
}

.rotation-tabs button {
  flex: 0 0 auto;
  border: 1px solid #949494;
  background: #fff;
  padding: 0.52rem 0.75rem;
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  cursor: pointer;
}

.rotation-tabs button span {
  margin-right: 0.4rem;
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.rotation-tabs button.active {
  border-color: var(--color-text-primary);
  background: var(--color-text-primary);
  color: #fff;
}

.rotation-tabs button.active span {
  color: var(--color-accent-primary);
}

.fallback-banner {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.8rem;
  margin-top: 0.75rem;
  border: 1px solid #8f3f00;
  border-left: 5px solid var(--color-accent-orange);
  background: #fff8f1;
  padding: 0.75rem 0.85rem;
}

.fallback-banner span {
  color: #8f3f00;
  font-family: var(--font-display);
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.fallback-banner p {
  color: #5c3a00;
  font-size: 0.73rem;
  line-height: 1.6;
}

.rotation-overview {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin: 1rem 0 1.2rem;
}

.rotation-overview > p {
  max-width: 760px;
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  line-height: 1.7;
}

.rotation-overview > div {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.35rem;
}

.rotation-overview span {
  border: 1px solid var(--color-border-primary);
  background: var(--color-bg-secondary);
  padding: 0.2rem 0.38rem;
  color: var(--color-text-secondary);
  font-family: var(--font-display);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.step-controller {
  position: relative;
  overflow: hidden;
  margin-bottom: 1.25rem;
  border: 1px solid var(--color-border-strong);
  background:
    linear-gradient(var(--color-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--color-grid-line) 1px, transparent 1px),
    #f7f7f7;
  background-size: 24px 24px;
}

.step-controller:focus-visible {
  outline: 3px solid var(--color-accent-blue);
  outline-offset: 3px;
}

.frequency-decoration {
  position: absolute;
  z-index: 0;
  top: 0.4rem;
  right: 0.7rem;
  width: clamp(5.5rem, 14vw, 9rem);
  opacity: 0.14;
  pointer-events: none;
  animation: frequency-enter 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.controller-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border-primary);
  background: #ffffff;
  padding: 1rem clamp(6.5rem, 16vw, 10.5rem) 1rem 1rem;
}

.controller-kicker {
  display: block;
  color: var(--color-accent-blue);
  font-family: var(--font-display);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.controller-head strong {
  display: block;
  margin-top: 0.18rem;
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 1.08rem;
  font-weight: 700;
}

.controller-head p {
  margin-top: 0.2rem;
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  line-height: 1.55;
}

.step-controls {
  display: flex;
  flex: 0 0 auto;
  gap: 0.45rem;
}

.step-controls button {
  min-height: 44px;
  border: 1px solid var(--color-border-strong);
  background: #ffffff;
  padding: 0.55rem 0.8rem;
  color: var(--color-text-primary);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.step-controls button:not(:disabled):hover {
  background: var(--color-text-primary);
  color: var(--color-text-inverse);
}

.step-controls button:focus-visible {
  outline: 3px solid var(--color-accent-blue);
  outline-offset: 2px;
}

.step-controls button:disabled {
  border-color: var(--color-border-primary);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  cursor: not-allowed;
}

.current-step-panel {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1px;
  background: var(--color-border-primary);
  animation: step-focus-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.current-step-marker {
  display: flex;
  min-width: 92px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  background: var(--color-accent-primary);
  padding: 1rem 0.8rem;
  color: var(--color-text-primary);
}

.current-step-marker span {
  font-family: var(--font-display);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.16em;
}

.current-step-marker strong {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1;
}

.current-step-body {
  min-width: 0;
  background: #fffde5;
  padding: 0.9rem 1rem;
}

.current-step-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}

.current-step-title > div {
  min-width: 0;
}

.current-step-title > div > span {
  color: var(--color-text-secondary);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.current-step-title h3 {
  margin-top: 0.16rem;
  overflow-wrap: anywhere;
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 1.16rem;
  font-weight: 700;
  line-height: 1.3;
}

.current-step-title h3 i {
  margin: 0 0.25rem;
  color: var(--color-accent-blue);
  font-style: normal;
}

.current-step-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-top: 0.7rem;
  border: 1px solid var(--color-border-primary);
  background: var(--color-border-primary);
}

.current-step-facts div {
  min-width: 0;
  background: #ffffff;
  padding: 0.55rem 0.65rem;
}

.current-step-facts dt {
  color: var(--color-text-secondary);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.current-step-facts dd {
  margin-top: 0.2rem;
  overflow-wrap: anywhere;
  color: var(--color-text-primary);
  font-size: 0.8rem;
  line-height: 1.55;
}

.step-list {
  display: grid;
  gap: 0;
  list-style: none;
}

.step-card {
  display: grid;
  min-width: 0;
  grid-template-columns: 54px minmax(0, 1fr);
}

.step-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.step-number {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--color-text-primary);
  background: #ffffff;
  padding: 0;
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.step-number:hover,
.step-number:focus-visible {
  background: var(--color-text-primary);
  color: var(--color-text-inverse);
}

.step-number:focus-visible {
  outline: 3px solid var(--color-accent-blue);
  outline-offset: 2px;
}

.step-card.is-current .step-number {
  border-width: 2px;
  background: var(--color-accent-primary);
  color: var(--color-text-primary);
}

.step-rail i {
  width: 1px;
  min-height: 24px;
  flex: 1;
  background: #949494;
}

.step-card:last-child .step-rail i {
  background: linear-gradient(#949494, transparent);
}

.step-content {
  min-width: 0;
  border-top: 1px solid var(--color-border-primary);
  padding: 0.2rem 0 1.2rem 0.85rem;
}

.step-card:first-child .step-content {
  border-top-color: var(--color-text-primary);
}

.step-card.is-current .step-content {
  margin: 0.3rem 0 1rem;
  border: 1px solid var(--color-border-strong);
  border-left: 6px solid var(--color-accent-primary);
  background: #fffde5;
  padding: 0.8rem 0.85rem;
  animation: step-focus-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.step-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.8rem;
}

.step-title-row > div {
  min-width: 0;
}

.phase-label {
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.step-title-row h3 {
  margin-top: 0.2rem;
  overflow-wrap: anywhere;
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.3;
}

.operator {
  color: var(--color-text-primary);
}

.skill-divider {
  margin: 0 0.28rem;
  color: var(--color-accent-blue);
}

.skill-type {
  flex: 0 0 auto;
  border: 1px solid #949494;
  background: #f7f7f7;
  padding: 0.2rem 0.4rem;
  color: var(--color-text-secondary);
  font-size: 0.64rem;
  font-weight: 700;
}

.skill-type.battle {
  border-color: #191919;
  background: var(--color-accent-primary);
  color: #191919;
}

.skill-type.combo {
  border-color: var(--color-accent-blue);
  background: #eef3ff;
  color: var(--color-accent-blue);
}

.skill-type.ultimate {
  border-color: var(--color-accent-orange);
  background: #fff4ec;
  color: #8f3f00;
}

.resource-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.5rem;
}

.resource-badges span {
  border: 1px solid #949494;
  background: #f7f7f7;
  padding: 0.2rem 0.38rem;
  color: var(--color-text-secondary);
  font-family: var(--font-display);
  font-size: 0.64rem;
}

.condition-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-top: 0.6rem;
  border: 1px solid #949494;
  background: #949494;
}

.condition-grid div {
  min-width: 0;
  background: #fafafa;
  padding: 0.6rem 0.65rem;
}

.condition-grid span {
  color: var(--color-text-tertiary);
  font-size: 0.62rem;
  font-weight: 700;
}

.condition-grid p {
  margin-top: 0.24rem;
  overflow-wrap: anywhere;
  color: var(--color-text-primary);
  font-size: 0.74rem;
  line-height: 1.6;
}

.step-note {
  margin-top: 0.6rem;
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  line-height: 1.65;
}

.step-warnings {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.55rem;
  list-style: none;
}

.step-warnings li {
  border-left: 3px solid var(--color-accent-orange);
  background: #fff7ef;
  padding: 0.2rem 0.38rem;
  color: #5c3a00;
  font-size: 0.65rem;
}

.rotation-warnings {
  display: grid;
  gap: 0.3rem;
  border-top: 1px solid var(--color-border-primary);
  padding-top: 0.8rem;
}

.rotation-warnings p {
  display: flex;
  gap: 0.45rem;
  color: #5c3a00;
  font-size: 0.72rem;
}

.rotation-warnings span {
  color: var(--color-accent-orange);
  font-family: var(--font-display);
  font-weight: 700;
}

.rotation-empty {
  border: 1px dashed #949494;
  background: #f7f7f7;
  padding: 2.5rem 1rem;
  text-align: center;
}

.rotation-empty strong {
  color: #8f3f00;
  font-family: var(--font-display);
  font-size: 0.8rem;
  letter-spacing: 0.12em;
}

.rotation-empty p {
  margin-top: 0.45rem;
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}

.source-line {
  margin-top: 0.85rem;
  overflow-wrap: anywhere;
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
}

@keyframes frequency-enter {
  from {
    opacity: 0;
    transform: translateY(-0.25rem);
  }

  to {
    opacity: 0.14;
    transform: translateY(0);
  }
}

@keyframes step-focus-in {
  from {
    opacity: 0.55;
    transform: translateY(0.25rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 960px) {
  .resource-doctrine {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .doctrine-source {
    grid-column: 1 / -1;
    min-height: 38px;
  }

  .controller-head {
    align-items: stretch;
    flex-direction: column;
    padding-right: 7.5rem;
  }

  .step-controls {
    align-self: flex-start;
  }
}

@media (max-width: 620px) {
  .rotation-board {
    padding: 1rem;
  }

  .rotation-head {
    align-items: flex-start;
  }

  .rotation-head h2 {
    font-size: 1.9rem;
  }

  .rotation-kind span {
    font-size: 0.6rem;
  }

  .resource-doctrine {
    grid-template-columns: 1fr;
  }

  .resource-doctrine article {
    padding: 0.7rem;
  }

  .rotation-overview {
    flex-direction: column;
  }

  .rotation-overview > div {
    justify-content: flex-start;
  }

  .frequency-decoration {
    top: 0.35rem;
    right: 0.35rem;
    width: 5.25rem;
  }

  .controller-head {
    gap: 0.75rem;
    padding: 0.85rem 5.9rem 0.85rem 0.85rem;
  }

  .step-controls {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .step-controls button {
    padding-inline: 0.45rem;
  }

  .current-step-panel {
    grid-template-columns: 1fr;
  }

  .current-step-marker {
    min-width: 0;
    flex-direction: row;
    justify-content: flex-start;
    padding: 0.65rem 0.85rem;
  }

  .current-step-marker strong {
    font-size: 1.1rem;
  }

  .current-step-body {
    padding: 0.8rem;
  }

  .current-step-facts {
    grid-template-columns: 1fr;
  }

  .condition-grid {
    grid-template-columns: 1fr;
  }

  .step-card {
    grid-template-columns: 38px minmax(0, 1fr);
  }

  .step-number {
    width: 30px;
    height: 30px;
    font-size: 0.7rem;
  }

  .step-content {
    padding-left: 0.55rem;
  }

  .step-card.is-current .step-content {
    padding: 0.75rem;
  }

  .step-title-row {
    gap: 0.5rem;
  }

  .step-title-row h3 {
    font-size: 1rem;
  }

  .fallback-banner {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .frequency-decoration,
  .current-step-panel,
  .step-card.is-current .step-content {
    animation: none;
  }
}
</style>
