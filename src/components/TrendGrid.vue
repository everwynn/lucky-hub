<script setup lang="ts">
/**
 * 最近 30 期点阵走势图。
 * 不把相邻期连成折线：折线会暗示期与期之间存在连续性，与独立随机的事实相反。
 * 每个格子都画 1px 网格线：这一页的用法就是横向找号、纵向看期，没有网格线很容易读到相邻行。
 * 悬停时整行、整列同时高亮，帮助把视线锁在一条横带和一条竖带上。
 * 期号列 sticky 在左侧，横向滚动时保持可见。
 */
import { computed, ref } from 'vue';
import type { Draw } from '../lib/types';

const props = defineProps<{ draws: Draw[] }>();

/** 最新在前；用 computed 保证父组件数据变化时同步 */
const rows = computed(() => [...props.draws].reverse());
const pad = (n: number) => String(n).padStart(2, '0');
const RED = Array.from({ length: 33 }, (_, i) => i + 1);
const BLUE = Array.from({ length: 16 }, (_, i) => i + 1);

const hoverRow = ref(-1); // -1 表示无悬停
const hoverCol = ref(-1);

/** 事件委托：1500+ 单元格只绑一个监听器，靠 cellIndex / rowIndex 定位 */
function onTableOver(e: MouseEvent) {
  const cell = (e.target as HTMLElement).closest<HTMLTableCellElement>('td,th');
  if (!cell) return;
  const tr = cell.parentElement as HTMLTableRowElement;
  // 表头行不产生行高亮；tbody 第一行 rowIndex 为 1，减一后与 rows 下标对齐
  const row = tr.parentElement?.tagName === 'TBODY' ? tr.rowIndex - 1 : -1;
  if (cell.cellIndex === hoverCol.value && row === hoverRow.value) return;
  hoverCol.value = cell.cellIndex;
  hoverRow.value = row;
}

function clearHover() {
  hoverRow.value = -1;
  hoverCol.value = -1;
}

/** sticky 期号列必须保持不透明，所以自己决定底色；hover 用 line 色，亮暗两向都有足够对比 */
const stickyBg = (i: number) =>
  hoverCol.value === 0 || hoverRow.value === i ? 'bg-line' : 'bg-panel';

const colBg = (col: number) => (hoverCol.value === col ? 'bg-line' : '');
</script>

<template>
  <figure class="panel">
    <figcaption>
      <h2 class="text-sm font-semibold">最近 30 期走势</h2>
      <p class="mt-1 text-xs leading-5 text-muted">
        每一期都是独立事件，观察这些点的位置无法推出下一期会落在哪里。
      </p>
    </figcaption>

    <div class="mt-3 overflow-x-auto">
      <table
        class="border-collapse text-[10px]"
        role="img"
        aria-label="最近 30 期号码走势图，详细号码见首页表格"
        @mouseover="onTableOver"
        @mouseleave="clearHover"
        @touchstart.passive="clearHover"
      >
        <thead>
          <tr class="text-muted">
            <th
              scope="col"
              class="sticky left-0 z-10 border border-line px-1 text-left font-normal"
              :class="hoverCol === 0 ? 'bg-line' : 'bg-panel'"
            >期</th>
            <th
              v-for="(n, j) in RED"
              :key="n"
              scope="col"
              class="w-3 whitespace-nowrap border border-line font-normal"
              :class="colBg(j + 1)"
            >{{ pad(n) }}</th>
            <th
              scope="col"
              class="w-1 border border-line"
              :class="hoverCol === 34 ? 'bg-line' : 'bg-line/30'"
            ></th>
            <th
              v-for="(n, j) in BLUE"
              :key="`b-${n}`"
              scope="col"
              class="w-3 whitespace-nowrap border border-line font-normal text-lucky-blue"
              :class="colBg(35 + j)"
            >
              {{ pad(n) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(d, i) in rows" :key="d.code" :class="hoverRow === i ? 'bg-line' : ''">
            <th
              scope="row"
              class="sticky left-0 z-10 border border-line px-1 text-left font-normal tabular-nums text-muted"
              :class="stickyBg(i)"
              :title="d.code"
            >{{ d.code.slice(-3) }}</th>
            <td
              v-for="(n, j) in RED"
              :key="n"
              class="h-4 border border-line text-center"
              :class="colBg(j + 1)"
            >
              <span v-if="d.red.includes(n)" class="inline-block h-1.5 w-1.5 rounded-full bg-lucky-red"></span>
            </td>
            <td class="border border-line" :class="hoverCol === 34 ? 'bg-line' : 'bg-line/30'"></td>
            <td
              v-for="(n, j) in BLUE"
              :key="`b-${n}`"
              class="h-4 border border-line text-center"
              :class="colBg(35 + j)"
            >
              <span v-if="d.blue === n" class="inline-block h-1.5 w-1.5 rounded-full bg-lucky-blue"></span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>
