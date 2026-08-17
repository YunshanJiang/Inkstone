import { appConfig } from '@/app/config'

export function resolveAssetUrl(value: string): string {
  const trimmedValue = value.trim()
  const isAbsoluteUrl = /^[a-z][a-z\d+\-.]*:/i.test(trimmedValue) || trimmedValue.startsWith('//')
  const url = new URL(
    isAbsoluteUrl ? trimmedValue : trimmedValue.replace(/^\/+/, ''),
    appConfig.assetBaseUrl,
  )
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('资源 URL 必须使用 HTTP 或 HTTPS')
  }
  return url.toString()
}
