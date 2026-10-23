<script setup lang="ts">
import { computed } from 'vue'
import { usePlannerStore } from '@/stores/planner'
import { getCharacterPortrait } from '@/data/portraitLoader'

const planner = usePlannerStore()

const selectedSlots = computed(() =>
  Array.from({ length: 4 }, (_, index) => planner.selectedCharacters[index] ?? null),
)

const selectedChapter = computed(() =>
  planner.chapters.find((chapter) => chapter.id === planner.chapterId),
)

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
        <h2>四人编成</h2>
      </div>
      <button
        v-if="planner.selectedCharacters.length"
        type="button"
        class="clear-button"
        @click="planner.clearTeam()"
      >
        清空
      </button>
    </div>

    <div class="slot-stack">
      <div
        v-for="(character, index) in selectedSlots"
        :key="character?.id ?? `empty-${index}`"
        class="squad-slot"
        :class="{ filled: Boolean(character) }"
      >
        <span class="slot-number">0{{ index + 1 }}</span>
        <template v-if="character">
          <span class="slot-avatar">
            <img v-if="getCharacterPortrait(character.id)" :src="getCharacterPortrait(character.id)!" :alt="character.name" loading="lazy" />
            <span v-else>{{ character.name.slice(0, 1) }}</span>
          </span>
          <span class="slot-copy">
            <strong>{{ character.name }}</strong>
            <small>{{ character.profession || '职业未标注' }} · {{ character.element || '元素未标注' }}</small>
          </span>
          <button
            type="button"
            class="remove-button"
            :aria-label="`移除 ${character.name}`"
            @click="planner.removeCharacter(character.id)"
          >
            ×
          </button>
        </template>
        <template v-else>
          <span class="empty-cross" aria-hidden="true">+</span>
          <span class="slot-copy empty-copy">
            <strong>等待席位</strong>
            <small>从角色矩阵选择</small>
          </span>
        </template>
      </div>
    </div>

    <p v-if="planner.notice" class="dock-notice" role="status">
      <span>!</span>{{ planner.notice }}
    </p>

    <div class="progress-section">
      <div class="section-rule">
        <span>03 / PROGRESS GATE</span>
        <i></i>
      </div>

      <label class="field-label" for="player-level">玩家等级</label>
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

      <label class="field-label" for="chapter">剧情进度（可选）</label>
      <select
        id="chapter"
        class="chapter-select"
        :value="planner.chapterId"
        :disabled="!planner.hasChapterData"
        @change="planner.setChapter(($event.target as HTMLSelectElement).value)"
      >
        <template v-if="planner.hasChapterData">
          <option value="">不指定章节（仅用已知等级条件）</option>
          <option v-for="chapter in planner.chapters" :key="chapter.id" :value="chapter.id">
            {{ chapter.name }}{{ chapter.minPlayerLevel ? ` · Lv.${chapter.minPlayerLevel}` : '' }}
          </option>
        </template>
        <option v-else value="">章节资料尚未核验（不阻塞生成）</option>
      </select>

      <p v-if="selectedChapter" class="chapter-meta">
        CHAPTER ORDER {{ String(selectedChapter.order).padStart(2, '0') }}
        <template v-if="selectedChapter.minPlayerLevel">
          / GATE LV.{{ selectedChapter.minPlayerLevel }}
        </template>
      </p>
      <p v-else-if="!planner.hasChapterData" class="chapter-meta unverified">
        CHAPTER / AUTHORITY DATA UNVERIFIED
        <span>本次只按装备穿戴等级与已知配方资料筛选，不判定剧情或配方权限。</span>
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
        <strong>{{ planner.isGenerating ? '正在编排…' : '生成战术方案' }}</strong>
        <small>DETERMINISTIC · NO AI</small>
      </span>
      <span class="generate-arrow">→</span>
    </button>

    <div class="dock-footnote">
      <span class="pulse-dot"></span>
      <p v-if="planner.selectedCharacters.length === 4">队伍席位已锁定，可以生成。</p>
      <p v-else>还需 {{ 4 - planner.selectedCharacters.length }} 名角色。</p>
    </div>
  </aside>
</template>

<style scoped>
.team-dock {
  position: sticky;
  top: 1rem;
  padding: 1.2rem;
}

