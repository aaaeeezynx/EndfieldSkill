<script setup lang="ts">
import { computed } from 'vue'
import { DATA_FILES } from '@/data/loadDataset'
import equipmentImageMap from '@/data/equipmentImageMap.json'
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
    { label: '角色技能欄位', value: coverage.characterSkillCoverage },
    { label: '角色來源覆蓋', value: coverage.characterSourceCoverage },
    { label: '裝備門檻覆蓋', value: coverage.equipmentGateCoverage },
    { label: '循環來源覆蓋', value: coverage.rotationSourceCoverage },
  ]
})

const statusLabel = computed(() => {
  if (planner.dataState === 'loading') return '鏈路檢測中'
  if (planner.dataState === 'error') return '鏈路錯誤'
  if (planner.dataState === 'empty') return '等待資料管線'
  if (planner.dataState === 'ready') {
    return dataset.value?.missingFiles.length ? '部分資料可用' : '資料在線'
  }
  return '尚未檢測'
})

const missingEquipmentImages = computed(() => {
  const imageIds = new Set(Object.keys(equipmentImageMap))
  return (dataset.value?.equipment ?? []).filter((item) => !imageIds.has(item.id))
})

const missingSkillCharacters = computed(() => {
  const missingTypes = new Set(dataset.value?.meta.missingSkillTypes ?? [])
  return (dataset.value?.characters ?? [])
    .map((character) => ({
      id: character.id,
      name: character.name,
      types: [...missingTypes]
        .filter((entry) => entry.startsWith(`${character.id}:`))
        .map((entry) => entry.slice(character.id.length + 1)),
    }))
    .filter((item) => item.types.length)
})

