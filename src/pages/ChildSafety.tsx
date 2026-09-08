import { Link } from 'react-router-dom'
import { childSafetyEmail } from '../config/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/**
 * 아동 안전 표준(Google Play Console "Child Safety Standards" 제출용 공개 페이지).
 * 인증·지역 선택·리다이렉트 무관 독립 라우트(App.tsx, AppLayout 밖 — /privacy·/delete-account와 동일).
 * 정책 고지문이라 i18n 사전 대신 한·영을 정적으로 병기한다(D-020 원칙).
 *
 * 문안을 고치면 LAST_UPDATED도 같은 날짜로 올린다(재검수 D-032 — 게시일보다 앞선 날짜 금지).
 */
const LAST_UPDATED = '2026-09-09'
const PAGE_TITLE = 'NongsaDaMa 아동 안전 표준 / Child Safety Standards'
const MAILTO = `mailto:${childSafetyEmail}?subject=${encodeURIComponent('[NongsaDaMa] 아동 안전 신고 / Child safety report')}`

/** 문장 안에서는 인라인, 연락처 블록에서는 44px 터치 높이의 독립 링크(block). */
function EmailLink({ block = false }: { block?: boolean }) {
  return (
    <a
      className={
        block
          ? 'inline-flex min-h-[44px] items-center font-semibold text-green-800 underline'
          : 'font-semibold text-green-800 underline'
      }
      href={MAILTO}
    >
      {childSafetyEmail}
    </a>
  )
}

export function ChildSafety() {
  useDocumentTitle(PAGE_TITLE)

  return (
    <div className="mx-auto min-h-screen max-w-screen-sm bg-brand-cream px-6 py-8 text-gray-900 md:max-w-2xl">
      <h1 className="text-xl font-extrabold tracking-tight text-green-800 md:text-2xl">{PAGE_TITLE}</h1>
      <p className="mt-1 text-xs text-gray-500">
        마지막 업데이트 / Last updated: {LAST_UPDATED} · 앱/App: 농사다마 NongsaDaMa
      </p>

      {/* ── 한국어 ── */}
      <section lang="ko" className="mt-6 space-y-3 text-sm leading-relaxed">
        <h2 className="text-base font-extrabold tracking-tight">한국어</h2>
        <div className="space-y-3 rounded-card border border-gray-100 bg-white px-4 py-4 shadow-card text-gray-800">
          <p>
            농사다마는 아동 성적 학대 및 착취(CSAE)와 아동 성적 학대물(CSAM)을 어떠한 형태로도
            허용하지 않습니다.
          </p>
          <p>
            사용자는 서비스 내 신고 기능 또는 <EmailLink />을 통해 아동 안전과 관련된 우려사항,
            부적절한 콘텐츠 또는 불법적인 콘텐츠를 신고할 수 있습니다.
          </p>
          <p>
            신고된 콘텐츠와 계정은 운영정책에 따라 검토되며, 관련 정책 또는 법령을 위반한 경우 콘텐츠
            삭제, 계정 제한 또는 이용정지 등의 조치가 이루어질 수 있습니다.
          </p>
          <p>
            농사다마는 적용 가능한 아동 안전 관련 법률과 규정을 준수하며, 법적으로 필요한 경우 관계
            기관 및 수사기관의 적법한 요청에 협조합니다.
          </p>
          <p className="border-t border-gray-100 pt-3">
            <strong>아동 안전 관련 문의 및 신고:</strong>
            <br />
            <EmailLink block />
          </p>
        </div>
      </section>

      {/* ── English ── */}
      <section lang="en" className="mt-8 space-y-3 text-sm leading-relaxed">
        <h2 className="text-base font-extrabold tracking-tight">English</h2>
        <div className="space-y-3 rounded-card border border-gray-100 bg-white px-4 py-4 shadow-card text-gray-800">
          <p>
            NongsaDaMa has zero tolerance for child sexual abuse and exploitation (CSAE) and child
            sexual abuse material (CSAM).
          </p>
          <p>
            Users may report child-safety concerns, inappropriate content, or illegal content through
            the reporting features available in the service or by contacting <EmailLink />.
          </p>
          <p>
            Reported content and accounts may be reviewed under our policies. Content may be removed
            and accounts may be restricted or suspended when they violate our policies or applicable
            laws.
          </p>
          <p>
            NongsaDaMa complies with applicable child safety laws and regulations and cooperates with
            relevant authorities in response to valid legal requests when required.
          </p>
          <p className="border-t border-gray-100 pt-3">
            <strong>Child safety contact and reporting:</strong>
            <br />
            <EmailLink block />
          </p>
        </div>
      </section>

      <Link
        to="/"
        className="mt-8 inline-flex min-h-[44px] items-center text-sm text-green-800 underline"
      >
        <span aria-hidden="true">← </span>홈으로 돌아가기 / Back to home
      </Link>
    </div>
  )
}
