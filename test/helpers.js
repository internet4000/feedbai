/** Fake fetch: routes are [predicate(url, init), body] pairs; records calls. */
export const fakeFetch = (routes) => {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, init })
    const route = routes.find(([match]) => match(url, init))
    if (!route) return new Response('{"error":"no route"}', { status: 404 })
    const [, body, status = 200] = route
    return new Response(JSON.stringify(typeof body === 'function' ? body(url, init) : body), { status })
  }
  return Object.assign(impl, { calls })
}
