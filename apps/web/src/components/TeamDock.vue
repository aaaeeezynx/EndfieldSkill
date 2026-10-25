<script setup lang="ts">
import { computed, reactive } from 'vue'
import { usePlannerStore } from '@/stores/planner'
import { getCharacterPortrait } from '@/data/portraitLoader'
import { displayElement, displayProfession } from '@/lib/displayLabels'
import { MAX_TEAM_SIZE } from '@/lib/validation'

const planner = usePlannerStore()
const operatorFrameUrl = `url("${import.meta.env.BASE_URL}assets/official/operator-frame.svg")`

const imageErrors = reactive<Set<string>>(new Set())

const selectedSlots = computed(() =>
  Array.from(
    { length: MAX_TEAM_SIZE },
    (_, index) => planner.selectedCharacters[index] ?? null,
  ),
)

const teamCount = computed(() => planner.selectedCharacters.length)
const isAtCapacity = computed(() => teamCount.value >= MAX_TEAM_SIZE)

const selectedChapter = computed(() =>
  planner.chapters.find((chapter) => chapter.id === planner.chapterId),
)

const getPortraitUrl = (characterId: string): string | null =>
  getCharacterPortrait(characterId)

const shouldShowFallback = (characterId: string): boolean =>
  !getPortraitUrl(characterId) || imageErrors.has(characterId)

const handleImageError = (characterId: string): void => {
  imageErrors.add(characterId)
}

const monogram = (name: string): string => name.slice(0, 1)

const displayName = (characterId: string, name: string): string => {
  if (characterId === 'chr_0002_endminm') return '管理員'
  return name
}