const missingSkillLabel = (type: string): string => {
  if (type === 'battle') return '戰技'
  if (type === 'combo') return '連攜技'
  if (type === 'ultimate') return '終結技'
  return type
}

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
      <div class="data-title">
        <p class="eyebrow">DATA LINK // TRACEABILITY</p>
        <h1 class="display-title">資料鏈路與<br /><span>可驗證邊界。</span></h1>
        <p>
          本頁保留資料版本、來源、欄位覆蓋與所有已知缺漏。推薦結果只使用可追溯的靜態資料，
          執行期不呼叫 AI，也不以猜測補齊遊戲內容。
        </p>
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
            <h2>資料集版本</h2>
          </div>
          <span class="schema-chip">
            Schema 版本：{{ dataset?.meta.schemaVersion ?? 'SCHEMA PENDING' }}
          </span>
        </div>

        <dl class="meta-grid">
          <div>
            <dt>資料版本</dt>
            <dd>{{ dataset?.meta.dataVersion ?? '等待資料代理提供' }}</dd>
          </div>
          <div>
            <dt>遊戲版本</dt>
            <dd>{{ dataset?.meta.gameVersion ?? '未標註' }}</dd>
          </div>
          <div>
            <dt>生成時間</dt>
            <dd>{{ dataset?.meta.generatedAt ?? '未標註' }}</dd>
          </div>
          <div>
            <dt>來源數量</dt>
            <dd>{{ dataset?.meta.sourceCount ?? dataset?.sources.length ?? 0 }}</dd>
          </div>
        </dl>

        <div class="count-grid">
          <div>
            <strong>{{ dataset?.characters.length ?? 0 }}</strong>
            <span>可用角色</span>
          </div>
          <div><strong>{{ dataset?.equipment.length ?? 0 }}</strong><span>裝備</span></div>
          <div :class="{ partial: hasUnverifiedProgressData }">
            <strong>{{ dataset?.chapters.length ?? 0 }}</strong>
            <span>{{ hasUnverifiedProgressData ? '章節／未核驗' : '章節' }}</span>
          </div>
          <div><strong>{{ dataset?.rotationPresets.length ?? 0 }}</strong><span>來源循環</span></div>
        </div>

        <div v-if="hasUnverifiedProgressData" class="progress-limits">
          <span>PROGRESS DATA UNVERIFIED</span>
          <p>
            章節資料為空，配方權限也尚未由劇情或權限進度自動核驗。角色選擇、技能循環與裝備穿戴等級推薦仍可使用，
            但本頁不會把章節門檻或「目前可製造」狀態宣稱為完整結論。
          </p>
        </div>

        <div v-if="dataset?.meta.notes.length" class="meta-notes">
          <span>DATASET NOTES</span>
          <p v-for="note in dataset.meta.notes" :key="note">{{ note }}</p>
        </div>
        <div v-else-if="!dataset" class="empty-line">
          尚未讀取到 `public/data/v1/`。頁面不會生成示例角色、循環或裝備資料冒充已驗證資料。
        </div>
      </section>

      <section class="coverage-panel panel reveal reveal-delay-2">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">FIELD COVERAGE</p>
            <h2>欄位覆蓋率</h2>
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
        <p v-else class="coverage-empty">等待資料管線後計算覆蓋率。</p>

        <div class="missing-fields">
          <span>MISSING / PARTIAL FIELDS</span>
          <div v-if="dataset?.meta.partialFields.length">
            <code v-for="field in dataset.meta.partialFields" :key="field">{{ field }}</code>
          </div>
          <div v-else-if="dataset?.coverage.missingFields.length">
            <code v-for="field in dataset.coverage.missingFields" :key="field">{{ field }}</code>
          </div>
          <p v-else-if="dataset">目前未發現可計算的缺失欄位，或資料集為空。</p>
          <p v-else>尚無資料。</p>
        </div>

        <div v-if="dataset?.errors.length" class="load-errors">
          <span>LOAD ERRORS</span>
          <p v-for="error in dataset.errors" :key="error">{{ error }}</p>
        </div>
      </section>
    </div>

    <section class="gap-panel panel reveal reveal-delay-2">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">COVERAGE GAPS</p>
          <h2>缺資料與缺圖明細</h2>
        </div>
        <span class="gap-total">
          {{ missingSkillCharacters.length }} 技能缺口 · {{ missingEquipmentImages.length }} 裝備缺圖
        </span>
      </div>

      <div class="gap-grid">
        <div>
          <h3>技能資料缺口</h3>
          <div v-if="missingSkillCharacters.length" class="gap-list">
            <article v-for="character in missingSkillCharacters" :key="character.id">
              <div>
                <strong>{{ character.name }}</strong>
                <code>{{ character.id }}</code>
              </div>
              <span>
                缺少 {{ character.types.map(missingSkillLabel).join('、') }}
              </span>
            </article>
          </div>
          <p v-else class="gap-empty">目前沒有列出的技能型別缺口。</p>
        </div>

        <div>
          <h3>裝備圖片缺口</h3>
          <div v-if="missingEquipmentImages.length" class="image-gap-list">
            <article v-for="item in missingEquipmentImages" :key="item.id">
              <strong>{{ item.name }}</strong>
              <code>{{ item.id }}</code>
              <span>來源缺圖；介面顯示替代標記，不捏造圖像。</span>
            </article>
          </div>
          <p v-else class="gap-empty">
            目前 {{ dataset?.equipment.length ?? 0 }} 件裝備資料均有本地圖片映射。
          </p>
          <p class="gap-source-note">
            裝備圖以本地鏡像提供；其中 18 張由 Warfarin 社群資料庫／社群鏡像補齊，非官方 CDN。
          </p>
        </div>
      </div>
    </section>

    <div class="lower-grid">
      <section class="contract-panel panel reveal reveal-delay-2">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">FILE CONTRACT</p>
            <h2>資料檔案</h2>
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
          規範資料保存在倉庫根 `data/v1/`；建置前由同步腳本複製至前端靜態目錄。前端只讀取規範化契約，
          不在瀏覽器中抓取第三方頁面。
        </p>
      </section>

      <section class="sources-panel panel reveal reveal-delay-3">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">SOURCE REGISTER</p>
            <h2>來源索引</h2>
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
                開啟 ↗
              </a>
              <span v-else class="source-unlinked">無安全連結</span>
            </div>
            <h3>{{ source.title }}</h3>
            <p>{{ source.publisher || '發佈者未標註' }} · {{ source.fetchedAt || '抓取時間未標註' }}</p>
            <div v-if="source.fields.length" class="source-fields">
              <span v-for="field in source.fields.slice(0, 8)" :key="field">{{ field }}</span>
            </div>
          </article>
        </div>
        <div v-else class="source-empty">
          <strong>AWAITING SOURCE REGISTER</strong>
          <p>資料代理尚未提供 `sources.json`，因此目前沒有可核驗的抓取來源。</p>
        </div>
      </section>
    </div>

    <section v-if="dataset?.meta.unresolved.length" class="unresolved-panel panel reveal">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">UNRESOLVED FIELDS</p>
          <h2>未解問題</h2>
        </div>
      </div>
      <div class="unresolved-list">
        <article v-for="item in dataset.meta.unresolved" :key="`${item.field}:${item.subject}`">
          <span>{{ item.field || 'FIELD UNSPECIFIED' }}</span>
          <strong>{{ item.subject || '未命名項目' }}</strong>
          <p>{{ item.reason || '未提供原因。' }}</p>
          <small>{{ item.sourceIds.length ? `來源：${item.sourceIds.join(' / ')}` : '未標註來源' }}</small>
        </article>
      </div>
    </section>

    <section class="method-note reveal">
      <span>METHOD / 01</span>
      <p>
        推薦循環採用「完整來源命中／同來源片段／無可核驗資料」三態：完整命中要求隊伍角色集合與攻略一致；
        部分命中只展示同來源片段，並標示不足以代表完整隊伍軸；沒有可靠來源時顯示無資料，
        不以標籤規則推導或拼接不同來源生成順序。共享技力、連攜觸發條件與終結技能量分別建模，
        不以普通秒錶時間軸替代戰鬥機制。
      </p>
      <a href="https://endfield.gryphline.com/zh-tw#home" target="_blank" rel="noreferrer">
        官方網站 ↗
      </a>
    </section>
  </div>
