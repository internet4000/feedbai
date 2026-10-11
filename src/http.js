import { t } from './i18n.js'

// GitHub rejects requests without one, and Workers' fetch (unlike Node's) sends none.
const USER_AGENT = 'feedbai (+https://github.com/internet4000/feedbai)'

/** fetch() + JSON with readable errors. `fetchImpl` is injectable for tests. */
export const request = async (url, { method = 'GET', token, body, fetchImpl = fetch } = {}) => {
  const response = await fetchImpl(url, {
    method,
    headers: {
      'user-agent': USER_AGENT,
      ...(token && { authorization: `Bearer ${token}` }),
      ...(body && { 'content-type': 'application/json' }),
    },
    body: body && JSON.stringify(body),
  })
  const text = await response.text()
  let data
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  if (!response.ok) {
    const error = new Error(
      t('error.http', { method, url: url.split('?')[0], status: response.status, body: text.slice(0, 200) }),
    )
    Object.assign(error, { status: response.status, data })
    throw error
  }
  return data
}

export const query = (params) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    for (const v of [value].flat()) search.append(key, String(v))
  }
  return search.toString()
}
