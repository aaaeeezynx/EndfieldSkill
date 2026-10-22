<script setup lang="ts">
import { onMounted } from 'vue'
import { usePlannerStore } from '@/stores/planner'
import SiteHeader from '@/components/SiteHeader.vue'

const planner = usePlannerStore()

onMounted(() => {
  void planner.initialize()
})
</script>

<template>
  <div class="app-shell">
    <div class="ambient-grid" aria-hidden="true"></div>
    <div class="scanline" aria-hidden="true"></div>
    <SiteHeader />
    <main class="relative z-10">
      <RouterView />
    </main>
    <footer class="site-footer">
      <div class="container-shell">
        <p>END//FIELD TACTICAL ORCHESTRATOR · 确定性规则 MVP · 无 AI 运行时分析</p>
        <p class="footer-note">
          游戏机制资料与装备门槛需以游戏内当前版本为准。攻略预设保留来源索引，规则编排明确标注待核对。
        </p>
      </div>
    </footer>
  </div>
</template>
