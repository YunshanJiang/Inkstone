<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { $scene } from '@google/model-viewer/lib/model-viewer-base.js'
import type { ModelScene } from '@google/model-viewer/lib/three-components/ModelScene.js'
import { Matrix4, Quaternion, Vector3, type Object3D } from 'three'
import ViewerControls from './ViewerControls.vue'
import { useFullscreen } from '@/composables/useFullscreen'
import { useViewerSession } from '@/composables/useViewerSession'
import type { ItemDocument } from '@/domain/catalog/types'
import type { ViewerPhase } from '@/domain/viewer/types'
import { computeVolumeCenter } from '@/domain/viewer/volume-center'
import type { InkstoneModelViewerElement } from '@/types/model-viewer'

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
const viewerStage = ref<HTMLElement | null>(null)
const autoRotate = ref(false)
const itemRef = toRef(props, 'item')
const timeoutRef = toRef(props, 'loadTimeoutMs')
const session = useViewerSession(itemRef, timeoutRef)
const fullscreen = useFullscreen(stageRoot)
const setViewerElement = session.setViewerElement
const viewerElement = ref<InkstoneModelViewerElement | null>(null)

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
const centeredCameraOrbit = computed(() => {
  const [theta = '0deg', phi = '68deg'] = cameraOrbit.value.trim().split(/\s+/)
  return `${theta} ${phi} auto`
})
const fieldOfView = computed(() => props.item?.view?.fieldOfView || '30deg')
const exposure = computed(() => props.item?.view?.exposure ?? 1)
const shadowIntensity = computed(() => props.item?.view?.shadowIntensity ?? 0.8)
const interactiveFieldOfView = ref('30deg')
const interactiveCameraTarget = ref('0m 0m 0m')
const pivotSource = ref<'pending' | 'volume' | 'bounds'>('pending')
const activePointers = new Map<number, { x: number; y: number }>()
let pinchDistance: number | null = null
let pointerCaptureTarget: HTMLElement | null = null
let modelTransform: ModelTransform | null = null
let pivotInitializationFrame: number | null = null
let autoRotateFrame: number | null = null
let autoRotateTimestamp: number | null = null
let rotationInterpolationFrame: number | null = null
let rotationInterpolationTimestamp: number | null = null

const ORBIT_DEGREES_PER_PIXEL = 0.45
const DRAG_INTERPOLATION_RESPONSE = 22
const ROTATION_SETTLE_RADIANS = 0.0005
const MIN_FIELD_OF_VIEW = 12
const MAX_FIELD_OF_VIEW = 60
const MIN_PINCH_DISTANCE = 8
const AUTO_ROTATE_DEGREES_PER_SECOND = 18

interface ModelTransform {
  scene: ModelScene
  model: Object3D
  baseMatrix: Matrix4
  pivotInParent: Vector3
}

const targetRotation = new Quaternion()
const displayedRotation = new Quaternion()
const incrementalRotation = new Quaternion()
const userRotationMatrix = new Matrix4()
const pivotTranslation = new Matrix4()
const inversePivotTranslation = new Matrix4()
const transformedModelMatrix = new Matrix4()
const cameraWorldQuaternion = new Quaternion()
const parentWorldQuaternion = new Quaternion()
const cameraRightInParent = new Vector3()
const parentUpAxis = new Vector3(0, 1, 0)

