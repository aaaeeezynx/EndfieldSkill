<script setup lang="ts">
import { computed } from 'vue'
import { DATA_FILES } from '@/data/loadDataset'
import { usePlannerStore } from '@/stores/planner'

const planner = usePlannerStore()

const dataset = computed(() => planner.dataset)
const hasUnverifiedProgressData = computed(
  () => Boolean(dataset.value?.characters.length) && !(dataset.value?.chapters.length ?? 0),
)

const coverageItems = computed(() => {
  const coverage = dataset.value?.coverage
  if (!coverage) return []
  return [
    { label: '角色技能字段', value: coverage.characterSkillCoverage },
    { label: '角色来源覆盖', value: coverage.characterSourceCoverage },
    { label: '装备门槛覆盖', value: coverage.equipmentGateCoverage },
    { label: '循环来源覆盖', value: coverage.rotationSourceCoverage },
  ]
})

const statusLabel = computed(() => {
  if (planner.dataState === 'loading') return '链路检测中'
  if (planner.dataState === 'error') return '链路错误'
  if (planner.dataState === 'empty') return '等待数据管线'
  if (planner.dataState === 'ready') {
    return dataset.value?.missingFiles.length ? '部分数据可用' : '数据在线'
  }
  return '尚未检测'
})

const safeUrl = (url: string | null): string | null => {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null
  } catch {
    return null
  }
}

const fileStatus = (file: string): string => {
  if (!dataset.value) return 'PENDING'
  if (dataset.value.missingFiles.includes(file)) return 'MISSING'
  if (dataset.value.loadedFiles.includes(file)) return 'LOADED'
  return 'PENDING'
}
</script>

