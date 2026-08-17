import { z } from 'zod'

const idSchema = z.string().regex(/^YT-\d{4,}$/, '编号必须使用 YT-0001 格式')

export const catalogItemSummarySchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1),
  itemUrl: z.string().trim().min(1),
  keywords: z.array(z.string().trim().min(1)).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
}).strict()

export const catalogDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  catalogVersion: z.string().trim().min(1),
  generatedAt: z.string().datetime({ offset: true }),
  items: z.array(catalogItemSummarySchema),
}).strict()

export const itemDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  id: idSchema,
  name: z.string().trim().min(1),
  introduction: z.array(z.string().trim().min(1)).min(1),
  modelUrl: z.string().trim().min(1).refine((value) => /\.glb(?:[?#].*)?$/i.test(value), 'modelUrl 必须指向 GLB 文件'),
  fallbackImage: z.string().trim().min(1).refine((value) => /.(?:png|jpe?g|webp)(?:[?#].*)?$/i.test(value), 'fallbackImage 必须指向图片文件'),
  alt: z.string().trim().min(1),
  view: z.object({
    cameraOrbit: z.string().trim().min(1).optional(),
    cameraTarget: z.string().trim().min(1).optional(),
    fieldOfView: z.string().trim().min(1).optional(),
    exposure: z.number().finite().optional(),
    shadowIntensity: z.number().min(0).max(3).optional(),
  }).strict().optional(),
  metadata: z.object({
    material: z.string().trim().min(1).optional(),
    period: z.string().trim().min(1).optional(),
    dimensions: z.string().trim().min(1).optional(),
    owner: z.string().trim().min(1).optional(),
  }).strict().optional(),
}).strict()
