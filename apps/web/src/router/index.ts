import { createRouter, createWebHashHistory } from 'vue-router'
import PlannerView from '@/views/PlannerView.vue'
import DataView from '@/views/DataView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'planner',
      component: PlannerView,
    },
    {
      path: '/data',
      name: 'data',
      component: DataView,
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
