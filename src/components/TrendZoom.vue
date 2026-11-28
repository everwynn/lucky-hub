<script setup lang="ts">
/**
 * 走势图放大弹窗。
 * 卡片只有 736px 宽，51 列放不下，必然出现横向滚动；放大后按视口宽度把列宽均分，一屏能看全。
 * 竖屏手机的屏幕宽度注定了 51 列塞不进去，所以靠 zoom-rotate（见 global.css）
 * 直接按横屏尺寸排版再转 90°：用户把手机横过来，画面正好转正。
 * 这条路不依赖任何浏览器 API，iOS 和国产内核同样生效。
 * 能自动横屏的设备（Android Chrome）额外请求全屏 + 锁方向，成功时屏幕真的转过去，
 * 媒体查询随之失效，旋转自动让位。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Draw } from '../lib/types';
import TrendGrid from './TrendGrid.vue';

defineProps<{ draws: Draw[] }>();
const emit = defineEmits<{ (e: 'close'): void }>();

/** 弹窗面板本身：全屏请求要落在它身上，指整个文档在部分内核会被直接拒绝 */
const panel = ref<HTMLElement | null>(null);
/** 触屏才自动横屏：桌面弹窗已经够大，全屏反而打断浏览 */
const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const isFullscreen = ref(false);

function close() {
  emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}

/**
 * 全屏真正生效之后再锁方向：紧跟 requestFullscreen 的 Promise 调用会被直接拒绝，
 * 所以放进 fullscreenchange 回调。锁失败也不影响使用，
 * zoom-rotate 已经把内容按横屏排好，用户自己转过来一样看全。
 */
function lockLandscape() {
  // ScreenOrientation.lock 不在 TS 标准库里，单独声明
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (o: 'landscape') => Promise<void>;
  };
  // 失败也不影响使用：zoom-rotate 已经把内容按横屏排好，用户手动转过来一样看全
  orientation.lock?.('landscape').catch(() => {});
}

/** 用户按 ESC 或返回手势退出全屏时，一并关掉弹窗 */
function onFullscreenChange() {
  if (document.fullscreenElement) {
    isFullscreen.value = true;
    lockLandscape();
  } else if (isFullscreen.value) {
    close();
  }
}

onMounted(() => {
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  if (!coarse) return;
  if (document.fullscreenElement) {
    isFullscreen.value = true;
    lockLandscape();
    return;
  }
  // onMounted 是紧跟着 click 的微任务，此刻请求仍在用户手势有效期内。
  // 不放在 await nextTick 之后：那样会被推后一个微任务，部分浏览器会判定手势已失效。
  panel.value?.requestFullscreen().catch(() => {});
});

onBeforeUnmount(() => {
  document.body.style.overflow = '';
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  try {
    screen.orientation.unlock();
  } catch {
    /* 未锁定过时调用会抛错，忽略 */
  }
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
});
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-6"
    @click.self="close"
  >
    <div
      ref="panel"
      role="dialog"
      aria-modal="true"
      aria-label="最近 30 期走势图，放大查看"
      class="zoom-rotate flex w-full flex-col overflow-hidden bg-panel shadow-2xl"
      :class="isFullscreen ? 'h-full max-w-none rounded-none' : 'max-h-[94vh] max-w-[1600px] rounded-xl'"
    >
      <div class="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
        <div class="min-w-0">
          <h2 class="text-sm font-semibold">最近 30 期走势</h2>
          <p class="mt-0.5 text-xs text-muted">每一期都是独立事件，点的位置不预示下一期。</p>
        </div>
        <button
          type="button"
          class="btn-secondary min-h-9 shrink-0 px-2.5 text-xs"
          @click="close"
        >
          关闭
        </button>
      </div>

      <div class="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain p-1.5">
        <TrendGrid :draws="draws" expanded />
        <p class="px-1.5 pb-1 pt-2 text-xs leading-5 text-muted">
          数据来源：中国福利彩票官网公开开奖数据。仅供娱乐参考，不构成投注建议。
        </p>
      </div>
    </div>

    <p
      class="zoom-tip pointer-events-none absolute inset-x-0 bottom-8 z-10 mx-auto hidden w-max rounded-full bg-black/75 px-4 py-2 text-center text-xs leading-5 text-white"
    >
      画面已按横屏排版，请把手机横过来
    </p>
  </div>
</template>
