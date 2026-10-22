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
</script>

<template>
  <section class="pipeline-shell reveal" aria-live="polite">
    <div class="pipeline-code">
      <span>SYS/</span>
      <span>DATA_LINK</span>
      <span class="blink">_</span>
    </div>
    <div class="pipeline-body">
      <p class="eyebrow">
        {{ planner.dataState === 'error' ? 'LINK FAILURE' : 'WAITING FOR DATA PIPELINE' }}
      </p>
      <h1 class="display-title pipeline-title">
        {{ planner.dataState === 'error' ? '数据链路中断。' : '等待数据管线接入。' }}
      </h1>
      <p class="pipeline-copy">
        {{
          planner.dataState === 'error'
            ? planner.dataError
            : '前端已经就位，但尚未发现可验证的 /data/v1 数据集。这里不会用示例角色冒充游戏资料。'
        }}
      </p>

      <div class="file-grid">
        <div v-for="file in files" :key="file" class="file-row">
          <span class="file-status" :class="{ missing: planner.dataset?.missingFiles.includes(file) }"></span>
          <code>data/v1/{{ file }}</code>
          <span class="file-note">
            {{ planner.dataset?.missingFiles.includes(file) ? 'MISSING' : 'PENDING' }}
          </span>
        </div>
      </div>

      <div class="pipeline-actions">
        <button class="action-button" type="button" @click="planner.initialize(true)">
          [ 重新检测数据链路 ]
        </button>
        <RouterLink class="text-link" to="/data">查看数据契约 →</RouterLink>
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
  border: 1px solid var(--line);
  background:
    linear-gradient(120deg, rgba(216, 244, 91, 0.055), transparent 34%),
    rgba(23, 26, 21, 0.92);
  box-shadow: var(--shadow-terminal, 0 18px 70px rgba(0, 0, 0, 0.34));
}

.pipeline-shell::after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: 24%;
  height: 100%;
  opacity: 0.08;
  background: repeating-linear-gradient(
    -45deg,
    var(--acid) 0,
    var(--acid) 1px,
    transparent 1px,
    transparent 10px
  );
  pointer-events: none;
}

.pipeline-code {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 2rem 0.7rem;
  border-right: 1px solid var(--line);
  color: #69705f;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  writing-mode: vertical-rl;
}

.blink {
  color: var(--acid);
  animation: blink 1s steps(1) infinite;
}

.pipeline-body {
  position: relative;
  z-index: 1;
  max-width: 850px;
  padding: clamp(2rem, 7vw, 5rem);
}

.pipeline-title {
  max-width: 720px;
  margin-top: 1.1rem;
  font-size: clamp(3rem, 8vw, 7.4rem);
  color: var(--paper);
}

.pipeline-copy {
  max-width: 630px;
  margin-top: 1.4rem;
  color: var(--muted);
  font-size: 0.95rem;
  line-height: 1.8;
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-top: 2.2rem;
  border: 1px solid var(--line);
  background: var(--line);
}

.file-row {
  display: grid;
  grid-template-columns: 7px 1fr auto;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
  padding: 0.72rem 0.8rem;
  background: #171a15;
}

.file-row code {
  overflow: hidden;
  color: #c8cabb;
  font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
  font-size: 0.7rem;
  text-overflow: ellipsis;
}

.file-status {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--acid);
}

.file-status.missing {
  background: var(--ember);
}

.file-note {
  color: #737a6c;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.63rem;
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
  min-height: 42px;
  border: 1px solid var(--acid);
  background: transparent;
  padding: 0 1rem;
  color: var(--acid);
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.action-button:hover {
  background: var(--acid);
  color: var(--ink);
}

.text-link {
  color: var(--muted);
  font-size: 0.78rem;
  text-decoration: none;
}

.text-link:hover {
  color: var(--paper);
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
    padding: 0.65rem 1rem;
    border-right: 0;
    border-bottom: 1px solid var(--line);
    writing-mode: horizontal-tb;
  }

  .pipeline-body {
    padding: 2rem 1.2rem;
  }

  .pipeline-title {
    font-size: clamp(2.65rem, 17vw, 4.6rem);
  }

  .file-grid {
    grid-template-columns: 1fr;
  }
}
</style>
