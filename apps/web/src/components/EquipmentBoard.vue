<script setup lang="ts">
import { computed } from 'vue'
import EquipmentArtwork from '@/components/EquipmentArtwork.vue'
import { getCharacterPortrait } from '@/data/portraitLoader'
import { displayElement, displayProfession } from '@/lib/displayLabels'
import {
  buildEquipmentStatDisplays,
  type EquipmentStatDisplay,
} from '@/lib/equipmentDisplay'
import {
  describeUnlockGate,
  EQUIPMENT_SLOT_LABELS,
} from '@/lib/recommendation'
import type {
  CharacterFact,
  EquipmentCandidate,
  EquipmentLoadout,
  EquipmentSlot,
  EquipmentSlotRecommendation,
  UnlockState,
} from '@/types/domain'

const props = defineProps<{
  loadouts: EquipmentLoadout[]
  characters: CharacterFact[]
}>()

const equipmentSlots: EquipmentSlot[] = ['body', 'hand', 'edc']

const characterById = computed(
  () => new Map(props.characters.map((character) => [character.id, character])),
)

const displayName = (characterId: string, name?: string): string => {
  if (characterId === 'chr_0002_endminm') return '管理員'
  return name ?? characterId
}

const stateLabel = (state: UnlockState): string => {
  if (state === 'unlocked') return '穿戴門檻已達標'
  if (state === 'locked') return '已知門檻未達'
  if (state === 'not-craftable') return '來源標記不可製造'
  return '門檻待核對'
}

const targetLabel = (candidate: EquipmentCandidate | null): string => {
  if (!candidate) return '尚無候選'
  if (candidate.unlockState === 'unlocked') return '目前門檻最佳'
  if (candidate.unlockState === 'locked') return '角色上限方向'
  return '待核對方向'
}

const statEntries = (candidate: EquipmentCandidate): EquipmentStatDisplay[] =>
  buildEquipmentStatDisplays(
    candidate.equipment.stats,
    candidate.equipment.statTypes,
    6,
  )

const hasDistinctAvailable = (slot: EquipmentSlotRecommendation): boolean =>
  Boolean(
    slot.available &&
      slot.available.equipment.id !== slot.target?.equipment.id,
  )

const visibleAlternatives = (
  slot: EquipmentSlotRecommendation,
): EquipmentCandidate[] => {
  const excluded = new Set(
    [slot.target?.equipment.id, slot.available?.equipment.id].filter(
      (id): id is string => Boolean(id),
    ),
  )
  return slot.alternatives
    .filter((candidate) => !excluded.has(candidate.equipment.id))
    .slice(0, 2)
}

const hasFormulaAuthority = (candidate: EquipmentCandidate): boolean =>
  candidate.equipment.formulaAuthorityRank !== null

const equipmentMeta = (
  candidate: EquipmentCandidate,
  fallbackSlot: EquipmentSlot,
): string => {
  const parts = [
    candidate.equipment.slot
      ? EQUIPMENT_SLOT_LABELS[candidate.equipment.slot]
      : EQUIPMENT_SLOT_LABELS[fallbackSlot],
  ]
  if (candidate.equipment.setName) parts.push(candidate.equipment.setName)
  if (candidate.equipment.rarity) parts.push(`${candidate.equipment.rarity}★`)
  return parts.join(' · ')
}

const loadoutWarnings = (loadout: EquipmentLoadout): string[] => {
  const slotWarnings = new Set(
    equipmentSlots.flatMap((slot) => loadout.slots[slot].warnings),
  )
  return loadout.warnings.filter((warning) => !slotWarnings.has(warning))
}
</script>