<template>
  <div class="container-shell data-page">
    <section class="data-hero reveal">
      <div>
        <p class="eyebrow">DATA LINK // TRACEABILITY</p>
        <h1 class="display-title">资料链路与<br /><span>可验证边界。</span></h1>
      </div>
      <div class="status-block">
        <span class="status-light" :class="planner.dataState"></span>
        <div>
          <small>CURRENT STATE</small>
          <strong>{{ statusLabel }}</strong>
        </div>
      </div>
    </section>

    <div class="data-grid">
      <section class="dataset-panel panel reveal reveal-delay-1">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">DATASET MANIFEST</p>
            <h2>数据集版本</h2>
          </div>
          <span class="schema-chip">{{ dataset?.meta.schemaVersion ?? 'SCHEMA PENDING' }}</span>
        </div>

        <dl class="meta-grid">
          <div>
            <dt>数据版本</dt>
            <dd>{{ dataset?.meta.dataVersion ?? '等待数据代理提供' }}</dd>
          </div>
          <div>
            <dt>游戏版本</dt>
            <dd>{{ dataset?.meta.gameVersion ?? '未标注' }}</dd>
          </div>
          <div>
            <dt>生成时间</dt>
            <dd>{{ dataset?.meta.generatedAt ?? '未标注' }}</dd>
          </div>
          <div>
            <dt>来源数量</dt>
            <dd>{{ dataset?.meta.sourceCount ?? dataset?.sources.length ?? 0 }}</dd>
          </div>
        </dl>

        <div class="count-grid">
          <div><strong>{{ dataset?.characters.length ?? 0 }}</strong><span>CHARACTERS</span></div>
          <div><strong>{{ dataset?.equipment.length ?? 0 }}</strong><span>EQUIPMENT</span></div>
          <div :class="{ partial: hasUnverifiedProgressData }">
            <strong>{{ dataset?.chapters.length ?? 0 }}</strong>
            <span>{{ hasUnverifiedProgressData ? 'CHAPTERS / UNVERIFIED' : 'CHAPTERS' }}</span>
          </div>
          <div><strong>{{ dataset?.rotationPresets.length ?? 0 }}</strong><span>ROTATIONS</span></div>
        </div>

        <div v-if="hasUnverifiedProgressData" class="progress-limits">
          <span>PROGRESS DATA UNVERIFIED</span>
          <p>
            章节资料为空，配方权限也尚未由剧情或权限进度自动核验。角色选择、技能循环与装备穿戴等级推荐仍可使用，
            但本页不会把章节门槛或“当前可制造”状态宣称为完整结论。
          </p>
        </div>

        <div v-if="dataset?.meta.notes.length" class="meta-notes">
          <span>DATASET NOTES</span>
          <p v-for="note in dataset.meta.notes" :key="note">{{ note }}</p>
        </div>
        <div v-else-if="!dataset" class="empty-line">
          尚未读取到 `public/data/v1/`。页面不会生成示例角色、循环或装备数据冒充已验证资料。
        </div>
      </section>

      <section class="coverage-panel panel reveal reveal-delay-2">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">FIELD COVERAGE</p>
            <h2>字段覆盖率</h2>
          </div>
        </div>

        <div v-if="coverageItems.length" class="coverage-list">
          <div v-for="item in coverageItems" :key="item.label">
            <div class="coverage-label">
              <span>{{ item.label }}</span>
              <strong>{{ item.value === null ? 'N/A' : `${item.value}%` }}</strong>
            </div>
            <div class="coverage-track">
              <i :style="{ width: `${item.value ?? 0}%` }"></i>
            </div>
          </div>
        </div>
        <p v-else class="coverage-empty">等待数据管线后计算覆盖率。</p>

        <div class="missing-fields">
          <span>MISSING / PARTIAL FIELDS</span>
          <div v-if="dataset?.coverage.missingFields.length">
            <code v-for="field in dataset.coverage.missingFields" :key="field">{{ field }}</code>
          </div>
          <p v-else-if="dataset">当前未发现可计算的缺失字段，或数据集为空。</p>
          <p v-else>尚无数据。</p>
        </div>

        <div v-if="dataset?.errors.length" class="load-errors">
          <span>LOAD ERRORS</span>
          <p v-for="error in dataset.errors" :key="error">{{ error }}</p>
        </div>
      </section>
    </div>

    <div class="lower-grid">
      <section class="contract-panel panel reveal reveal-delay-2">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">FILE CONTRACT</p>
            <h2>数据文件</h2>
          </div>
          <span class="contract-path">public/data/v1</span>
        </div>
        <div class="file-table">
          <div v-for="file in DATA_FILES" :key="file" class="file-row">
            <span class="file-dot" :class="fileStatus(file).toLowerCase()"></span>
            <code>{{ file }}</code>
            <span>{{ fileStatus(file) }}</span>
          </div>
        </div>
        <p class="contract-note">
          规范数据保存在仓库根 `data/v1/`；构建前由同步脚本复制至前端静态目录。前端只读取规范化契约，
          不在浏览器中抓取第三方页面。
        </p>
      </section>

      <section class="sources-panel panel reveal reveal-delay-3">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">SOURCE REGISTER</p>
            <h2>来源索引</h2>
          </div>
          <span class="source-count">{{ dataset?.sources.length ?? 0 }} ENTRIES</span>
        </div>

        <div v-if="dataset?.sources.length" class="source-list">
          <article v-for="source in dataset.sources" :key="source.id">
            <div class="source-head">
              <span>{{ source.id }}</span>
              <a
                v-if="safeUrl(source.url)"
                :href="safeUrl(source.url) ?? undefined"
                target="_blank"
                rel="noreferrer"
              >
                OPEN ↗
              </a>
              <span v-else class="source-unlinked">NO SAFE URL</span>
            </div>
            <h3>{{ source.title }}</h3>
            <p>{{ source.publisher || '发布者未标注' }} · {{ source.fetchedAt || '抓取时间未标注' }}</p>
            <div v-if="source.fields.length" class="source-fields">
              <span v-for="field in source.fields.slice(0, 8)" :key="field">{{ field }}</span>
            </div>
          </article>
        </div>
        <div v-else class="source-empty">
          <strong>AWAITING SOURCE REGISTER</strong>
          <p>数据代理尚未提供 `sources.json`，因此当前没有可核验的抓取来源。</p>
        </div>
      </section>
    </div>

    <section class="method-note reveal">
      <span>METHOD / 01</span>
      <p>
        推荐采用“来源预设优先，标签规则回退”的确定性流程。共享技力、连携触发条件与终结技能量分别建模，
        不以普通秒表时间轴替代战斗机制。任何规则生成内容均明确标注待人工核对。
      </p>
      <a href="https://endfield.games/zh-Hans/tutorials/battle/" target="_blank" rel="noreferrer">
        官方战斗机制 ↗
      </a>
    </section>
  </div>
