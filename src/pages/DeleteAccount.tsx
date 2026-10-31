import { Link } from 'react-router-dom'
import { deletionRequestEmail, deletionRequestMailto } from '../config/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  LEGAL_INLINE_LINK,
  LegalBullets,
  LegalHomeLink,
  LegalLangHeading,
  LegalPage,
  LegalSection,
  LegalTitle,
  Strong,
} from '../components/legal/LegalParts'

/**
 * 계정 삭제 안내(Google Play 계정 삭제 URL 제출용 — 인증 없이 직접 접근 가능한 공개 페이지).
 * 법적 고지문 성격이라 i18n 사전 대신 한·영을 정적으로 병기한다(D-020·Privacy와 동일 원칙).
 * 라우트는 AppLayout 밖 독립 화면(로그인·지역 선택과 무관, 리다이렉트 없음).
 *
 * 문안을 고치면 EFFECTIVE_DATE도 같은 날짜로 올린다(재검수 D-032 — 게시일보다 앞선 날짜 금지).
 * 처리 기한은 개인정보 보호법 시행령 제43조③(요구를 받은 날부터 10일 이내, 역일)을 따른다.
 * 디자인 v5: 모양만 바꿨다(문안 그대로) — 흰 바탕, 1px 선 카드, 본문 16/25.
 */
const EFFECTIVE_DATE = '2026-10-23'
const PAGE_TITLE = 'NongsaDaMa 계정 삭제 안내 / Account Deletion'

function EmailLink() {
  return (
    <a className={LEGAL_INLINE_LINK} href={deletionRequestMailto}>
      {deletionRequestEmail}
    </a>
  )
}