<template>
  <section class="equipment-board panel reveal">
    <div class="equipment-head">
      <div>
        <p class="eyebrow">06 / EQUIPMENT LOADOUT</p>
        <h2>角色裝備推薦</h2>
      </div>
      <p class="equipment-principle">
        依角色定位、元素、目前等級與已知章節條件，分別比對身體、手部與 EDC。
        配方權限仍需進入遊戲核對，本頁不宣稱任何裝備已解鎖配方或目前可製造。
      </p>
    </div>

    <div class="equipment-legend">
      <span>OWNED ROSTER × WEAR GATE</span>
      <p>
        <strong>角色上限方向</strong>是綜合分數最高的目標；
        <strong>目前門檻最佳</strong>只代表已確認通過穿戴等級與已知章節條件。
        兩者分開呈現，不會把未達門檻的裝備誤標為可立即使用。
      </p>
    </div>

    <div v-if="loadouts.length" class="loadout-list stagger-list">
      <article
        v-for="loadout in loadouts"
        :key="loadout.characterId"
        class="loadout-character"
      >
        <header class="character-strip">
          <span class="character-avatar">
            <img
              v-if="getCharacterPortrait(loadout.characterId)"
              :src="getCharacterPortrait(loadout.characterId) ?? ''"
              :alt="displayName(loadout.characterId, characterById.get(loadout.characterId)?.name)"
              loading="lazy"
            />
            <span v-else>
              {{ displayName(loadout.characterId, characterById.get(loadout.characterId)?.name).slice(0, 1) }}
            </span>
          </span>
          <div class="character-copy">
            <p class="character-index">OPERATOR LOADOUT</p>
            <h3>
              {{ displayName(loadout.characterId, characterById.get(loadout.characterId)?.name) }}
            </h3>
            <p>
              {{ displayProfession(characterById.get(loadout.characterId)?.profession) || '職業未標註' }}
              ·
              {{ displayElement(characterById.get(loadout.characterId)?.element) || '元素未標註' }}
            </p>
          </div>
          <span class="slot-count">03 GEAR SLOTS</span>
        </header>

        <div class="slot-grid">
          <section
            v-for="(slotKey, slotIndex) in equipmentSlots"
            :key="slotKey"
            class="slot-card"
          >
            <header class="slot-head">
              <span class="slot-number">0{{ slotIndex + 1 }}</span>
              <div>
                <p>{{ slotKey.toUpperCase() }}</p>
                <h4>{{ EQUIPMENT_SLOT_LABELS[slotKey] }}</h4>
              </div>
              <span
                v-if="loadout.slots[slotKey].target"
                class="slot-state"
                :class="loadout.slots[slotKey].target?.unlockState"
              >
                {{ stateLabel(loadout.slots[slotKey].target!.unlockState) }}
              </span>
            </header>

            <template v-if="loadout.slots[slotKey].target">
              <div class="target-block">
                <EquipmentArtwork
                  class="target-artwork"
                  :equipment-id="loadout.slots[slotKey].target!.equipment.id"
                  :name="loadout.slots[slotKey].target!.equipment.name"
                  :rarity="loadout.slots[slotKey].target!.equipment.rarity"
                />
                <div class="target-copy">
                  <span class="target-kicker">
                    TARGET / {{ targetLabel(loadout.slots[slotKey].target) }}
                  </span>
                  <h5>{{ loadout.slots[slotKey].target!.equipment.name }}</h5>
                  <p class="equipment-meta">
                    {{ equipmentMeta(loadout.slots[slotKey].target!, slotKey) }}
                  </p>
                  <p class="gate-line">
                    {{ describeUnlockGate(loadout.slots[slotKey].target!) }}
                  </p>
                </div>
              </div>

              <div
                v-if="statEntries(loadout.slots[slotKey].target!).length"
                class="stat-grid"
              >
                <span
                  v-for="stat in statEntries(loadout.slots[slotKey].target!)"
                  :key="stat.key"
                >
                  {{ stat.label }}
                  <strong>{{ stat.value }}</strong>
                </span>
              </div>
              <p v-else class="field-warning">此裝備未提供可顯示的屬性數值。</p>

              <div
                v-if="loadout.slots[slotKey].target!.matchNotes.length"
                class="match-notes"
              >
                <span
                  v-for="note in loadout.slots[slotKey].target!.matchNotes"
                  :key="note"
                >
                  {{ note }}
                </span>
              </div>

              <div class="material-line">
                <span>MATERIALS</span>
                <div
                  v-if="loadout.slots[slotKey].target!.equipment.unlock.materials.length"
                >
                  <span
                    v-for="material in loadout.slots[slotKey].target!.equipment.unlock.materials"
                    :key="material"
                  >
                    {{ material }}
                  </span>
                </div>
                <small v-else>材料未標註</small>
              </div>

              <p
                v-if="hasFormulaAuthority(loadout.slots[slotKey].target!)"
                class="authority-note"
              >
                配方權限與配方階級僅作門檻提示，尚未由玩家進度自動確認。
              </p>

              <p
                v-if="loadout.slots[slotKey].target!.unlockState === 'unlocked'"
                class="single-result-note"
              >
                此裝備同時是角色上限與目前已知門檻下的最佳結果；不代表配方已解鎖或現在可製造。
              </p>
            </template>

            <div v-else class="slot-empty">
              <span>NO MATCH</span>
              <p>此部位沒有符合角色標籤或通用屬性的裝備資料。</p>
            </div>

            <div
              v-if="hasDistinctAvailable(loadout.slots[slotKey])"
              class="available-block"
            >
              <p class="subhead">ALTERNATIVE / 穿戴門檻已達標</p>
              <div class="available-candidate">
                <EquipmentArtwork
                  compact
                  :equipment-id="loadout.slots[slotKey].available!.equipment.id"
                  :name="loadout.slots[slotKey].available!.equipment.name"
                  :rarity="loadout.slots[slotKey].available!.equipment.rarity"
                />
                <div>
                  <h5>{{ loadout.slots[slotKey].available!.equipment.name }}</h5>
                  <p class="equipment-meta">
                    {{ equipmentMeta(loadout.slots[slotKey].available!, slotKey) }}
                  </p>
                  <p class="gate-line">
                    {{ describeUnlockGate(loadout.slots[slotKey].available!) }}
                  </p>
                </div>
              </div>
            </div>

            <div
              v-if="visibleAlternatives(loadout.slots[slotKey]).length"
              class="alternative-block"
            >
              <p class="subhead">OTHER CANDIDATES / 其他候選</p>
              <article
                v-for="alternative in visibleAlternatives(loadout.slots[slotKey])"
                :key="alternative.equipment.id"
                class="alternative-card"
              >
                <EquipmentArtwork
                  compact
                  :equipment-id="alternative.equipment.id"
                  :name="alternative.equipment.name"
                  :rarity="alternative.equipment.rarity"
                />
                <div>
                  <strong>{{ alternative.equipment.name }}</strong>
                  <small>{{ describeUnlockGate(alternative) }}</small>
                </div>
              </article>
            </div>

            <div
              v-if="loadout.slots[slotKey].warnings.length"
              class="slot-warnings"
            >
              <p
                v-for="warning in loadout.slots[slotKey].warnings"
                :key="warning"
              >
                <span>!</span>{{ warning }}
              </p>
            </div>

            <p
              v-if="loadout.slots[slotKey].target?.equipment.sourceIds.length"
              class="equipment-source"
            >
              SOURCES
              {{ loadout.slots[slotKey].target!.equipment.sourceIds.join(' / ') }}
            </p>
            <p v-else class="equipment-source">SOURCES 未標註</p>
          </section>
        </div>

        <div v-if="loadoutWarnings(loadout).length" class="loadout-warnings">
          <p v-for="warning in loadoutWarnings(loadout)" :key="warning">
            <span>DATA NOTE</span>{{ warning }}
          </p>
        </div>
      </article>
    </div>

    <div v-else class="equipment-empty">
      <strong>NO EQUIPMENT RECORDS</strong>
      <p>裝備資料為空，無法生成門檻過濾後的推薦。</p>
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

