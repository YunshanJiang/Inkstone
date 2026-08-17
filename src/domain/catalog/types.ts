export interface CatalogDocument {
  schemaVersion: 1
  catalogVersion: string
  generatedAt: string
  items: CatalogItemSummary[]
}

export interface CatalogItemSummary {
  id: string
  title: string
  itemUrl: string
  keywords?: string[]
  sortOrder?: number
}

export interface ItemDocument {
  schemaVersion: 1
  id: string
  title: string
  description: string[]
  model: ModelAsset
  view?: ViewPreset
  metadata?: ItemMetadata
}

export interface ModelAsset {
  glbUrl: string
  fallbackImage: string
  alt: string
}

export interface ViewPreset {
  cameraOrbit?: string
  cameraTarget?: string
  fieldOfView?: string
  exposure?: number
  shadowIntensity?: number
}

export interface ItemMetadata {
  material?: string
  period?: string
  dimensions?: string
  owner?: string
}
