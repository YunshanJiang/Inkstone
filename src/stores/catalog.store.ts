import { computed, reactive, ref, shallowRef } from 'vue'
import { loadCatalog, loadItem } from '@/domain/catalog/catalog.repository'
import type { CatalogDocument, CatalogItemSummary, ItemDocument } from '@/domain/catalog/types'

type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error'

const status = ref<CatalogStatus>('idle')
const source = ref<'network' | 'cache' | null>(null)
const error = shallowRef<Error | null>(null)
const document = shallowRef<CatalogDocument | null>(null)
const currentItem = shallowRef<ItemDocument | null>(null)
const itemError = shallowRef<Error | null>(null)
const itemLoading = ref(false)
const itemCache = reactive(new Map<string, ItemDocument>())
let catalogController: AbortController | null = null
let itemController: AbortController | null = null
let itemRequestId = 0

const items = computed(() => document.value?.items ?? [])

async function load(): Promise<void> {
  if (status.value === 'loading') return
  catalogController?.abort()
  catalogController = new AbortController()
  status.value = 'loading'
  error.value = null

  try {
    const result = await loadCatalog(catalogController.signal)
    document.value = result.document
    source.value = result.source
    status.value = 'ready'
  } catch (cause) {
    if (catalogController.signal.aborted) return
    error.value = cause instanceof Error ? cause : new Error('目录加载失败')
    status.value = 'error'
  }
}

async function selectItem(id: string | null): Promise<void> {
  itemController?.abort()
  itemRequestId += 1
  const requestId = itemRequestId
  currentItem.value = null
  itemError.value = null

  if (!id) {
    itemLoading.value = false
    return
  }

  const summary = items.value.find((item) => item.id === id)
  if (!summary) {
    itemError.value = new Error(`未找到展件：${id}`)
    itemLoading.value = false
    return
  }

  const cached = itemCache.get(id)
  if (cached) {
    currentItem.value = cached
    itemLoading.value = false
    return
  }

  itemController = new AbortController()
  itemLoading.value = true

  try {
    const item = await loadItem(summary, itemController.signal)
    if (requestId !== itemRequestId) return
    itemCache.set(id, item)
    currentItem.value = item
  } catch (cause) {
    if (requestId !== itemRequestId || itemController.signal.aborted) return
    itemError.value = cause instanceof Error ? cause : new Error('展件资料加载失败')
  } finally {
    if (requestId === itemRequestId) itemLoading.value = false
  }
}

function findSummary(id: string | null): CatalogItemSummary | null {
  if (!id) return null
  return items.value.find((item) => item.id === id) ?? null
}

export function useCatalogStore() {
  return {
    status,
    source,
    error,
    document,
    items,
    currentItem,
    itemError,
    itemLoading,
    load,
    selectItem,
    findSummary,
  }
}