</template>

<style scoped>
.data-page {
  background: #ffffff;
  padding-top: clamp(2rem, 5vw, 4.5rem);
}

.data-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  padding-bottom: clamp(2rem, 4vw, 3.2rem);
}

.data-title {
  max-width: 900px;
}

.data-hero h1 {
  margin-top: 0.7rem;
  font-size: clamp(3rem, 6.5vw, 6.2rem);
}

.data-hero h1 span {
  display: inline-block;
  background: var(--color-accent-primary);
  padding: 0 0.08em;
}

.data-title > p:last-child {
  max-width: 680px;
  margin-top: 1.25rem;
  color: var(--color-text-secondary);
  font-size: 0.92rem;
  line-height: 1.8;
}

.status-block {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.7rem;
  border: 1px solid var(--color-border-primary);
  background: #fff;
  padding: 0.8rem 1rem;
}

.status-light {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #9b9b9b;
}

.status-light.ready {
  background: var(--color-accent-blue);
  box-shadow: 0 0 0 4px rgba(34, 87, 214, 0.1);
}

.status-light.loading {
  background: var(--color-accent-primary);
  box-shadow: 0 0 0 4px rgba(255, 250, 0, 0.2);
  animation: beacon-pulse 1.2s ease-in-out infinite;
}

.status-light.error {
  background: var(--color-danger);
}

.status-block div {
  display: flex;
  flex-direction: column;
}

.status-block small {
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.status-block strong {
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 700;
}

.data-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
  gap: 0.9rem;
}

.dataset-panel,
.coverage-panel,
.contract-panel,
.sources-panel,
.gap-panel,
.unresolved-panel {
  padding: 1.3rem;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--color-border-primary);
  padding-bottom: 0.8rem;
}

.panel-heading h2 {
  margin-top: 0.2rem;
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 700;
}

.schema-chip,
.contract-path,
.source-count,
.gap-total {
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-align: right;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-top: 0.9rem;
  border: 1px solid var(--color-border-primary);
  background: var(--color-border-primary);
}

.meta-grid div {
  min-width: 0;
  background: #fff;
  padding: 0.7rem;
}

.meta-grid dt {
  color: var(--color-text-tertiary);
  font-size: 0.75rem;
}

.meta-grid dd {
  margin: 0.15rem 0 0;
  overflow-wrap: anywhere;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: 0.7rem;
}

.count-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.4rem;
  margin-top: 0.8rem;
}

.count-grid div {
  border: 1px solid var(--color-border-primary);
  background: #fafafa;
  padding: 0.65rem;
}