.equipment-legend {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: 1rem;
  border: 1px solid #949494;
  border-left: 5px solid #fffa00;
  background: #f2f2f2;
  padding: 0.72rem 0.9rem;
}

.equipment-legend > span {
  flex: 0 0 auto;
  color: #191919;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.equipment-legend p {
  color: #3f3f3f;
  font-size: 0.75rem;
  line-height: 1.6;
}

.equipment-legend strong {
  color: #191919;
}

.loadout-list {
  display: grid;
  gap: 1.15rem;
  margin-top: 1.15rem;
}

.loadout-character {
  position: relative;
  border: 1px solid #949494;
  background: #fafafa;
  padding: 1.15rem;
}

.loadout-character::before {
  content: "";
  position: absolute;
  top: -1px;
  left: -1px;
  width: 56px;
  height: 5px;
  background: #fffa00;
}

.character-strip {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  border-bottom: 1px solid #949494;
  padding-bottom: 0.85rem;
}

.character-avatar {
  display: grid;
  width: 54px;
  height: 58px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 2px solid #191919;
  background: #35373c;
  color: #fffa00;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.3rem;
  font-weight: 700;
}

.character-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.character-copy {
  min-width: 0;
  flex: 1;
}

.character-index {
  color: #3f3f3f;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.character-strip h3 {
  color: #191919;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.35rem;
  font-weight: 700;
}

