<script setup lang="ts">
import { computed, reactive } from 'vue'
import type { CharacterFact, RecommendationReport } from '@/types/domain'
import { getCharacterPortrait } from '@/data/portraitLoader'

const props = defineProps<{
  report: RecommendationReport
  characters: CharacterFact[]
}>()

const imageErrors = reactive<Set<string>>(new Set())

const characterById = computed(
  () => new Map(props.characters.map((character) => [character.id, character])),
)

const selectedCharacters = computed(() =>
  props.report.equipment
    .map((item) => characterById.value.get(item.characterId))
    .filter((character): character is CharacterFact => Boolean(character)),
)

const bestMatch = computed(() => props.report.exactTeam ?? props.report.teamMatches[0] ?? null)

const displayCharacterName = (id: string): string => {
  if (id === 'chr_0002_endminm') return '管理員（A 形態）'
  if (id === 'chr_0003_endminf') return '管理員（B 形態）'
  return characterById.value.get(id)?.name ?? id
}

const matchNames = (ids: string[]): string =>
  ids.map(displayCharacterName).join('、')

const alternativeLines = computed(() => {
  const preset = bestMatch.value?.preset
  if (!preset) return []
  return Object.entries(preset.alternatives)
    .filter(([, alternatives]) => alternatives.length > 0)
    .map(([characterId, alternatives]) => ({
      source: displayCharacterName(characterId),
      alternatives: matchNames(alternatives),
    }))
})

const statusLabel = computed(() => {
  if (props.report.exactTeam) return '完整攻略匹配'
  if (bestMatch.value) return '近似隊伍 / 標籤覆蓋'
  return '無攻略隊伍匹配'
})

const getPortraitUrl = (characterId: string): string | null =>
  getCharacterPortrait(characterId)

const shouldShowFallback = (characterId: string): boolean =>
  !getPortraitUrl(characterId) || imageErrors.has(characterId)

const handleImageError = (characterId: string): void => {
  imageErrors.add(characterId)
}

const monogram = (name: string): string => name.slice(0, 1)
</script>

<template>
  <section class="summary panel reveal">
    <div class="summary-head">
      <div>
        <p class="eyebrow">04 / SQUAD READOUT</p>
        <h2>隊伍摘要</h2>
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
              <img
                v-if="!shouldShowFallback(character.id)"
                :src="getPortraitUrl(character.id)!"
                :alt="displayCharacterName(character.id)"
                loading="lazy"
                @error="handleImageError(character.id)"
              />
              <span v-else class="token-fallback">{{ monogram(character.name) }}</span>
            </span>
            <span class="token-copy">
              <strong>{{ displayCharacterName(character.id) }}</strong>
              <small>{{ character.profession || '職業未標註' }} · {{ character.element || '元素未標註' }}</small>
            </span>
          </article>
        </div>

        <div class="tag-cloud">
          <span class="readout-label">TEAM TAGS</span>
          <div>
            <span v-for="tag in report.teamTags" :key="tag">{{ tag }}</span>
            <span v-if="!report.teamTags.length">標籤資料缺失</span>
          </div>
        </div>
      </div>

      <div class="match-readout">
        <div class="readout-label">PRESET COMPARISON</div>
        <template v-if="bestMatch">
          <h3>{{ bestMatch.preset.name }}</h3>
          <p>{{ bestMatch.preset.description || '攻略隊伍未附說明。' }}</p>
          <dl>
            <div>
              <dt>已匹配</dt>
              <dd>{{ matchNames(bestMatch.matchedCharacterIds) || '無' }}</dd>
            </div>
            <div>
              <dt>預設缺少</dt>
              <dd>{{ matchNames(bestMatch.missingCharacterIds) || '無' }}</dd>
            </div>
            <div>
              <dt>隊伍額外</dt>
              <dd>{{ matchNames(bestMatch.extraCharacterIds) || '無' }}</dd>
            </div>
          </dl>
          <p class="source-id">
            {{ bestMatch.sourceBacked ? `SOURCE ${bestMatch.preset.sourceIds.join(' / ')}` : 'SOURCE 未標註' }}
          </p>
        </template>
        <p v-else class="no-match-copy">
          目前四人沒有命中任何攻略隊伍。循環與裝備仍會按確定性規則生成，但需要人工核對。
        </p>
      </div>
    </div>

    <div v-if="alternativeLines.length" class="alternative-strip">
      <span class="readout-label">PRESET ALTERNATIVES</span>
      <p v-for="line in alternativeLines" :key="line.source">
        <strong>{{ line.source }}</strong> 可替換為 {{ line.alternatives }}
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
  background: #ffffff;
  border: 1px solid var(--color-border-primary);
  color: var(--color-text-primary);
}

