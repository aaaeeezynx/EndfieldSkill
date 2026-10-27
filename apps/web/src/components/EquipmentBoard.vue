<script setup lang="ts">
import { computed } from 'vue'
import EquipmentArtwork from '@/components/EquipmentArtwork.vue'
import {
  selectIndeterminateEquipmentBySlot,
  selectLevelEligibleEquipmentBySlot,
} from '@/lib/equipmentEligibility'
import type {
  CharacterFact,
  EquipmentFact,
  EquipmentLoadout,
  EquipmentSlot,
} from '@/types/domain'

// `loadouts` and `characters` remain accepted for backwards compatibility with
// the planner page. They are intentionally not used to filter this board:
// manufacturing eligibility is decided by the configured player level only.
const props = defineProps<{
  loadouts?: EquipmentLoadout[]
  characters?: CharacterFact[]
  equipment?: EquipmentFact[]
  playerLevel?: number
}>()

const equipmentSlots: EquipmentSlot[] = ['body', 'hand', 'edc']

const slotLabels: Record<EquipmentSlot, string> = {
  body: '身體',
  hand: '手部',
  edc: 'EDC',
}

const emptySlotRecord = (): Record<EquipmentSlot, EquipmentFact[]> => ({
  body: [],
  hand: [],
  edc: [],
})

const equipmentPool = computed(() => props.equipment ?? [])

const hasUsableLevel = computed(
  () => props.playerLevel !== undefined && Number.isFinite(props.playerLevel),
)

const eligibleBySlot = computed<Record<EquipmentSlot, EquipmentFact[]>>(() => {
  if (!hasUsableLevel.value) return emptySlotRecord()
  return selectLevelEligibleEquipmentBySlot(
    equipmentPool.value,
    props.playerLevel as number,
  )
})

const indeterminateBySlot = computed<Record<EquipmentSlot, EquipmentFact[]>>(
  () => selectIndeterminateEquipmentBySlot(equipmentPool.value),
)

const totalEligible = computed(() =>
  equipmentSlots.reduce(
    (total, slot) => total + eligibleBySlot.value[slot].length,
    0,
  ),
)

const totalIndeterminate = computed(() =>
  equipmentSlots.reduce(
    (total, slot) => total + indeterminateBySlot.value[slot].length,
    0,
  ),
)

const playerLevelLabel = computed(() =>
  hasUsableLevel.value ? `Lv.${props.playerLevel}` : '尚未設定',
)

const playerLevelGateLabel = (equipment: EquipmentFact): string =>
  equipment.unlock.playerLevel === null
    ? '穿戴等級門檻未知'
    : `穿戴等級 Lv.${equipment.unlock.playerLevel}`

const equipmentMeta = (
  equipment: EquipmentFact,
  fallbackSlot: EquipmentSlot,
): string => {
  const parts = [slotLabels[equipment.slot ?? fallbackSlot]]
  if (equipment.setName) parts.push(equipment.setName)
  if (equipment.rarity !== null) parts.push(`${equipment.rarity}★`)
  return parts.join(' · ')
}

const indeterminateReason = (equipment: EquipmentFact): string => {
  if (equipment.craftable === null && equipment.unlock.playerLevel === null)
    return '可製造標記與穿戴等級皆未知'
  if (equipment.craftable === null) return '可製造標記未知'
  return '穿戴等級門檻未知'
}
</script>

