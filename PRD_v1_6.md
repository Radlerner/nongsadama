# 농사다마 PRD v1.6 — 고도화: 비슷한 게시물 찾기 + 안전한 연락 연결 (초안)

**작성일**: 2026-08-02
**문서 상태**: ⚠️ 승인 대기 초안. **구현은 새 세션에서 이 문서를 기준으로 시작한다**(§5 인수인계).
**기준**: v1.3(품질·비용·개인정보) + v1.4(매칭) + v1.5(지도·라우터) 위의 증분.

---

## 1. 비슷한 게시물 찾기 (임베딩 기반)

### 1.1 목표
게시글 상세 하단에 "비슷한 글" 3~5건 추천 → 질문 중복 감소, 과거 답변 재활용, 체류 시간 증가.

### 1.2 임베딩 공급자 결정 (핵심 트레이드오프)

| 선택지 | 비용 | 개인정보 | 다국어 품질 |
|---|---|---|---|
| **A. Supabase 내장 gte-small (권장)** | **0원** (Edge Function 내장 `Supabase.ai`) | **UGC가 인프라 밖으로 안 나감** — D-017(학습봇 /board 차단) 정합 | 영어 중심 — ko·vi 혼합 텍스트 품질 제한적(§1.5) |
| B. OpenAI text-embedding-3-small | 유료(키·빌링 필요) | **게시글 제3자 전송** — D-017 취지 충돌, 처리방침 고지+동의 필요 | 다국어 우수 |

**권고: A로 시작**(무료·정책 정합·키 불필요), 파일럿에서 추천 품질이 부족하면 B를 별도 승인으로.
참고: Anthropic은 임베딩 API를 제공하지 않는다(공식 권장은 Voyage AI — 역시 유료·제3자).

### 1.3 스키마·쿼리 (Supabase 방식)

```sql
-- 마이그레이션: pgvector + 임베딩 컬럼 (gte-small = 384차원)
create extension if not exists vector;
alter table public.posts add column if not exists embedding vector(384);

-- 유사 글 검색 RPC (anon 실행 가능해야 함 — published만, RLS와 이중 필터)
create or replace function public.match_posts(
  query_embedding vector(384), match_count int default 5, exclude_id uuid default null
) returns table (id uuid, title text, similarity float)
language sql stable
as $$
  select p.id, p.title, 1 - (p.embedding <=> query_embedding) as similarity
  from public.posts p
  where p.status = 'published' and p.embedding is not null
    and (exclude_id is null or p.id <> exclude_id)
  order by p.embedding <=> query_embedding
  limit match_count;
$$;
```
- 인덱스(hnsw)는 글 수백 건 전까지 불필요 — 순차 스캔으로 충분.
- **RLS 주의**: RPC는 definer가 아닌 invoker로 두고 posts RLS(published or own)가 그대로 적용되게 한다.

### 1.4 파이프라인

1. **Edge Function `embed-post`**: 글 작성/수정 시 클라이언트가 호출(글 id 전달) → 함수가
   본문을 읽어 gte-small 임베딩 생성 → `posts.embedding` UPDATE(service_role은 함수 내부만).
   실패해도 글 저장은 성공(임베딩은 비동기 보강 — 추천만 빠짐).
2. **상세 화면**: 해당 글 embedding으로 `match_posts` RPC 호출 → "비슷한 글" 카드 3건.
3. 기존 글 백필: 운영 스크립트 1회(현재 ~2건이라 즉시).
- 배포는 MCP `deploy_edge_function`으로 가능(이 환경에서 실행 가능 확인됨).

### 1.5 정직한 한계
- 데이터 현실: 현재 공개 글 ~2건 — **추천이 의미를 가지려면 파일럿 시딩/실사용 필요**.
  기능은 준비하되 "글 5건 미만이면 섹션 숨김" 조건을 완료 기준에 포함.
