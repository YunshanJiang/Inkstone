import { appConfig } from '@/app/config'
import { parseCatalog, parseItem } from './parser'
import { fetchJson } from '@/services/httpClient'
import { readCatalogCache, writeCatalogCache } from '@/services/cache'
import type { CatalogDocument, CatalogItemSummary, ItemDocument } from './types'

export async function loadCatalog(signal?: AbortSignal): Promise<{ document: CatalogDocument; source: 'network' | 'cache' }> {
  try {
    const document = parseCatalog(await fetchJson(appConfig.catalogUrl, signal))
    writeCatalogCache(document)
    return { document, source: 'network' }
  } catch (error) {
    if (signal?.aborted) throw error
    const cached = readCatalogCache()
    if (cached) return { document: cached.document, source: 'cache' }
    throw error
  }
}

export async function loadItem(summary: CatalogItemSummary, signal?: AbortSignal): Promise<ItemDocument> {
  return parseItem(await fetchJson(summary.itemUrl, signal), summary.id)
}
