import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export function useFullscreen(target: Ref<HTMLElement | null>) {
  const isFullscreen = ref(false)
  const isPseudoFullscreen = ref(false)

  function syncNativeFullscreen(): void {
    if (isPseudoFullscreen.value) return
    isFullscreen.value = document.fullscreenElement === target.value
  }

  function setPseudoFullscreen(value: boolean): void {
    isPseudoFullscreen.value = value
    isFullscreen.value = value
    target.value?.classList.toggle('is-pseudo-fullscreen', value)
    document.body.classList.toggle('inkstone-no-scroll', value)
  }

  async function enterFullscreen(): Promise<void> {
    const element = target.value
    if (!element) return

    if (document.fullscreenEnabled && typeof element.requestFullscreen === 'function') {
      try {
        await element.requestFullscreen()
        isFullscreen.value = true
        return
      } catch {
        // In-app browsers can expose the API but reject the request.
      }
    }

    setPseudoFullscreen(true)
  }

  async function exitFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } finally {
        isFullscreen.value = false
      }
    }
    if (isPseudoFullscreen.value) setPseudoFullscreen(false)
  }

  async function toggleFullscreen(): Promise<void> {
    if (isFullscreen.value) {
      await exitFullscreen()
    } else {
      await enterFullscreen()
    }
  }

  onMounted(() => document.addEventListener('fullscreenchange', syncNativeFullscreen))
  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', syncNativeFullscreen)
    document.body.classList.remove('inkstone-no-scroll')
  })

  return {
    isFullscreen,
    isPseudoFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
  }
}