.count-grid strong {
  display: block;
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 1.65rem;
  font-weight: 700;
  line-height: 1;
}

.count-grid span {
  display: block;
  margin-top: 0.3rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}

.count-grid div.partial {
  border-color: #e4a368;
  background: #fff7ef;
}

.count-grid div.partial strong,
.count-grid div.partial span {
  color: #8a3400;
}

.progress-limits {
  margin-top: 0.8rem;
  border: 1px solid #f0c9a7;
  border-left: 5px solid var(--color-accent-orange);
  background: #fff8f1;
  padding: 0.65rem 0.75rem;
}

.progress-limits > span,
.meta-notes > span,
.load-errors > span,
.missing-fields > span {
  color: #8a3400;
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.09em;
}

.progress-limits p {
  margin-top: 0.3rem;
  color: #5a3a1a;
  font-size: 0.75rem;
  line-height: 1.6;
}

.meta-notes,
.load-errors {
  display: grid;
  gap: 0.3rem;
  margin-top: 0.8rem;
  border-left: 3px solid var(--color-accent-orange);
  padding-left: 0.65rem;
}

.meta-notes p,
.load-errors p {
  overflow-wrap: anywhere;
  color: var(--color-text-secondary);
  font-size: 0.7rem;
  line-height: 1.55;
}

.empty-line {
  margin-top: 0.8rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  line-height: 1.6;
}

.coverage-list {
  display: grid;
  gap: 0.8rem;
  margin-top: 1rem;
}

.coverage-label {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: var(--color-text-secondary);
  font-size: 0.7rem;
}

.coverage-label strong {
  color: var(--color-accent-blue);
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
}

.coverage-track {
  height: 5px;
  margin-top: 0.3rem;
  background: #e6e6e6;
}

.coverage-track i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent-blue), var(--color-accent-primary));
}

.coverage-empty,
.gap-empty {
  margin-top: 1rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}

.gap-source-note {
  margin-top: 0.65rem;
  border-left: 3px solid var(--color-accent-blue);
  padding-left: 0.55rem;
  color: var(--color-text-tertiary);
  font-size: 0.75rem;
  line-height: 1.55;
}

.missing-fields {
  margin-top: 1rem;
  border-top: 1px solid var(--color-border-primary);
  padding-top: 0.8rem;
}

.missing-fields > div {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.5rem;
}

.missing-fields code {
  background: #f0f0f0;
  padding: 0.18rem 0.35rem;
  color: var(--color-text-secondary);
  font-family: var(--font-mono);
  font-size: 0.6rem;
}

.missing-fields p {
  margin-top: 0.45rem;
  color: var(--color-text-secondary);
  font-size: 0.7rem;
}

.gap-panel {
  margin-top: 0.9rem;
}

.gap-grid {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 1rem;
  margin-top: 0.9rem;
}

.gap-grid h3 {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
}

.gap-list {
  display: grid;
  gap: 0.4rem;
  margin-top: 0.55rem;
}

.gap-list article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  border: 1px solid #f0c9a7;
  background: #fff8f1;
  padding: 0.55rem 0.65rem;
}

.gap-list article > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.gap-list strong,
.image-gap-list strong {
  font-size: 0.78rem;
}

.gap-list code,
.image-gap-list code {
  margin-top: 0.12rem;
  overflow-wrap: anywhere;
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.gap-list article > span {
  flex: 0 0 auto;
  color: #8a3400;
  font-size: 0.75rem;
}

.image-gap-list {
  display: grid;
  max-height: 410px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem;
  margin-top: 0.55rem;
  overflow: auto;
  padding-right: 0.25rem;
}

.image-gap-list article {
  min-width: 0;
  border: 1px solid var(--color-border-primary);
  background: #fafafa;
  padding: 0.5rem 0.6rem;
}

.image-gap-list span {
  display: block;
  margin-top: 0.25rem;
  color: #8a3400;
  font-size: 0.75rem;
  line-height: 1.45;
}

.lower-grid {
  display: grid;
  grid-template-columns: minmax(300px, 0.75fr) minmax(0, 1.25fr);
  gap: 0.9rem;
  margin-top: 0.9rem;
}

.file-table {
  margin-top: 0.8rem;
  border: 1px solid var(--color-border-primary);
}

.file-row {
  display: grid;
  grid-template-columns: 7px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  border-bottom: 1px solid var(--color-border-primary);
  padding: 0.55rem 0.65rem;
}

.file-row:last-child {
  border-bottom: 0;
}

.file-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9b9b9b;
}

