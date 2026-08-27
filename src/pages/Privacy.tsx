import { Link } from 'react-router-dom'
import { operatorEmail } from '../config/app'

/**
 * 개인정보처리방침(PRD v1.5 §10-J, Google Play 심사 필수 URL).
 * 법적 고지 문서로서 번역 오차 위험을 줄이기 위해 한국어 원문을 기준으로 두고
 * 하단에 영어 요약을 병기한다(i18n 사전 미사용 — 의도된 예외, D-020).
 */
export function Privacy() {
  return (
    <div className="mx-auto max-w-screen-sm bg-white px-6 py-8 text-gray-900">
      <h1 className="text-xl font-bold text-green-700">농사다마 개인정보처리방침</h1>
      <p className="mt-1 text-xs text-gray-500">시행일: 2026-08-27 · 문의: {operatorEmail}</p>

      <section className="mt-6 space-y-4 text-sm leading-relaxed">
        <div>
          <h2 className="font-bold">1. 수집하는 정보</h2>
          <ul className="mt-1 list-disc pl-5 text-gray-700">
            <li>계정: 이메일 주소, 닉네임, 비밀번호(암호화 저장, Supabase Auth)</li>
            <li>카카오 간편로그인 시: 카카오가 제공하는 닉네임·이메일(선택 동의)·프로필 이미지</li>
            <li>선택 입력: 언어, 지역(읍·면 단위), 국적 코드, 재배 작목 — 모두 입력하지 않아도 이용 가능</li>
            <li>작성 콘텐츠: 게시글(제목·본문)</li>
            <li>자동 수집: 서비스 이용 기록(하단 3항의 분석 도구)</li>
          </ul>
          <p className="mt-1 text-gray-700">
            <strong>수집하지 않는 것</strong>: 전화번호, 정확한 위치(GPS 좌표는 지도 표시에만 쓰이고
            서버에 저장하지 않습니다), 실명, 농장명, 숙소 위치.
          </p>
        </div>

        <div>
          <h2 className="font-bold">2. 이용 목적</h2>
          <p className="text-gray-700">
            지역 생활정보 제공, 게시판·이웃 연결 기능 제공, 서비스 개선(익명 통계). 이웃 찾기
            노출은 별도 동의(opt-in)한 사용자 간에만 이루어집니다.
          </p>
        </div>

        <div>
          <h2 className="font-bold">3. 제3자 서비스</h2>
          <ul className="mt-1 list-disc pl-5 text-gray-700">
            <li>Supabase(데이터베이스·인증, 서울 리전) — 계정·게시글 저장</li>
            <li>카카오(지도, 간편로그인)</li>
            <li>OpenStreetMap(지도 타일 — 카카오맵 대체 시)</li>
            <li>Google Analytics 4, Microsoft Clarity(익명 이용 통계·화면 사용성 분석)</li>
            <li>AddToAny(공유 버튼)</li>
            <li>음성 입력 사용 시: 브라우저 제공사(예: Google)의 음성 인식 서버로 음성이 전송되며
              농사다마 서버에는 저장되지 않습니다(사용 전 안내 후 동의).</li>
          </ul>
          <p className="mt-1 text-gray-700">
            AI 크롤러의 게시판 학습 수집은 robots 정책으로 거부하고 있습니다.
          </p>
          <p className="mt-1 text-gray-700">
            서비스는 Cloudflare·GitHub Pages(미국 등 국외 서버)에서 호스팅되며, 위 분석
            도구(GA4·Clarity)와 공유 버튼(AddToAny) 이용 기록도 해당 사업자의 국외 서버로
            전송·처리됩니다. 계정·게시글 데이터 자체는 Supabase 서울 리전에 저장됩니다.
          </p>
        </div>

        {/* Play 심사 제출용 삭제 요청 리소스 — https://nongsadama.app/privacy#delete (재검수 P1-1) */}
        <div id="delete" className="rounded-md border border-green-200 bg-green-50 px-4 py-3">
          <h2 className="font-bold">4. 계정 및 데이터 삭제</h2>
          <p className="mt-1 text-gray-700">
            <strong>앱 안에서</strong>: 내 정보 → 계정 삭제 버튼으로 즉시 영구 삭제할 수 있습니다.
            <br />
            <strong>앱 밖에서(웹 요청)</strong>: 이메일{' '}
            <a className="underline" href={`mailto:${operatorEmail}?subject=${encodeURIComponent('[농사다마] 계정 삭제 요청')}`}>
              {operatorEmail}
            </a>
            로 가입 이메일을 보내 요청하면 확인 후 지체 없이 삭제합니다.
          </p>
          <p className="mt-2 text-gray-700">
            <strong>삭제되는 데이터(전부)</strong>: 계정(이메일·비밀번호·카카오 연결 정보),
            프로필(닉네임·언어·지역·국적·작목), 작성한 게시글 전체.
            <br />
            <strong>삭제 후 보관하는 데이터</strong>: 없습니다. 익명 통계(GA4·Clarity)는 계정과
            연결되지 않은 상태로만 남습니다.
            <br />
            개별 게시글을 삭제한 경우 공개 목록에서 즉시 제외되며, 계정 삭제 시 함께 완전
            파기됩니다.
          </p>
        </div>

        <div>
          <h2 className="font-bold">5. 이용자 권리</h2>
          <p className="text-gray-700">
            언제든 프로필에서 국적·작목·이웃 공개 동의를 수정·철회할 수 있습니다. 열람·정정·삭제
            요청은 위 이메일로 연락 주시면 처리합니다.
          </p>
        </div>

        <div className="rounded-md bg-gray-50 px-4 py-3">
          <h2 className="font-bold">English summary</h2>
          <p className="mt-1 text-gray-700">
            NongsaDama collects: email, nickname, optional language/town-level region/nationality
            code/crop, and your posts. Kakao sign-in shares your Kakao nickname, email (optional)
            and profile image. We never collect phone numbers or exact GPS locations. Third
            parties: Supabase (Seoul), Kakao, OpenStreetMap, Google Analytics 4, Microsoft
            Clarity, AddToAny, and your browser vendor for voice input. Hosting and analytics run
            on overseas servers (US); account and post data are stored in Supabase&apos;s Seoul
            region. Delete your account anytime in Profile → Delete account — this permanently
            removes your account, profile and all posts, and nothing linked to you is retained —
            or request deletion by email: {operatorEmail}. You can change or withdraw optional
            fields and neighbor-visibility consent anytime in your profile.
          </p>
        </div>
      </section>

      <Link to="/" className="mt-8 inline-block text-sm text-green-700 underline">
        ← 홈으로 / Back to home
      </Link>
    </div>
  )
}