export function DeleteAccount() {
  useDocumentTitle(PAGE_TITLE)

  return (
    <LegalPage>
      <LegalTitle
        title={PAGE_TITLE}
        meta={
          <>
            개발자/Developer: NongsaDaMa (농사다마) · 앱/App: 농사다마 NongsaDaMa · 시행일/Effective:{' '}
            {EFFECTIVE_DATE}
          </>
        }
      />

      {/* ── 한국어 ── */}
      <div lang="ko">
        <LegalLangHeading>한국어</LegalLangHeading>

        <LegalSection boxed first as="h3" title="1. 계정 삭제를 요청하는 방법">
          <LegalBullets ordered>
            <li>
              <Strong>앱 안에서(즉시 삭제)</Strong>: 로그인 → <Strong>내 정보</Strong> → 화면 맨 아래
              <Strong> 계정 설정</Strong>의 <Strong>회원탈퇴</Strong> → <Strong>계정 삭제</Strong> → 본인 확인(이메일 가입은 비밀번호, 카카오 가입은
              화면의 숫자 4개 입력) → <Strong>영구 삭제 확정</Strong>. 확인 즉시 계정과 데이터가 삭제되며 되돌릴 수 없어요.
              (1.5 이전 앱: 내 정보 → 계정 삭제 → 영구 삭제 확정)
            </li>
            <li>
              <Strong>이메일로(앱 밖에서)</Strong>: <EmailLink />로{' '}
              <Strong>가입에 사용한 이메일 주소</Strong>에서 "계정 삭제 요청"이라고 보내 주세요.
              본인 확인 후 <Strong>요청일로부터 10일 이내</Strong>(개인정보 보호법 시행령 제43조)에
              삭제하고 결과를 회신해 드려요. 보통은 3일 안에 처리해요.
            </li>
          </LegalBullets>
        </LegalSection>

        <LegalSection boxed as="h3" title="2. 삭제되는 데이터">
          <LegalBullets>
            <li>
              계정 정보: 이메일, 비밀번호(암호화 저장), 카카오 로그인 연결 정보(카카오가 전달한
              닉네임·프로필 이미지 주소 포함)
            </li>
            <li>프로필: 닉네임, 언어, 지역(읍·면 또는 시·군 단위), 국적 코드, 재배 작목, 이웃 공개 동의</li>
            <li>작성 콘텐츠: 내가 쓴 게시글 전체(올린 사진 포함)</li>
            <li>차단 목록, 신고 기록 중 내 계정에 연결된 부분</li>
          </LegalBullets>
          <p>
            위 데이터는 삭제 즉시 서비스 데이터베이스에서 영구 삭제됩니다. 농사다마는 전화번호·정확한
            위치·실명·농장명을 애초에 수집하지 않습니다.
          </p>
          <p>
            카카오 간편로그인으로 가입했다면 농사다마에 저장된 연결 정보는 함께 삭제돼요. 카카오
            계정 쪽 연결은 카카오톡 → 설정 → 카카오계정 → <Strong>연결된 서비스 관리</Strong>에서
            직접 해제할 수 있어요.
          </p>
        </LegalSection>

        <LegalSection boxed as="h3" title="3. 일정 기간 보관될 수 있는 데이터">
          <p>
            관계 법령에서 보관을 요구하는 정보(예: 서비스 접속 기록 등)는 해당 법령이 정한 기간 동안
            다른 데이터와 분리해 안전하게 보관한 뒤 파기합니다. 이 기간에는 계정 복구나 서비스
            이용에 사용되지 않습니다.
          </p>
          <p>
            익명 이용 통계(Google Analytics·Microsoft Clarity)는 계정과 연결되지 않은 형태로만
            남습니다. 백업 사본에 남은 데이터는 백업 주기(최대 30일)에 따라 순차 삭제됩니다.
          </p>
        </LegalSection>

        <p className="mt-4 text-small text-ink-muted">
          자세한 개인정보 처리 내용은{' '}
          <Link to="/privacy" className={LEGAL_INLINE_LINK}>
            개인정보처리방침
          </Link>
          을 참고하세요.
        </p>
      </div>

      {/* ── English ── */}
      <div lang="en">
        <LegalLangHeading>English</LegalLangHeading>

        <LegalSection boxed first as="h3" title="1. How to request account deletion">
          <LegalBullets ordered>
            <li>
              <Strong>In the app (immediate)</Strong>: Sign in → <Strong>Profile</Strong> → scroll to
              <Strong> Account settings</Strong> at the bottom → <Strong>Close my account</Strong> → <Strong>Delete account</Strong> → confirm it is you
              (your password for email accounts, or the 4 numbers shown on screen for Kakao accounts) →
              <Strong> Permanently delete</Strong>. Your account and data are deleted right away and cannot be recovered.
              (App versions before 1.5: Profile → Delete account → Permanently delete.)
            </li>
            <li>
              <Strong>By email (outside the app)</Strong>: Send "Account deletion request" to{' '}
              <EmailLink /> <Strong>from the email address you signed up with</Strong>. After
              verifying it is you, we delete the account and reply{' '}
              <Strong>within 10 days of your request</Strong> (usually within 3 days), as required by
              Korean privacy law.
            </li>
          </LegalBullets>
        </LegalSection>

        <LegalSection boxed as="h3" title="2. Data that is deleted">
          <LegalBullets>
            <li>
              Account: email, password (stored encrypted), Kakao sign-in link (including the
              nickname and profile-image URL Kakao provided)
            </li>
            <li>Profile: nickname, language, region (town or city/county level), nationality code, crop, neighbor-visibility consent</li>
            <li>Your content: all posts you wrote, including photos</li>
            <li>Your block list and the parts of report records tied to your account</li>
          </LegalBullets>
          <p>
            This data is permanently removed from the service database at the time of deletion.
            NongsaDaMa never collects phone numbers, exact locations, real names, or farm names.
          </p>
          <p>
            If you signed up with Kakao, the link stored by NongsaDaMa is deleted as well. You can
            also remove NongsaDaMa on the Kakao side under KakaoTalk → Settings → Kakao Account →{' '}
            <Strong>Connected services</Strong>.
          </p>
        </LegalSection>

        <LegalSection boxed as="h3" title="3. Data that may be retained for a period">
          <p>
            Where applicable laws require retention (for example, service access logs), that data is
            kept separately and securely for the legally required period and then destroyed. It is
            not used to restore the account or to provide the service during that time.
          </p>
          <p>
            Anonymous usage statistics (Google Analytics, Microsoft Clarity) remain only in a form not
            linked to your account. Copies in backups are removed on the backup rotation cycle (up to
            30 days).
          </p>
        </LegalSection>

        <p className="mt-4 text-small text-ink-muted">
          See our{' '}
          <Link to="/privacy" className={LEGAL_INLINE_LINK}>
            Privacy Policy
          </Link>{' '}
          for full details.
        </p>
      </div>

      <LegalHomeLink>홈으로 / Back to home</LegalHomeLink>
    </LegalPage>
  )
}