.file-dot.loaded {
  background: var(--color-accent-blue);
}

.file-dot.missing {
  background: var(--color-accent-orange);
}

.file-row code {
  overflow: hidden;
  color: var(--color-text-primary);
  font-size: 0.75rem;
  text-overflow: ellipsis;
}

.file-row > span:last-child {
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.07em;
}

.contract-note {
  margin-top: 0.8rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  line-height: 1.65;
}

.source-list {
  display: grid;
  gap: 0.45rem;
  margin-top: 0.8rem;
}

.source-list article {
  border: 1px solid var(--color-border-primary);
  background: #fafafa;
  padding: 0.7rem;
}

.source-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.source-head > span:first-child {
  overflow-wrap: anywhere;
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.75rem;
}

.source-head a {
  flex: 0 0 auto;
  color: var(--color-accent-blue);
  font-size: 0.75rem;
  text-decoration: none;
}

.source-unlinked {
  color: var(--color-text-tertiary);
  font-size: 0.6rem;
}

.source-list h3 {
  margin-top: 0.3rem;
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
}

.source-list article > p {
  margin-top: 0.2rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}

.source-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.45rem;
}

.source-fields span {
  background: #ededed;
  padding: 0.15rem 0.3rem;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}

.source-empty {
  margin-top: 0.8rem;
  border: 1px dashed var(--color-border-primary);
  padding: 2rem 1rem;
  text-align: center;
}

.source-empty strong {
  color: #8a3400;
  font-family: var(--font-display);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
}

.source-empty p {
  margin-top: 0.4rem;
  color: var(--color-text-secondary);
  font-size: 0.7rem;
}

.unresolved-panel {
  margin-top: 0.9rem;
}

.unresolved-list {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.8rem;
}

.unresolved-list article {
  border-left: 5px solid var(--color-accent-orange);
  background: #fafafa;
  padding: 0.7rem 0.8rem;
}

.unresolved-list span {
  display: block;
  color: #8a3400;
  font-family: var(--font-display);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.unresolved-list strong {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.82rem;
}

.unresolved-list p {
  margin-top: 0.25rem;
  color: var(--color-text-secondary);
  font-size: 0.7rem;
  line-height: 1.6;
}

.unresolved-list small {
  display: block;
  margin-top: 0.3rem;
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}

.method-note {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: 0.9rem;
  border: 1px solid var(--color-text-primary);
  background: #fff;
  padding: 0.9rem;
}

.method-note > span {
  flex: 0 0 auto;
  background: var(--color-accent-primary);
  padding: 0.25rem 0.4rem;
  color: var(--color-text-primary);
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.09em;
}

.method-note p {
  flex: 1;
  color: var(--color-text-secondary);
  font-size: 0.7rem;
  line-height: 1.65;
}

.method-note a {
  flex: 0 0 auto;
  color: var(--color-accent-blue);
  font-size: 0.75rem;
  text-decoration: none;
}

@keyframes beacon-pulse {
  50% {
    opacity: 0.3;
  }
}

@media (max-width: 880px) {
  .data-grid,
  .lower-grid,
  .gap-grid {
    grid-template-columns: 1fr;
  }

  .data-hero {
    align-items: flex-start;
    flex-direction: column;
    gap: 1.2rem;
  }
}

@media (max-width: 540px) {
  .data-page {
    padding-top: 1.5rem;
  }

  .data-hero h1 {
    font-size: clamp(2.6rem, 13vw, 4rem);
  }

  .dataset-panel,
  .coverage-panel,
  .contract-panel,
  .sources-panel,
  .gap-panel,
  .unresolved-panel {
    padding: 1rem;
  }

  .panel-heading {
    flex-direction: column;
    gap: 0.45rem;
  }

  .schema-chip,
  .contract-path,
  .source-count,
  .gap-total {
    text-align: left;
  }

  .count-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .meta-grid,
  .image-gap-list {
    grid-template-columns: 1fr;
  }

  .gap-list article {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.3rem;
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