.character-strip p:last-child {
  color: #3f3f3f;
  font-size: 0.75rem;
}

.slot-count {
  color: #3f3f3f;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.slot-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
  margin-top: 0.9rem;
}

.slot-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  border: 1px solid #949494;
  border-top: 4px solid #191919;
  background: #ffffff;
  padding: 0.9rem;
}

.slot-head {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  border-bottom: 1px solid #949494;
  padding-bottom: 0.65rem;
}

.slot-number {
  display: grid;
  width: 34px;
  height: 30px;
  flex: 0 0 auto;
  place-items: center;
  background: #191919;
  color: #fffa00;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
}

.slot-head > div {
  min-width: 0;
  flex: 1;
}

.slot-head p {
  color: #3f3f3f;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.slot-head h4 {
  color: #191919;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1rem;
  font-weight: 700;
}

.slot-state {
  border: 1px solid #949494;
  background: #f2f2f2;
  padding: 0.18rem 0.32rem;
  color: #3f3f3f;
  font-size: 0.6rem;
  white-space: nowrap;
}

.slot-state.locked {
  border-color: #8f3f00;
  background: #fff8e8;
  color: #5c3a00;
}

.slot-state.unknown,
.slot-state.not-craftable {
  border-color: #9e332a;
  background: #fff2f0;
  color: #9e332a;
}

.slot-state.unlocked {
  border-color: #145c35;
  background: #effbf2;
  color: #145c35;
}

.target-block {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-top: 0.8rem;
}

.target-artwork {
  width: 126px;
}

.target-copy {
  min-width: 0;
  flex: 1;
}

.target-kicker {
  color: #3f3f3f;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.07em;
}

.target-copy h5,
.available-candidate h5 {
  margin-top: 0.18rem;
  color: #191919;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.06rem;
  font-weight: 700;
  line-height: 1.3;
}

.equipment-meta {
  margin-top: 0.16rem;
  color: #3f3f3f;
  font-size: 0.75rem;
  line-height: 1.45;
}

.gate-line {
  margin-top: 0.42rem;
  border-top: 1px solid #949494;
  padding-top: 0.38rem;
  color: #3f3f3f;
  font-size: 0.75rem;
  line-height: 1.5;
}

.stat-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem;
  margin-top: 0.55rem;
}

