<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue'
import ViewerControls from './ViewerControls.vue'
import { useFullscreen } from '@/composables/useFullscreen'
import { useViewerSession } from '@/composables/useViewerSession'
import type { ItemDocument } from '@/domain/catalog/types'
import type { ViewerPhase } from '@/domain/viewer/types'

const props = withDefaults(defineProps<{
  item: ItemDocument | null
  loadTimeoutMs: number
  canPrevious: boolean
  canNext: boolean
}>(), {
  item: null,
  loadTimeoutMs: 30_000,
  canPrevious: false,
  canNext: false,
})

const emit = defineEmits<{
  'phase-change': [phase: ViewerPhase]
  previous: []
  next: []
}>()

const stageRoot = ref<HTMLElement | null>(null)
const autoRotate = ref(false)
const itemRef = toRef(props, 'item')
const timeoutRef = toRef(props, 'loadTimeoutMs')
const session = useViewerSession(itemRef, timeoutRef)
const fullscreen = useFullscreen(stageRoot)
const setViewerElement = session.setViewerElement

const phase = computed(() => session.state.value.phase)
const progressPercent = computed(() => {
  if (session.state.value.progress === null) return null
  return Math.round(session.state.value.progress * 100)
})
const loadingRingStyle = computed(() => ({
  '--loading-progress': `${progressPercent.value ?? 0}%`,
}))
const phaseLabel = computed(() => {
  switch (phase.value) {
    case 'loading': return '正在读取 3D 模型'
    case 'ready': return '可交互查看'
    case 'error': return session.state.value.failureReason === 'fallback-load-failure'
      ? '替换视图暂不可用'
      : '3D 视图暂不可用'
    case 'fallback': return '静态替换视图'
    default: return '等待展件'
  }
})
const errorCopy = computed(() => {
  switch (session.state.value.failureReason) {
    case 'webgl-unavailable': return '当前浏览器无法启动 3D 渲染。'
    case 'timeout': return '模型读取时间过长，请检查网络后重试。'
    case 'webgl-context-lost': return '3D 渲染被浏览器中断，请重试。'
    case 'fallback-load-failure': return '替换视图也暂时无法读取，请稍后再试。'
    default: return '模型文件无法读取或解析。'
  }
})
const cameraOrbit = computed(() => props.item?.view?.cameraOrbit || '0deg 68deg 2.6m')
const cameraTarget = computed(() => props.item?.view?.cameraTarget || '0m 0m 0m')
const fieldOfView = computed(() => props.item?.view?.fieldOfView || '30deg')
const exposure = computed(() => props.item?.view?.exposure ?? 1)
const shadowIntensity = computed(() => props.item?.view?.shadowIntensity ?? 0.8)
const modelOrientation = ref('0deg 0deg 0deg')
const interactiveFieldOfView = ref('30deg')
const activePointers = new Map<number, { x: number; y: number }>()
let pinchDistance: number | null = null
let pointerCaptureTarget: HTMLElement | null = null

const ORBIT_DEGREES_PER_PIXEL = 0.45
const MIN_FIELD_OF_VIEW = 12
const MAX_FIELD_OF_VIEW = 60

watch(
  [() => props.item?.id, fieldOfView],
  ([, nextFieldOfView]) => {
    interactiveFieldOfView.value = nextFieldOfView
    modelOrientation.value = '0deg 0deg 0deg'
    clearModelPointers()
  },
  { immediate: true },
)

function toggleAutoRotate(): void {
  autoRotate.value = !autoRotate.value
}

async function toggleFullscreen(): Promise<void> {
  await fullscreen.toggleFullscreen()
}

function readDegrees(value: string): number {
  const degrees = Number.parseFloat(value)
  return Number.isFinite(degrees) ? degrees : 30
}

function updateOrientation(horizontalDelta: number, verticalDelta: number): void {
  const orientationValues = modelOrientation.value.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [0, 0, 0]
  const roll = orientationValues[0] || 0
  const pitch = (orientationValues[1] || 0) + verticalDelta * ORBIT_DEGREES_PER_PIXEL
  const yaw = (orientationValues[2] || 0) + horizontalDelta * ORBIT_DEGREES_PER_PIXEL
  modelOrientation.value = `${roll}deg ${pitch}deg ${yaw}deg`
}

function updateFieldOfView(delta: number): void {
  const nextFieldOfView = Math.min(
    MAX_FIELD_OF_VIEW,
    Math.max(MIN_FIELD_OF_VIEW, readDegrees(interactiveFieldOfView.value) + delta),
  )
  interactiveFieldOfView.value = `${nextFieldOfView}deg`
}

