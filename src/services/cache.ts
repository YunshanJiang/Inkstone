import { appConfig } from '@/app/config'
import { parseCatalog } from '@/domain/catalog/parser'
import type { CatalogDocument } from '@/domain/catalog/types'

interface CachedCatalog {
  cachedAt: number
  document: unknown
}

export function writeCatalogCache(document: CatalogDocument): void {
  try {
    const payload: CachedCatalog = { cachedAt: Date.now(), document }
    localStorage.setItem(appConfig.catalogCacheKey, JSON.stringify(payload))
  } catch {
    // Private mode or a full storage quota should not block the application.
  }
}

export function readCatalogCache(): { document: CatalogDocument; cachedAt: number } | null {
  try {
    const raw = localStorage.getItem(appConfig.catalogCacheKey)
    if (!raw) return null
    const payload = JSON.parse(raw) as CachedCatalog
    if (Date.now() - payload.cachedAt > appConfig.catalogCacheTtlMs) return null
    return { document: parseCatalog(payload.document), cachedAt: payload.cachedAt }
  } catch {
    return null
  }
}
