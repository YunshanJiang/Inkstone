import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { resolveAssetUrl } from '@/services/assetUrl'
import { detectWebGL } from './useWebGLSupport'
import { createIdleViewerState, reduceViewerState } from '@/domain/viewer/machine'
import type { ViewerFailureReason, ViewerSnapshot } from '@/domain/viewer/types'
import type { ItemDocument } from '@/domain/catalog/types'
import type { InkstoneModelViewerElement } from '@/types/model-viewer'

interface ProgressDetail {
  totalProgress?: unknown
  reason?: unknown
}

interface ModelErrorDetail {
  type?: unknown
  sourceError?: unknown
}

interface ModelViewerListeners {
  progress: EventListener
  load: EventListener
  error: EventListener
}

const DEFAULT_MODEL_LOAD_TIMEOUT_MS = 30_000

export function useViewerSession(item: Ref<ItemDocument | null>, timeoutMs: Ref<number>) {
  const state = ref<ViewerSnapshot>(createIdleViewerState())
  const activeSrc = ref('')
  const fallbackSrc = ref('')
  const mountKey = ref(0)
  const activeItem = ref<ItemDocument | null>(null)
  const activeAttemptId = ref(0)
  const webglAvailable = ref(false)

  let loadTimer: number | undefined
  let activeViewerElement: InkstoneModelViewerElement | null = null
  let modelListeners: ModelViewerListeners | null = null
  let fallbackImage: HTMLImageElement | null = null

  const shouldMountModel = computed(() => {
    return Boolean(
      webglAvailable.value
      && activeSrc.value
      && (state.value.phase === 'loading' || state.value.phase === 'ready'),
    )
  })

  function isCurrent(attemptId: number, element?: InkstoneModelViewerElement | null): boolean {
    return Boolean(
      attemptId === activeAttemptId.value
      && attemptId === state.value.attemptId
      && (element === undefined || element === activeViewerElement),
    )
  }

  function clearLoadTimer(): void {
    if (loadTimer !== undefined) {
      window.clearTimeout(loadTimer)
      loadTimer = undefined
    }
  }

  function cancelFallbackPreload(): void {
    if (!fallbackImage) return

    fallbackImage.onload = null
    fallbackImage.onerror = null
    fallbackImage.src = ''
    fallbackImage = null
  }

  function detachViewerElement(): void {
    const element = activeViewerElement
    if (!element) {
      modelListeners = null
      return
    }

    if (modelListeners) {
      element.removeEventListener('progress', modelListeners.progress)
      element.removeEventListener('load', modelListeners.load)
      element.removeEventListener('error', modelListeners.error)
      modelListeners = null
    }

    element.src = ''
    activeViewerElement = null
  }

  function releaseModel(): void {
    detachViewerElement()
    activeSrc.value = ''
    mountKey.value += 1
  }

  function getLoadTimeoutMs(): number {
    const configured = Number(timeoutMs.value)
    if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MODEL_LOAD_TIMEOUT_MS
    return Math.max(1_000, configured)
  }

  function startLoadTimer(attemptId: number): void {
    clearLoadTimer()
    loadTimer = window.setTimeout(() => {
      if (isCurrent(attemptId) && state.value.phase === 'loading') {
        fail(attemptId, 'timeout')
      }
    }, getLoadTimeoutMs())
  }

  function markFallbackFailure(attemptId: number, image: HTMLImageElement): void {
    if (!isCurrent(attemptId) || state.value.phase !== 'error' || fallbackImage !== image) return
    cancelFallbackPreload()
    state.value = reduceViewerState(state.value, { type: 'FALLBACK_FAILURE', attemptId })
  }

  function preloadFallback(attemptId: number, nextItem: ItemDocument): void {
    cancelFallbackPreload()

    let url: string
    try {
      url = resolveAssetUrl(nextItem.model.fallbackImage)
    } catch {
      state.value = reduceViewerState(state.value, { type: 'FALLBACK_FAILURE', attemptId })
      return
    }

    const image = new Image()
    fallbackImage = image
    image.onload = () => {
      void (async () => {
        if (!isCurrent(attemptId) || state.value.phase !== 'error' || fallbackImage !== image) return

        try {
          if (typeof image.decode === 'function') await image.decode()
        } catch {
          markFallbackFailure(attemptId, image)
          return
        }

        if (!isCurrent(attemptId) || state.value.phase !== 'error' || fallbackImage !== image) return

        image.onload = null
        image.onerror = null
        fallbackImage = null
        fallbackSrc.value = url
        state.value = reduceViewerState(state.value, { type: 'FALLBACK_READY', attemptId })
      })()
    }
    image.onerror = () => markFallbackFailure(attemptId, image)
    image.src = url
  }

  function fail(attemptId: number, reason: ViewerFailureReason): void {
    if (!isCurrent(attemptId) || (state.value.phase !== 'loading' && state.value.phase !== 'ready')) return

    clearLoadTimer()
    state.value = reduceViewerState(state.value, { type: 'FAILURE', attemptId, reason })
    releaseModel()

    const nextItem = activeItem.value
    if (nextItem) preloadFallback(attemptId, nextItem)
  }

  function setViewerElement(element: Element | null): void {
    if (!element) {
      detachViewerElement()
      return
    }

    const nextElement = element as InkstoneModelViewerElement
    if (nextElement === activeViewerElement) return

    detachViewerElement()
    if (!shouldMountModel.value) {
      nextElement.src = ''
      return
    }

    const attemptId = activeAttemptId.value
    const listeners: ModelViewerListeners = {
      progress: (event) => handleProgress(event, attemptId, nextElement),
      load: (event) => handleLoad(event, attemptId, nextElement),
      error: (event) => handleError(event, attemptId, nextElement),
    }

    activeViewerElement = nextElement
    modelListeners = listeners
    nextElement.addEventListener('progress', listeners.progress)
    nextElement.addEventListener('load', listeners.load)
    nextElement.addEventListener('error', listeners.error)
  }

  async function start(nextItem: ItemDocument): Promise<void> {
    const attemptId = activeAttemptId.value + 1
    activeAttemptId.value = attemptId
    activeItem.value = nextItem
    clearLoadTimer()
    cancelFallbackPreload()
    fallbackSrc.value = ''
    webglAvailable.value = false
    releaseModel()
    state.value = reduceViewerState(state.value, {
      type: 'START',
      attemptId,
      itemId: nextItem.id,
    })

    await nextTick()
    if (!isCurrent(attemptId)) return

    webglAvailable.value = detectWebGL()
    if (!webglAvailable.value) {
      fail(attemptId, 'webgl-unavailable')
      return
    }

    try {
      activeSrc.value = resolveAssetUrl(nextItem.model.glbUrl)
    } catch {
      fail(attemptId, 'glb-load-failure')
      return
    }

    await nextTick()
    if (isCurrent(attemptId)) startLoadTimer(attemptId)
  }

  function cancel(): void {
    const attemptId = activeAttemptId.value + 1
    activeAttemptId.value = attemptId
    clearLoadTimer()
    cancelFallbackPreload()
    fallbackSrc.value = ''
    webglAvailable.value = false
    releaseModel()
    state.value = reduceViewerState(state.value, { type: 'CANCEL', attemptId })
  }

  function retry(): void {
    if (activeItem.value) void start(activeItem.value)
  }

  function handleProgress(event: Event, attemptId: number, element: InkstoneModelViewerElement): void {
    if (!isCurrent(attemptId, element) || state.value.phase !== 'loading') return

    const detail = (event as CustomEvent<ProgressDetail>).detail
    if (detail?.reason !== undefined && detail.reason !== 'model-load') return

    const value = detail?.totalProgress
    if (typeof value !== 'number' || !Number.isFinite(value)) return

    state.value = reduceViewerState(state.value, {
      type: 'PROGRESS',
      attemptId,
      value,
    })
  }

  function handleLoad(_event: Event, attemptId: number, element: InkstoneModelViewerElement): void {
    if (!isCurrent(attemptId, element) || state.value.phase !== 'loading') return

    clearLoadTimer()
    state.value = reduceViewerState(state.value, { type: 'SUCCESS', attemptId })
  }

  function handleError(event: Event, attemptId: number, element: InkstoneModelViewerElement): void {
    if (!isCurrent(attemptId, element)) return

    const detail = (event as CustomEvent<ModelErrorDetail>).detail
    const reason: ViewerFailureReason = detail?.type === 'webglcontextlost'
      ? 'webgl-context-lost'
      : 'glb-load-failure'
    fail(attemptId, reason)
  }

  function handleFallbackImageError(event: Event): void {
    if (state.value.phase !== 'fallback' || !fallbackSrc.value) return

    const element = event.currentTarget
    if (!(element instanceof HTMLImageElement)) return

    const expectedUrl = fallbackSrc.value
    if (element.currentSrc !== expectedUrl && element.src !== expectedUrl) return

    fallbackSrc.value = ''
    state.value = reduceViewerState(state.value, {
      type: 'FALLBACK_FAILURE',
      attemptId: state.value.attemptId,
    })
  }

  watch(item, (nextItem) => {
    if (nextItem) {
      void start(nextItem)
    } else {
      activeItem.value = null
      cancel()
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    activeAttemptId.value += 1
    clearLoadTimer()
    cancelFallbackPreload()
    fallbackSrc.value = ''
    webglAvailable.value = false
    releaseModel()
    activeItem.value = null
  })

  return {
    state,
    activeSrc,
    fallbackSrc,
    mountKey,
    shouldMountModel,
    setViewerElement,
    retry,
    cancel,
    handleFallbackImageError,
  }
}