function getPinchDistance(): number | null {
  if (activePointers.size < 2) return null

  const [first, second] = [...activePointers.values()]
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function clearModelPointers(): void {
  if (pointerCaptureTarget) {
    for (const pointerId of activePointers.keys()) {
      if (pointerCaptureTarget.hasPointerCapture?.(pointerId)) {
        pointerCaptureTarget.releasePointerCapture(pointerId)
      }
    }
  }

  activePointers.clear()
  pinchDistance = null
  pointerCaptureTarget = null
}

function handleModelPointerDown(event: globalThis.PointerEvent): void {
  if (phase.value !== 'ready') return
  if (event.pointerType === 'mouse' && event.button !== 0) return

  event.preventDefault()
  autoRotate.value = false

  const target = event.currentTarget
  if (target instanceof HTMLElement) {
    pointerCaptureTarget = target
    target.setPointerCapture?.(event.pointerId)
  }

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  pinchDistance = getPinchDistance()
}

function handleModelPointerMove(event: globalThis.PointerEvent): void {
  const previous = activePointers.get(event.pointerId)
  if (!previous || phase.value !== 'ready') return

  event.preventDefault()
  const horizontalDelta = event.clientX - previous.x
  const verticalDelta = event.clientY - previous.y
  previous.x = event.clientX
  previous.y = event.clientY

  if (activePointers.size === 1) {
    updateOrientation(horizontalDelta, verticalDelta)
    return
  }

  const nextPinchDistance = getPinchDistance()
  if (pinchDistance !== null && nextPinchDistance !== null) {
    updateFieldOfView((pinchDistance - nextPinchDistance) * 0.035)
  }
  pinchDistance = nextPinchDistance
}

function finishModelPointer(event: globalThis.PointerEvent): void {
  if (!activePointers.has(event.pointerId)) return

  activePointers.delete(event.pointerId)
  if (pointerCaptureTarget?.hasPointerCapture?.(event.pointerId)) {
    pointerCaptureTarget.releasePointerCapture(event.pointerId)
  }

  pinchDistance = getPinchDistance()
  if (activePointers.size === 0) pointerCaptureTarget = null
}

function handleModelWheel(event: globalThis.WheelEvent): void {
  if (phase.value !== 'ready') return

  event.preventDefault()
  const pixels = event.deltaMode === globalThis.WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY
  updateFieldOfView(pixels * 0.025)
}

watch(phase, (nextPhase) => {
  if (nextPhase !== 'ready') clearModelPointers()
  emit('phase-change', nextPhase)
}, { immediate: true })

onBeforeUnmount(clearModelPointers)
</script>

<template>
  <section
    ref="stageRoot"
    class="viewer-frame"
    :class="{ 'is-fullscreen': fullscreen.isFullscreen.value }"
    :data-phase="phase"
    :aria-busy="phase === 'loading'"
  >
    <div class="viewer-stage">
      <!-- Keep the complete orbit gesture on the model surface so both
           horizontal yaw and unbounded vertical X-axis rotation accumulate. -->
      <model-viewer
        v-if="session.shouldMountModel.value"
        :ref="setViewerElement"
        :key="session.mountKey.value"
        class="inkstone-model"
        :src="session.activeSrc.value"
        :alt="props.item?.model.alt || ''"
        :camera-orbit="cameraOrbit"
        :camera-target="cameraTarget"
        :field-of-view="interactiveFieldOfView"
        :orientation="modelOrientation"
        :exposure="exposure"
        :shadow-intensity="shadowIntensity"
        :auto-rotate="autoRotate ? '' : undefined"
        auto-rotate-delay="0"
        rotation-per-second="18deg"
        touch-action="none"
        loading="eager"
        reveal="auto"
        @pointerdown="handleModelPointerDown"
        @pointermove="handleModelPointerMove"
        @pointerup="finishModelPointer"
        @pointercancel="finishModelPointer"
        @lostpointercapture="clearModelPointers"
        @wheel="handleModelWheel"
      />

      <div v-if="phase === 'idle'" class="viewer-message viewer-message--idle">
        <p>{{ props.item ? '等待开始读取' : '从目录中选择一方砚台' }}</p>
      </div>

      <div
        v-else-if="phase === 'loading'"
        class="viewer-message viewer-message--loading"
        role="status"
        aria-live="polite"
      >
        <div class="loading-ring" :style="loadingRingStyle">
          <div class="loading-ring__content">
            <p>正在加载 3D 模型</p>
            <strong>{{ progressPercent ?? 0 }}%</strong>
          </div>
        </div>
      </div>

      <div v-else-if="phase === 'error'" class="viewer-message viewer-message--error" role="alert">
        <span class="error-mark" aria-hidden="true">!</span>
        <p>{{ phaseLabel }}</p>
        <small>{{ errorCopy }}</small>
        <button class="quiet-action" type="button" @click="session.retry">重试 3D</button>
      </div>

      <div v-else-if="phase === 'fallback'" class="fallback-view" role="img" :aria-label="`${props.item?.title || '该砚台'}的静态替换视图`">
        <img
          :src="session.fallbackSrc.value"
          :alt="props.item?.model.alt || ''"
          @error="session.handleFallbackImageError"
        />
        <button class="quiet-action quiet-action--light" type="button" @click="session.retry">重试 3D</button>
      </div>
    </div>

    <header v-if="fullscreen.isFullscreen.value" class="fullscreen-viewer-header">
      <span class="fullscreen-viewer-id">{{ props.item?.id }}</span>
    </header>

    <ViewerControls
      v-if="props.item"
      :auto-rotate="autoRotate"
      :fullscreen="fullscreen.isFullscreen.value"
      :can-previous="props.canPrevious"
      :can-next="props.canNext"
      :disabled="phase !== 'ready'"
      @toggle-auto-rotate="toggleAutoRotate"
      @toggle-fullscreen="toggleFullscreen"
      @previous="emit('previous')"
      @next="emit('next')"
    />
  </section>
</template>
