export type ViewerPhase = 'idle' | 'loading' | 'ready' | 'error' | 'fallback'

export type ViewerFailureReason =
  | 'glb-load-failure'
  | 'glb-parse-failure'
  | 'webgl-unavailable'
  | 'webgl-context-lost'
  | 'timeout'
  | 'fallback-load-failure'

export interface ViewerSnapshot {
  phase: ViewerPhase
  attemptId: number
  itemId: string | null
  progress: number | null
  failureReason?: ViewerFailureReason
}

export type ViewerEvent =
  | { type: 'START'; attemptId: number; itemId: string }
  | { type: 'PROGRESS'; attemptId: number; value: number }
  | { type: 'SUCCESS'; attemptId: number }
  | { type: 'FAILURE'; attemptId: number; reason: ViewerFailureReason }
  | { type: 'FALLBACK_READY'; attemptId: number }
  | { type: 'FALLBACK_FAILURE'; attemptId: number }
  | { type: 'CANCEL'; attemptId: number }
