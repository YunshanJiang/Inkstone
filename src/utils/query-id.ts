export function normalizeQueryId(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return null
  const normalized = raw.trim().toUpperCase()
  return normalized || null
}

export function hasValidIdSyntax(value: string | null): boolean {
  return Boolean(value && /^YT-\d{4,}$/.test(value))
}
