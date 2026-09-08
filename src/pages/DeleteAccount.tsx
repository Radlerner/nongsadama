import { Link } from 'react-router-dom'
import { deletionRequestEmail } from '../config/app'

/**
 * 계정 삭제 안내(Google Play 계정 삭제 URL 제출용 — 인증 없이 직접 접근 가능한 공개 페이지).
 * 법적 고지문 성격이라 i18n 사전 대신 한·영을 정적으로 병기한다(D-020·Privacy와 동일 원칙).
 * 라우트는 AppLayout 밖 독립 화면(로그인·지역 선택과 무관, 리다이렉트 없음).
 */
export function DeleteAccount() {
  const mailto = `mailto:${deletionRequestEmail}?subject=${encodeURIComponent('[NongsaDaMa] 계정 삭제 요청 / Account deletion request')}`

  return (
    <div className="mx-auto max-w-screen-sm bg-brand-cream px-6 py-8 text-gray-900">
      <h1 className="text-xl font-extrabold tracking-tight text-green-800">
        NongsaDaMa 계정 삭제 안내 / Account Deletion
      </h1>
      <p className="mt-1 text-xs text-gray-500">
        개발자/Developer: NongsaDaMa (농사다마) · 앱/App: 농사다마 NongsaDaMa · 시행일/Effective:
        2026-08-29
      </p>

      {/* ── 한국어 ── */}
      <section className="mt-6 space-y-4 text-sm leading-relaxed">
        <h2 className="text-base font-extrabold tracking-tight">한국어</h2>

        <div className="rounded-card border border-gray-100 bg-white px-4 py-4 shadow-card">
          <h3 className="font-bold">1. 계정 삭제를 요청하는 방법</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-gray-700">
            <li>
              <strong>앱 안에서(즉시 삭제)</strong>: 로그인 → <strong>내 정보</strong> →
              <strong> 계정 삭제</strong> → <strong>영구 삭제 확정</strong>. 확인 즉시 계정과 데이터가
              삭제되며 되돌릴 수 없어요.
            </li>
            <li>
              <strong>이메일로(앱 밖에서)</strong>:{' '}
              <a className="font-semibold text-green-800 underline" href={mailto}>
                {deletionRequestEmail}
              </a>
              로 <strong>가입에 사용한 이메일 주소</strong>에서 "계정 삭제 요청"이라고 보내 주세요.
              본인 확인 후 <strong>영업일 기준 7일 이내</strong>에 삭제하고 회신해 드려요.
            </li>
          </ol>
        </div>

        <div className="rounded-card border border-gray-100 bg-white px-4 py-4 shadow-card">
          <h3 className="font-bold">2. 삭제되는 데이터</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-700">
            <li>계정 정보: 이메일, 비밀번호(암호화 저장), 카카오 로그인 연결 정보</li>
            <li>프로필: 닉네임, 언어, 지역(읍·면 단위), 국적 코드, 재배 작목, 이웃 공개 동의</li>
            <li>작성 콘텐츠: 내가 쓴 게시글 전체</li>
            <li>차단 목록, 신고 기록 중 내 계정에 연결된 부분</li>
          </ul>
          <p className="mt-2 text-gray-700">
            위 데이터는 삭제 즉시 서비스 데이터베이스에서 영구 삭제됩니다. 농사다마는 전화번호·정확한
            위치·실명·농장명을 애초에 수집하지 않습니다.
          </p>
        </div>

        <div className="rounded-card border border-gray-100 bg-white px-4 py-4 shadow-card">
          <h3 className="font-bold">3. 일정 기간 보관될 수 있는 데이터</h3>
          <p className="mt-2 text-gray-700">
            관계 법령에서 보관을 요구하는 정보(예: 서비스 접속 기록 등)는 해당 법령이 정한 기간 동안
            다른 데이터와 분리해 안전하게 보관한 뒤 파기합니다. 이 기간에는 계정 복구나 서비스
            이용에 사용되지 않습니다.
          </p>
          <p className="mt-2 text-gray-700">
            익명 이용 통계(Google Analytics·Microsoft Clarity)는 계정과 연결되지 않은 형태로만
            남습니다. 백업 사본에 남은 데이터는 백업 주기(최대 30일)에 따라 순차 삭제됩니다.
          </p>
        </div>

        <p className="text-xs text-gray-500">
          자세한 개인정보 처리 내용은{' '}
          <Link to="/privacy" className="underline">
            개인정보처리방침
          </Link>
          을 참고하세요.
        </p>
      </section>

      {/* ── English ── */}
      <section className="mt-8 space-y-4 text-sm leading-relaxed">
        <h2 className="text-base font-extrabold tracking-tight">English</h2>

        <div className="rounded-card border border-gray-100 bg-white px-4 py-4 shadow-card">
          <h3 className="font-bold">1. How to request account deletion</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-gray-700">
            <li>
              <strong>In the app (immediate)</strong>: Sign in → <strong>My Profile</strong> →
              <strong> Delete account</strong> → <strong>Permanently delete</strong>. Your account and
              data are deleted right away and cannot be recovered.
            </li>
            <li>
              <strong>By email (outside the app)</strong>: Send "Account deletion request" to{' '}
              <a className="font-semibold text-green-800 underline" href={mailto}>
                {deletionRequestEmail}
              </a>{' '}
              <strong>from the email address you signed up with</strong>. After verifying it is you,
              we delete the account within <strong>7 business days</strong> and reply to confirm.
            </li>
          </ol>
        </div>

        <div className="rounded-card border border-gray-100 bg-white px-4 py-4 shadow-card">
          <h3 className="font-bold">2. Data that is deleted</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-700">
            <li>Account: email, password (stored encrypted), Kakao sign-in link</li>
            <li>Profile: nickname, language, region (town level), nationality code, crop, neighbor-visibility consent</li>
            <li>Your content: all posts you wrote</li>
            <li>Your block list and the parts of report records tied to your account</li>
          </ul>
          <p className="mt-2 text-gray-700">
            This data is permanently removed from the service database at the time of deletion.
            NongsaDaMa never collects phone numbers, exact locations, real names, or farm names.
          </p>
        </div>

        <div className="rounded-card border border-gray-100 bg-white px-4 py-4 shadow-card">
          <h3 className="font-bold">3. Data that may be retained for a period</h3>
          <p className="mt-2 text-gray-700">
            Where applicable laws require retention (for example, service access logs), that data is
            kept separately and securely for the legally required period and then destroyed. It is
            not used to restore the account or to provide the service during that time.
          </p>
          <p className="mt-2 text-gray-700">
            Anonymous usage statistics (Google Analytics, Microsoft Clarity) remain only in a form not
            linked to your account. Copies in backups are removed on the backup rotation cycle (up to
            30 days).
          </p>
        </div>

        <p className="text-xs text-gray-500">
          See our{' '}
          <Link to="/privacy" className="underline">
            Privacy Policy
          </Link>{' '}
          for full details.
        </p>
      </section>

      <Link to="/" className="mt-8 inline-block text-sm text-green-800 underline">
        ← 홈으로 / Back to home
      </Link>
    </div>
  )
}
