import type { ViewerEvent, ViewerSnapshot } from './types'

export function createIdleViewerState(attemptId = 0): ViewerSnapshot {
  return {
    phase: 'idle',
    attemptId,
    itemId: null,
    progress: null,
  }
}

export function reduceViewerState(state: ViewerSnapshot, event: ViewerEvent): ViewerSnapshot {
  if (
    'attemptId' in event
    && event.type !== 'START'
    && event.type !== 'CANCEL'
    && event.attemptId !== state.attemptId
  ) {
    return state
  }

  switch (event.type) {
    case 'START':
      if (event.attemptId <= state.attemptId) return state
      return {
        phase: 'loading',
        attemptId: event.attemptId,
        itemId: event.itemId,
        progress: 0,
      }
    case 'PROGRESS':
      if (state.phase !== 'loading') return state
      return { ...state, progress: Math.min(1, Math.max(0, event.value)) }
    case 'SUCCESS':
      if (state.phase !== 'loading') return state
      return { ...state, phase: 'ready', progress: 1, failureReason: undefined }
    case 'FAILURE':
      if (state.phase !== 'loading' && state.phase !== 'ready') return state
      return { ...state, phase: 'error', failureReason: event.reason }
    case 'FALLBACK_READY':
      if (state.phase !== 'error') return state
      return { ...state, phase: 'fallback', progress: null }
    case 'FALLBACK_FAILURE':
      if (state.phase !== 'error' && state.phase !== 'fallback') return state
      return {
        ...state,
        phase: 'error',
        failureReason: 'fallback-load-failure',
        progress: null,
      }
    case 'CANCEL':
      return createIdleViewerState(event.attemptId)
  }
}
