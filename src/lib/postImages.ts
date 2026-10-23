// 게시글 사진(D-044). 올리기 전에 기기에서 줄여 JPEG로 다시 저장한다 — 그림만 다시 그리므로
// 사진 속 위치(GPS)·기기 정보(EXIF)는 따라가지 않는다. 시골 통신비를 생각해 목록용 작은 그림을 따로 만든다.
// 저장 경로: post-images/<작성자 id>/<uuid>_<가로>x<세로>.jpg (+ 같은 이름 끝 _t = 작은 그림).
// 크기를 이름에 넣어 화면이 그림이 오기 전에 자리를 잡는다(늦게 온 그림이 누르는 자리를 밀지 않게).
import { getSupabaseClient } from './supabase'
import { POST_IMAGES_BUCKET, newImagePath, thumbPath } from './postImagePaths'

// 경로 규칙은 postImagePaths(Supabase 없이 테스트) — 화면은 이 파일 하나만 가져다 쓴다
export { MAX_POST_IMAGES, POST_IMAGES_BUCKET, imageSize, isPostImagePath, thumbPath } from './postImagePaths'

const FULL_MAX_SIDE = 1280
const THUMB_MAX_SIDE = 360
const FULL_QUALITY = 0.8
const THUMB_QUALITY = 0.7

export interface PreparedImage {
  full: Blob
  thumb: Blob
  width: number
  height: number
}

export function imageUrl(path: string): string {
  return getSupabaseClient().storage.from(POST_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** notImage: 사진 파일이 아님 · unreadable: 사진이지만 이 기기가 못 여는 형식(HEIC 등)·너무 큼 · failed: 저장·올리기 실패 */
export class ImageError extends Error {
  constructor(readonly reason: 'notImage' | 'unreadable' | 'failed') {
    super(reason)
  }
}

/** 그림 파일을 읽는다. 사진의 회전 정보는 그릴 때 반영한다(브라우저 기본값 from-image). */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close() }
    } catch {
      // 일부 브라우저는 옵션을 모르거나 형식을 못 읽는다 — 아래 <img> 방식으로 다시 시도
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    throw new ImageError('unreadable')
  }
}

function fit(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function encode(source: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new ImageError('failed'))
  ctx.fillStyle = '#ffffff' // 투명한 PNG가 검게 나오지 않게
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(source, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ImageError('failed'))), 'image/jpeg', quality)
  })
}

/** 고른 사진 1장을 올릴 모양(큰 그림 + 작은 그림)으로 만든다. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (file.type && !file.type.startsWith('image/')) throw new ImageError('notImage')
  const img = await decode(file)
  try {
    const full = fit(img.width, img.height, FULL_MAX_SIDE)
    const small = fit(img.width, img.height, THUMB_MAX_SIDE)
    return {
      full: await encode(img.source, full.width, full.height, FULL_QUALITY),
      thumb: await encode(img.source, small.width, small.height, THUMB_QUALITY),
      width: full.width,
      height: full.height,
    }
  } finally {
    img.done()
  }
}

/** 준비한 사진을 올리고 경로 목록을 돌려준다. 하나라도 실패하면 이번에 올린 것을 지우고 실패로 끝낸다. */
export async function uploadPreparedImages(userId: string, images: PreparedImage[]): Promise<string[]> {
  const bucket = getSupabaseClient().storage.from(POST_IMAGES_BUCKET)
  const done: string[] = []
  try {
    for (const image of images) {
      const path = newImagePath(userId, newId(), image.width, image.height)
      // 하루만 캐시 — 글을 지운 뒤에도 CDN·브라우저가 오래 보여 주지 않게(공개 버킷)
      const opts = { contentType: 'image/jpeg', cacheControl: '86400', upsert: false }
      const full = await bucket.upload(path, image.full, opts)
      if (full.error) throw new ImageError('failed')
      done.push(path)
      const small = await bucket.upload(thumbPath(path), image.thumb, opts)
      if (small.error) throw new ImageError('failed')
    }
    return done
  } catch (error) {
    await removePostImages(done)
    throw error instanceof ImageError ? error : new ImageError('failed')
  }
}

/** 사진 파일(큰 그림 + 작은 그림)을 지운다. 실패해도 글 저장·삭제는 막지 않는다(남은 파일은 계정 삭제 때 정리). */
export async function removePostImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    await getSupabaseClient().storage.from(POST_IMAGES_BUCKET).remove(paths.flatMap((p) => [p, thumbPath(p)]))
  } catch {
    // 부가 정리 — 무시
  }
}
