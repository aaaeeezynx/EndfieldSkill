<script setup lang="ts">
import { computed } from 'vue'
import { usePlannerStore } from '@/stores/planner'

const planner = usePlannerStore()

const files = computed(() => [
  'meta.json',
  'characters.json',
  'equipment.json',
  'progressions.json',
  'team-presets.json',
  'rotation-presets.json',
  'sources.json',
])

const hasError = computed(() => planner.dataState === 'error')
</script>

<template>
  <section class="pipeline-shell reveal" aria-live="polite">
    <div class="pipeline-code">
      <span>SYS/</span>
      <span>DATA_LINK</span>
      <span class="blink">_</span>
    </div>

    <div class="pipeline-body">
      <p class="eyebrow">{{ hasError ? 'LINK FAILURE' : 'WAITING FOR DATA PIPELINE' }}</p>
      <h1 class="display-title pipeline-title">
        {{ hasError ? '資料鏈路中斷。' : '等待資料管線接入。' }}
      </h1>
      <p class="pipeline-copy">
        {{
          hasError
            ? planner.dataError
            : '前端已就位，但尚未發現可驗證的 /data/v1 資料集。本頁不會以示例角色冒充遊戲資料。'
        }}
      </p>

      <div class="file-grid">
        <div v-for="file in files" :key="file" class="file-row">
          <span
            class="file-status"
            :class="{ missing: planner.dataset?.missingFiles.includes(file) }"
          ></span>
          <code>data/v1/{{ file }}</code>
          <span class="file-note">
            {{ planner.dataset?.missingFiles.includes(file) ? 'MISSING' : 'PENDING' }}
          </span>
        </div>
      </div>

      <div class="pipeline-actions">
        <button class="action-button" type="button" @click="planner.initialize(true)">
          重新檢測資料鏈路
        </button>
        <RouterLink class="text-link" to="/data">查看資料契約 →</RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pipeline-shell {
  position: relative;
  display: grid;
  grid-template-columns: minmax(90px, 150px) 1fr;
  min-height: 500px;
  margin-top: 2rem;
  overflow: hidden;
  border: 1px solid var(--color-border-primary);
  border-top: 6px solid var(--color-text-primary);
  background: var(--color-bg-panel);
  box-shadow: 0 20px 60px rgba(25, 25, 25, 0.08);
}

.pipeline-shell::after {
  position: absolute;
  top: 0;
  right: 0;
  width: 24%;
  height: 100%;
  background: repeating-linear-gradient(
    -45deg,
    var(--color-accent-primary) 0,
    var(--color-accent-primary) 1px,
    transparent 1px,
    transparent 12px
  );
  content: "";
  opacity: 0.32;
  pointer-events: none;
}

.pipeline-code {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  border-right: 1px solid var(--color-border-primary);
  background: var(--color-text-primary);
  padding: 2rem 0.7rem;
  color: #fff;
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  writing-mode: vertical-rl;
}

.blink {
  color: var(--color-accent-primary);
  animation: blink 1s steps(1) infinite;
}

.pipeline-body {
  position: relative;
  z-index: 1;
  max-width: 900px;
  padding: clamp(2rem, 7vw, 5rem);
}

.pipeline-title {
  max-width: 720px;
  margin-top: 1.1rem;
  color: var(--color-text-primary);
  font-size: clamp(3rem, 8vw, 7.4rem);
}

.pipeline-copy {
  max-width: 630px;
  margin-top: 1.4rem;
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  line-height: 1.8;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-top: 2.2rem;
  border: 1px solid var(--color-border-primary);
  background: var(--color-border-primary);
}

.file-row {
  display: grid;
  grid-template-columns: 7px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  background: #fff;
  padding: 0.72rem 0.8rem;
}

.file-row code {
  overflow: hidden;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  text-overflow: ellipsis;
}

.file-status {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent-primary);
  box-shadow: 0 0 0 1px var(--color-text-primary);
}

.file-status.missing {
  background: var(--color-accent-orange);
}

.file-note {
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.pipeline-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.4rem;
  margin-top: 2rem;
}

.action-button {
  min-height: 46px;
  border: 1px solid var(--color-text-primary);
  background: var(--color-text-primary);
  padding: 0 1rem;
  color: #fff;
  font-family: var(--font-display);
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.action-button:hover {
  background: var(--color-accent-primary);
  color: var(--color-text-primary);
}

.text-link {
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  text-decoration: none;
}

.text-link:hover {
  color: var(--color-text-primary);
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

@media (max-width: 640px) {
  .pipeline-shell {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .pipeline-code {
    flex-direction: row;
    justify-content: flex-start;
    border-right: 0;
    border-bottom: 1px solid var(--color-border-primary);
    padding: 0.65rem 1rem;
    writing-mode: horizontal-tb;
  }

  .pipeline-body {
    padding: 2rem 1rem;
  }

  .pipeline-title {
    font-size: clamp(2.65rem, 15vw, 4.3rem);
  }

  .file-grid {
    grid-template-columns: 1fr;
  }
}
</style>
