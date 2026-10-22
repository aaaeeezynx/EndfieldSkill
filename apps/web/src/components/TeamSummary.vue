<script setup lang="ts">
import { computed } from 'vue'
import type { CharacterFact, RecommendationReport } from '@/types/domain'

const props = defineProps<{
  report: RecommendationReport
  characters: CharacterFact[]
}>()

const characterById = computed(
  () => new Map(props.characters.map((character) => [character.id, character])),
)

const selectedCharacters = computed(() =>
  props.report.equipment
    .map((item) => characterById.value.get(item.characterId))
    .filter((character): character is CharacterFact => Boolean(character)),
)

const bestMatch = computed(() => props.report.exactTeam ?? props.report.teamMatches[0] ?? null)

const matchNames = (ids: string[]): string =>
  ids.map((id) => characterById.value.get(id)?.name ?? id).join('、')

const alternativeLines = computed(() => {
  const preset = bestMatch.value?.preset
  if (!preset) return []
  return Object.entries(preset.alternatives)
    .filter(([, alternatives]) => alternatives.length > 0)
    .map(([characterId, alternatives]) => ({
      source: characterById.value.get(characterId)?.name ?? characterId,
      alternatives: matchNames(alternatives),
    }))
})

const statusLabel = computed(() => {
  if (props.report.exactTeam) return '完整攻略匹配'
  if (bestMatch.value) return '近似队伍 / 标签覆盖'
  return '无攻略队伍匹配'
})
</script>

<template>
  <section class="summary panel reveal">
    <div class="summary-head">
      <div>
        <p class="eyebrow">04 / SQUAD READOUT</p>
        <h2>队伍摘要</h2>
      </div>
      <div class="match-meter" :class="{ exact: report.exactTeam }">
        <span>{{ statusLabel }}</span>
        <strong>{{ bestMatch?.score ?? 0 }}<small>/100</small></strong>
      </div>
    </div>

    <div class="summary-grid">
      <div class="squad-readout">
        <div class="readout-label">LOCKED PERSONNEL</div>
        <div class="squad-tokens">
          <article
            v-for="(character, index) in selectedCharacters"
            :key="character.id"
            class="squad-token"
          >
            <span class="token-index">0{{ index + 1 }}</span>
            <span class="token-avatar">
              <img v-if="character.portraitUrl" :src="character.portraitUrl" :alt="character.name" />
              <span v-else>{{ character.name.slice(0, 1) }}</span>
            </span>
            <span class="token-copy">
              <strong>{{ character.name }}</strong>
              <small>{{ character.profession || '职业未标注' }} · {{ character.element || '元素未标注' }}</small>
            </span>
          </article>
        </div>

        <div class="tag-cloud">
          <span class="readout-label">TEAM TAGS</span>
          <div>
            <span v-for="tag in report.teamTags" :key="tag">{{ tag }}</span>
            <span v-if="!report.teamTags.length">标签资料缺失</span>
          </div>
        </div>
      </div>

      <div class="match-readout">
        <div class="readout-label">PRESET COMPARISON</div>
        <template v-if="bestMatch">
          <h3>{{ bestMatch.preset.name }}</h3>
          <p>{{ bestMatch.preset.description || '攻略队伍未附说明。' }}</p>
          <dl>
            <div>
              <dt>已匹配</dt>
              <dd>{{ matchNames(bestMatch.matchedCharacterIds) || '无' }}</dd>
            </div>
            <div>
              <dt>预设缺少</dt>
              <dd>{{ matchNames(bestMatch.missingCharacterIds) || '无' }}</dd>
            </div>
            <div>
              <dt>队伍额外</dt>
              <dd>{{ matchNames(bestMatch.extraCharacterIds) || '无' }}</dd>
            </div>
          </dl>
          <p class="source-id">
            {{ bestMatch.sourceBacked ? `SOURCE ${bestMatch.preset.sourceIds.join(' / ')}` : 'SOURCE 未标注' }}
          </p>
        </template>
        <p v-else class="no-match-copy">
          当前四人没有命中任何攻略队伍。循环与装备仍会按确定性规则生成，但需要人工核对。
        </p>
      </div>
    </div>

    <div v-if="alternativeLines.length" class="alternative-strip">
      <span class="readout-label">PRESET ALTERNATIVES</span>
      <p v-for="line in alternativeLines" :key="line.source">
        <strong>{{ line.source }}</strong> 可替换为 {{ line.alternatives }}
      </p>
    </div>

    <div v-if="report.warnings.length" class="summary-warnings">
      <p v-for="warning in report.warnings" :key="warning"><span>!</span>{{ warning }}</p>
    </div>
  </section>
