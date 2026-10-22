<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePlannerStore } from '@/stores/planner'

const route = useRoute()
const planner = usePlannerStore()

const dataLabel = computed(() => {
  if (planner.dataState === 'loading') return 'LINKING'
  if (planner.dataState === 'ready') return 'DATA ONLINE'
  if (planner.dataState === 'error') return 'LINK ERROR'
  return 'AWAITING DATA'
})
</script>

<template>
  <header class="site-header">
    <div class="container-shell header-inner">
      <RouterLink to="/" class="brand" aria-label="返回战术编排台">
        <span class="brand-mark" aria-hidden="true">
          <span></span>
        </span>
        <span class="brand-copy">
          <span class="brand-kicker">ENDFIELD // TACTICAL</span>
          <span class="brand-name">战术编排台</span>
        </span>
      </RouterLink>

      <nav class="nav-links" aria-label="主导航">
        <RouterLink to="/" :class="{ active: route.name === 'planner' }">
          <span>01</span> 编成终端
        </RouterLink>
        <RouterLink to="/data" :class="{ active: route.name === 'data' }">
          <span>02</span> 数据链路
        </RouterLink>
      </nav>

      <div class="data-beacon" :class="`state-${planner.dataState}`">
        <i aria-hidden="true"></i>
        <span>{{ dataLabel }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: relative;
  z-index: 30;
  border-bottom: 1px solid rgba(238, 233, 220, 0.13);
  background: rgba(16, 19, 15, 0.78);
  backdrop-filter: blur(18px);
}

.header-inner {
  display: flex;
  min-height: 76px;
  align-items: center;
  gap: 2rem;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.8rem;
  color: var(--paper);
  text-decoration: none;
}

.brand-mark {
  position: relative;
  display: grid;
  width: 37px;
  height: 37px;
  place-items: center;
  border: 1px solid var(--acid);
  transform: rotate(45deg);
}

.brand-mark::before,
.brand-mark::after,
.brand-mark span {
  content: "";
  position: absolute;
  background: var(--acid);
}

.brand-mark::before {
  width: 17px;
  height: 1px;
}

.brand-mark::after {
  width: 1px;
  height: 17px;
}

.brand-mark span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ink);
  box-shadow: 0 0 0 2px var(--acid);
}

.brand-copy {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.brand-kicker {
  font-family: "Rajdhani", sans-serif;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--acid);
}

.brand-name {
  margin-top: 0.28rem;
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 1.22rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.nav-links {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
}

.nav-links a {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 40px;
  padding: 0 0.9rem;
  color: var(--muted);
  font-family: "Rajdhani", "Noto Sans TC", sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-decoration: none;
  transition:
    color 180ms ease,
    background-color 180ms ease;
}

.nav-links a span {
  color: #69705f;
  font-size: 0.68rem;
}

.nav-links a:hover,
.nav-links a.active {
  color: var(--paper);
  background: rgba(238, 233, 220, 0.05);
}

.nav-links a.active::after {
  content: "";
  position: absolute;
  right: 0.9rem;
  bottom: 4px;
  left: 0.9rem;
  height: 2px;
  background: var(--acid);
}

.data-beacon {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-family: "Rajdhani", sans-serif;
  font-size: 0.67rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--muted);
}

.data-beacon i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #8d9487;
}

.data-beacon.state-ready i {
  background: var(--cyan);
  box-shadow: 0 0 12px var(--cyan);
}

.data-beacon.state-loading i {
  background: var(--acid);
  animation: beacon-pulse 1.2s ease-in-out infinite;
}

.data-beacon.state-error i {
  background: var(--danger);
}

@keyframes beacon-pulse {
  50% {
    opacity: 0.3;
  }
}

@media (max-width: 760px) {
  .header-inner {
    min-height: 64px;
    gap: 0.7rem;
  }

  .brand-mark {
    width: 29px;
    height: 29px;
  }

  .brand-kicker {
    display: none;
  }

  .brand-name {
    margin: 0;
    font-size: 1.02rem;
  }

  .nav-links {
    margin-left: auto;
  }

  .nav-links a {
    min-height: 36px;
    padding: 0 0.55rem;
    font-size: 0.78rem;
  }

  .nav-links a span,
  .data-beacon span {
    display: none;
  }

  .nav-links a.active::after {
    right: 0.55rem;
    left: 0.55rem;
  }
}
</style>
