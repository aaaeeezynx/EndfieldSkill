<script setup lang="ts">
import { ref, watch } from 'vue'
import { getEquipmentImage } from '@/data/equipmentImageLoader'

const props = withDefaults(
  defineProps<{
    equipmentId: string
    name: string
    rarity: number | null
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)

const imageFailed = ref(false)
const imagePath = ref(getEquipmentImage(props.equipmentId))

watch(
  () => props.equipmentId,
  (equipmentId) => {
    imagePath.value = getEquipmentImage(equipmentId)
    imageFailed.value = false
  },
)

const rarityLevel = () => {
  if (!props.rarity) return 0
  return Math.min(5, Math.max(1, Math.round(props.rarity)))
}
</script>

<template>
  <figure
    class="equipment-artwork"
    :class="[`rarity-${rarityLevel()}`, { compact, missing: !imagePath || imageFailed }]"
  >
    <img
      v-if="imagePath && !imageFailed"
      :src="imagePath"
      :alt="`${name} 裝備圖`"
      loading="lazy"
      decoding="async"
      @error="imageFailed = true"
    />
    <div v-else class="artwork-missing" role="img" :aria-label="`${name}來源缺圖`">
      <span>{{ name.slice(0, 1) }}</span>
      <small>來源缺圖</small>
    </div>
    <figcaption>
      <span>{{ rarity ? `${rarity}★` : '稀有度未知' }}</span>
      <b aria-hidden="true"></b>
    </figcaption>
  </figure>
</template>

<style scoped>
.equipment-artwork {
  --rarity-color: #9aa0a6;
  position: relative;
  display: grid;
  width: 112px;
  aspect-ratio: 1;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  border: 2px solid var(--rarity-color);
  background: #f4f4f4;
  box-shadow:
    0 0 0 1px rgba(25, 25, 25, 0.08) inset,
    0 8px 20px rgba(25, 25, 25, 0.12);
  clip-path: polygon(0 0, calc(100% - 13px) 0, 100% 13px, 100% 100%, 13px 100%, 0 calc(100% - 13px));
}

.equipment-artwork::before,
.equipment-artwork::after {
  content: "";
  position: absolute;
  z-index: 2;
  width: 24px;
  height: 3px;
  background: var(--rarity-color);
}

.equipment-artwork::before {
  top: 0;
  left: 0;
}

.equipment-artwork::after {
  right: 0;
  bottom: 0;
}

.rarity-1 {
  --rarity-color: #a7abb0;
}

.rarity-2 {
  --rarity-color: #2f9d5a;
}

.rarity-3 {
  --rarity-color: #2257d6;
}

.rarity-4 {
  --rarity-color: #8b5cf6;
}

.rarity-5 {
  --rarity-color: #d99b1c;
}

.equipment-artwork img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 8%;
  filter: drop-shadow(0 6px 10px rgba(25, 25, 25, 0.25));
}

.artwork-missing {
  display: grid;
  width: 100%;
  height: 100%;
  place-content: center;
  background: #f7f7f7;
  text-align: center;
}

.artwork-missing span {
  /* Dark monogram; rarity colour stays on the border/decoration only. */
  color: #191919;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
}

.artwork-missing small {
  margin-top: 0.45rem;
  color: #3f3f3f;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
}

figcaption {
  position: absolute;
  right: 5px;
  bottom: 5px;
  left: 5px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

figcaption span {
  border: 1px solid color-mix(in srgb, var(--rarity-color) 80%, #ffffff);
  background: #ffffff;
  padding: 0.12rem 0.3rem;
  /* Rarity text is always dark for APCA body-text contrast; the rarity colour
     is reserved for the border, bar and decorative marks only. */
  color: #191919;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

figcaption b {
  width: 8px;
  height: 8px;
  background: var(--rarity-color);
  box-shadow: 0 0 10px var(--rarity-color);
  transform: rotate(45deg);
}

.equipment-artwork.compact {
  width: 72px;
}

.compact .artwork-missing small {
  display: none;
}

.compact figcaption span {
  font-size: 0.75rem;
}

@media (max-width: 520px) {
  .equipment-artwork {
    width: 92px;
  }

  .equipment-artwork.compact {
    width: 64px;
  }
}

@media (max-width: 390px) {
  .equipment-artwork { width: 84px; }
  .equipment-artwork.compact { width: 58px; }
}

@media (prefers-reduced-motion: reduce) {
  .equipment-artwork {
    transition: none;
  }
}
</style>
