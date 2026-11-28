<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { DEFAULT_WINDOW, WINDOW_OPTIONS, type Draw, type WindowMode } from '../lib/generate';
import { loadDraws } from '../lib/loadDraws';
import {
  bigSmallDistribution,
  blueFrequency,
  carryoverDistribution,
  consecutiveDistribution,
  oddEvenDistribution,
  omissionStats,
  redFrequency,
  sumDistribution,
  zoneDistribution,
  type Bucket,
} from '../lib/stats';
import DistChart from './DistChart.vue';
import FreqBars from './FreqBars.vue';
import OmissionTable from './OmissionTable.vue';
import TrendGrid from './TrendGrid.vue';
import TrendZoom from './TrendZoom.vue';

const draws = ref<Draw[]>([]);
const windowMode = ref<WindowMode>(DEFAULT_WINDOW);
const loading = ref(true);
const error = ref('');
/** 走势图放大弹窗：只在点击后渲染，关闭即销毁 */
const zoomOpen = ref(false);

onMounted(async () => {
  // ?window=30|100|all；非法值回落默认，不报错也不改 URL
  const q = new URLSearchParams(location.search).get('window');
  if (q === '30' || q === '100' || q === 'all') {
    windowMode.value = q === 'all' ? 'all' : (Number(q) as WindowMode);
  }
  try {
    draws.value = await loadDraws();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '数据加载失败';
  } finally {
    loading.value = false;
  }
});

const redFreq = computed(() => redFrequency(draws.value, windowMode.value));
const blueFreq = computed(() => blueFrequency(draws.value, windowMode.value));

/** Map → 升序行，组件只负责画 */
const toRows = (counts: Map<number, number>) =>
  [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([n, count]) => ({ n, count }));

const redRows = computed(() => toRows(redFreq.value.counts));
const blueRows = computed(() => toRows(blueFreq.value.counts));

/** 比例尺留 8% 头部，避免最热号满格、参考线贴边 */
const redScaleMax = computed(() => Math.max(...redFreq.value.counts.values()) * 1.08);
const blueScaleMax = computed(() => Math.max(...blueFreq.value.counts.values()) * 1.08);

/** 频次文案：动态判断实际范围是否落在期望 ±2σ 内。poolLabel 说明参与比较的号码个数，红蓝各不同 */
function freqCaption(
  freq: { counts: Map<number, number>; expected: number; sigma: number; sampleSize: number },
  poolLabel: string,
): string {
  const values = [...freq.counts.values()];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const lo = Math.max(0, freq.expected - 2 * freq.sigma);
  const hi = freq.expected + 2 * freq.sigma;
  const head = `共 ${freq.sampleSize} 期。每号理论期望 ${freq.expected.toFixed(1)} 次，正常波动范围约 ${lo.toFixed(0)}–${hi.toFixed(0)}（±2σ）。`;
  if (min >= lo && max <= hi) return `${head}实际 ${min}–${max} 次，落在正常范围内。`;
  return `${head}实际 ${min}–${max} 次，极值超出 2σ；${poolLabel}同时比较时极值越界并不罕见，这不构成某个号有偏向的证据。`;
}

const redCaption = computed(() => freqCaption(redFreq.value, '33 个红球'));
const blueCaption = computed(() => freqCaption(blueFreq.value, '16 个蓝球'));

const sums = computed(() => sumDistribution(draws.value, windowMode.value));
const oddEven = computed(() => oddEvenDistribution(draws.value, windowMode.value));
const bigSmall = computed(() => bigSmallDistribution(draws.value, windowMode.value));
const zones = computed(() => zoneDistribution(draws.value, windowMode.value));
const consecutive = computed(() => consecutiveDistribution(draws.value, windowMode.value));
const carry = computed(() => carryoverDistribution(draws.value, windowMode.value));

/** 桶索引就是“个数”，用索引算均值，不依赖标签字符串 */
function bucketMean(buckets: Bucket[]): number {
  const total = buckets.reduce((a, b) => a + b.count, 0);
  if (!total) return 0;
  return buckets.reduce((a, b, i) => a + i * b.count, 0) / total;
}

/** “至少 1 个”的占比：除 0 号桶之外全部相加 */
function bucketAnyPct(buckets: Bucket[]): number {
  const total = buckets.reduce((a, b) => a + b.count, 0);
  if (!total) return 0;
  return (100 * buckets.slice(1).reduce((a, b) => a + b.count, 0)) / total;
}

/** 重号均值理论值：本期 6 个号各自碰中上期 6 个号的机会为 6/33，合计 36/33 */
const repeatCaption = computed(() => {
  const s = carry.value.sampleSize;
  if (!s) return '至少需要两期数据才能比较。';
  return `与上一期比较，共 ${s} 对。理论上平均重 ${(36 / 33).toFixed(2)} 个，实际 ${bucketMean(carry.value.repeat).toFixed(2)} 个；${bucketAnyPct(carry.value.repeat).toFixed(0)}% 的期数至少含 1 个上期号码。按“排除上期号”筛选，等于在这些期数里主动排掉会开出的号。`;
});

const adjacentCaption = computed(() => {
  const s = carry.value.sampleSize;
  if (!s) return '至少需要两期数据才能比较。';
  return `邻号 = 与上期某个号码相差 1。${s} 对中 ${bucketAnyPct(carry.value.adjacent).toFixed(0)}% 至少含 1 个邻号，平均 ${bucketMean(carry.value.adjacent).toFixed(2)} 个。上期号码的相邻位置没有记忆，不影响本期。`;
});