const submit = async (): Promise<void> => {
  if (!planner.validation.valid || planner.isGenerating) return
  const success = await planner.generate()
  if (success) {
    requestAnimationFrame(() => {
      document.querySelector('#recommendation-output')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }
}
</script>

<template>
  <aside class="team-dock panel cut-corners">
    <div class="dock-head">
      <div>
        <p class="eyebrow">02 / SQUAD LOCK</p>
        <h2>1～4 人編成</h2>
      </div>
      <div class="dock-head-actions">
        <span class="capacity-badge" :class="{ full: isAtCapacity }">
          {{ teamCount }} / {{ MAX_TEAM_SIZE }}
        </span>
        <button
          v-if="teamCount"
          type="button"
          class="clear-button"
          @click="planner.clearTeam()"
        >
          清空
        </button>
      </div>
    </div>

    <TransitionGroup name="squad-slot" tag="div" class="slot-stack">
      <div
        v-for="(character, index) in selectedSlots"
        :key="character?.id ?? `empty-${index}`"
        class="squad-slot"
        :class="{ filled: Boolean(character) }"
      >
        <span class="slot-number">0{{ index + 1 }}</span>
        <template v-if="character">
          <span class="slot-avatar">
            <img
              v-if="!shouldShowFallback(character.id)"
              :src="getPortraitUrl(character.id)!"
              :alt="displayName(character.id, character.name)"
              loading="lazy"
              @error="handleImageError(character.id)"
            />
            <span v-else class="avatar-fallback">{{ monogram(character.name) }}</span>
          </span>
          <span class="slot-copy">
            <strong>{{ displayName(character.id, character.name) }}</strong>
            <small>{{ displayProfession(character.profession) || '職業未標註' }} · {{ displayElement(character.element) || '元素未標註' }}</small>
          </span>
          <button
            type="button"
            class="remove-button"
            :aria-label="`移除 ${displayName(character.id, character.name)}`"
            @click="planner.removeCharacter(character.id)"
          >
            ×
          </button>
        </template>
        <template v-else>
          <span class="empty-cross" aria-hidden="true">+</span>
          <span class="slot-copy empty-copy">
            <strong>等待席位</strong>
            <small>從角色矩陣選擇</small>
          </span>
        </template>
      </div>
    </TransitionGroup>

    <p v-if="planner.notice" class="dock-notice" role="status">
      <span>!</span>{{ planner.notice }}
    </p>

    <div class="progress-section">
      <div class="section-rule">
        <span>03 / PROGRESS GATE</span>
        <i></i>
      </div>

      <label class="field-label" for="player-level">玩家等級</label>
      <div class="level-field">
        <span>LV.</span>
        <input
          id="player-level"
          :value="planner.playerLevelRaw"
          type="number"
          inputmode="numeric"
          min="1"
          max="999"
          placeholder="例如 60"
          @input="planner.setPlayerLevel(($event.target as HTMLInputElement).value)"
        />
      </div>

      <label class="field-label" for="chapter">劇情進度（可選）</label>
      <select
        id="chapter"
        class="chapter-select"
        :value="planner.chapterId"
        :disabled="!planner.hasChapterData"
        @change="planner.setChapter(($event.target as HTMLSelectElement).value)"
      >
        <template v-if="planner.hasChapterData">
          <option value="">不指定章節（僅用已知等級條件）</option>
          <option v-for="chapter in planner.chapters" :key="chapter.id" :value="chapter.id">
            {{ chapter.name }}{{ chapter.minPlayerLevel ? ` · Lv.${chapter.minPlayerLevel}` : '' }}
          </option>
        </template>
        <option v-else value="">章節資料尚未核驗（不阻塞生成）</option>
      </select>

      <p v-if="selectedChapter" class="chapter-meta">
        CHAPTER ORDER {{ String(selectedChapter.order).padStart(2, '0') }}
        <template v-if="selectedChapter.minPlayerLevel">
          / GATE LV.{{ selectedChapter.minPlayerLevel }}
        </template>
      </p>
      <p v-else-if="!planner.hasChapterData" class="chapter-meta unverified">
        CHAPTER / AUTHORITY DATA UNVERIFIED
        <span>本次只按裝備穿戴等級與已知配方資料篩選，不判定劇情或配方權限。</span>
      </p>
    </div>

    <ul v-if="planner.validation.errors.length" class="validation-list" aria-live="polite">
      <li v-for="error in planner.validation.errors" :key="error">{{ error }}</li>
    </ul>

    <button
      class="generate-button"
      type="button"
      :disabled="!planner.validation.valid || planner.isGenerating"
      @click="submit"
    >
      <span class="generate-icon" aria-hidden="true"></span>
      <span>
        <strong>{{ planner.isGenerating ? '正在編排…' : '生成戰術方案' }}</strong>
        <small>DETERMINISTIC · NO AI</small>
      </span>
      <span class="generate-arrow">→</span>
    </button>

    <div class="dock-footnote">
      <span class="pulse-dot" :class="{ full: isAtCapacity }"></span>
      <p v-if="teamCount === 0">尚未編成，至少選擇 1 名角色。</p>
      <p v-else-if="isAtCapacity">已達 {{ MAX_TEAM_SIZE }}/{{ MAX_TEAM_SIZE }} 上限；可移除角色後替換。</p>
      <p v-else>已選 {{ teamCount }}/{{ MAX_TEAM_SIZE }} 人，符合 1～4 人編成。</p>
    </div>
  </aside>
</template>

<style scoped>
.team-dock {
  position: sticky;
  top: 1rem;
  padding: 1.2rem;
  background: #ffffff;
  border: 1px solid var(--color-border-primary);
  color: var(--color-text-primary);
}

.dock-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border-primary);
}

