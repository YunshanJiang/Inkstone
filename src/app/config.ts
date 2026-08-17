const configuredAssetBase = import.meta.env.VITE_ASSET_BASE_URL?.trim()
const configuredModelLoadTimeoutMs = Number(import.meta.env.VITE_MODEL_LOAD_TIMEOUT_MS)
const modelLoadTimeoutMs = Number.isFinite(configuredModelLoadTimeoutMs) && configuredModelLoadTimeoutMs > 0
  ? configuredModelLoadTimeoutMs
  : 30_000

export const appConfig = {
  catalogUrl: import.meta.env.VITE_CATALOG_URL?.trim() || '/content/catalog.json',
  assetBaseUrl: configuredAssetBase || window.location.origin,
  modelLoadTimeoutMs,
  catalogCacheKey: 'inkstone.catalog.v1',
  catalogCacheTtlMs: 7 * 24 * 60 * 60 * 1000,
}
