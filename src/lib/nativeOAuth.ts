import { getSupabaseClient } from './supabase'

export const NATIVE_OAUTH_REDIRECT = 'com.nongsadama.myapp://auth/callback'

export function readNativeOAuthCode(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'com.nongsadama.myapp:' || url.host !== 'auth' || url.pathname !== '/callback'
    || url.username || url.password) return null
  const codes = url.searchParams.getAll('code')
  if (url.hash || url.searchParams.has('error') || url.searchParams.has('error_code')
    || codes.length !== 1 || !codes[0].trim() || codes[0].length > 2048) {
    throw new Error('oauth-callback-invalid')
  }
  return codes[0]
}

const exchanges = new Map<string, Promise<boolean>>()

export async function completeNativeOAuth(raw: string): Promise<boolean> {
  const code = readNativeOAuthCode(raw)
  if (code === null) return false
  const existing = exchanges.get(code)
  if (existing) return existing
  const exchange = (async () => {
    const { data, error } = await getSupabaseClient().auth.exchangeCodeForSession(code)
    if (error || !data.session?.user) throw new Error('oauth-exchange-failed')
    return true
  })()
  exchanges.set(code, exchange)
  return exchange
}