</template>

<style scoped>
.summary {
  padding: clamp(1rem, 2.5vw, 1.6rem);
}

.summary-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1.1rem;
  border-bottom: 1px solid var(--line);
}

.summary-head h2 {
  margin-top: 0.2rem;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  font-weight: 700;
}

.match-meter {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  text-align: right;
}

.match-meter span {
  max-width: 150px;
  color: var(--ember);
  font-size: 0.65rem;
  line-height: 1.35;
}

.match-meter strong {
  color: var(--ember);
  font-family: "Rajdhani", sans-serif;
  font-size: 2.2rem;
  font-weight: 600;
  line-height: 0.8;
}

.match-meter small {
  color: #737a6c;
  font-size: 0.65rem;
  font-weight: 500;
}

.match-meter.exact strong,
.match-meter.exact span {
  color: var(--acid);
}

.summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(260px, 0.75fr);
  gap: 1.6rem;
  padding-top: 1.2rem;
}

.readout-label {
  color: #737a6c;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.13em;
}

.squad-tokens {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  margin-top: 0.55rem;
}

.squad-token {
  display: grid;
  grid-template-columns: 1.2rem 38px minmax(0, 1fr);
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  border: 1px solid #394132;
  background: rgba(16, 19, 15, 0.45);
  padding: 0.45rem;
}

.token-index {
  color: var(--acid);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.58rem;
}

.token-avatar {
  display: grid;
  width: 36px;
  height: 39px;
  place-items: center;
  overflow: hidden;
  border: 1px solid #4b5441;
  background: #252b22;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.9rem;
}

.token-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.token-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.token-copy strong {
  overflow: hidden;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-copy small {
  overflow: hidden;
  margin-top: 0.1rem;
  color: #777e70;
  font-size: 0.54rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-cloud {
  margin-top: 1rem;
}

.tag-cloud > div {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.45rem;
}

.tag-cloud > div > span {
  border: 1px solid #3d4537;
  padding: 0.16rem 0.35rem;
  color: #a4aa9c;
  font-size: 0.57rem;
}

.match-readout {
  border-left: 1px solid var(--line);
  padding-left: 1.3rem;
}

.match-readout h3 {
  margin-top: 0.45rem;
  color: var(--paper);
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.2rem;
  font-weight: 600;
}

.match-readout > p {
  margin-top: 0.45rem;
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.6;
}

.match-readout dl {
  display: grid;
  gap: 0.45rem;
  margin-top: 0.8rem;
}

.match-readout dl div {
  display: grid;
  grid-template-columns: 5.4rem 1fr;
  gap: 0.5rem;
  border-top: 1px solid rgba(238, 233, 220, 0.08);
  padding-top: 0.38rem;
}

.match-readout dt {
  color: #70776a;
  font-size: 0.58rem;
}

.match-readout dd {
  margin: 0;
  color: #c3c7b9;
  font-size: 0.65rem;
  line-height: 1.45;
}

.source-id {
  color: #68705f !important;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.56rem !important;
  letter-spacing: 0.08em;
  overflow-wrap: anywhere;
}

.no-match-copy {
  margin-top: 0.8rem !important;
}

.alternative-strip {
  display: grid;
  gap: 0.3rem;
  margin-top: 1rem;
  border-top: 1px solid var(--line);
  padding-top: 0.8rem;
}

.alternative-strip p {
  margin: 0;
  color: #9ba293;
  font-size: 0.65rem;
}

.alternative-strip strong {
  color: var(--paper);
  font-weight: 500;
}

.summary-warnings {
  display: grid;
  gap: 0.25rem;
  margin-top: 1rem;
  border: 1px solid rgba(255, 156, 102, 0.22);
  background: rgba(255, 156, 102, 0.055);
  padding: 0.6rem 0.7rem;
}

.summary-warnings p {
  display: flex;
  gap: 0.45rem;
  margin: 0;
  color: #c8ad9b;
  font-size: 0.64rem;
  line-height: 1.45;
}

.summary-warnings span {
  color: var(--ember);
  font-family: "Rajdhani", sans-serif;
  font-weight: 700;
}

@media (max-width: 860px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .match-readout {
    border-top: 1px solid var(--line);
    border-left: 0;
    padding-top: 1rem;
    padding-left: 0;
  }
}

@media (max-width: 480px) {
  .summary-head {
    align-items: flex-start;
  }

  .match-meter {
    flex-direction: column;
    align-items: flex-end;
    gap: 0.35rem;
  }

  .match-meter strong {
    font-size: 1.8rem;
  }

  .squad-tokens {
    grid-template-columns: 1fr;
  }
}
</style>
