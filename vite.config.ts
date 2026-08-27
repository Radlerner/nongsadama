import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Node 런타임의 process.env 를 @types/node 추가 없이 참조하기 위한 최소 선언.
declare const process: { env: Record<string, string | undefined> }

// https://vite.dev/config/
// base: GitHub Pages는 /<repo>/ 하위 경로로 배포되므로 base가 필요하다.
//   배포 워크플로에서 BASE_PATH=/nongsadama/ 를 주입한다.
//   Vercel 배포와 로컬 dev는 BASE_PATH가 없어 기본값 '/'(루트)로 동작한다.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    // v0 프리뷰는 매번 다른 임시 서브도메인(sb-xxxx.vercel.run)에서 서빙되므로
    // 와일드카드로 허용한다. 로컬/배포 환경에는 영향 없음.
    allowedHosts: ['.vercel.run'],
  },
})
