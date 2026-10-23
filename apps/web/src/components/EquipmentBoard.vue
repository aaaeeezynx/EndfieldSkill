<script setup lang="ts">
import { computed } from 'vue'
import {
  buildEquipmentStatDisplays,
  type EquipmentStatDisplay,
} from '@/lib/equipmentDisplay'
import { describeUnlockGate } from '@/lib/recommendation'
import { getCharacterPortrait } from '@/data/portraitLoader'
import type {
  CharacterFact,
  EquipmentCandidate,
  EquipmentRecommendation,
  UnlockState,
} from '@/types/domain'

const props = defineProps<{
  recommendations: EquipmentRecommendation[]
  characters: CharacterFact[]
}>()

const characterById = computed(
  () => new Map(props.characters.map((character) => [character.id, character])),
)

const stateLabel = (state: UnlockState): string => {
  if (state === 'unlocked') return '穿戴等级已达标'
  if (state === 'locked') return '已知门槛未达'
  if (state === 'not-craftable') return '不可制造'
  return '门槛未确认'
}

const statEntries = (candidate: EquipmentCandidate): EquipmentStatDisplay[] =>
  buildEquipmentStatDisplays(candidate.equipment.stats, candidate.equipment.statTypes)

const hasSeparateAvailable = (recommendation: EquipmentRecommendation): boolean =>
  Boolean(
    recommendation.bestAvailable &&
      recommendation.bestAvailable.equipment.id !== recommendation.bestOverall?.equipment.id,
  )

const hasSingleTargetResult = (recommendation: EquipmentRecommendation): boolean =>
  !hasSeparateAvailable(recommendation) ||
  recommendation.bestOverall?.unlockState === 'unlocked'

const targetKicker = (recommendation: EquipmentRecommendation): string =>
  hasSingleTargetResult(recommendation)
    ? 'CEILING / CURRENT BEST · 角色上限／目前門檻最佳'
    : 'BEST OVERALL / 角色上限'

const hasFormulaAuthority = (candidate: EquipmentCandidate): boolean =>
  candidate.equipment.formulaAuthorityRank !== null
</script>