watch(
  [() => props.item?.id, fieldOfView, cameraTarget],
  ([, nextFieldOfView, nextCameraTarget]) => {
    interactiveFieldOfView.value = nextFieldOfView
    interactiveCameraTarget.value = nextCameraTarget
    cancelRotationInterpolation()
    targetRotation.identity()
    displayedRotation.identity()
    modelTransform = null
    pivotSource.value = 'pending'
    cancelPivotInitialization()
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

function handleViewerElement(element: globalThis.Element | null): void {
  const nextElement = element as InkstoneModelViewerElement | null
  if (viewerElement.value !== nextElement) {
    viewerElement.value = nextElement
    modelTransform = null
    pivotSource.value = 'pending'
    if (nextElement && phase.value === 'ready') schedulePivotInitialization()
  }
  setViewerElement(element)
}

function readDegrees(value: string): number {
  const degrees = Number.parseFloat(value)
  return Number.isFinite(degrees) ? degrees : 30
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180
}

function formatMeters(value: number): string {
  const normalized = Math.abs(value) < 1e-7 ? 0 : value
  return `${normalized.toFixed(6)}m`
}

function getModelScene(): ModelScene | null {
  const element = viewerElement.value as (InkstoneModelViewerElement & {
    [$scene]?: ModelScene
  }) | null
  return element?.[$scene] ?? null
}

function initializeModelTransform(): ModelTransform | null {
  const scene = getModelScene()
  const model = scene?.model
  if (!scene || !model) return null
  if (modelTransform?.scene === scene && modelTransform.model === model) return modelTransform

  model.updateMatrix()
  model.updateMatrixWorld(true)

  const volumeCenter = computeVolumeCenter(model)
  const baseMatrix = model.matrix.clone()
  const pivotInParent = volumeCenter.center.clone().applyMatrix4(baseMatrix)

  modelTransform = { scene, model, baseMatrix, pivotInParent }
  pivotSource.value = volumeCenter.source

  const centeredTarget = [
    formatMeters(pivotInParent.x),
    formatMeters(pivotInParent.y),
    formatMeters(pivotInParent.z),
  ].join(' ')
  interactiveCameraTarget.value = centeredTarget

  const element = viewerElement.value
  if (element) {
    element.cameraTarget = centeredTarget
    element.cameraOrbit = centeredCameraOrbit.value
    void updateViewerFraming(element)
  }

  return modelTransform
}

async function updateViewerFraming(element: InkstoneModelViewerElement): Promise<void> {
  try {
    await element.updateComplete
    if (element !== viewerElement.value || phase.value !== 'ready') return
    await element.updateFraming()
    if (element === viewerElement.value) element.jumpCameraToGoal()
  } catch {
    // The model remains usable with the last valid framing if the element is replaced mid-update.
  }
}

function cancelPivotInitialization(): void {
  if (pivotInitializationFrame === null) return
  globalThis.window.cancelAnimationFrame(pivotInitializationFrame)
  pivotInitializationFrame = null
}

function schedulePivotInitialization(): void {
  cancelPivotInitialization()
  pivotInitializationFrame = globalThis.window.requestAnimationFrame(() => {
    pivotInitializationFrame = null
    if (phase.value !== 'ready') return
    modelTransform = null
    applyModelRotation()
  })
}

function applyModelRotation(rotation = displayedRotation): void {
  const transform = modelTransform ?? initializeModelTransform()
  if (!transform) return

  userRotationMatrix.makeRotationFromQuaternion(rotation)

  const { pivotInParent, baseMatrix, model, scene } = transform
  pivotTranslation.makeTranslation(pivotInParent.x, pivotInParent.y, pivotInParent.z)
  inversePivotTranslation.makeTranslation(-pivotInParent.x, -pivotInParent.y, -pivotInParent.z)
  transformedModelMatrix
    .copy(pivotTranslation)
    .multiply(userRotationMatrix)
    .multiply(inversePivotTranslation)
    .multiply(baseMatrix)

  transformedModelMatrix.decompose(model.position, model.quaternion, model.scale)
  model.updateMatrixWorld(true)
  scene.queueRender()
}

function rotateTargetAroundParentAxis(axis: Vector3, degrees: number): void {
  if (Math.abs(degrees) < 1e-6) return
  incrementalRotation.setFromAxisAngle(axis, degreesToRadians(degrees))
  targetRotation.premultiply(incrementalRotation).normalize()
}

function cancelRotationInterpolation(): void {
  if (rotationInterpolationFrame !== null) {
    globalThis.window.cancelAnimationFrame(rotationInterpolationFrame)
    rotationInterpolationFrame = null
  }
  rotationInterpolationTimestamp = null
}

function runRotationInterpolation(timestamp: number): void {
  rotationInterpolationFrame = null
  if (phase.value !== 'ready') {
    rotationInterpolationTimestamp = null
    return
  }

  const elapsedSeconds = rotationInterpolationTimestamp === null
    ? 1 / 60
    : Math.min(0.05, (timestamp - rotationInterpolationTimestamp) / 1_000)
  rotationInterpolationTimestamp = timestamp

  const interpolationAmount = 1 - Math.exp(-DRAG_INTERPOLATION_RESPONSE * elapsedSeconds)
  displayedRotation.slerp(targetRotation, interpolationAmount).normalize()

  if (displayedRotation.angleTo(targetRotation) <= ROTATION_SETTLE_RADIANS) {
    displayedRotation.copy(targetRotation)
    rotationInterpolationTimestamp = null
  }

  applyModelRotation()

  if (rotationInterpolationTimestamp !== null) {
    rotationInterpolationFrame = globalThis.window.requestAnimationFrame(runRotationInterpolation)
  }
}

function scheduleRotationInterpolation(): void {
  if (rotationInterpolationFrame !== null || phase.value !== 'ready') return
  rotationInterpolationFrame = globalThis.window.requestAnimationFrame(runRotationInterpolation)
}

function settleRotationImmediately(): void {
  cancelRotationInterpolation()
  displayedRotation.copy(targetRotation)
  applyModelRotation()
}

function getCameraRightAxis(): Vector3 | null {
  const transform = modelTransform ?? initializeModelTransform()
  if (!transform) return null

  const camera = transform.scene.getCamera()
  const parent = transform.model.parent
  camera.updateMatrixWorld(true)
  parent?.updateMatrixWorld(true)
  camera.getWorldQuaternion(cameraWorldQuaternion)

  cameraRightInParent.set(1, 0, 0).applyQuaternion(cameraWorldQuaternion)
  if (parent) {
    parent.getWorldQuaternion(parentWorldQuaternion)
    cameraRightInParent.applyQuaternion(parentWorldQuaternion.invert())
  }

  return cameraRightInParent.normalize()
}

function updateOrientation(horizontalDelta: number, verticalDelta: number): void {
  rotateTargetAroundParentAxis(parentUpAxis, horizontalDelta * ORBIT_DEGREES_PER_PIXEL)
  const cameraRight = getCameraRightAxis()
  if (cameraRight) {
    rotateTargetAroundParentAxis(cameraRight, verticalDelta * ORBIT_DEGREES_PER_PIXEL)
  }
  scheduleRotationInterpolation()
}

function stopAutoRotation(): void {
  if (autoRotateFrame !== null) {
    globalThis.window.cancelAnimationFrame(autoRotateFrame)
    autoRotateFrame = null
  }
  autoRotateTimestamp = null
}

function runAutoRotation(timestamp: number): void {
  if (!autoRotate.value || phase.value !== 'ready') {
    stopAutoRotation()
    return
  }

  if (autoRotateTimestamp !== null) {
    const elapsedSeconds = Math.min(0.1, (timestamp - autoRotateTimestamp) / 1_000)
    rotateTargetAroundParentAxis(
      parentUpAxis,
      AUTO_ROTATE_DEGREES_PER_SECOND * elapsedSeconds,
    )
    displayedRotation.copy(targetRotation)
    applyModelRotation()
  }

  autoRotateTimestamp = timestamp
  autoRotateFrame = globalThis.window.requestAnimationFrame(runAutoRotation)
}

function startAutoRotation(): void {
  if (autoRotateFrame !== null || !autoRotate.value || phase.value !== 'ready') return
  settleRotationImmediately()
  autoRotateTimestamp = null
  autoRotateFrame = globalThis.window.requestAnimationFrame(runAutoRotation)
}

function setFieldOfView(value: number): void {
  const nextFieldOfView = Math.min(
    MAX_FIELD_OF_VIEW,
    Math.max(MIN_FIELD_OF_VIEW, value),
  )
  interactiveFieldOfView.value = `${Number(nextFieldOfView.toFixed(3))}deg`
}

function updateFieldOfViewFromPinch(previousDistance: number, nextDistance: number): void {
  if (previousDistance < MIN_PINCH_DISTANCE || nextDistance < MIN_PINCH_DISTANCE) return
  const currentFieldOfView = readDegrees(interactiveFieldOfView.value)
  setFieldOfView(currentFieldOfView * previousDistance / nextDistance)
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
    updateFieldOfViewFromPinch(pinchDistance, nextPinchDistance)
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
  event.stopPropagation()
  const pixels = event.deltaMode === globalThis.WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY
  const zoomScale = Math.exp(pixels * 0.0015)
  setFieldOfView(readDegrees(interactiveFieldOfView.value) * zoomScale)
}

watch(phase, (nextPhase) => {
  if (nextPhase === 'ready') {
    schedulePivotInitialization()
  } else {
    cancelPivotInitialization()
    cancelRotationInterpolation()
    modelTransform = null
    pivotSource.value = 'pending'
    clearModelPointers()
  }
  emit('phase-change', nextPhase)
}, { immediate: true })

watch([autoRotate, phase], ([enabled, nextPhase]) => {
  if (enabled && nextPhase === 'ready') {
    startAutoRotation()
  } else {
    stopAutoRotation()
  }
}, { immediate: true })

onMounted(() => {
  viewerStage.value?.addEventListener('wheel', handleModelWheel, { passive: false })
})

onBeforeUnmount(() => {
  viewerStage.value?.removeEventListener('wheel', handleModelWheel)
  cancelPivotInitialization()
  cancelRotationInterpolation()
  stopAutoRotation()
  modelTransform = null
  clearModelPointers()
})
</script>

<template>
  <section
    ref="stageRoot"
    class="viewer-frame"
    :class="{ 'is-fullscreen': fullscreen.isFullscreen.value }"
    :data-phase="phase"
    :aria-busy="phase === 'loading'"
  >
    <div
      ref="viewerStage"
      class="viewer-stage"
    >
      <!-- Keep the complete orbit gesture on the model surface so horizontal
           yaw and camera-relative vertical rotation both accumulate. -->
      <model-viewer
        v-if="session.shouldMountModel.value"
        :ref="handleViewerElement"
        :key="session.mountKey.value"
        class="inkstone-model"
        :src="session.activeSrc.value"
        :alt="props.item?.model.alt || ''"
        :camera-orbit="centeredCameraOrbit"
        :camera-target="interactiveCameraTarget"
        :field-of-view="interactiveFieldOfView"
        :data-pivot-source="pivotSource"
        :exposure="exposure"
        :shadow-intensity="shadowIntensity"
        touch-action="none"
        loading="eager"
        reveal="auto"
        @pointerdown="handleModelPointerDown"
        @pointermove="handleModelPointerMove"
        @pointerup="finishModelPointer"
        @pointercancel="finishModelPointer"
        @lostpointercapture="clearModelPointers"
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
