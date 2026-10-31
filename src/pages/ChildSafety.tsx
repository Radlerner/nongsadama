import type { ReactNode } from 'react'
import { childSafetyEmail } from '../config/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  LEGAL_INLINE_LINK,
  LegalHomeLink,
  LegalLangHeading,
  LegalPage,
  LegalSection,
  LegalTitle,
  Strong,
} from '../components/legal/LegalParts'

/**
 * 아동 안전 표준(Google Play Console "Child Safety Standards" 제출용 공개 페이지).
 * 인증·지역 선택·리다이렉트 무관 독립 라우트(App.tsx, AppLayout 밖 — /privacy·/delete-account와 동일).
 * 정책 고지문이라 i18n 사전 대신 한·영을 정적으로 병기한다(D-020 원칙).
 *
 * 문안을 고치면 LAST_UPDATED도 같은 날짜로 올린다(재검수 D-032 — 게시일보다 앞선 날짜 금지).
 * 디자인 v5: 모양만 바꿨다(문안 그대로) — 흰 바탕, 1px 선 카드, 본문 16/25.
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
          ? 'inline-flex min-h-11 items-center font-bold text-nong-600 underline underline-offset-2 [overflow-wrap:anywhere]'
          : LEGAL_INLINE_LINK
      }
      href={MAILTO}
    >
      {childSafetyEmail}
    </a>
  )
}

/** 연락처 줄: 카드 안 마지막, 위 1px 선 */
function Contact({ children }: { children: ReactNode }) {
  return <p className="border-t border-line pt-3">{children}</p>
}

export function ChildSafety() {
  useDocumentTitle(PAGE_TITLE)

  return (
    <LegalPage>
      <LegalTitle title={PAGE_TITLE} meta={<>마지막 업데이트 / Last updated: {LAST_UPDATED} · 앱/App: 농사다마 NongsaDaMa</>} />

      {/* ── 한국어 ── */}
      <div lang="ko">
        <LegalLangHeading>한국어</LegalLangHeading>
        <LegalSection boxed first>
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
          <Contact>
            <Strong>아동 안전 관련 문의 및 신고:</Strong>
            <br />
            <EmailLink block />
          </Contact>
        </LegalSection>
      </div>

      {/* ── English ── */}
      <div lang="en">
        <LegalLangHeading>English</LegalLangHeading>
        <LegalSection boxed first>
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
          <Contact>
            <Strong>Child safety contact and reporting:</Strong>
            <br />
            <EmailLink block />
          </Contact>
        </LegalSection>
      </div>

      <LegalHomeLink>홈으로 돌아가기 / Back to home</LegalHomeLink>
    </LegalPage>
  )
}
