<script setup lang="ts">
import { computed, ref, reactive } from 'vue'
import type { CharacterFact } from '@/types/domain'
import { getCharacterPortrait } from '@/data/portraitLoader'
import {
  displayElement,
  displayProfession,
  displayRoleOrTag,
  missingSkillTypeLabels,
} from '@/lib/displayLabels'
import { MAX_TEAM_SIZE } from '@/lib/validation'

const props = defineProps<{
  characters: CharacterFact[]
  selectedIds: string[]
}>()

const emit = defineEmits<{
  toggle: [characterId: string]
}>()

const search = ref('')
const elementFilter = ref('')
const roleFilter = ref('')
const imageErrors = reactive<Set<string>>(new Set())

const elements = computed(() =>
  [
    ...new Set(
      props.characters
        .map((character) => character.element)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort(),
)
const professions = computed(() =>
  [
    ...new Set(
      props.characters
        .map((character) => character.profession)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort(),
)

const filteredCharacters = computed(() => {
  const query = search.value.trim().toLowerCase()
  return props.characters.filter((character) => {
    const haystack = [
      character.name,
      character.nameEn,
      character.profession,
      character.element,
      ...character.roles,
      ...character.tags,
      // Include display-mapped values so Traditional Chinese searches hit raw tokens.
      displayProfession(character.profession),
      displayElement(character.element),
      ...character.roles.map((role) => displayRoleOrTag(role)),
      ...character.tags.map((tag) => displayRoleOrTag(tag)),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return (
      (!query || haystack.includes(query)) &&
      (!elementFilter.value || character.element === elementFilter.value) &&
      (!roleFilter.value || character.profession === roleFilter.value)
    )
  })
})

const selectedIndex = (characterId: string): number =>
  props.selectedIds.indexOf(characterId)

const isSelected = (characterId: string): boolean =>
  selectedIndex(characterId) >= 0

const isAtCapacity = computed(() => props.selectedIds.length >= MAX_TEAM_SIZE)

const isCapacityBlocked = (character: CharacterFact): boolean =>
  isAtCapacity.value && !isSelected(character.id)

const clearFilters = (): void => {
  search.value = ''
  elementFilter.value = ''
  roleFilter.value = ''
}

const monogram = (character: CharacterFact): string =>
  character.nameEn?.slice(0, 1).toUpperCase() ?? character.name.slice(0, 1)

const getPortraitUrl = (character: CharacterFact): string | null => {
  return getCharacterPortrait(character.id)
}

const handleImageError = (characterId: string): void => {
  imageErrors.add(characterId)
}

const shouldShowFallback = (character: CharacterFact): boolean => {
  return !getPortraitUrl(character) || imageErrors.has(character.id)
}

const displayName = (character: CharacterFact): string => {
  if (character.id === 'chr_0002_endminm') return '管理員'
  return character.name
}

// Localized missing-skill chip text, derived purely from skills[].type.
const missingSkillLabels = (character: CharacterFact): string[] =>
  missingSkillTypeLabels(character.skills).map((label) => `缺 ${label}`)
</script>

<template>
  <section class="picker-panel panel">
    <div class="picker-heading">
      <div>
        <p class="eyebrow">01 / PERSONNEL MATRIX</p>
        <h2 class="picker-title">選擇已擁有角色</h2>
      </div>
      <div class="picker-counter" :class="{ 'is-full': isAtCapacity }">
        <strong>{{ selectedIds.length }}</strong>
        <span>/ {{ MAX_TEAM_SIZE }}</span>
      </div>
    </div>

    <p
      v-if="isAtCapacity"
      id="team-capacity-note"
      class="capacity-banner"
      role="status"
    >
      隊伍已滿 {{ MAX_TEAM_SIZE }}/{{ MAX_TEAM_SIZE }}；請先移除已選角色，才能加入其他角色。
    </p>

    <div class="filter-bar">
      <label class="search-field">
        <span class="sr-only">搜尋角色</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5"></circle>
          <path d="m15.5 15.5 4.5 4.5"></path>
        </svg>
        <input v-model="search" type="search" placeholder="搜尋角色 / 職業 / 標籤" />
      </label>
      <label class="compact-select">
        <span>元素</span>
        <select v-model="elementFilter">
          <option value="">全部</option>
          <option v-for="element in elements" :key="element" :value="element">{{ displayElement(element) }}</option>
        </select>
      </label>
      <label class="compact-select">
        <span>職業</span>
        <select v-model="roleFilter">
          <option value="">全部</option>
          <option v-for="profession in professions" :key="profession" :value="profession">
            {{ displayProfession(profession) }}
          </option>
        </select>
      </label>
    </div>

    <div v-if="filteredCharacters.length" class="character-grid stagger-list">
      <button
        v-for="character in filteredCharacters"
        :key="character.id"
        type="button"
        class="character-card cut-corners"
        :class="{
          selected: isSelected(character.id),
          'capacity-blocked': isCapacityBlocked(character),
        }"
        :disabled="isCapacityBlocked(character)"
        :aria-pressed="isSelected(character.id)"
        :aria-describedby="isCapacityBlocked(character) ? 'team-capacity-note' : undefined"
        @click="emit('toggle', character.id)"
      >
        <span class="card-sequence">
          {{ isSelected(character.id) ? `0${selectedIndex(character.id) + 1}` : character.id.slice(-3) }}
        </span>
        <span class="element-mark" aria-hidden="true"></span>

        <span class="portrait">
          <img
            v-if="!shouldShowFallback(character)"
            :src="getPortraitUrl(character)!"
            :alt="`${displayName(character)} 角色立繪`"
            loading="lazy"
            @error="handleImageError(character.id)"
          />
          <span v-else class="portrait-fallback">{{ monogram(character) }}</span>
        </span>

        <span class="character-copy">
          <strong>{{ displayName(character) }}</strong>
          <small>{{ character.nameEn || character.id }}</small>
        </span>

        <span class="character-meta">
          <span>{{ displayProfession(character.profession) || '職業未標註' }}</span>
          <span>{{ displayElement(character.element) || '元素未標註' }}</span>
          <span v-if="character.rarity">{{ character.rarity }}★</span>
        </span>

        <span v-if="character.roles && character.roles.length > 0" class="role-row">
          <span v-for="role in character.roles.slice(0, 3)" :key="role">{{ displayRoleOrTag(role) }}</span>
        </span>

        <span v-if="missingSkillLabels(character).length" class="missing-skill-row">
          <span v-for="label in missingSkillLabels(character)" :key="label" class="missing-chip">{{ label }}</span>
        </span>

        <span class="select-indicator" aria-hidden="true">
          {{ isSelected(character.id) ? '−' : isAtCapacity ? '滿' : '+' }}
        </span>
      </button>
    </div>

    <div v-else class="filter-empty">
      <span>NO MATCH</span>
      <p>沒有符合目前篩選條件的角色。</p>
      <button type="button" @click="clearFilters">清除篩選</button>
    </div>
  </section>
</template>

<style scoped>
.picker-panel {
  padding: 1.35rem;
  background: #ffffff;
  border: 1px solid var(--color-border-primary);
  color: var(--color-text-primary);
}

.picker-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid var(--color-border-primary);
}

.picker-title {
  margin-top: 0.2rem;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: clamp(1.4rem, 2.5vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
}

.picker-counter {
  font-family: "Rajdhani", sans-serif;
  color: var(--color-text-tertiary);
  letter-spacing: 0.08em;
}

.picker-counter strong {
  color: var(--color-text-primary);
  font-size: 1.8rem;
  font-weight: 600;
}

.picker-counter span {
  font-size: 0.85rem;
}

.picker-counter.is-full,
.picker-counter.is-full strong {
  color: var(--color-danger);
}

.capacity-banner {
  margin: 0.8rem 0 0;
  border-left: 3px solid var(--color-text-primary);
  background: var(--color-accent-primary);
  padding: 0.55rem 0.7rem;
  color: var(--color-text-primary);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.45;
}

.filter-bar {
  display: grid;
  grid-template-columns: minmax(200px, 1fr) auto auto;
  gap: 0.55rem;
  padding: 0.8rem 0 1rem;
  border-bottom: 1px solid var(--color-border-primary);
}

.search-field {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  height: 42px;
  border: 1px solid var(--color-border-primary);
  background: #ffffff;
  padding: 0 0.8rem;
}

.search-field:focus-within {
  border-color: var(--color-text-primary);
  box-shadow: inset 0 0 0 1px var(--color-text-primary);
}

.search-field svg {
  width: 17px;
  fill: none;
  stroke: var(--color-text-tertiary);
  stroke-linecap: square;
  stroke-width: 1.5;
}

.search-field input {
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 0.8rem;
}

.search-field input:focus-visible,
.compact-select select:focus-visible {
  outline: 3px solid var(--color-text-primary);
  outline-offset: 2px;
}

.search-field input::placeholder {
  color: var(--color-text-tertiary);
}

.compact-select {
  display: flex;
  align-items: center;
  height: 42px;
  border: 1px solid var(--color-border-primary);
  background: #ffffff;
  padding-left: 0.7rem;
}

.compact-select span {
  color: var(--color-text-secondary);
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.compact-select select {
  height: 100%;
  max-width: 105px;
  border: 0;
  background: transparent;
  padding: 0 1.5rem 0 0.45rem;
  color: var(--color-text-primary);
  font-size: 0.76rem;
}

.compact-select option {
  background: #ffffff;
}

.character-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.character-card {
  position: relative;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  grid-template-rows: auto auto auto;
  gap: 0.42rem 0.75rem;
  min-height: 125px;
  overflow: hidden;
  border: 1px solid var(--color-border-primary);
  background: #ffffff;
  padding: 1.05rem 0.9rem 0.8rem;
  color: var(--color-text-primary);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.character-card:hover:not(:disabled) {
  z-index: 1;
  border-color: var(--color-accent-blue);
  transform: translateY(-2px);
}

.character-card:focus-visible {
  outline: 3px solid var(--color-text-primary);
  outline-offset: 3px;
}

.character-card.selected {
  /* Yellow is a fill-only accent; selection needs a dark-blue UI boundary. */
  border-color: var(--color-accent-blue);
  box-shadow: inset 0 0 0 1px var(--color-accent-blue);
  background: #fffef0;
}

.character-card::after {
  position: absolute;
  inset: 0;
  border: 3px solid var(--color-accent-blue);
  content: "";
  opacity: 0;
  pointer-events: none;
}

.character-card.selected::after {
  animation: card-select-feedback 160ms ease-out both;
}

.character-card:disabled {
  border-color: var(--color-border-primary);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  cursor: not-allowed;
}

.character-card.capacity-blocked .portrait {
  filter: grayscale(1);
}

.card-sequence {
  position: absolute;
  top: 0.55rem;
  right: 0.65rem;
  color: var(--color-text-tertiary);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.character-card.selected .card-sequence {
  color: var(--color-text-primary);
}

.element-mark {
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 34%;
  background: var(--color-accent-blue);
}

.selected .element-mark {
  height: 100%;
  background: var(--color-accent-primary);
}

.portrait {
  grid-row: 1 / span 2;
  display: grid;
  width: 54px;
  height: 62px;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border-primary);
  background: #f0f0f0;
  color: var(--color-text-primary);
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.65rem;
  font-weight: 600;
}

.portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

.portrait-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.character-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-self: end;
}

.character-copy strong {
  overflow: hidden;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-primary);
}

.character-copy small {
  overflow: hidden;
  margin-top: 0.15rem;
  color: var(--color-text-tertiary);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.character-meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 0.28rem;
  align-self: start;
}

.character-meta span,
.role-row span {
  border: 1px solid var(--color-border-primary);
  padding: 0.1rem 0.28rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  line-height: 1.2;
}

.role-row {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem;
}

.role-row span {
  border-color: transparent;
  background: #f0f0f0;
  color: var(--color-text-secondary);
}

.missing-line {
  grid-column: 1 / -1;
  color: var(--color-accent-orange);
  font-size: 0.75rem;
}

.missing-skill-row {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem;
}

.missing-chip {
  border: 1px solid var(--color-accent-orange);
  background: #fff3e6;
  padding: 0.08rem 0.3rem;
  color: #8f3f00;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.select-indicator {
  position: absolute;
  right: 0.5rem;
  bottom: 0.38rem;
  color: var(--color-text-tertiary);
  font-family: "Rajdhani", sans-serif;
  font-size: 1.1rem;
}

.selected .select-indicator {
  color: var(--color-text-primary);
}

.capacity-blocked .select-indicator {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
}

.filter-empty {
  padding: 4rem 1rem;
  border-top: 1px solid var(--color-border-primary);
  text-align: center;
}

.filter-empty span {
  color: var(--color-accent-orange);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.16em;
}

.filter-empty p {
  margin: 0.6rem 0 1rem;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}

.filter-empty button {
  border: 1px solid var(--color-border-strong);
  background: transparent;
  padding: 0.45rem 0.8rem;
  color: var(--color-text-primary);
  font-size: 0.75rem;
  cursor: pointer;
}

.filter-empty button:hover {
  border-color: var(--color-text-primary);
  color: var(--color-text-primary);
  background: var(--color-accent-primary);
}

@keyframes card-select-feedback {
  0% {
    opacity: 0.8;
    transform: translateX(0);
  }
  100% {
    opacity: 0;
    transform: translateX(6px);
  }
}

@media (max-width: 1180px) {
  .character-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .picker-panel {
    padding: 1rem;
  }

  .filter-bar {
    grid-template-columns: 1fr 1fr;
  }

  .search-field {
    grid-column: 1 / -1;
  }

  .compact-select select {
    width: 100%;
    max-width: none;
  }

  .character-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
  }

  .character-card {
    grid-template-columns: 43px minmax(0, 1fr);
    min-height: 108px;
    padding: 0.92rem 0.68rem 0.65rem;
  }

  .character-card.selected {
    box-shadow: inset 3px 0 0 var(--color-accent-blue);
  }

  .character-copy strong {
    font-size: 0.9rem;
  }

  .character-meta span:nth-child(2) {
    display: none;
  }

  .capacity-banner {
    font-size: 0.75rem;
  }
}

@media (max-width: 390px) {
  .picker-panel { padding: 0.75rem; }
  .character-grid { gap: 0.32rem; }
  .character-card {
    grid-template-columns: 38px minmax(0, 1fr);
    gap: 0.32rem 0.45rem;
    min-height: 102px;
    padding: 0.8rem 0.5rem 0.58rem;
  }
  .portrait { width: 44px; height: 54px; }
  .character-meta span { font-size: 0.75rem; }
}

@media (prefers-reduced-motion: reduce) {
  .character-card,
  .character-card::after {
    animation: none;
    transition: none;
  }

  .character-card:hover:not(:disabled) {
    transform: none;
  }
}
</style>
