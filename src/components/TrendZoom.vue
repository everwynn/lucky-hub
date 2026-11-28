<script setup lang="ts">
/**
 * 走势图放大弹窗。
 * 卡片只有 736px 宽，51 列放不下，必然出现横向滚动；放大后按视口宽度把列宽均分，一屏能看全。
 * 桌面直接给一块接近视口的面板；触屏设备额外尝试全屏 + 锁定横屏，
 * 让手机竖屏也能一次看全。iOS Safari 不支持普通元素全屏、也不支持锁定方向，
 * 会退化成“横过来看”的提示，手动旋转后同样不用左右滑。
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Draw } from '../lib/types';
import TrendGrid from './TrendGrid.vue';

defineProps<{ draws: Draw[] }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const panel = ref<HTMLElement | null>(null);
/** 触屏才自动横屏：桌面弹窗已经够大，全屏反而打断浏览 */
const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const isFullscreen = ref(false);
const showRotateHint = ref(coarse);

function close() {
  emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}

/** 用户按 ESC 或返回手势退出全屏时，一并关掉弹窗 */
function onFullscreenChange() {
  if (document.fullscreenElement) {
    isFullscreen.value = true;
  } else if (isFullscreen.value) {
    close();
  }
}

onMounted(async () => {
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  if (!coarse) return;

  await nextTick();
  try {
    await panel.value?.requestFullscreen();
  } catch {
    /* iOS 只允许 video 全屏，跳过 */
  }
  // ScreenOrientation.lock 不在 TS 标准库里，单独声明；只在真正锁定成功时才收起手动横屏提示
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (o: 'landscape') => Promise<void>;
  };
  if (orientation.lock) {
    try {
      await orientation.lock('landscape');
      showRotateHint.value = false;
    } catch {
      /* 方向锁定被拒绝，保留提示 */
    }
  }
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
      class="flex w-full flex-col overflow-hidden bg-panel shadow-2xl"
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

      <p
        v-if="showRotateHint"
        class="border-b border-line bg-sunken px-3 py-2 text-xs leading-5 text-muted landscape:hidden"
      >
        横过来看：51 列一次铺满，不用左右滑。
      </p>

      <div class="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain p-1.5">
        <TrendGrid :draws="draws" expanded />
        <p class="px-1.5 pb-1 pt-2 text-xs leading-5 text-muted">
          数据来源：中国福利彩票官网公开开奖数据。仅供娱乐参考，不构成投注建议。
        </p>
      </div>
    </div>
  </div>
</template>
