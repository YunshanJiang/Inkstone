export function detectWebGL(): boolean {
  if (typeof document === 'undefined') return false

  const canvas = document.createElement('canvas')
  const contextAttributes: WebGLContextAttributes = {
    alpha: true,
    antialias: false,
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: false,
  }

  try {
    for (const contextType of ['webgl2', 'webgl', 'experimental-webgl'] as const) {
      const context = canvas.getContext(contextType, contextAttributes) as WebGLRenderingContext | null
      if (!context) continue

      context.getExtension('WEBGL_lose_context')?.loseContext()
      return true
    }

    return false
  } catch {
    return false
  } finally {
    canvas.width = 1
    canvas.height = 1
  }
}
