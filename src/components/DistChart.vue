<script setup lang="ts">
/**
 * 柱图：CSS flex 实现，不用 SVG。
 * 柱高只依赖容器高度与 count/max 比例，桶数变化（6/7/17）无需重算坐标。
 * referenceLabel 命中的那根柱子会画一条虚线，用于标出理论值（如和值 102）。
 */
import { computed } from 'vue';

const props = defineProps<{
  title: string;
  caption: string;
  buckets: { label: string; count: number }[];
  tone?: 'red' | 'blue';
  referenceLabel?: string;
  /** 每隔几个柱子显示一次标签；和值 17 箱时传 3，避免标签挤成一团 */
  labelEvery?: number;
}>();

const max = computed(() => Math.max(...props.buckets.map((b) => b.count), 1));
const barClass = computed(() => (props.tone === 'blue' ? 'bg-lucky-blue/70' : 'bg-lucky-red/70'));
const every = computed(() => props.labelEvery ?? 1);
const refIndex = computed(() => props.buckets.findIndex((b) => b.label === props.referenceLabel));
const refLeft = computed(() =>
  refIndex.value < 0 ? '' : `${((refIndex.value + 0.5) / props.buckets.length) * 100}%`,
);
</script>

<template>
  <figure class="panel">
    <figcaption>
      <h2 class="text-sm font-semibold">{{ title }}</h2>
      <p class="mt-1 text-xs leading-5 text-muted">{{ caption }}</p>
    </figcaption>

    <div class="relative mt-3 h-28">
      <div class="absolute inset-0 flex items-end gap-0.5">
        <div
          v-for="b in buckets"
          :key="b.label"
          class="flex-1 rounded-t-sm"
          :class="barClass"
          :style="{ height: `${(b.count / max) * 100}%` }"
          :title="`${b.label}：${b.count} 期`"
        ></div>
      </div>
      <div
        v-if="refLeft"
        class="pointer-events-none absolute inset-y-0 border-l border-dashed border-body/50"
        :style="{ left: refLeft }"
      ></div>
    </div>

    <div class="mt-1 flex gap-0.5">
      <div v-for="(b, i) in buckets" :key="b.label" class="min-w-0 flex-1 text-center">
        <div class="truncate text-[9px] text-muted">{{ i % every === 0 ? b.label : '' }}</div>
        <div class="text-[9px] tabular-nums text-body">{{ b.count }}</div>
      </div>
    </div>
  </figure>
</template>