</template>

<style scoped>
.data-page {
  padding-top: clamp(2rem, 5vw, 4.5rem);
}

.data-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  padding-bottom: clamp(2rem, 4vw, 3.2rem);
}

.data-hero h1 {
  margin-top: 0.7rem;
  font-size: clamp(3rem, 6.5vw, 6.2rem);
}

.data-hero h1 span {
  color: var(--cyan);
}

.status-block {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid var(--line);
  background: rgba(16, 19, 15, 0.6);
  padding: 0.7rem 0.9rem;
}

.status-light {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #777e70;
}

.status-light.ready {
  background: var(--cyan);
  box-shadow: 0 0 12px var(--cyan);
}

.status-light.loading {
  background: var(--acid);
  animation: beacon-pulse 1.2s ease-in-out infinite;
}

.status-light.error {
  background: var(--danger);
}

.status-block div {
  display: flex;
  flex-direction: column;
}

.status-block small {
  color: #676e60;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.52rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.status-block strong {
  color: var(--paper);
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.88rem;
  font-weight: 600;
}

.data-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
  gap: 0.8rem;
}

.dataset-panel,
.coverage-panel,
.contract-panel,
.sources-panel {
  padding: 1.2rem;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--line);
  padding-bottom: 0.75rem;
}

.panel-heading h2 {
  margin-top: 0.18rem;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.3rem;
  font-weight: 600;
}

.schema-chip,
.contract-path,
.source-count {
  color: #767d6f;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.56rem;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-top: 0.8rem;
  border: 1px solid #343b2e;
  background: #343b2e;
}

.meta-grid div {
  min-width: 0;
  background: #191d17;
  padding: 0.6rem;
}

.meta-grid dt {
  color: #71786b;
  font-size: 0.56rem;
}

.meta-grid dd {
  margin: 0.15rem 0 0;
  overflow-wrap: anywhere;
  color: #bdc1b5;
  font-size: 0.66rem;
}

.count-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.35rem;
  margin-top: 0.7rem;
}

.count-grid div {
  border: 1px solid #343b2e;
  padding: 0.55rem;
}

.count-grid strong {
  display: block;
  color: var(--acid);
  font-family: "Rajdhani", sans-serif;
  font-size: 1.4rem;
  font-weight: 600;
  line-height: 1;
}

.count-grid span {
  display: block;
  margin-top: 0.2rem;
  color: #6f7668;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.49rem;
  font-weight: 600;
  letter-spacing: 0.07em;
}

.count-grid div.partial {
  border-color: rgba(255, 156, 102, 0.5);
  background: rgba(255, 156, 102, 0.045);
}

.count-grid div.partial strong,
.count-grid div.partial span {
  color: var(--ember);
}

.progress-limits {
  margin-top: 0.7rem;
  border-left: 2px solid var(--ember);
  background: rgba(255, 156, 102, 0.055);
  padding: 0.55rem 0.65rem;
}

.progress-limits > span {
  color: var(--ember);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.54rem;
  font-weight: 700;
  letter-spacing: 0.09em;
}

.progress-limits p {
  margin-top: 0.25rem;
  color: #ad9787;
  font-size: 0.61rem;
  line-height: 1.55;
}

.meta-notes,
.load-errors {
  display: grid;
  gap: 0.25rem;
  margin-top: 0.7rem;
  border-left: 1px solid var(--ember);
  padding-left: 0.55rem;
}

.meta-notes > span,
.load-errors > span,
.missing-fields > span {
  color: var(--ember);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.54rem;
  font-weight: 700;
  letter-spacing: 0.09em;
}

.meta-notes p,
.load-errors p {
  color: #a48e7f;
  font-size: 0.6rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.empty-line {
  margin-top: 0.7rem;
  color: #958474;
  font-size: 0.62rem;
  line-height: 1.55;
}

.coverage-list {
  display: grid;
  gap: 0.7rem;
  margin-top: 0.9rem;
}

.coverage-label {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: #8e9587;
  font-size: 0.61rem;
}

.coverage-label strong {
  color: var(--cyan);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.65rem;
  font-weight: 600;
}

.coverage-track {
  height: 4px;
  margin-top: 0.28rem;
  background: #2d3329;
}

.coverage-track i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--cyan), var(--acid));
}

