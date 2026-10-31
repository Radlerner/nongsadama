/** @type {import('tailwindcss').Config} */
// 디자인 v5: 흰 바탕 + 로고 3색(농사 nong green · 다 da purple · 마 ma ochre) + NanumSquareRound(400/700/800).
// 쓰는 법은 docs/DESIGN_TOKENS.md. 화면 TSX에 hex를 직접 쓰지 않고, Tailwind 기본 팔레트(gray-*, green-*,
// amber-* …)도 새로 쓰지 않는다 — 아래 토큰만 쓴다.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['NanumSquareRound', 'Apple SD Gothic Neo', 'Noto Sans KR', 'system-ui', 'sans-serif'],
      },
      colors: {
        // 중립 사다리: white → surface → surface-2. 선은 line / line-strong
        surface: { DEFAULT: '#f6f7f9', 2: '#eef0f3' },
        // line/line-strong = 구분선·카드·알약·보조 버튼. line-input = 입력칸·선택칸·꺼진 스위치의 테두리
        // (흰 바탕 3.29:1, surface 3.07:1 → WCAG 1.4.11 비텍스트 대비 3:1)
        line: { DEFAULT: '#e6e8ec', strong: '#d3d6dc', input: '#8a8e96' },
        ink: {
          DEFAULT: '#16181d', // 제목·UI 글자
          body: '#3f434b', // 본문 문단
          muted: '#6b6f78', // 메타·비활성 탭(가장 옅은 글자색)
          disabled: '#9a9ea6', // 비활성 상태 전용
        },
        danger: '#c0392b',
        // 카카오 로그인 디자인 가이드 색. 로고 밖에서 허용되는 유일한 색이며 카카오 로그인 버튼에만 쓴다
        // (bg-kakao + text-kakao-ink).
        kakao: { DEFAULT: '#FEE500', ink: 'rgba(0,0,0,0.85)' },
        // 농사 = 홈·생활정보·농사 도움(green). 주 버튼은 어느 탭이든 nong-600
        nong: {
          50: '#f2f5ec',
          100: '#e4ead8',
          200: '#c9d3b4',
          500: '#70834b',
          600: '#5b6c3a',
          700: '#46552b',
        },
        // 다 = 게시판(purple)
        da: {
          50: '#f3f2fa',
          100: '#e5e3f3',
          200: '#cfcce8',
          500: '#6f6aad',
          600: '#5a5596',
          700: '#47437a',
        },
        // 마 = 이웃(ochre). ma-500은 그래픽 전용(글자색 금지)
        ma: {
          50: '#fcf4ea',
          100: '#f6e3cc',
          200: '#ecc9a3',
          500: '#bc7530',
          600: '#9a5d22',
          700: '#7b4a1a',
        },
      },
      fontSize: {
        hero: ['26px', { lineHeight: '34px', fontWeight: '800', letterSpacing: '-0.4px' }],
        title: ['22px', { lineHeight: '30px', fontWeight: '800', letterSpacing: '-0.3px' }],
        section: ['19px', { lineHeight: '26px', fontWeight: '800', letterSpacing: '-0.2px' }],
        body: ['16px', { lineHeight: '25px', fontWeight: '400' }],
        label: ['15px', { lineHeight: '20px', fontWeight: '700' }],
        small: ['14px', { lineHeight: '21px', fontWeight: '400' }],
        caption: ['13px', { lineHeight: '19px', fontWeight: '400' }],
      },
      boxShadow: {
        // v5: 흰 면에는 그림자 금지. 아래 셋만 쓴다.
        raised: '0 0 0 4px #fff, 0 6px 16px rgba(22,24,29,.18)', // 말하기 원형 버튼 전용
        float: '0 8px 24px rgba(22,24,29,.12)', // 토스트
        sheet: '0 -8px 24px rgba(22,24,29,.12)', // 바텀시트
      },
    },
  },
  plugins: [],
}