<template>
  <section class="equipment-board panel reveal">
    <div class="equipment-head">
      <div>
        <p class="eyebrow">06 / EQUIPMENT GATES</p>
        <h2>装备门槛建议</h2>
      </div>
      <p class="equipment-principle">
        先按你的四人匹配，再核对装备穿戴等级与已知章节条件。配方权限与剧情解锁尚未自动判定，不宣称装备“当前可制造”。
      </p>
    </div>

    <div class="differentiator">
      <span>OWNED ROSTER × PROGRESS</span>
      <p>
        <strong>最佳方向</strong>说明角色最终配装方向；<strong>穿戴等级已达标</strong>只代表已知装备穿戴等级与章节条件通过，
        不代表已经取得配方或现在可制造。
      </p>
    </div>

    <div v-if="recommendations.length" class="equipment-list stagger-list">
      <article
        v-for="recommendation in recommendations"
        :key="recommendation.characterId"
        class="equipment-character"
      >
        <header class="character-strip">
          <span class="character-avatar">
            <img
              v-if="getCharacterPortrait(recommendation.characterId)"
              :src="getCharacterPortrait(recommendation.characterId) ?? ''"
              :alt="characterById.get(recommendation.characterId)?.name ?? recommendation.characterId"
              loading="lazy"
            />
            <span v-else>
              {{ characterById.get(recommendation.characterId)?.name.slice(0, 1) ?? '?' }}
            </span>
          </span>
          <div>
            <h3>{{ characterById.get(recommendation.characterId)?.name ?? recommendation.characterId }}</h3>
            <p>
              {{ characterById.get(recommendation.characterId)?.profession || '职业未标注' }}
              ·
              {{ characterById.get(recommendation.characterId)?.element || '元素未标注' }}
            </p>
          </div>
        </header>

        <div
          class="gear-grid"
          :class="{ 'single-column': hasSingleTargetResult(recommendation) }"
        >
          <div class="gear-column target">
            <span class="gear-kicker">{{ targetKicker(recommendation) }}</span>
            <template v-if="recommendation.bestOverall">
              <div class="gear-name-row">
                <h4>{{ recommendation.bestOverall.equipment.name }}</h4>
                <span class="unlock-state" :class="recommendation.bestOverall.unlockState">
                  {{ stateLabel(recommendation.bestOverall.unlockState) }}
                </span>
              </div>
              <p class="gear-meta">
                {{ recommendation.bestOverall.equipment.slot || '部位未标注' }}
                <template v-if="recommendation.bestOverall.equipment.setName">
                  · {{ recommendation.bestOverall.equipment.setName }}
                </template>
                <template v-if="recommendation.bestOverall.equipment.rarity">
                  · {{ recommendation.bestOverall.equipment.rarity }}★
                </template>
              </p>
              <p class="gate-line">{{ describeUnlockGate(recommendation.bestOverall) }}</p>
              <p v-if="hasFormulaAuthority(recommendation.bestOverall)" class="authority-note">
                Rank 为配方权限要求；剧情/权限进度尚未自动判定。
              </p>
              <p
                v-if="recommendation.bestOverall.unlockState === 'unlocked'"
                class="single-result-note"
              >
                此结果同时是角色上限与目前通过已知门槛的最佳结果；仅代表穿戴等级与已知章节条件通过，不代表配方已解锁或当前可制造。
              </p>
              <div v-if="statEntries(recommendation.bestOverall).length" class="stat-grid">
                <span
                  v-for="stat in statEntries(recommendation.bestOverall)"
                  :key="stat.key"
                >
                  {{ stat.label }} <strong>{{ stat.value }}</strong>
                </span>
              </div>
              <div v-else class="field-warning">属性数值未标注</div>
            </template>
            <p v-else class="gear-empty">没有可评分的装备资料。</p>
          </div>

          <div
            v-if="hasSeparateAvailable(recommendation)"
            class="gear-column available"
          >
            <span class="gear-kicker">WEAR GATE PASSED / 穿戴等级已达标</span>
            <template v-if="recommendation.bestAvailable">
              <div class="gear-name-row">
                <h4>{{ recommendation.bestAvailable.equipment.name }}</h4>
                <span class="unlock-state unlocked">已知等级门槛通过</span>
              </div>
              <p class="gear-meta">
                {{ recommendation.bestAvailable.equipment.slot || '部位未标注' }}
                <template v-if="recommendation.bestAvailable.equipment.rarity">
                  · {{ recommendation.bestAvailable.equipment.rarity }}★
                </template>
              </p>
              <p class="gate-line">{{ describeUnlockGate(recommendation.bestAvailable) }}</p>
              <p v-if="hasFormulaAuthority(recommendation.bestAvailable)" class="authority-note">
                配方权限要求已列出，但尚未由剧情/权限进度自动判定。
              </p>
              <div class="match-notes">
                <span
                  v-for="note in recommendation.bestAvailable.matchNotes"
                  :key="note"
                >
                  {{ note }}
                </span>
              </div>
            </template>
          </div>
        </div>

        <div v-if="recommendation.bestOverall?.equipment.unlock.materials.length" class="material-line">
          <span>MATERIALS</span>
          <div>
            <span
              v-for="material in recommendation.bestOverall.equipment.unlock.materials"
              :key="material"
            >
              {{ material }}
            </span>
          </div>
        </div>
        <p v-else class="material-line missing">
          <span>MATERIALS</span>
          制造材料未标注
        </p>

        <div v-if="recommendation.alternatives.length" class="alternatives">
          <span class="gear-kicker">
            {{
              recommendation.bestOverall?.unlockState === 'unlocked'
                ? 'OTHER WEARABLE CANDIDATES / 其他可穿戴候选'
                : 'KNOWN-GATE ALTERNATIVES / 已知门槛替代项'
            }}
          </span>
          <div class="alternative-grid">
            <div v-for="alternative in recommendation.alternatives" :key="alternative.equipment.id">
              <strong>{{ alternative.equipment.name }}</strong>
              <small>
                {{ alternative.equipment.slot || '部位未标注' }}
                · {{ describeUnlockGate(alternative) }}
              </small>
            </div>
          </div>
        </div>

        <div v-if="recommendation.warnings.length" class="equipment-warnings">
          <p v-for="warning in recommendation.warnings" :key="warning">
            <span>!</span>{{ warning }}
          </p>
        </div>

        <p class="equipment-source">
          {{
            recommendation.bestOverall?.equipment.sourceIds.length
              ? `SOURCES ${recommendation.bestOverall.equipment.sourceIds.join(' / ')}`
              : 'SOURCES 未标注'
          }}
        </p>
      </article>
    </div>

    <div v-else class="equipment-empty">
      <strong>NO EQUIPMENT RECORDS</strong>
      <p>装备资料为空，无法生成门槛过滤后的推荐。</p>
    </div>
  </section>
