// 게시글 사진 경로 규칙(D-044) — Supabase 없이 읽을 수 있게 따로 둔다(테스트가 SQL 마이그레이션과 맞는지 검사).
// 저장 경로: post-images/<작성자 id>/<uuid>_<가로>x<세로>.jpg (+ 같은 이름 끝 _t = 작은 그림).
export const POST_IMAGES_BUCKET = 'post-images'
export const MAX_POST_IMAGES = 3

// DB 제약(posts_image_paths_check)·Storage 정책과 같은 모양 — supabase/migrations/20261023004059_post_images.sql
const PATH_RE = /^([0-9a-f-]{36})\/([0-9a-f-]{36})_(\d{1,4})x(\d{1,4})\.jpg$/

/** 경로에서 그림 크기를 읽는다. 모양이 다르면 null. */
export function imageSize(path: string): { width: number; height: number } | null {
  const m = PATH_RE.exec(path)
  return m ? { width: Number(m[3]), height: Number(m[4]) } : null
}

/** 글에 붙일 수 있는 경로인가(작성자 id를 주면 그 사람 폴더인지도 본다). */
export function isPostImagePath(path: string, authorId?: string): boolean {
  const m = PATH_RE.exec(path)
  return Boolean(m) && (!authorId || m?.[1] === authorId)
}

export function thumbPath(path: string): string {
  return path.replace(/\.jpg$/, '_t.jpg')
}

export function newImagePath(userId: string, id: string, width: number, height: number): string {
  return `${userId}/${id}_${width}x${height}.jpg`
}
