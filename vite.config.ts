import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Node 런타임의 process.env 를 @types/node 추가 없이 참조하기 위한 최소 선언.
declare const process: { env: Record<string, string | undefined>; cwd: () => string }

// https://vite.dev/config/
// base: GitHub Pages는 /<repo>/ 하위 경로로 배포되므로 base가 필요하다.
//   배포 워크플로에서 BASE_PATH=/nongsadama/ 를 주입한다.
//   Vercel 배포와 로컬 dev는 BASE_PATH가 없어 기본값 '/'(루트)로 동작한다.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  if (env.REQUIRE_RELEASE_ENV === 'true') {
    const required = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_STT_ENDPOINT',
      'VITE_KAKAO_MAP_KEY',
    ]
    const missing = required.filter((key) => !env[key]?.trim())
    if (missing.length > 0) throw new Error(`Release build requires: ${missing.join(', ')}`)
    if (!/^[0-9a-f]{32}$/i.test(env.VITE_KAKAO_MAP_KEY!)) {
      throw new Error('VITE_KAKAO_MAP_KEY must be a Kakao JavaScript key')
    }
    const sttUrl = new URL(env.VITE_STT_ENDPOINT!)
    if (sttUrl.protocol !== 'https:' || !sttUrl.pathname.endsWith('/functions/v1/stt')) {
      throw new Error('VITE_STT_ENDPOINT must be the HTTPS STT Edge Function URL')
    }
  }
  return {
    base: process.env.BASE_PATH ?? '/',
    plugins: [react()],
  }
})
