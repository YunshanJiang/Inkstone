import { appConfig } from '@/app/config'

export function resolveAssetUrl(value: string): string {
  const url = new URL(value, appConfig.assetBaseUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('资源 URL 必须使用 HTTP 或 HTTPS')
  }
  return url.toString()
}
