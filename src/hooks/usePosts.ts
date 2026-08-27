import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '../lib/supabase'
import type { Tables, TablesInsert } from '../types/database'

export type Post = Omit<Tables<'posts'>, 'embedding'>

/** 게시글 카테고리(고정 도메인, PRD 8.1). */
export const POST_CATEGORIES = ['question', 'info', 'daily', 'other', 'help'] as const
export function postCategoryLabelKey(category: string): string {
  return `board.category.${category}`
}

// embedding(384float)은 목록·상세 페이로드에서 제외(PRD v1.6 — 유사도는 RPC가 서버측 계산)
const POST_COLUMNS =
  'id,author_id,region_id,category,title,body,source_locale,status,created_at,updated_at'

export interface PostWithAuthor extends Post {
  authorNickname: string | null
  /** 작성자가 매칭 공개에 동의한 경우에만 값이 있다(public_profiles 뷰가 강제). */
  authorCountry: string | null
}

async function attachAuthors(posts: Post[]): Promise<PostWithAuthor[]> {
  const supabase = getSupabaseClient()
  const ids = [...new Set(posts.map((p) => p.author_id))]
  const authors = new Map<string, { nickname: string | null; country_code: string | null }>()
  if (ids.length > 0) {
    const { data } = await supabase
      .from('public_profiles')
      .select('*')
      .in('id', ids)
    for (const a of data ?? []) {
      if (a.id) authors.set(a.id, { nickname: a.nickname, country_code: a.country_code })
    }
  }
  return posts.map((p) => ({
    ...p,
    authorNickname: authors.get(p.author_id)?.nickname ?? null,
    authorCountry: authors.get(p.author_id)?.country_code ?? null,
  }))
}

async function fetchPosts(
  regionIds: string[] | null,
  authorId: string | null,
): Promise<PostWithAuthor[]> {
  let query = getSupabaseClient()
    .from('posts')
    .select(POST_COLUMNS)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  if (authorId) {
    // 이웃 → 그 사용자의 공개 게시글 보기(PRD v1.4 §2.1). 지역 범위와 무관하게 전체 공개 글.
    query = query.eq('author_id', authorId)
  } else if (regionIds && regionIds.length > 0) {
    query = query.in('region_id', regionIds)
  }
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return attachAuthors(data ?? [])
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
      const { data, error } = await getSupabaseClient()
        .from('posts')
        .select(POST_COLUMNS)
        .eq('id', id as string)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data || data.status === 'deleted') return null
      const [withAuthor] = await attachAuthors([data])
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
      const { data, error } = await getSupabaseClient()
        .from('posts')
        .insert(input)
        .select('id')
        .single()
      if (error) throw new Error(error.message)
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
    mutationFn: async (input: { id: string; category: string; title: string; body: string }) => {
      const { error } = await getSupabaseClient()
        .from('posts')
        .update({ category: input.category, title: input.title, body: input.body })
        .eq('id', input.id)
      if (error) throw new Error(error.message)
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

/** 소프트 삭제(status='deleted', D-007). 공개 피드에서 즉시 사라진다. */
export function useDeletePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient()
        .from('posts')
        .update({ status: 'deleted' })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['posts'] }),
  })
}