.summary-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1.1rem;
  border-bottom: 1px solid var(--color-border-primary);
}

.summary-head h2 {
  margin-top: 0.2rem;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  font-weight: 700;
  color: var(--color-text-primary);
}

.match-meter {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  text-align: right;
}

.match-meter span {
  max-width: 150px;
  color: var(--color-accent-orange);
  font-size: 0.65rem;
  line-height: 1.35;
}

.match-meter strong {
  color: var(--color-accent-orange);
  font-family: "Rajdhani", sans-serif;
  font-size: 2.2rem;
  font-weight: 600;
  line-height: 0.8;
}

.match-meter small {
  color: var(--color-text-tertiary);
  font-size: 0.65rem;
  font-weight: 500;
}

.match-meter.exact strong,
.match-meter.exact span {
  color: var(--color-text-primary);
}

.summary-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(260px, 0.75fr);
  gap: 1.6rem;
  padding-top: 1.2rem;
}

.readout-label {
  color: var(--color-text-secondary);
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
  border: 1px solid var(--color-border-primary);
  background: #fafafa;
  padding: 0.45rem;
}

.token-index {
  color: var(--color-text-primary);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.58rem;
}

.token-avatar {
  display: grid;
  width: 36px;
  height: 39px;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border-primary);
  background: #f0f0f0;
  color: var(--color-text-primary);
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.9rem;
}

.token-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.token-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  opacity: 0.7;
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
  color: var(--color-text-primary);
}

.token-copy small {
  overflow: hidden;
  margin-top: 0.1rem;
  color: var(--color-text-secondary);
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
  border: 1px solid var(--color-border-primary);
  padding: 0.16rem 0.35rem;
  color: var(--color-text-secondary);
  font-size: 0.57rem;
}

.match-readout {
  border-left: 1px solid var(--color-border-primary);
  padding-left: 1.3rem;
}

.match-readout h3 {
  margin-top: 0.45rem;
  color: var(--color-text-primary);
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.2rem;
  font-weight: 600;
}

.match-readout > p {
  margin-top: 0.45rem;
  color: var(--color-text-secondary);
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
  border-top: 1px solid var(--color-border-primary);
  padding-top: 0.38rem;
}

.match-readout dt {
  color: var(--color-text-secondary);
  font-size: 0.58rem;
}

.match-readout dd {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 0.65rem;
  line-height: 1.45;
}

.source-id {
  color: var(--color-text-tertiary) !important;
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
  border-top: 1px solid var(--color-border-primary);
  padding-top: 0.8rem;
}

.alternative-strip p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.65rem;
}

.alternative-strip strong {
  color: var(--color-text-primary);
  font-weight: 500;
}

.summary-warnings {
  display: grid;
  gap: 0.25rem;
  margin-top: 1rem;
  border: 1px solid rgba(255, 156, 102, 0.4);
  background: #fff8ec;
  padding: 0.6rem 0.7rem;
}

.summary-warnings p {
  display: flex;
  gap: 0.45rem;
  margin: 0;
  color: #8a5a1c;
  font-size: 0.64rem;
  line-height: 1.45;
}

.summary-warnings span {
  color: var(--color-accent-orange);
  font-family: "Rajdhani", sans-serif;
  font-weight: 700;
}

@media (max-width: 860px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .match-readout {
    border-top: 1px solid var(--color-border-primary);
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

@media (max-width: 390px) {
  .summary { padding: 0.75rem; }
  .squad-tokens { gap: 0.32rem; }
}
</style>
