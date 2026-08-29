/** @type {import('tailwindcss').Config} */
// 디자인 v0(D-025): 로고 퍼즐 팔레트를 브랜드 토큰으로.
// 기존 코드의 green-* 사용처와의 호환을 위해 green 스케일 자체는 유지하고,
// brand-* 토큰을 추가해 신규/개선 화면부터 점진 적용한다.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // 로고 퍼즐 3색 + 크림 배경(favicon-src 실측 근사값)
          green: '#6b8f4e', // 상단 퍼즐(NONGSA)
          greenDark: '#15803d', // 기존 green-700과 동일 — CTA 연속성 유지
          purple: '#7b7fc7', // 좌하 퍼즐(D)
          orange: '#c9812e', // 우하 퍼즐(M)
          cream: '#f5f1e8', // 로고 배경(앱 배경 후보)
          ink: '#2b2b2b',
        },
      },
      borderRadius: {
        card: '1rem', // 카드 통일 라운드(v1: 12→16px — 손글씨 안내판의 부드러움, DESIGN.md §4)
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