.stat-grid span {
  max-width: 100%;
  border: 1px solid #949494;
  background: #f7f7f7;
  padding: 0.18rem 0.3rem;
  color: #3f3f3f;
  font-size: 0.75rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.stat-grid strong {
  margin-left: 0.16rem;
  color: #191919;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.match-notes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.48rem;
}

.match-notes span {
  border: 1px solid #949494;
  background: #f7f7f7;
  padding: 0.14rem 0.28rem;
  color: #3f3f3f;
  font-size: 0.75rem;
}

.field-warning {
  margin-top: 0.5rem;
  color: #5c3a00;
  font-size: 0.7rem;
}

.material-line {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin-top: 0.6rem;
}

.material-line > span,
.subhead {
  color: #3f3f3f;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.material-line > div {
  display: flex;
  flex-wrap: wrap;
  gap: 0.22rem;
}

.material-line > div span {
  border: 1px solid #949494;
  background: #f7f7f7;
  padding: 0.12rem 0.26rem;
  color: #3f3f3f;
  font-size: 0.75rem;
}

.material-line small {
  color: #5c3a00;
  font-size: 0.75rem;
}

.authority-note,
.single-result-note {
  margin-top: 0.52rem;
  border-left: 3px solid #8f3f00;
  background: #fff8e8;
  padding: 0.35rem 0.45rem;
  color: #5c3a00;
  font-size: 0.75rem;
  line-height: 1.5;
}

.single-result-note {
  border-left-color: #145c35;
  background: #effbf2;
  color: #145c35;
}

.available-block,
.alternative-block {
  margin-top: 0.75rem;
  border-top: 1px solid #949494;
  padding-top: 0.65rem;
}

.available-candidate,
.alternative-card {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin-top: 0.5rem;
}

.available-candidate > div,
.alternative-card > div {
  min-width: 0;
  flex: 1;
}

.alternative-card {
  border: 1px solid #949494;
  background: #f7f7f7;
  padding: 0.45rem;
}

.alternative-card + .alternative-card {
  margin-top: 0.38rem;
}

.alternative-card strong {
  display: block;
  color: #191919;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.84rem;
}

.alternative-card small {
  display: block;
  margin-top: 0.12rem;
  color: #3f3f3f;
  font-size: 0.75rem;
  line-height: 1.45;
}

.slot-warnings {
  display: grid;
  gap: 0.18rem;
  margin-top: 0.62rem;
}

.slot-warnings p {
  display: flex;
  gap: 0.32rem;
  color: #5c3a00;
  font-size: 0.75rem;
  line-height: 1.45;
}

.slot-warnings span {
  color: #5c3a00;
  font-family: "Rajdhani", sans-serif;
  font-weight: 700;
}

.slot-empty {
  margin-top: 0.7rem;
  border: 1px dashed #949494;
  background: #f7f7f7;
  padding: 1.2rem 0.8rem;
  text-align: center;
}

.slot-empty span {
  color: #5c3a00;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.slot-empty p {
  margin-top: 0.25rem;
  color: #3f3f3f;
  font-size: 0.75rem;
  line-height: 1.5;
}

.equipment-source {
  margin-top: auto;
  padding-top: 0.65rem;
  color: #3f3f3f;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  overflow-wrap: anywhere;
}

.loadout-warnings {
  display: grid;
  gap: 0.35rem;
  margin-top: 0.85rem;
  border: 1px solid #8f3f00;
  background: #fffaf0;
  padding: 0.65rem 0.75rem;
}

.loadout-warnings p {
  color: #5c3a00;
  font-size: 0.75rem;
  line-height: 1.55;
}

.loadout-warnings span {
  margin-right: 0.55rem;
  color: #5c3a00;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.equipment-empty {
  border: 1px dashed #949494;
  background: #f7f7f7;
  margin-top: 1rem;
  padding: 2.5rem 1rem;
  text-align: center;
}

.equipment-empty strong {
  color: #191919;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.76rem;
  letter-spacing: 0.12em;
}

.equipment-empty p {
  margin-top: 0.45rem;
  color: #3f3f3f;
  font-size: 0.75rem;
}

@media (max-width: 1180px) {
  .slot-grid {
    grid-template-columns: 1fr;
  }

  .slot-card {
    border-top-width: 3px;
  }
}

@media (max-width: 780px) {
  .equipment-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.65rem;
  }

  .equipment-principle {
    text-align: left;
  }

  .equipment-legend {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.35rem;
  }
}

@media (max-width: 520px) {
  .equipment-board {
    padding: 1rem;
  }

  .loadout-character {
    padding: 0.8rem;
  }

  .slot-count {
    display: none;
  }

  .target-artwork {
    width: 104px;
  }

  .target-block {
    gap: 0.6rem;
  }
}
</style>
