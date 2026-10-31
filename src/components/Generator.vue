<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  DEFAULT_WINDOW,
  generateTicket,
  weightRatio,
  WINDOW_OPTIONS,
  type Draw,
  type GeneratedTicket,
  type Mode,
  type WindowMode,
} from '../lib/generate';
import { loadDraws } from '../lib/loadDraws';

interface Favorite {
  red: number[];
  blue: number;
  savedAt: string;
}

const FAV_KEY = 'lucky-hub:favorites';
const MAX_FAV = 10;

const modeOptions: { value: Mode; label: string }[] = [
  { value: 'weighted', label: '加权' },
  { value: 'uniform', label: '纯随机' },
];

const draws = ref<Draw[]>([]);
const mode = ref<Mode>('weighted');
const windowMode = ref<WindowMode>(DEFAULT_WINDOW);
const history = ref<GeneratedTicket[]>([]);
const favorites = ref<Favorite[]>([]);
const loading = ref(true);
const error = ref('');
const copyText = ref('');
const hint = ref('');

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (t: { red: number[]; blue: number }) => `${t.red.join(',')}-${t.blue}`;

const current = computed<GeneratedTicket | null>(() => history.value[0] ?? null);
/** 当前档位的冷热权重差，1 倍即完全随机 */
const ratio = computed(() => (draws.value.length ? weightRatio(draws.value, windowMode.value) : 1));
const isFaved = computed(() => {
  const c = current.value;
  return c ? favorites.value.some((f) => keyOf(f) === keyOf(c)) : false;
});

onMounted(async () => {
  favorites.value = readFavorites();
  try {
    draws.value = await loadDraws();
  } catch (e) {
    error.value = e instanceof Error ? e.message : '数据加载失败';
  } finally {
    loading.value = false;
  }
});

function readFavorites(): Favorite[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is Favorite =>
        !!f &&
        Array.isArray((f as Favorite).red) &&
        (f as Favorite).red.length === 6 &&
        Number.isInteger((f as Favorite).blue),
    );
  } catch {
    return [];
  }
}

function writeFavorites(list: Favorite[]) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
  } catch {
    hint.value = '浏览器不允许保存，请改用复制';
  }
}

function generate() {
  if (draws.value.length === 0) return;
  copyText.value = '';
  hint.value = '';
  const next = generateTicket(draws.value, { mode: mode.value, window: windowMode.value });
  history.value = [next, ...history.value].slice(0, 5);
}

function toggleFav() {
  const c = current.value;
  if (!c) return;
  const k = keyOf(c);
  if (favorites.value.some((f) => keyOf(f) === k)) {
    favorites.value = favorites.value.filter((f) => keyOf(f) !== k);
    hint.value = '已取消收藏';
  } else {
    if (favorites.value.length >= MAX_FAV) {
      hint.value = `最多收藏 ${MAX_FAV} 注，先删一注`;
      return;
    }
    favorites.value = [{ red: c.red, blue: c.blue, savedAt: new Date().toISOString() }, ...favorites.value];
    hint.value = '已加入守号';
  }
  writeFavorites(favorites.value);
}

function removeFav(k: string) {
  favorites.value = favorites.value.filter((f) => keyOf(f) !== k);
  writeFavorites(favorites.value);
  hint.value = '已删除';
}

const windowLabel = (w: WindowMode) => (w === 'all' ? '全部历史' : `近 ${w} 期`);

function basisOf(t: GeneratedTicket): string {
  if (t.mode === 'uniform') return '纯随机：33 选 6 + 16 选 1，每注概率完全相同';
  const detail = t.red.map((n) => `${pad(n)} 出现 ${t.redCounts.get(n) ?? 0} 次`).join('，');
  return `${windowLabel(t.window)}开奖中，${detail}`;
}

async function copy(t: GeneratedTicket) {
  const text = `${t.red.map(pad).join(' ')} + ${pad(t.blue)}`;
  try {
    await navigator.clipboard.writeText(text);
    copyText.value = text;
  } catch {
    copyText.value = text;
  }
}

