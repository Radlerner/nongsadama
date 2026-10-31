import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'
import { removePostImages } from '../lib/postImages'

export type Post = Omit<Tables<'posts'>, 'embedding'>

/** 게시글 카테고리(고정 도메인, PRD 8.1) — 정의는 lib/postCategories(테스트에서 Supabase 없이 읽기 위해). */
export { POST_CATEGORIES, postCategoryLabelKey } from '../lib/postCategories'

// embedding(384float)은 목록·상세 페이로드에서 제외(PRD v1.6 — 유사도는 RPC가 서버측 계산).
export const POST_COLUMNS =
  'id,author_id,region_id,category,title,body,source_locale,status,image_paths,created_at,updated_at'
const POST_COLUMNS_WITHOUT_IMAGES = POST_COLUMNS.replace(',image_paths', '')

// 사진 열(image_paths, D-044)은 20261023004059 마이그레이션이 만든다. 웹은 main 에 합치면 바로 배포되므로
// 마이그레이션보다 먼저 나가도 게시판이 열리게: "그런 열이 없다"는 오류면 그 열 없이 다시 묻고 사진은 없는 것으로 본다.
let imageColumn = true
function missingImageColumn(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && imageColumn && /image_paths/.test(error.message ?? '') && ['42703', 'PGRST204'].includes(error.code ?? ''))
}
const withImages = (row: Record<string, unknown>): Post => ({ image_paths: [], ...row }) as unknown as Post

/** DB가 거절했는지(code 있음) 응답을 못 받았는지(code 없음 — 실제로는 저장됐을 수도) 구분해 던진다. */
export class PostSaveError extends Error {
  constructor(message: string, readonly rejected: boolean) {
    super(message)
  }
}
const dbError = (error: { message: string; code?: string }) => new PostSaveError(error.message, Boolean(error.code))

/**
 * 공개 화면(게시판·글 상세·비슷한 글)에는 작성자 닉네임만 보여 준다. 작성자 국적은 보여 주지 않는다.
 * public_profiles 뷰에는 id, nickname 만 있다(country_code 열은 2026-10-29에 뺐다) — 그 둘만 읽는다.
 */
export interface PostWithAuthor extends Post {
  authorNickname: string | null
}

async function attachAuthors(posts: Post[]): Promise<PostWithAuthor[]> {
  const supabase = getSupabaseClient()
  const ids = [...new Set(posts.map((p) => p.author_id))]
  const authors = new Map<string, string | null>()
  if (ids.length > 0) {
    const { data } = await supabase
      .from('public_profiles')
      .select('id,nickname')
      .in('id', ids)
    for (const a of data ?? []) {
      if (a.id) authors.set(a.id, a.nickname)
    }
  }
  return posts.map((p) => ({
    ...p,
    authorNickname: authors.get(p.author_id) ?? null,
  }))
}

async function fetchPosts(
  regionIds: string[] | null,
  authorId: string | null,
): Promise<PostWithAuthor[]> {
  const run = () => {
    let query = getSupabaseClient()
      .from('posts')
      .select(imageColumn ? POST_COLUMNS : POST_COLUMNS_WITHOUT_IMAGES)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
    if (authorId) {
      // 이웃 → 그 사용자의 공개 게시글 보기(PRD v1.4 §2.1). 지역 범위와 무관하게 전체 공개 글.
      query = query.eq('author_id', authorId)
    } else if (regionIds && regionIds.length > 0) {
      query = query.in('region_id', regionIds)
    }
    return query
  }
  let { data, error } = await run()
  if (missingImageColumn(error)) {
    imageColumn = false
    ;({ data, error } = await run())
  }
  if (error) throw new Error(error.message)
  return attachAuthors(((data ?? []) as unknown as Record<string, unknown>[]).map(withImages))
}

export function useBoardPosts(
  regionIds: string[] | null,
  enabled = true,
  authorId: string | null = null,
) {
  return useQuery({
    queryKey: ['posts', 'list', authorId, regionIds ? [...regionIds].sort() : null],
    queryFn: () => fetchPosts(regionIds, authorId),
    enabled,
  })
}