<template>
  <section class="equipment-board panel reveal" aria-labelledby="equipment-title">
    <header class="equipment-head">
      <div>
        <p class="eyebrow">06 / EQUIPMENT BY LEVEL</p>
        <h2 id="equipment-title">依等級可製造裝備</h2>
      </div>
      <p class="equipment-principle">
        僅依目前設定的玩家等級，列出所有可製造裝備。劇情章節、配方權限、
        角色職業、元素與推薦標籤都不參與篩選，也不截斷結果。
      </p>
    </header>

    <div class="level-summary" aria-live="polite">
      <div>
        <span>目前設定等級</span>
        <strong>{{ playerLevelLabel }}</strong>
      </div>
      <div>
        <span>可製造裝備</span>
        <strong>{{ totalEligible }}<small>件</small></strong>
      </div>
      <div v-if="totalIndeterminate" class="summary-unknown">
        <span>無法判定</span>
        <strong>{{ totalIndeterminate }}<small>件</small></strong>
      </div>
    </div>

    <p class="eligibility-note">
      判定條件只有兩項：來源標記為可製造，且穿戴等級不高於目前設定等級。
      章節為 null 或配方權限尚未核驗，都不會排除已達等級門檻的裝備。
      排序為稀有度降冪、穿戴等級降冪、ID 升冪。
    </p>

    <div v-if="!hasUsableLevel" class="board-message">
      <strong>請先設定玩家等級</strong>
      <p>設定等級後，才會列出可製造裝備；缺少可製造標記或穿戴等級的資料會另列於下方。</p>
    </div>

    <div v-else class="eligibility-grid">
      <section
        v-for="slot in equipmentSlots"
        :key="slot"
        class="eligibility-slot"
      >
        <header class="slot-head">
          <div>
            <p>{{ slot.toUpperCase() }}</p>
            <h3>{{ slotLabels[slot] }}</h3>
          </div>
          <strong>{{ eligibleBySlot[slot].length }} 件</strong>
        </header>

        <ul v-if="eligibleBySlot[slot].length" class="equipment-list">
          <li
            v-for="equipment in eligibleBySlot[slot]"
            :key="equipment.id"
            class="equipment-item"
          >
            <EquipmentArtwork
              compact
              :equipment-id="equipment.id"
              :name="equipment.name"
              :rarity="equipment.rarity"
            />
            <div class="equipment-copy">
              <strong>{{ equipment.name }}</strong>
              <small>{{ equipmentMeta(equipment, slot) }}</small>
              <small class="equipment-gate">{{ playerLevelGateLabel(equipment) }}</small>
            </div>
          </li>
        </ul>
        <p v-else class="slot-empty">
          目前等級沒有符合此部位的可製造裝備。
        </p>
      </section>
    </div>

    <section
      v-if="totalIndeterminate"
      class="indeterminate-board"
      aria-labelledby="indeterminate-title"
    >
      <header class="indeterminate-head">
        <div>
          <p class="eyebrow">DATA BOUNDARY / UNKNOWN</p>
          <h3 id="indeterminate-title">無法判定（{{ totalIndeterminate }} 件）</h3>
        </div>
        <p>下列裝備缺少可製造標記或穿戴等級，因此不放入可製造清單，也不猜測其資格。</p>
      </header>

      <div class="indeterminate-grid">
        <section
          v-for="slot in equipmentSlots"
          :key="slot"
          class="indeterminate-slot"
        >
          <h4>
            {{ slotLabels[slot] }}
            <small>{{ indeterminateBySlot[slot].length }} 件</small>
          </h4>
          <ul v-if="indeterminateBySlot[slot].length" class="equipment-list">
            <li
              v-for="equipment in indeterminateBySlot[slot]"
              :key="equipment.id"
              class="equipment-item"
            >
              <EquipmentArtwork
                compact
                :equipment-id="equipment.id"
                :name="equipment.name"
                :rarity="equipment.rarity"
              />
              <div class="equipment-copy">
                <strong>{{ equipment.name }}</strong>
                <small>{{ equipmentMeta(equipment, slot) }}</small>
                <small class="unknown-reason">{{ indeterminateReason(equipment) }}</small>
              </div>
            </li>
          </ul>
          <p v-else class="slot-empty">此部位沒有無法判定的裝備。</p>
        </section>
      </div>
    </section>

    <div v-if="!equipmentPool.length" class="board-message board-message-empty">
      <strong>NO EQUIPMENT RECORDS</strong>
      <p>目前沒有裝備資料，因此無法列出可製造清單。</p>
    </div>
  </section>
</template>

<style scoped>
.equipment-board {
  border-color: #949494;
  background: #ffffff;
  color: #191919;
  padding: clamp(1.15rem, 2.7vw, 1.8rem);
  box-shadow: 0 18px 50px rgba(25, 25, 25, 0.07);
}

.equipment-board::before {
  width: 72px;
  height: 5px;
  background: #fffa00;
}

.equipment-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 2rem;
  border-bottom: 1px solid #949494;
  padding-bottom: 1.1rem;
}

.equipment-head h2 {
  margin-top: 0.25rem;
  color: #191919;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: clamp(1.9rem, 3.6vw, 2.65rem);
  font-weight: 700;
  letter-spacing: -0.025em;
}

