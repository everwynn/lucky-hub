<script setup lang="ts">
/**
 * 最近 30 期点阵走势图。
 * 不把相邻期连成折线：折线会暗示期与期之间存在连续性，与独立随机的事实相反。
 * 每个格子都画 1px 网格线：这一页的用法就是横向找号、纵向看期，没有网格线很容易读到相邻行。
 * 悬停时整行、整列同时高亮，帮助把视线锁在一条横带和一条竖带上。
 * 期号列 sticky 在左侧，横向滚动时保持可见。
 * 卡片只有 736px 宽，51 列必然放不下；expanded 模式改用 table-fixed 均分列宽铺满弹窗，
 * 让“想看某一期的蓝号得先左右滑”这件事不再发生。
 */
import { computed, ref } from 'vue';
import type { Draw } from '../lib/types';

const props = withDefaults(defineProps<{ draws: Draw[]; expanded?: boolean }>(), {
  expanded: false,
});
const emit = defineEmits<{ (e: 'zoom'): void }>();

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

/** 表头要 sticky 在滚动区顶部，必须有实底，否则纵向滚动时下面的点会透出来 */
const headBg = (col: number) =>
  hoverCol.value === col ? 'bg-line' : props.expanded ? 'bg-panel' : '';

/** 行高随视口高度伸缩：桌面舒展到 26px，手机横屏压到 16px，少滚一点 */
const cellH = computed(() => (props.expanded ? 'h-[clamp(16px,2.6vh,26px)]' : 'h-4'));
const dotSize = computed(() => (props.expanded ? 'h-2 w-2' : 'h-1.5 w-1.5'));

/** 点表格任意位置都能放大；放大态里不再嵌套触发 */
function onTableClick() {
  if (!props.expanded) emit('zoom');
}
</script>

<template>
  <figure :class="expanded ? '' : 'panel'">
    <figcaption v-if="!expanded" class="flex items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold">最近 30 期走势</h2>
        <p class="mt-1 text-xs leading-5 text-muted">
          每一期都是独立事件，观察这些点的位置无法推出下一期会落在哪里。
        </p>
      </div>
      <button
        type="button"
        class="btn-secondary min-h-9 shrink-0 px-2.5 text-xs"
        aria-label="放大查看最近 30 期走势"
        @click="emit('zoom')"
      >
        放大
      </button>
    </figcaption>

    <!-- 放大态不自己建滚动容器：overflow-x 会把 overflow-y 一并变成 auto，
         sticky 表头就会盯住这个不滚动的小容器而不是弹窗的滚动区，列号依然会滚走 -->
    <div :class="expanded ? '' : 'mt-3 overflow-x-auto cursor-zoom-in'">
      <table
        class="border-separate border-spacing-0 border-t border-l border-line text-[10px]"
        :class="expanded ? 'w-full min-w-[640px] table-fixed' : ''"
        role="img"
        aria-label="最近 30 期号码走势图，详细号码见首页表格"
        @mouseover="onTableOver"
        @mouseleave="clearHover"
        @touchstart.passive="clearHover"
        @click="onTableClick"
      >
        <thead>
          <tr class="text-muted">
            <th
              scope="col"
              class="sticky left-0 z-10 border-r border-b border-line px-1 text-left font-normal"
              :class="[hoverCol === 0 ? 'bg-line' : 'bg-panel', expanded ? 'w-10 top-0 z-30' : '']"
            >期</th>
            <th
              v-for="(n, j) in RED"
              :key="n"
              scope="col"
              class="whitespace-nowrap border-r border-b border-line font-normal"
              :class="[headBg(j + 1), expanded ? 'sticky top-0 z-20' : 'w-3']"
            >{{ pad(n) }}</th>
            <th
              scope="col"
              class="border-r border-b border-line"
              :class="[hoverCol === 34 ? 'bg-line' : expanded ? 'bg-panel' : 'bg-line/30', expanded ? 'sticky top-0 z-20 w-2' : 'w-1']"
            ></th>
            <th
              v-for="(n, j) in BLUE"
              :key="`b-${n}`"
              scope="col"
              class="whitespace-nowrap border-r border-b border-line font-normal text-lucky-blue"
              :class="[headBg(35 + j), expanded ? 'sticky top-0 z-20' : 'w-3']"
            >
              {{ pad(n) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(d, i) in rows" :key="d.code" :class="hoverRow === i ? 'bg-line' : ''">
            <th
              scope="row"
              class="sticky left-0 z-10 border-r border-b border-line px-1 text-left font-normal tabular-nums text-muted"
              :class="[stickyBg(i), expanded ? 'w-10' : '']"
              :title="d.code"
            >{{ d.code.slice(-3) }}</th>
            <td
              v-for="(n, j) in RED"
              :key="n"
              class="border-r border-b border-line text-center"
              :class="[colBg(j + 1), cellH]"
            >
              <span
                v-if="d.red.includes(n)"
                class="inline-block rounded-full bg-lucky-red"
                :class="dotSize"
              ></span>
            </td>
            <td
              class="border-r border-b border-line"
              :class="[hoverCol === 34 ? 'bg-line' : 'bg-line/30', expanded ? 'w-2' : '']"
            ></td>
            <td
              v-for="(n, j) in BLUE"
              :key="`b-${n}`"
              class="border-r border-b border-line text-center"
              :class="[colBg(35 + j), cellH]"
            >
              <span
                v-if="d.blue === n"
                class="inline-block rounded-full bg-lucky-blue"
                :class="dotSize"
              ></span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </figure>
</template>
