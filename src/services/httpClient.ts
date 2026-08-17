export async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    method: 'GET',
    signal,
    headers: { Accept: 'application/json' },
    cache: url.endsWith('catalog.json') ? 'no-cache' : 'default',
  })

  if (!response.ok) {
    throw new Error(`数据请求失败：${response.status}`)
  }

  return response.json()
}
