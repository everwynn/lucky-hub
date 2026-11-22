<script setup lang="ts">
/**
 * 频次横条：纯展示组件，所有数字由父组件算好传进来。
 * 比例尺用 scaleMax 而不是实际最大值，留出头部空间，
 * 这样期望参考线不会贴在右边缘、也能看出最热号超出期望多少。
 */
import { computed } from 'vue';

const props = defineProps<{
  title: string;
  caption: string;
  rows: { n: number; count: number }[];
  expected: number;
  scaleMax: number;
  tone: 'red' | 'blue';
}>();

const pad = (n: number) => String(n).padStart(2, '0');
const expectedLeft = computed(() => `${(props.expected / props.scaleMax) * 100}%`);
const barClass = computed(() => (props.tone === 'red' ? 'bg-lucky-red/75' : 'bg-lucky-blue/75'));
</script>

<template>
  <figure class="panel">
    <figcaption>
      <h2 class="text-sm font-semibold">{{ title }}</h2>
      <p class="mt-1 text-xs leading-5 text-muted">{{ caption }}</p>
    </figcaption>

    <div class="relative mt-3 space-y-0.5">
      <!-- 期望值参考线：贯穿所有行，比例与条宽同尺 -->
      <div
        class="pointer-events-none absolute inset-y-0 z-10 border-l border-dashed border-body/40"
        :style="{ left: expectedLeft }"
      ></div>
      <div v-for="row in rows" :key="row.n" class="flex items-center gap-2 text-xs">
        <span class="w-6 shrink-0 tabular-nums text-muted">{{ pad(row.n) }}</span>
        <div class="h-3 flex-1 rounded-sm bg-sunken">
          <div class="h-full rounded-sm" :class="barClass" :style="{ width: `${(row.count / scaleMax) * 100}%` }"></div>
        </div>
        <span class="w-8 shrink-0 text-right tabular-nums">{{ row.count }}</span>
      </div>
    </div>
  </figure>
</template>
