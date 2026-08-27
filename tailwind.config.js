/** @type {import('tailwindcss').Config} */
// 디자인 v0(D-030): 리브랜딩 — Deep Forest Green / Warm Apricot / Warm Gray 팔레트.
// green/amber/gray 스케일 자체를 브랜드 컬러 기준으로 재정의해 앱 전체(기존
// green-*/amber-*/gray-* 사용처 24개 파일)가 한 번에 새 브랜드 컬러를 따르게 한다.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary: Deep Forest Green (#1B4D3E 앵커, 700)
        green: {
          50: '#EAF4F0',
          100: '#CFE6DC',
          200: '#A3D0BE',
          300: '#77B9A0',
          400: '#4E9C80',
          500: '#327D64',
          600: '#22624F',
          700: '#1B4D3E',
          800: '#143A2F',
          900: '#0E2921',
        },
        // Secondary: Warm Apricot (#E87A40 앵커, 500)
        amber: {
          50: '#FDF1E9',
          100: '#FBDFC9',
          200: '#F6C09A',
          300: '#F1A06B',
          400: '#EC8A55',
          500: '#E87A40',
          600: '#D3652C',
          700: '#AC5124',
          800: '#7E3B1A',
          900: '#542712',
        },
        // Neutral: Light Warm Gray(50) ~ Dark Slate Gray(900)
        gray: {
          50: '#F8F9FA',
          100: '#F1F2F0',
          200: '#E4E5E1',
          300: '#D1D3CC',
          400: '#A8ABA1',
          500: '#7D8074',
          600: '#5C5F55',
          700: '#45473F',
          800: '#2E302B',
          900: '#1F2937',
        },
        brand: {
          greenDark: '#1B4D3E', // Primary — 주요 CTA(기존 사용처 그대로 전역 반영)
          purple: '#6C5CE7', // Accent(Soft Violet) — 지도 "지역 묶음 핀" 등 강조용
        },
      },
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '0.75rem', // 카드 통일 라운드(v0)
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