.dock-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.dock-head h2 {
  margin-top: 0.2rem;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.55rem;
  font-weight: 700;
}

.clear-button {
  border: 0;
  background: transparent;
  padding: 0.25rem 0;
  color: #7e8577;
  font-size: 0.65rem;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.clear-button:hover {
  color: var(--paper);
}

.slot-stack {
  display: grid;
  gap: 0.35rem;
}

.squad-slot {
  display: grid;
  grid-template-columns: 1.8rem 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.55rem;
  min-height: 60px;
  border: 1px dashed #3b4334;
  background: rgba(16, 19, 15, 0.46);
  padding: 0.4rem 0.45rem;
}

.squad-slot.filled {
  border-style: solid;
  border-color: #4a533f;
  background: linear-gradient(90deg, rgba(216, 244, 91, 0.055), transparent);
}

.slot-number {
  color: #62695b;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.65rem;
  font-weight: 600;
}

.filled .slot-number {
  color: var(--acid);
}

.slot-avatar {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  overflow: hidden;
  border: 1px solid #4a533f;
  background: #252b22;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.1rem;
}

.slot-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
}

.slot-copy small {
  overflow: hidden;
  margin-top: 0.12rem;
  color: #767d70;
  font-size: 0.6rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-copy strong {
  color: #7b8274;
  font-weight: 500;
}

.empty-cross {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  color: #555d4e;
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
  color: #7c8375;
  font-size: 1rem;
  cursor: pointer;
}

.remove-button:hover {
  border-color: var(--danger);
  color: var(--danger);
}

.dock-notice {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.6rem;
  border-left: 2px solid var(--ember);
  background: rgba(255, 156, 102, 0.08);
  padding: 0.48rem 0.6rem;
  color: #d9b59e;
  font-size: 0.68rem;
}

.dock-notice span {
  color: var(--ember);
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
  color: #767d6f;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.section-rule i {
  height: 1px;
  flex: 1;
  background: var(--line);
}

.field-label {
  display: block;
  margin: 0.7rem 0 0.35rem;
  color: #939a8c;
  font-size: 0.66rem;
  font-weight: 500;
}

.level-field {
  display: flex;
  align-items: center;
  height: 43px;
  border: 1px solid #414a39;
  background: #141712;
}

.level-field:focus-within {
  border-color: var(--acid);
}

.level-field span {
  padding-left: 0.75rem;
  color: var(--acid);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.72rem;
  font-weight: 600;
}

.level-field input {
  width: 100%;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  padding: 0 0.7rem;
  color: var(--paper);
  font-family: "Rajdhani", sans-serif;
  font-size: 1.05rem;
  font-weight: 500;
}

.chapter-select {
  width: 100%;
  height: 43px;
  border: 1px solid #414a39;
  outline: 0;
  background: #141712;
  padding: 0 0.7rem;
  color: var(--paper);
  font-size: 0.76rem;
}

.chapter-select:focus {
  border-color: var(--acid);
}

.chapter-select option {
  background: var(--carbon);
}

.chapter-meta {
  margin-top: 0.42rem;
  color: #6f7668;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.59rem;
  letter-spacing: 0.08em;
}

.chapter-meta.unverified {
  color: #b8a46d;
  line-height: 1.45;
}

.chapter-meta.unverified span {
  display: block;
  margin-top: 0.18rem;
  color: #8e8260;
  font-family: "Noto Sans TC", sans-serif;
  letter-spacing: 0;
}

.validation-list {
  display: grid;
  gap: 0.2rem;
  margin: 0.85rem 0 0;
  border-left: 2px solid var(--danger);
  padding: 0.35rem 0 0.35rem 0.6rem;
  color: #d9a297;
  font-size: 0.65rem;
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
  border: 1px solid var(--acid);
  background: var(--acid);
  padding: 0 0.8rem;
  color: var(--ink);
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
  border-color: #3b4334;
  background: #252a21;
  color: #6e7567;
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
  font-size: 0.53rem;
  font-weight: 600;
  letter-spacing: 0.13em;
  opacity: 0.65;
}

.generate-arrow {
  font-size: 1.2rem;
}

.dock-footnote {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin-top: 0.7rem;
  color: #70776a;
  font-size: 0.62rem;
}

.pulse-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 9px var(--cyan);
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
    font-size: 0.52rem;
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
</style>
