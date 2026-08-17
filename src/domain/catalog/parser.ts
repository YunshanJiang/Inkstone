import { catalogDocumentSchema, itemDocumentSchema } from './schema'
import type { CatalogDocument, ItemDocument } from './types'

export function parseCatalog(value: unknown): CatalogDocument {
  const parsed = catalogDocumentSchema.parse(value)
  const ids = new Set<string>()

  for (const item of parsed.items) {
    if (ids.has(item.id)) {
      throw new Error(`目录中存在重复编号：${item.id}`)
    }
    ids.add(item.id)
  }

  parsed.items.sort((left, right) => {
    const order = (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER)
    return order || left.id.localeCompare(right.id)
  })

  return parsed
}

export function parseItem(value: unknown, expectedId?: string): ItemDocument {
  const parsed = itemDocumentSchema.parse(value)
  if (expectedId && parsed.id !== expectedId) {
    throw new Error(`条目编号不匹配：期望 ${expectedId}，实际 ${parsed.id}`)
  }
  return {
    schemaVersion: parsed.schemaVersion,
    id: parsed.id,
    title: parsed.name,
    description: parsed.introduction,
    model: {
      glbUrl: parsed.modelUrl,
      fallbackImage: parsed.fallbackImage,
      alt: parsed.alt,
    },
    view: parsed.view,
    metadata: parsed.metadata,
  }
}
