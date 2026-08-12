# 농사다마 PRD v1.6 — 고도화: 비슷한 게시물 찾기

**작성일**: 2026-08-02
**문서 상태**: §1 승인·구현·독립 재검수 완료(배포됨). 기록은 docs/DECISIONS.md(D-017)·docs/TEST_CHECKLIST.md 참조.
**기준**: v1.3(품질·비용·개인정보) + v1.4(매칭) + v1.5(지도·라우터) 위의 증분.

> 이 문서의 §2(작성자 연락 연결)는 한 차례 구현되었다가 제품 오너 요청으로 전면 롤백되었고, 설계
> 문서도 삭제되었다(revert 커밋 기록 참조). 향후 다시 다룰 경우 새 설계로 시작한다.

---

## 1. 비슷한 게시물 찾기 (임베딩 기반)

### 1.1 목표
게시글 상세 하단에 "비슷한 글" 3~5건 추천 → 질문 중복 감소, 과거 답변 재활용, 체류 시간 증가.

### 1.2 임베딩 공급자 결정 (핵심 트레이드오프)

| 선택지 | 비용 | 개인정보 | 다국어 품질 |
|---|---|---|---|
| **A. Supabase 내장 gte-small (채택)** | **0원** (Edge Function 내장 `Supabase.ai`) | **UGC가 인프라 밖으로 안 나감** — D-017(학습봇 /board 차단) 정합 | 영어 중심 — ko·vi 혼합 텍스트 품질 제한적(§1.5) |
| B. OpenAI text-embedding-3-small | 유료(키·빌링 필요) | **게시글 제3자 전송** — D-017 취지 충돌, 처리방침 고지+동의 필요 | 다국어 우수 |

**결정: A 채택**(무료·정책 정합·키 불필요, 오너 승인). 파일럿에서 추천 품질이 부족하면 B를 별도 승인으로 재논의.
참고: Anthropic은 임베딩 API를 제공하지 않는다(공식 권장은 Voyage AI — 역시 유료·제3자).

### 1.3 스키마·쿼리 (Supabase 방식 — 구현 반영)

```sql
-- 마이그레이션: pgvector + 임베딩 컬럼 (gte-small = 384차원)
create extension if not exists vector;
alter table public.posts add column if not exists embedding vector(384);

-- 유사 글 조회 RPC. 구현은 원시 임베딩을 클라이언트가 넘기지 않도록 source_id를 받아
-- RLS 밑에서 source 임베딩을 조회하는 방식으로 변경(더 안전 — 재검수 개선 반영).
create or replace function public.similar_posts(source_id uuid, match_count int default 3)
returns table (id uuid, title text, category text, region_id uuid, created_at timestamptz, similarity float)
language sql stable
as $$
  select p.id, p.title, p.category, p.region_id, p.created_at,
         1 - (p.embedding <=> s.embedding) as similarity
  from public.posts p
  cross join (select embedding from public.posts where id = source_id) s
  where s.embedding is not null and p.status = 'published' and p.embedding is not null
    and p.id <> source_id
    and (select count(*) from public.posts where status = 'published') >= 5
  order by p.embedding <=> s.embedding
  limit match_count;
$$;
```
- 인덱스(hnsw)는 글 수백 건 전까지 불필요 — 순차 스캔으로 충분.
- **RLS**: SECURITY INVOKER(기본) — posts RLS(published or own)가 source·결과 모두에 적용.
  search_path는 D-010 표준대로 `public, pg_catalog` 고정(pgvector `<=>` 해석용, 재검수 P2-a).

### 1.4 파이프라인 (구현 반영)

1. **Edge Function `embed-post`**: 글 작성/수정 시 클라이언트가 호출(글 id 전달) → 함수가
   본문을 읽어 gte-small 임베딩 생성 → `posts.embedding` UPDATE(service_role은 함수 내부만).
   실패해도 글 저장은 성공(임베딩은 비동기 보강 — 추천만 빠짐). verify_jwt=true.
2. **상세 화면**: `similar_posts(source_id)` RPC 호출 → "비슷한 글" 카드 3건.
   결과가 없으면(공개 글 5건 미만 포함) 섹션 자체를 숨긴다. 목록·상세 조회는 embedding 컬럼 제외.
3. 기존 글 백필: 운영 스크립트 1회.

### 1.5 정직한 한계
- 데이터 현실: 파일럿 시딩/실사용이 있어야 추천이 의미를 가진다.
  "공개 글 5건 미만이면 섹션 숨김" 조건을 완료 기준에 포함(구현됨).
- gte-small의 한국어·베트남어 품질 한계 — 검증 결과 ko 평가에서 유사쌍 랭킹이 1~2/3 수준
  (유사도 0.90~0.94 밀집). **① 현행(무료) 유지로 결정**, 파일럿 실데이터로 재평가.
  품질이 계속 부족하면 §1.2-B(유료 다국어)를 Edge Function 한 곳 교체로 전환.

---

## 2. 구현 준비도 점검 (이 세션에서 실측·확인한 사실)

| 항목 | 상태 |
|---|---|
| Supabase pgvector | 사용 가능(확장 enable) — 적용됨 |
| 무료 임베딩(gte-small) | Edge Function 내장 — 외부 키 불필요, 배포됨 |
| Edge Function 배포 수단 | MCP deploy_edge_function 사용 |
| 데이터 | 평가 글 6건 시드 — 품질 게이트 검증 완료(§1.5) |

## 3. 승인·결정 이력
- [x] §1 임베딩 공급자 = 내장 gte-small (무료·비전송) — 승인·구현
- [x] §1 DB 변경: vector 확장 + posts.embedding + similar_posts RPC — 적용
- [x] 품질 공급자: ① 현행(무료) 유지 — 파일럿 후 재평가
- 광고/수익화: 파일럿 검증 후 별도 논의(현 범위 밖)

## 4. 참고 (인수인계)
필요 컨텍스트는 PRD_v1_3~v1_6 + docs/DECISIONS.md + docs/TEST_CHECKLIST.md에 기록돼 있다.
Supabase 프로젝트 id: ikusdwursvbdrznbcjtw / 공식 도메인: https://nongsadama.app (D-016).