.dock-head-actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.dock-head h2 {
  margin-top: 0.2rem;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.55rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.capacity-badge {
  border: 1px solid var(--color-border-primary);
  background: var(--color-bg-secondary);
  padding: 0.26rem 0.45rem;
  color: var(--color-text-secondary);
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.capacity-badge.full {
  border-color: var(--color-text-primary);
  background: var(--color-accent-primary);
  color: var(--color-text-primary);
}

.clear-button {
  border: 0;
  background: transparent;
  padding: 0.25rem 0;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.clear-button:hover {
  color: var(--color-text-primary);
}

.slot-stack {
  display: grid;
  gap: 0.35rem;
}

.squad-slot {
  position: relative;
  display: grid;
  grid-template-columns: 1.8rem 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  min-height: 66px;
  border: 1px dashed var(--color-border-primary);
  background: #fafafa;
  padding: 0.4rem 0.45rem;
}

.squad-slot.filled {
  border-style: solid;
  border-color: var(--color-border-strong);
  background: #fffde7;
}

.squad-slot.filled::after {
  position: absolute;
  z-index: 0;
  inset: 0;
  background: var(--color-text-primary);
  content: "";
  opacity: 0.1;
  pointer-events: none;
  -webkit-mask: v-bind(operatorFrameUrl) center / 100% 100% no-repeat;
  mask: v-bind(operatorFrameUrl) center / 100% 100% no-repeat;
}

.squad-slot > * {
  position: relative;
  z-index: 1;
}

.squad-slot-enter-active {
  animation: squad-slot-enter 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.squad-slot-leave-active {
  animation: squad-slot-leave 140ms ease-in both;
  pointer-events: none;
}

.squad-slot-move {
  transition: transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.slot-number {
  color: var(--color-text-tertiary);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
}

.filled .slot-number {
  color: var(--color-text-primary);
}

.slot-avatar {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--color-border-primary);
  background: #f0f0f0;
  color: var(--color-text-primary);
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.1rem;
}

.slot-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.slot-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.slot-copy strong {
  overflow: hidden;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-primary);
}

.slot-copy small {
  overflow: hidden;
  margin-top: 0.12rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-copy strong {
  color: var(--color-text-tertiary);
  font-weight: 500;
}

.empty-cross {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: var(--color-text-tertiary);
  font-family: "Rajdhani", sans-serif;
  font-size: 1.1rem;
}

.remove-button {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 1rem;
  cursor: pointer;
}

.remove-button:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.dock-notice {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.6rem;
  border-left: 2px solid var(--color-accent-orange);
  background: #fff8ec;
  padding: 0.48rem 0.6rem;
  color: #5c3a00;
  font-size: 0.75rem;
}

.dock-notice span {
  color: var(--color-accent-orange);
  font-family: "Rajdhani", sans-serif;
  font-weight: 700;
}

.progress-section {
  margin-top: 1.25rem;
}

.section-rule {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 0.9rem;
  color: var(--color-text-secondary);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.section-rule i {
  height: 1px;
  flex: 1;
  background: var(--color-border-primary);
}

.field-label {
  display: block;
  margin: 0.7rem 0 0.35rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
}

.level-field {
  display: flex;
  align-items: center;
  height: 43px;
  border: 1px solid var(--color-border-primary);
  background: #ffffff;
}

.level-field:focus-within {
  border-color: var(--color-text-primary);
  box-shadow: inset 0 0 0 1px var(--color-text-primary);
}

.level-field span {
  padding-left: 0.75rem;
  color: var(--color-text-primary);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
}

.level-field input {
  width: 100%;
  height: 100%;
  border: 0;
  background: #ffffff;
  padding: 0 0.7rem;
  color: var(--color-text-primary);
  font-family: "Rajdhani", sans-serif;
  font-size: 1.05rem;
  font-weight: 500;
}

.level-field input::placeholder {
  color: #3f3f3f;
  opacity: 1;
}

.chapter-select {
  width: 100%;
  height: 43px;
  border: 1px solid var(--color-border-primary);
  background: #ffffff;
  padding: 0 0.7rem;
  color: var(--color-text-primary);
  font-size: 0.76rem;
}

.level-field input:focus-visible,
.chapter-select:focus-visible {
  outline: 3px solid var(--color-text-primary);
  outline-offset: 2px;
}

.chapter-select option {
  background: #ffffff;
}

.chapter-meta {
  margin-top: 0.42rem;
  color: var(--color-text-tertiary);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
}

.chapter-meta.unverified {
  color: #5c3a00;
  line-height: 1.45;
}

.chapter-meta.unverified span {
  display: block;
  margin-top: 0.18rem;
  color: #3f3f3f;
  font-family: "Noto Sans TC", sans-serif;
  letter-spacing: 0;
}

.validation-list {
  display: grid;
  gap: 0.2rem;
  margin: 0.85rem 0 0;
  border-left: 2px solid var(--color-danger);
  padding: 0.35rem 0 0.35rem 0.6rem;
  color: #9e332a;
  font-size: 0.75rem;
  line-height: 1.45;
  list-style: none;
}

.generate-button {
  display: flex;
  width: 100%;
  min-height: 63px;
  align-items: center;
  gap: 0.7rem;
  margin-top: 1rem;
  border: 1px solid var(--color-accent-primary);
  background: var(--color-accent-primary);
  padding: 0 0.8rem;
  color: #191919;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 180ms ease,
    color 180ms ease,
    opacity 180ms ease;
}

.generate-button:hover:not(:disabled) {
  background: #e7ff78;
}

.generate-button:disabled {
  border-color: var(--color-border-primary);
  background: #f0f0f0;
  color: var(--color-text-tertiary);
  cursor: not-allowed;
}

.generate-icon {
  position: relative;
  width: 20px;
  height: 20px;
  border: 1px solid currentColor;
  transform: rotate(45deg);
}

.generate-icon::before,
.generate-icon::after {
  content: "";
  position: absolute;
  background: currentColor;
}

.generate-icon::before {
  top: 8px;
  left: 4px;
  width: 10px;
  height: 1px;
}

.generate-icon::after {
  top: 4px;
  left: 8px;
  width: 1px;
  height: 10px;
}

.generate-button > span:nth-child(2) {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.generate-button strong {
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.96rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.generate-button small {
  margin-top: 0.1rem;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.13em;
}

.generate-arrow {
  font-size: 1.2rem;
}

.dock-footnote {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.7rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}

.pulse-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-accent-blue);
  box-shadow: 0 0 9px var(--color-accent-blue);
}

.pulse-dot.full {
  background: var(--color-text-primary);
  box-shadow: none;
}

@keyframes squad-slot-enter {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes squad-slot-leave {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(10px);
  }
}

@media (max-width: 960px) {
  .team-dock {
    position: relative;
    top: 0;
  }
}

@media (max-width: 640px) {
  .team-dock {
    padding: 1rem;
  }

  .slot-stack {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .squad-slot {
    grid-template-columns: 1.3rem 36px minmax(0, 1fr) auto;
    gap: 0.35rem;
    min-height: 55px;
  }

  .slot-avatar,
  .empty-cross {
    width: 34px;
    height: 38px;
  }

  .slot-copy strong {
    font-size: 0.78rem;
  }

  .slot-copy small {
    font-size: 0.75rem;
  }

  .progress-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 0.6rem;
  }

  .section-rule,
  .chapter-meta,
  .validation-list {
    grid-column: 1 / -1;
  }
}

@media (max-width: 390px) {
  .team-dock { padding: 0.75rem; }
  .dock-head-actions { gap: 0.4rem; }
  .squad-slot {
    grid-template-columns: 1.1rem 32px minmax(0, 1fr) auto;
    gap: 0.3rem;
    min-height: 60px;
    padding: 0.35rem 0.4rem;
  }
  .slot-avatar, .empty-cross { width: 30px; height: 34px; }
  .slot-copy strong { font-size: 0.75rem; }
  .slot-copy small { font-size: 0.75rem; }
  .generate-button { min-height: 58px; }
}

@media (prefers-reduced-motion: reduce) {
  .squad-slot-enter-active,
  .squad-slot-leave-active {
    animation: none;
  }

  .squad-slot-move {
    transition: none;
  }
}
</style>
