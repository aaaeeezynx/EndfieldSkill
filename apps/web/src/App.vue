<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { usePlannerStore } from '@/stores/planner'
import SiteHeader from '@/components/SiteHeader.vue'

const planner = usePlannerStore()
const baseUrl = import.meta.env.BASE_URL
const ringUrl = computed(() => `${baseUrl}assets/official/ring.5ce6e2bd.png`)

onMounted(() => {
  void planner.initialize()
})
</script>

<template>
  <div class="app-shell">
    <aside class="app-rail app-rail-left" aria-hidden="true">
      <div class="rail-mark"><span>E//F</span></div>
      <p class="rail-code">TACTICAL ORCHESTRATOR</p>
      <span class="rail-star"></span>
    </aside>

    <aside class="app-rail app-rail-right" aria-hidden="true">
      <span class="rail-star"></span>
      <img class="rail-ring" :src="ringUrl" alt="" />
      <p class="rail-code">ENDFIELD DATA LINK / 1.6.4</p>
    </aside>

    <div class="site-frame">
      <SiteHeader />
      <main>
        <RouterView />
      </main>
      <footer class="site-footer">
        <div class="container-shell footer-inner">
          <div>
            <p class="footer-brand">終末地戰術編排台</p>
            <p class="footer-note">
              依玩家已擁有角色、目前等級與劇情進度，以靜態資料和確定性規則生成技能順序與裝備方向。
              本工具不使用執行期 AI，遊戲實裝內容仍以官方版本為準。
            </p>
          </div>
          <p class="footer-index">ENDFIELD // SKILL ROUTE // MVP</p>
        </div>
      </footer>
    </div>
  </div>
</template>
