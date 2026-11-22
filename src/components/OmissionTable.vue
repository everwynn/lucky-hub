<script setup lang="ts">
/**
 * 遗漏表：红/蓝分 tab，默认各显示 Top 12，可展开全部。
 * 色阶只是辅助，数字始终可见——不靠颜色单独传达信息。
 */
import { computed, ref } from 'vue';
import type { OmissionRow } from '../lib/stats';

const props = defineProps<{
  red: OmissionRow[];
  blue: OmissionRow[];
  caption: string;
}>();

type Tab = 'red' | 'blue';
const tab = ref<Tab>('red');
const expanded = ref(false);
const TOP = 12;

const source = computed(() => (tab.value === 'red' ? props.red : props.blue));
const sorted = computed(() => [...source.value].sort((a, b) => b.current - a.current));
const visible = computed(() => (expanded.value ? sorted.value : sorted.value.slice(0, TOP)));
const pad = (n: number) => String(n).padStart(2, '0');

/** 4 档色阶，阈值按双色球节奏（每周 3 期）定，数值本身始终显示 */
function toneClass(current: number): string {
  if (current >= 20) return 'text-lucky-red';
  if (current >= 10) return 'text-amber-400';
  if (current >= 5) return 'text-muted';
  return 'text-body';
}
</script>

<template>
  <figure class="panel">
    <figcaption>
      <h2 class="text-sm font-semibold">遗漏值（全历史口径，不随窗口切换）</h2>
      <p class="mt-1 text-xs leading-5 text-muted">{{ caption }}</p>
    </figcaption>

    <div class="mt-3 flex rounded-xl border border-line bg-sunken p-1">
      <button
        class="min-h-9 flex-1 rounded-lg text-xs transition"
        :class="tab === 'red' ? 'bg-elevated font-medium text-body' : 'text-muted'"
        @click="tab = 'red'"
      >
        红球（33）
      </button>
      <button
        class="min-h-9 flex-1 rounded-lg text-xs transition"
        :class="tab === 'blue' ? 'bg-elevated font-medium text-body' : 'text-muted'"
        @click="tab = 'blue'"
      >
        蓝球（16）
      </button>
    </div>

    <table class="mt-3 w-full text-left text-xs">
      <thead class="text-muted">
        <tr>
          <th class="py-1">号码</th>
          <th class="py-1 text-right">当前遗漏</th>
          <th class="py-1 text-right">历史最大</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        <tr v-for="row in visible" :key="row.n">
          <td class="py-1">
            <span
              class="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              :class="tab === 'red' ? 'bg-lucky-red' : 'bg-lucky-blue'"
            >{{ pad(row.n) }}</span>
          </td>
          <td class="py-1 text-right tabular-nums" :class="toneClass(row.current)">{{ row.current }}</td>
          <td class="py-1 text-right tabular-nums text-muted">{{ row.max }}</td>
        </tr>
      </tbody>
    </table>

    <button
      v-if="sorted.length > TOP"
      class="btn-secondary mt-3 w-full text-xs"
      @click="expanded = !expanded"
    >
      {{ expanded ? '收起' : `展开全部 ${sorted.length} 个号` }}
    </button>
  </figure>
</template>