/** 和值桶标签：21-30 / 31-40 … 181-183，最后不满 10 也照实显示 */
const sumBuckets = computed(() =>
  sums.value.bins.map((b) => ({ label: `${b.from}-${b.to}`, count: b.count })),
);

/** 102 落在 101-110 这箱（索引 8），参考线画在桶中心 */
const SUM_MEAN = 102;

const zoneTop = computed(() => zones.value.combos.slice(0, 10));
const zoneOthers = computed(() =>
  zones.value.combos.slice(10).reduce((a, b) => a + b.count, 0),
);

const omissions = computed(() => omissionStats(draws.value));
const recent30 = computed(() => draws.value.slice(-30));

/** 切换窗口只重算本地数据，不重新请求；URL 用 replaceState，不往历史栈塞记录 */
function setWindow(next: WindowMode) {
  windowMode.value = next;
  const url = new URL(location.href);
  url.searchParams.set('window', String(next));
  history.replaceState(null, '', url);
}

const windowLabel = (w: WindowMode) => (w === 'all' ? '全部历史' : `近 ${w} 期`);
</script>

<template>
  <div class="space-y-4">
    <p v-if="loading" class="text-sm text-muted">正在加载开奖数据…</p>
    <p v-else-if="error" class="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-300">{{ error }}</p>

    <template v-else>
      <div>
        <div class="flex rounded-xl border border-line bg-sunken p-1">
          <button
            v-for="opt in WINDOW_OPTIONS"
            :key="opt.value"
            class="min-h-10 flex-1 rounded-lg text-xs transition sm:text-sm"
            :class="windowMode === opt.value ? 'bg-elevated font-medium text-body' : 'text-muted'"
            @click="setWindow(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
        <p class="mt-1 text-xs leading-5 text-muted">
          窗口影响下面的频次、和值、形态与连号；遗漏与走势图固定口径，不随窗口变化。
          当前：{{ windowLabel(windowMode) }}。
        </p>
      </div>

      <FreqBars
        title="红球频次"
        :caption="redCaption"
        :rows="redRows"
        :expected="redFreq.expected"
        :scale-max="redScaleMax"
        tone="red"
      />
      <FreqBars
        title="蓝球频次"
        :caption="blueCaption"
        :rows="blueRows"
        :expected="blueFreq.expected"
        :scale-max="blueScaleMax"
        tone="blue"
      />

      <DistChart
        title="和值分布"
        :caption="`理论均值 ${SUM_MEAN}，实际均值 ${sums.mean.toFixed(1)}。形状接近正态是组合数决定的，不是规律。`"
        :buckets="sumBuckets"
        reference-label="101-110"
        :label-every="3"
      />

      <DistChart
        title="奇偶比（奇:偶）"
        :caption="`3:3 占比最高是组合数学的结果，不是号码的规律。`"
        :buckets="oddEven.buckets"
        reference-label="3:3"
      />

      <DistChart
        title="大小比（小:大）"
        :caption="`1–16 为小、17–33 为大。两个池子分别有 16 和 17 个号，接近均等。`"
        :buckets="bigSmall.buckets"
      />

      <figure class="panel">
        <figcaption>
          <h2 class="text-sm font-semibold">三区组合（一区 1–11 / 二区 12–22 / 三区 23–33）</h2>
          <p class="mt-1 text-xs leading-5 text-muted">
            每期三区各出几个号。28 种组合里，最常见的 10 种如下；柱图放不下，改用表格。
          </p>
        </figcaption>
        <table class="mt-3 w-full text-left text-xs">
          <thead class="text-muted">
            <tr>
              <th class="py-1">组合</th>
              <th class="py-1 text-right">期数</th>
              <th class="py-1 text-right">占比</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="c in zoneTop" :key="c.label">
              <td class="py-1 font-mono">{{ c.label }}</td>
              <td class="py-1 text-right tabular-nums">{{ c.count }}</td>
              <td class="py-1 text-right tabular-nums text-muted">
                {{ zones.sampleSize ? ((c.count / zones.sampleSize) * 100).toFixed(1) : '0.0' }}%
              </td>
            </tr>
            <tr v-if="zoneOthers > 0">
              <td class="py-1 text-muted">其他</td>
              <td class="py-1 text-right tabular-nums">{{ zoneOthers }}</td>
              <td class="py-1 text-right tabular-nums text-muted">
                {{ zones.sampleSize ? ((zoneOthers / zones.sampleSize) * 100).toFixed(1) : '0.0' }}%
              </td>
            </tr>
          </tbody>
        </table>
      </figure>

      <DistChart
        title="连号对数"
        :caption="`按相邻差为 1 的号码对计数。理论上有 ${(100 * (1 - 376740 / 1107568)).toFixed(0)}% 的期数至少存在一组连号，比直觉高得多。`"
        :buckets="consecutive.buckets"
      />

      <DistChart
        title="上期重号个数"
        :caption="repeatCaption"
        :buckets="carry.repeat"
        reference-label="1"
      />

      <DistChart
        title="上期邻号个数"
        :caption="adjacentCaption"
        :buckets="carry.adjacent"
      />

      <hr class="border-line" />

      <OmissionTable
        :red="omissions.red"
        :blue="omissions.blue"
        caption="遗漏 30 期不等于“快出了”。每期独立随机，下期 6 个红球中含该号的概率仍是 6/33 ≈ 18%（蓝球 1/16 ≈ 6%）。"
      />

      <TrendGrid :draws="recent30" @zoom="zoomOpen = true" />
      <TrendZoom v-if="zoomOpen" :draws="recent30" @close="zoomOpen = false" />
    </template>
  </div>
</template>