.coverage-empty {
  margin-top: 1rem;
  color: #817d70;
  font-size: 0.64rem;
}

.missing-fields {
  margin-top: 1rem;
  border-top: 1px solid var(--line);
  padding-top: 0.7rem;
}

.missing-fields > div {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.45rem;
}

.missing-fields code {
  background: rgba(238, 233, 220, 0.045);
  padding: 0.15rem 0.3rem;
  color: #9a9f94;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.53rem;
}

.missing-fields p {
  margin-top: 0.4rem;
  color: #858c7e;
  font-size: 0.6rem;
}

.lower-grid {
  display: grid;
  grid-template-columns: minmax(300px, 0.75fr) minmax(0, 1.25fr);
  gap: 0.8rem;
  margin-top: 0.8rem;
}

.file-table {
  margin-top: 0.75rem;
  border: 1px solid #343b2e;
}

.file-row {
  display: grid;
  grid-template-columns: 7px 1fr auto;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  border-bottom: 1px solid #30372b;
  padding: 0.48rem 0.55rem;
}

.file-row:last-child {
  border-bottom: 0;
}

.file-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #61685a;
}

.file-dot.loaded {
  background: var(--cyan);
}

.file-dot.missing {
  background: var(--ember);
}

.file-row code {
  overflow: hidden;
  color: #a9afa1;
  font-size: 0.58rem;
  text-overflow: ellipsis;
}

.file-row > span:last-child {
  color: #6d7466;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.53rem;
  font-weight: 600;
  letter-spacing: 0.07em;
}

.contract-note {
  margin-top: 0.7rem;
  color: #797f72;
  font-size: 0.6rem;
  line-height: 1.6;
}

.source-list {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.75rem;
}

.source-list article {
  border: 1px solid #343b2e;
  padding: 0.65rem;
}

.source-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.source-head > span:first-child {
  color: #6e7567;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.53rem;
  overflow-wrap: anywhere;
}

.source-head a {
  flex: 0 0 auto;
  color: var(--cyan);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.54rem;
  text-decoration: none;
}

.source-unlinked {
  color: #806e61;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.52rem;
}

.source-list h3 {
  margin-top: 0.28rem;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
}

.source-list article > p {
  margin-top: 0.18rem;
  color: #71786b;
  font-size: 0.56rem;
}

.source-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.22rem;
  margin-top: 0.4rem;
}

.source-fields span {
  background: rgba(238, 233, 220, 0.045);
  padding: 0.12rem 0.26rem;
  color: #878e80;
  font-size: 0.5rem;
}

.source-empty {
  margin-top: 0.75rem;
  border: 1px dashed #3d4537;
  padding: 2rem 1rem;
  text-align: center;
}

.source-empty strong {
  color: var(--ember);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
}

.source-empty p {
  margin-top: 0.35rem;
  color: #817d70;
  font-size: 0.62rem;
}

.method-note {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-top: 0.8rem;
  border: 1px solid var(--line);
  background: rgba(16, 19, 15, 0.5);
  padding: 0.8rem;
}

.method-note > span {
  flex: 0 0 auto;
  color: var(--acid);
  font-family: "Rajdhani", sans-serif;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.09em;
}

.method-note p {
  flex: 1;
  color: #8b9284;
  font-size: 0.62rem;
  line-height: 1.6;
}

.method-note a {
  flex: 0 0 auto;
  color: var(--cyan);
  font-size: 0.58rem;
  text-decoration: none;
}

@keyframes beacon-pulse {
  50% {
    opacity: 0.3;
  }
}

@media (max-width: 880px) {
  .data-grid,
  .lower-grid {
    grid-template-columns: 1fr;
  }

  .data-hero {
    align-items: flex-start;
    flex-direction: column;
    gap: 1.2rem;
  }
}

@media (max-width: 540px) {
  .count-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .meta-grid {
    grid-template-columns: 1fr;
  }

  .method-note {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .method-note p {
    flex-basis: 100%;
  }
}
</style>