</template>

<style scoped>
.equipment-board {
  padding: clamp(1rem, 2.5vw, 1.6rem);
}

.equipment-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--line);
}

.equipment-head h2 {
  margin-top: 0.2rem;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  font-weight: 700;
}

.equipment-principle {
  max-width: 440px;
  color: #8e9587;
  font-size: 0.67rem;
  line-height: 1.6;
  text-align: right;
}

.differentiator {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-top: 0.9rem;
  border-left: 2px solid var(--cyan);
  background: rgba(124, 230, 212, 0.055);
  padding: 0.65rem 0.8rem;
}

.differentiator > span {
  flex: 0 0 auto;
  color: var(--cyan);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.differentiator p {
  color: #aab6ab;
  font-size: 0.64rem;
  line-height: 1.55;
}

.differentiator strong {
  color: var(--paper);
  font-weight: 600;
}

.equipment-list {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.equipment-character {
  position: relative;
  border: 1px solid #343b2e;
  background: rgba(16, 19, 15, 0.36);
  padding: 1rem;
}

.equipment-character::before {
  content: "";
  position: absolute;
  top: -1px;
  left: -1px;
  width: 28px;
  height: 1px;
  background: var(--cyan);
}

.character-strip {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.character-avatar {
  display: grid;
  width: 38px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 1px solid #4b5441;
  background: #252b22;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
}

.character-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.character-strip h3 {
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.05rem;
  font-weight: 600;
}

.character-strip p {
  margin-top: 0.08rem;
  color: #777e70;
  font-size: 0.58rem;
}

.gear-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
  margin-top: 0.85rem;
}

.gear-grid.single-column {
  grid-template-columns: 1fr;
}

.gear-column {
  min-width: 0;
  border: 1px solid #353d30;
  background: #191d17;
  padding: 0.75rem;
}

.gear-column.target {
  border-top-color: rgba(216, 244, 91, 0.6);
}

.gear-column.available {
  border-top-color: rgba(124, 230, 212, 0.6);
}

.gear-kicker {
  color: #737a6c;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.56rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.target .gear-kicker {
  color: var(--acid);
}

.available .gear-kicker {
  color: var(--cyan);
}

.gear-name-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.38rem;
}

.gear-name-row h4 {
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.98rem;
  font-weight: 600;
  line-height: 1.25;
}

.unlock-state {
  flex: 0 0 auto;
  border: 1px solid #4c5544;
  padding: 0.12rem 0.3rem;
  color: #9ba292;
  font-size: 0.52rem;
}

.unlock-state.locked {
  border-color: rgba(255, 156, 102, 0.5);
  color: var(--ember);
}

.unlock-state.unknown,
.unlock-state.not-craftable {
  border-color: rgba(255, 118, 95, 0.42);
  color: var(--danger);
}

.unlock-state.unlocked {
  border-color: rgba(124, 230, 212, 0.5);
  color: var(--cyan);
}

.gear-meta {
  margin-top: 0.22rem;
  color: #858c7e;
  font-size: 0.58rem;
}

.gate-line {
  margin-top: 0.5rem;
  border-top: 1px solid rgba(238, 233, 220, 0.08);
  padding-top: 0.45rem;
  color: #b1b6aa;
  font-size: 0.6rem;
  line-height: 1.55;
}

.authority-note {
  margin-top: 0.38rem;
  border-left: 2px solid var(--ember);
  background: rgba(255, 156, 102, 0.055);
  padding: 0.3rem 0.42rem;
  color: #bda58f;
  font-size: 0.56rem;
  line-height: 1.5;
}

.single-result-note {
  margin-top: 0.38rem;
  border-left: 2px solid var(--cyan);
  background: rgba(124, 230, 212, 0.055);
  padding: 0.3rem 0.42rem;
  color: #9bb9b1;
  font-size: 0.56rem;
  line-height: 1.5;
}

.stat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.stat-grid span {
  max-width: 100%;
  background: rgba(238, 233, 220, 0.045);
  padding: 0.16rem 0.3rem;
  color: #737a6c;
  font-size: 0.53rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.stat-grid strong {
  margin-left: 0.15rem;
  color: #bcc1b5;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.match-notes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.match-notes span {
  border: 1px solid rgba(124, 230, 212, 0.2);
  padding: 0.13rem 0.28rem;
  color: #8fbcb4;
  font-size: 0.52rem;
}

.field-warning {
  margin-top: 0.5rem;
  color: #a88b77;
  font-size: 0.56rem;
}

.gear-empty {
  margin-top: 0.5rem;
  color: #817d70;
  font-size: 0.64rem;
  line-height: 1.6;
}

.material-line {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  margin-top: 0.7rem;
}

.material-line > span {
  flex: 0 0 auto;
  padding-top: 0.12rem;
  color: #6e7567;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.54rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.material-line > div {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.material-line > div span {
  border: 1px solid #3c4436;
  padding: 0.12rem 0.28rem;
  color: #969d8f;
  font-size: 0.53rem;
}

.material-line.missing {
  color: #8a7564;
  font-size: 0.58rem;
}

.alternatives {
  margin-top: 0.7rem;
  border-top: 1px solid #343b2e;
  padding-top: 0.65rem;
}

.alternative-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.alternative-grid > div {
  min-width: 0;
  border: 1px solid #343b2e;
  padding: 0.45rem;
}

.alternative-grid strong {
  display: block;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.76rem;
  font-weight: 600;
}

.alternative-grid small {
  display: block;
  margin-top: 0.14rem;
  overflow-wrap: anywhere;
  color: #777e70;
  font-size: 0.54rem;
  line-height: 1.4;
}

.equipment-warnings {
  display: grid;
  gap: 0.2rem;
  margin-top: 0.65rem;
}

.equipment-warnings p {
  display: flex;
  gap: 0.35rem;
  color: #b49b8b;
  font-size: 0.58rem;
  line-height: 1.45;
}

.equipment-warnings span {
  color: var(--ember);
  font-family: "Rajdhani", sans-serif;
  font-weight: 700;
}

.equipment-source {
  margin-top: 0.55rem;
  color: #5f6659;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.52rem;
  letter-spacing: 0.07em;
  overflow-wrap: anywhere;
}

.equipment-empty {
  border: 1px dashed #3d4537;
  margin-top: 1rem;
  padding: 2.5rem 1rem;
  text-align: center;
}

.equipment-empty strong {
  color: var(--ember);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
}

.equipment-empty p {
  margin-top: 0.45rem;
  color: var(--muted);
  font-size: 0.68rem;
}

@media (max-width: 780px) {
  .equipment-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.6rem;
  }

  .equipment-principle {
    text-align: left;
  }

  .gear-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .differentiator {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.3rem;
  }

  .alternative-grid {
    grid-template-columns: 1fr;
  }
}
</style>
