const configuredAssetBase = import.meta.env.VITE_ASSET_BASE_URL?.trim()
const configuredCatalogUrl = import.meta.env.VITE_CATALOG_URL?.trim()
const configuredModelLoadTimeoutMs = Number(import.meta.env.VITE_MODEL_LOAD_TIMEOUT_MS)
const modelLoadTimeoutMs = Number.isFinite(configuredModelLoadTimeoutMs) && configuredModelLoadTimeoutMs > 0
  ? configuredModelLoadTimeoutMs
  : 30_000
const runtimeBaseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString()

function resolvePublicPath(path: string): string {
  return new URL(path.replace(/^\/+/, ''), runtimeBaseUrl).toString()
}

export const appConfig = {
  catalogUrl: configuredCatalogUrl || resolvePublicPath('/content/catalog.json'),
  assetBaseUrl: configuredAssetBase || runtimeBaseUrl,
  modelLoadTimeoutMs,
  catalogCacheKey: 'inkstone.catalog.v1',
  catalogCacheTtlMs: 7 * 24 * 60 * 60 * 1000,
}
