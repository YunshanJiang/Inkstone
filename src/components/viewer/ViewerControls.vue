<script setup lang="ts">
import { resolveAssetUrl } from '@/services/assetUrl'

defineProps<{
  autoRotate: boolean
  fullscreen: boolean
  canPrevious: boolean
  canNext: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  'toggle-auto-rotate': []
  'toggle-fullscreen': []
  previous: []
  next: []
}>()

const previousAssetUrl = resolveAssetUrl('/assets/ui/SwitchLeft.png')
const autoRotateAssetUrl = resolveAssetUrl('/assets/ui/autoRotate.png')
const fullscreenAssetUrl = resolveAssetUrl('/assets/ui/FullScreen.png')
const nextAssetUrl = resolveAssetUrl('/assets/ui/SwitchRight.png')
</script>

<template>
  <nav
    class="viewer-controls"
    :class="{ 'is-fullscreen': fullscreen, 'is-disabled': disabled }"
    :aria-disabled="disabled"
    aria-label="模型控制"
  >
    <div class="viewer-control-actions">
      <button
        class="control-button control-button--switch control-button--previous"
        type="button"
        :disabled="disabled || !canPrevious"
        aria-label="上一方砚台"
        title="上一方"
        @click="emit('previous')"
      >
        <img class="control-button__asset" :src="previousAssetUrl" alt="">
        <span class="control-text">上一方</span>
      </button>

      <button
        class="control-button control-button--icon control-button--auto-rotate"
        type="button"
        :disabled="disabled"
        :class="{ 'is-active': autoRotate }"
        :aria-pressed="autoRotate"
        aria-label="切换自动旋转"
        title="自动旋转"
        @click="emit('toggle-auto-rotate')"
      >
        <img class="control-button__icon" :src="autoRotateAssetUrl" alt="">
        <span class="control-text">自动旋转</span>
      </button>

      <button
        class="control-button control-button--icon control-button--fullscreen"
        type="button"
        :disabled="disabled"
        :class="{ 'is-active': fullscreen }"
        :aria-label="fullscreen ? '退出全屏' : '进入全屏'"
        :title="fullscreen ? '退出全屏' : '进入全屏'"
        @click="emit('toggle-fullscreen')"
      >
        <img class="control-button__icon" :src="fullscreenAssetUrl" alt="">
        <span class="control-text">{{ fullscreen ? '退出全屏' : '全屏' }}</span>
      </button>

      <button
        class="control-button control-button--switch"
        type="button"
        :disabled="disabled || !canNext"
        aria-label="下一方砚台"
        title="下一方"
        @click="emit('next')"
      >
        <img class="control-button__asset" :src="nextAssetUrl" alt="">
        <span class="control-text">下一方</span>
      </button>
    </div>
  </nav>
</template>