function selectAll(e: Event) {
  (e.target as HTMLInputElement).select();
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="loading" class="text-sm text-muted">正在加载开奖数据…</p>
    <p v-else-if="error" class="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-300">{{ error }}</p>

    <template v-else>
      <!-- 模式 + 加权档位：分段控件 -->
      <div class="space-y-2">
        <div class="flex rounded-xl border border-line bg-sunken p-1">
          <button
            v-for="opt in modeOptions"
            :key="opt.value"
            class="min-h-10 flex-1 rounded-lg text-sm transition"
            :class="mode === opt.value ? 'bg-elevated font-medium text-body' : 'text-muted'"
            @click="mode = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
        <div v-if="mode === 'weighted'" class="flex rounded-xl border border-line bg-sunken p-1">
          <button
            v-for="opt in WINDOW_OPTIONS"
            :key="opt.value"
            class="min-h-10 flex-1 rounded-lg text-xs transition sm:text-sm"
            :class="windowMode === opt.value ? 'bg-elevated font-medium text-body' : 'text-muted'"
            @click="windowMode = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
      <p class="text-xs leading-5 text-muted">
        <template v-if="mode === 'weighted'">
          窗口越短越偏向近期热门号，当前冷热权重差约 {{ ratio.toFixed(1) }} 倍（1 倍即完全随机）。
        </template>
        <template v-else>每注概率完全相同，不参考历史数据。</template>
      </p>

      <button class="btn-primary min-h-14 w-full text-lg" @click="generate">生成一注</button>

      <div v-if="current" class="panel">
        <div class="flex flex-wrap items-center justify-center gap-1 sm:justify-start sm:gap-1.5">
          <span v-for="n in current.red" :key="`r-${n}`" class="ball ball-red" :aria-label="`红球 ${pad(n)}`">
            {{ pad(n) }}
          </span>
          <span class="px-0.5 text-muted">+</span>
          <span class="ball ball-blue" :aria-label="`蓝球 ${pad(current.blue)}`">{{ pad(current.blue) }}</span>
        </div>

        <p class="mt-3 text-xs leading-5 text-muted">{{ basisOf(current) }}</p>

        <div class="mt-3 flex gap-2">
          <button class="btn-secondary flex-1" :class="isFaved ? 'border-lucky-red/60 text-lucky-red' : ''" @click="toggleFav">
            {{ isFaved ? '取消收藏' : '收藏这注' }}
          </button>
          <button class="btn-secondary flex-1" @click="copy(current)">复制号码</button>
        </div>

        <p v-if="hint" class="mt-2 text-xs text-muted">{{ hint }}</p>

        <input
          v-if="copyText"
          :value="copyText"
          readonly
          class="mt-2 w-full rounded-lg border border-line bg-sunken px-3 py-2 font-mono text-sm"
          @focus="selectAll"
        />
      </div>

      <!-- 守号：长期买同一组时用 -->
      <section v-if="favorites.length" class="space-y-2">
        <h2 class="text-xs font-semibold text-muted">我的守号（{{ favorites.length }}/{{ MAX_FAV }}）</h2>
        <ul class="space-y-1.5">
          <li
            v-for="f in favorites"
            :key="keyOf(f)"
            class="flex items-center justify-between gap-3 rounded-lg border border-line bg-sunken px-3 py-2"
          >
            <span class="font-mono text-sm">
              {{ f.red.map(pad).join(' ') }}<span class="px-1 text-muted">+</span>{{ pad(f.blue) }}
            </span>
            <button class="min-h-9 shrink-0 px-2 text-xs text-muted hover:text-body" @click="removeFav(keyOf(f))">
              删除
            </button>
          </li>
        </ul>
      </section>

      <section v-if="history.length > 1" class="space-y-1.5">
        <h2 class="text-xs font-semibold text-muted">本次生成</h2>
        <ul class="space-y-1 font-mono text-xs text-muted">
          <li v-for="(h, i) in history.slice(1)" :key="i">
            {{ h.red.map(pad).join(' ') }}<span class="px-1">+</span>{{ pad(h.blue) }}
          </li>
        </ul>
      </section>

      <p class="text-xs leading-6 text-muted">
        彩票每期独立随机，历史数据不改变任何号码的中奖概率。加权只是让结果偏向近期热门号，
        中奖率与纯随机完全相同。共 {{ draws.length }} 期历史数据可参考。仅供娱乐，请理性购彩（18+）。
      </p>
    </template>
  </div>
</template>
