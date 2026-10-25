<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePlannerStore } from '@/stores/planner'

const route = useRoute()
const planner = usePlannerStore()
const navIndicatorUrl = `url("${import.meta.env.BASE_URL}assets/official/nav-indicator.svg")`

const dataLabel = computed(() => {
  if (planner.dataState === 'loading') return '資料連線中'
  if (planner.dataState === 'ready') return '資料已連線'
  if (planner.dataState === 'error') return '連線異常'
  return '等待資料'
})
</script>

<template>
  <header class="site-header">
    <div class="container-shell header-inner">
      <RouterLink to="/" class="brand" aria-label="返回戰術編排台">
        <span class="brand-mark" aria-hidden="true">
          <span></span>
        </span>
        <span class="brand-copy">
          <span class="brand-kicker">ENDFIELD // TACTICAL ORCHESTRATOR</span>
          <span class="brand-name">戰術編排台</span>
        </span>
      </RouterLink>

      <nav class="nav-links" aria-label="主要導覽">
        <RouterLink to="/" :class="{ active: route.name === 'planner' }">
          <span>01</span>
          <b>編成終端</b>
        </RouterLink>
        <RouterLink to="/data" :class="{ active: route.name === 'data' }">
          <span>02</span>
          <b>資料鏈路</b>
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
  position: sticky;
  z-index: var(--z-header);
  top: 0;
  border-bottom: 1px solid var(--color-border-primary);
  background: #ffffff;
}

.header-inner {
  display: flex;
  min-height: 5.2rem;
  align-items: center;
  gap: 2.4rem;
}

.site-header::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  width: 20%;
  height: 3px;
  background: var(--color-accent-primary);
  content: "";
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  color: var(--color-text-primary);
  text-decoration: none;
}

.brand-mark {
  position: relative;
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--color-text-primary);
  background: var(--color-text-primary);
  transform: rotate(45deg);
}

.brand-mark::before,
.brand-mark::after,
.brand-mark span {
  content: "";
  position: absolute;
  background: var(--color-accent-primary);
}

.brand-mark::before {
  width: 1.25rem;
  height: 2px;
}

.brand-mark::after {
  width: 2px;
  height: 1.25rem;
}

.brand-mark span {
  width: 0.45rem;
  height: 0.45rem;
  box-shadow: 0 0 0 2px var(--color-text-primary);
}

.brand-copy {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.brand-kicker {
  font-family: "Rajdhani", sans-serif;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: var(--color-text-tertiary);
}

.brand-name {
  margin-top: 0.35rem;
  font-family: var(--font-display);
  font-size: 1.55rem;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.nav-links {
  display: flex;
  align-self: stretch;
  gap: 0;
  margin-left: auto;
}

.nav-links a {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 10.5rem;
  border-left: 1px solid var(--color-border-primary);
  padding: 0 1.2rem;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition:
    color 180ms ease,
    background-color 180ms ease;
}

.nav-links a:last-child {
  border-right: 1px solid var(--color-border-primary);
}

.nav-links a span {
  color: var(--color-text-tertiary);
  font-family: var(--font-display);
  font-size: 0.75rem;
  font-weight: 700;
}

.nav-links a b {
  font-family: var(--font-display);
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.nav-links a:hover,
.nav-links a.active {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.nav-links a.active::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
          right: 1.2rem;
          bottom: 0;
          left: 1.2rem;
          height: 6px;
          background: v-bind(navIndicatorUrl) center / 100% 100% no-repeat;
}

.data-beacon {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--color-text-secondary);
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.data-beacon i {
  width: 0.48rem;
  height: 0.48rem;
  border-radius: 50%;
  background: #9b9b9b;
}

.data-beacon.state-ready i {
  background: var(--color-accent-blue);
  box-shadow: 0 0 0 4px rgba(34, 87, 214, 0.1);
}

.data-beacon.state-loading i {
  background: var(--color-accent-primary);
  box-shadow: 0 0 0 4px rgba(255, 250, 0, 0.18);
  animation: beacon-pulse 1.2s ease-in-out infinite;
}

.data-beacon.state-error i {
  background: var(--color-danger);
}

@keyframes beacon-pulse {
  50% {
    opacity: 0.3;
  }
}

@media (max-width: 760px) {
  .site-header {
    position: relative;
  }

  .header-inner {
    min-height: 5rem;
    gap: 0.8rem;
  }

  .brand-mark {
    width: 2.3rem;
    height: 2.3rem;
  }

  .brand-kicker {
    display: none;
  }

  .brand-name {
    margin: 0;
    font-size: 1.25rem;
  }

  .data-beacon {
    margin-left: auto;
  }

  .data-beacon span {
    display: none;
  }

  .nav-links {
    position: fixed;
    z-index: var(--z-navigation);
    right: 0;
    bottom: 0;
    left: 0;
    display: grid;
    min-height: calc(4.4rem + env(safe-area-inset-bottom));
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 0;
    border-top: 1px solid var(--color-border-primary);
    background: #ffffff;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .nav-links a {
    display: flex;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    gap: 0.08rem;
    border-left: 0;
    border-right: 0;
    padding: 0.55rem;
    text-align: center;
  }

  .nav-links a + a {
    border-left: 1px solid var(--color-border-primary);
  }

  .nav-links a span {
    font-size: 0.75rem;
    letter-spacing: 0.1em;
  }

  .nav-links a b {
    font-size: 1.02rem;
  }

  .nav-links a.active {
    background: var(--color-accent-primary);
  }

  .nav-links a.active::after {
    top: 0;
    right: 0;
    bottom: auto;
    left: 0;
    height: 4px;
    background: var(--color-text-primary);
  }
}
</style>