export function usePost(id: string | undefined) {
  return useQuery({
    queryKey: ['posts', 'item', id],
    queryFn: async (): Promise<PostWithAuthor | null> => {
      const run = () =>
        getSupabaseClient()
          .from('posts')
          .select(imageColumn ? POST_COLUMNS : POST_COLUMNS_WITHOUT_IMAGES)
          .eq('id', id as string)
          .maybeSingle()
      let { data, error } = await run()
      if (missingImageColumn(error)) {
        imageColumn = false
        ;({ data, error } = await run())
      }
      if (error) throw new Error(error.message)
      const row = data as unknown as Record<string, unknown> | null
      if (!row || row.status === 'deleted') return null
      const [withAuthor] = await attachAuthors([withImages(row)])
      return withAuthor
    },
    enabled: Boolean(id),
  })
}

/**
 * 임베딩 생성 요청(비동기 보강, PRD v1.6 §1.4). 실패해도 글 저장은 성공 —
 * 추천만 빠질 뿐이므로 오류를 삼킨다(무언 실패 아님: 부가 기능).
 */
function requestEmbedding(postId: string): void {
  void getSupabaseClient()
    .functions.invoke('embed-post', { body: { post_id: postId } })
    .catch(() => undefined)
}

export function useCreatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TablesInsert<'posts'>) => {
      // 사진이 없으면 image_paths 를 보내지 않는다(DB 기본값 '{}') — 마이그레이션 전에도 글쓰기가 되게
      const { image_paths: paths, ...rest } = input
      const { data, error } = await getSupabaseClient()
        .from('posts')
        .insert(paths && paths.length > 0 ? input : rest)
        .select('id')
        .single()
      if (error) throw dbError(error)
      return data
    },
    onSuccess: (data) => {
      requestEmbedding(data.id)
      void queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}

export function useUpdatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    /** image_paths 는 사진을 바꿨을 때만 넣는다(안 바꾸면 보내지 않음 — 마이그레이션 전에도 수정이 되게). */
    mutationFn: async (input: { id: string; category: string; title: string; body: string; image_paths?: string[] }) => {
      const { error } = await getSupabaseClient()
        .from('posts')
        .update({
          category: input.category,
          title: input.title,
          body: input.body,
          ...(input.image_paths ? { image_paths: input.image_paths } : {}),
        })
        .eq('id', input.id)
      if (error) throw dbError(error)
      return input.id
    },
    onSuccess: (id) => {
      requestEmbedding(id)
      void queryClient.invalidateQueries({ queryKey: ['posts'] })
    },
  })
}

export interface SimilarPost {
  id: string
  title: string
  category: string
  region_id: string
  author_id: string
  created_at: string
  similarity: number
}

/** 비슷한 글(PRD v1.6 §1). RLS invoker RPC — 공개 글 5건 미만이면 빈 배열(섹션 숨김). */
export function useSimilarPosts(postId: string | undefined) {
  return useQuery({
    queryKey: ['posts', 'similar', postId],
    queryFn: async (): Promise<SimilarPost[]> => {
      const { data, error } = await getSupabaseClient().rpc('similar_posts', {
        source_id: postId as string,
      })
      if (error) throw new Error(error.message)
      return data ?? []
    },
    enabled: Boolean(postId),
  })
}

/**
 * 소프트 삭제(status='deleted', D-007). 공개 피드에서 즉시 사라진다.
 * 사진 파일은 글과 달리 주소만 알면 열리므로 함께 지운다(D-044). 파일 삭제가 실패해도 글 삭제는 성공으로 본다.
 */
export function useDeletePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, imagePaths }: { id: string; imagePaths: string[] }) => {
      const { error } = await getSupabaseClient()
        .from('posts')
        .update(imagePaths.length > 0 ? { status: 'deleted', image_paths: [] } : { status: 'deleted' })
        .eq('id', id)
      if (error) throw new Error(error.message)
      await removePostImages(imagePaths)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['posts'] }),
  })
}