.equipment-principle {
  max-width: 470px;
  color: #3f3f3f;
  font-size: 0.78rem;
  line-height: 1.65;
  text-align: right;
}

.level-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}

.level-summary > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.7rem;
  border: 1px solid #949494;
  border-left: 5px solid #191919;
  background: #f7f7f7;
  padding: 0.7rem 0.8rem;
}

.level-summary > div:first-child {
  border-left-color: #fffa00;
}

.level-summary > .summary-unknown {
  border-left-color: #8f3f00;
  background: #fff8e8;
}

.level-summary span {
  color: #3f3f3f;
  font-size: 0.75rem;
  font-weight: 700;
}

.level-summary strong {
  color: #191919;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.25rem;
  font-weight: 700;
  white-space: nowrap;
}

.level-summary small {
  margin-left: 0.18rem;
  color: #3f3f3f;
  font-size: 0.72rem;
}

.eligibility-note {
  margin-top: 0.75rem;
  color: #3f3f3f;
  font-size: 0.75rem;
  line-height: 1.7;
}

.eligibility-grid,
.indeterminate-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
  margin-top: 0.9rem;
}

.eligibility-slot,
.indeterminate-slot {
  min-width: 0;
  border: 1px solid #949494;
  background: #fafafa;
  padding: 0.8rem;
}

.eligibility-slot {
  border-top: 4px solid #191919;
}

.slot-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.6rem;
  border-bottom: 1px solid #949494;
  padding-bottom: 0.55rem;
}

.slot-head p {
  color: #3f3f3f;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.slot-head h3,
.indeterminate-slot h4 {
  color: #191919;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
}

.slot-head > strong {
  color: #145c35;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.78rem;
  white-space: nowrap;
}

.equipment-list {
  display: grid;
  gap: 0.55rem;
  margin: 0.7rem 0 0;
  padding: 0;
  list-style: none;
}

.equipment-item {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  min-width: 0;
}

.equipment-copy {
  min-width: 0;
  flex: 1;
}

.equipment-copy strong {
  display: block;
  color: #191919;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.9rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.equipment-copy small {
  display: block;
  margin-top: 0.12rem;
  color: #3f3f3f;
  font-size: 0.72rem;
  line-height: 1.45;
}

.equipment-gate {
  color: #145c35 !important;
}

.unknown-reason {
  color: #5c3a00 !important;
}

.slot-empty {
  margin-top: 0.65rem;
  color: #5c3a00;
  font-size: 0.75rem;
  line-height: 1.55;
}

.indeterminate-board {
  margin-top: 1.15rem;
  border: 1px solid #8f3f00;
  border-left: 5px solid #8f3f00;
  background: #fffaf0;
  padding: 1rem 1.1rem 1.15rem;
}

.indeterminate-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
  border-bottom: 1px solid #b88a5d;
  padding-bottom: 0.65rem;
}

.indeterminate-head .eyebrow {
  color: #5c3a00;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.indeterminate-head h3 {
  margin-top: 0.2rem;
  color: #191919;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.2rem;
  font-weight: 700;
}

.indeterminate-head > p {
  max-width: 430px;
  color: #5c3a00;
  font-size: 0.75rem;
  line-height: 1.6;
  text-align: right;
}

.indeterminate-slot {
  background: #ffffff;
}

.indeterminate-slot h4 {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  border-bottom: 1px solid #949494;
  padding-bottom: 0.5rem;
}

.indeterminate-slot h4 small {
  color: #5c3a00;
  font-size: 0.72rem;
}

.board-message {
  margin-top: 1rem;
  border: 1px dashed #949494;
  background: #f7f7f7;
  padding: 1rem;
}

.board-message strong {
  color: #191919;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.9rem;
}

.board-message p {
  margin-top: 0.3rem;
  color: #3f3f3f;
  font-size: 0.75rem;
  line-height: 1.6;
}

.board-message-empty {
  border-style: solid;
  background: #fff8e8;
}

@media (max-width: 1180px) {
  .eligibility-grid,
  .indeterminate-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .equipment-head,
  .indeterminate-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.65rem;
  }

  .equipment-principle,
  .indeterminate-head > p {
    max-width: none;
    text-align: left;
  }

  .level-summary {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .equipment-board {
    padding: 1rem;
  }

  .eligibility-slot,
  .indeterminate-slot {
    padding: 0.7rem;
  }
}
</style>