- gte-small의 한국어·베트남어 품질은 검증 필요 — 완료 조건에 "ko 테스트 글 6건으로
  유사쌍이 상위 3위 안에 드는지 수동 평가" 포함. 미달 시 B(유료) 재논의.

---

## 2. 게시물 작성자 연락 연결 (설계 수정안)

### 2.1 원요청과 충돌 지점 (그대로 구현 불가)
- 원요청: 작성자 연락정보(카톡·왓츠앱·텔레그램) 확인 + **광고 시청 조건**.
- 충돌: ① WhatsApp=전화번호 기반 → v1.3 §9 "전화번호 요구 금지"·v1.4 §4 "연락처 미공개" 위반
  ② 광고는 v1.3 §3.3 데모 제외 + 취약층의 연락처를 광고 뒤에 두는 것은 안전 관점 부적절
  ③ 리워드 광고는 광고망 계정·심사·SDK 필요(웹 지원 제한적).

### 2.2 수정 설계: "전화 비노출 메신저 링크, opt-in, 상호동의 열람"
- `profiles.messenger_link text null` — **전화번호가 드러나지 않는 링크만** 허용
  (카카오 오픈채팅 링크 `open.kakao.com/...`, 텔레그램 `t.me/사용자명`). 형식 검증으로
  전화번호 패턴 입력 차단. WhatsApp은 전화 노출이라 **제외**.
- **별도 opt-in 플래그** `is_contact_visible`(기본 false) — 기존 `is_matching_visible`과 분리
  (D-012 재검수의 "단일 플래그 과겸용" 지적 준수). 동의 문구에 노출 범위 명시.
- **열람 조건**: 로그인 + 열람자 본인도 연락 공개 동의(상호성) — `neighbor_profiles` 패턴 재사용.
  노출 지점: 게시글 상세의 작성자 영역 + 이웃 카드. anon에겐 절대 미노출.
- **뷰 변경 시 D-012 절차 필수**: revoke-then-grant + security_barrier 반복.
- 안전장치: 신고 링크 병기, "공개 장소에서 만나세요" 문구, 처리방침에 항목 추가.
- **광고 게이트는 이번 범위에서 제외 권고** — 수익화는 별도 결정(§4)으로 분리하고,
  연결 기능 자체를 먼저 검증한다.

---

## 3. 구현 준비도 점검 (이 세션에서 실측·확인한 사실)

| 항목 | 상태 |
|---|---|
| Supabase pgvector | 사용 가능(확장 enable만 하면 됨) |
| 무료 임베딩(gte-small) | Edge Function 내장 — 외부 키 불필요 |
| Edge Function 배포 수단 | MCP deploy_edge_function 사용 가능 |
| 광고망 | 계정·심사 필요 — 즉시 불가 |
| 데이터 | 공개 글 ~2건 — 추천 품질 검증 불가, 기능 gating 필요 |
| **컨텍스트** | 이 세션은 임계 — **구현·검증·독립재검수는 새 세션 권장** |

## 4. 승인 필요 결정
- [ ] A. §1 임베딩 공급자 = 내장 gte-small (무료·비전송) 승인
- [ ] B. §2 수정 설계(전화 비노출 링크·별도 opt-in·상호성) 승인 — 원안(연락정보+광고)은 §2.1 사유로 반려 권고
- [ ] C. 광고/수익화는 파일럿 검증 후 별도 논의로 분리
- [ ] D. DB 변경 3건 승인: vector 확장+posts.embedding / match_posts RPC / profiles.messenger_link+is_contact_visible

## 5. 새 세션 인수인계 절차
새 대화에서 다음을 지시하면 된다:
> "PRD_v1_6.md 승인. §1(비슷한 글)부터 기존 절차(계획→구현→검증→독립 재검수)로 구현해줘."
필요 컨텍스트는 PRD_v1_3~v1_6 + docs/DECISIONS.md + docs/TEST_CHECKLIST.md에 전부 기록돼 있다.
Supabase 프로젝트 id: ikusdwursvbdrznbcjtw / 공식 도메인: https://nongsadama.app (D-016).
