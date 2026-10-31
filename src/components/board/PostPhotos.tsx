import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { imageSize, imageUrl, thumbPath } from '../../lib/postImages'
import { Button, Icon, Spinner, cn } from '../ui'

/*
 * 글 사진(D-044) 화면 조각(디자인 v5, 키트 4.6 사진 자리). 그림 파일 규칙·올리기는 lib/postImages 그대로다.
 * - 자리 크기는 그림이 오기 전에 정한다(이름에 적힌 가로·세로) — 늦게 온 그림이 아래 버튼을 밀지 않는다.
 * - 오는 동안은 반짝이는 회색 면(.skel), 못 받으면 멈춘 회색 면 + 사진 그림(+ 상세에서는 다시 시도).
 * - 링크를 걸지 않는다(Android 앱에서 누르면 앱을 떠나 같은 그림을 다시 받는다).
 */

type SlotState = 'loading' | 'loaded' | 'error'

interface PhotoSlotProps {
  src: string
  alt: string
  /** 그림 원래 크기(이름에서 읽음) — img width/height 속성으로 쓴다 */
  size?: { width: number; height: number } | null
  /** cover = 자리를 채움(목록·작은 칸) · contain = 자르지 않음(상세) */
  fit?: 'cover' | 'contain'
  /** 화면 밖이면 늦게 받기(목록) */
  lazy?: boolean
  /** 상세: 오래 걸리면 "사진을 불러오는 중…" 알약, 실패하면 글자 + 다시 시도 */
  detailed?: boolean
  /** 바깥 자리(크기·비율·모서리) */
  className?: string
  /** 사진 위에 겹칠 것(남은 장 수 등) */
  children?: ReactNode
}

/** 사진 한 장의 자리. 불러오는 중·다 받음·실패를 스스로 그린다. */
export function PhotoSlot({ src, alt, size, fit = 'cover', lazy = false, detailed = false, className, children }: PhotoSlotProps) {
  const { t } = useTranslation()
  const [attempt, setAttempt] = useState(0)
  // 결과는 주소별로 둔다: 주소가 바뀌면(다시 시도·다른 사진) 저절로 '불러오는 중'으로 돌아간다
  const [done, setDone] = useState<{ url: string; ok: boolean } | null>(null)
  const [showWords, setShowWords] = useState(false)
  const url = attempt > 0 ? `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}` : src
  const state: SlotState = done?.url === url ? (done.ok ? 'loaded' : 'error') : 'loading'
  const setState = (next: 'loaded' | 'error') => setDone({ url, ok: next === 'loaded' })
  // 캐시에 있으면 바로 끝난다 — 잠깐 동안은 글자를 띄우지 않는다(깜빡임 방지)
  useEffect(() => {
    if (!detailed || state !== 'loading') {
      setShowWords(false)
      return
    }
    const id = window.setTimeout(() => setShowWords(true), 600)
    return () => window.clearTimeout(id)
  }, [detailed, state])

  return (
    <span className={cn('relative block overflow-hidden', state === 'loading' ? 'skel' : 'bg-surface', className)}>
      {state !== 'error' ? (
        <img
          key={url}
          ref={(el) => {
            // 캐시에서 이미 다 받은 그림은 load 이벤트를 놓칠 수 있다
            if (el && el.complete && el.naturalWidth > 0 && state === 'loading') setState('loaded')
          }}
          src={url}
          alt={alt}
          width={size?.width}
          height={size?.height}
          loading={lazy ? 'lazy' : undefined}
          decoding="async"
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
          className={cn(
            'absolute inset-0 block h-full w-full transition-opacity duration-300',
            fit === 'cover' ? 'object-cover' : 'object-contain',
            state === 'loaded' ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
      {/* 흰 사진이 흰 바탕에 녹지 않게 안쪽 가는 선 */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] border border-ink/[0.08]" />
      {state === 'loading' && detailed && showWords ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-11 items-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-white pl-3.5 pr-4 text-label text-ink">
            <Spinner tone="da" />
            {t('postDetail.photoLoading')}
          </span>
        </span>
      ) : null}
      {state === 'error' ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center text-ink-muted">
          <Icon name="photo" size={detailed ? 28 : 24} />
          {detailed ? (
            <>
              {/* 무엇이 안 됐는지 + 다시 시도(키트 4.15). alt 대신 읽히도록 글자로 둔다 */}
              <span role="alert" className="text-small font-bold text-ink">
                {t('postDetail.photoError')}
              </span>
              <Button variant="secondary" size="sm" icon="refresh" className="mt-1" onClick={() => setAttempt((n) => n + 1)}>
                {t('common.retry')}
              </Button>
            </>
          ) : (
            <span className="sr-only">{alt}</span>
          )}
        </span>
      ) : null}
      {children}
    </span>
  )
}

/**
 * 게시판 카드의 사진(Board 아트보드 사진 카드): 1장 = 넓은 한 칸, 2장 이상 = 정사각 두 칸(셋째부터는 "+1").
 * 목록은 작은 그림(_t, 약 360px)을 받는다 — 시골 통신비(D-044).
 */
export function PostCardPhotos({ paths, className }: { paths: string[]; className?: string }) {
  if (paths.length === 0) return null
  if (paths.length === 1) {
    const size = imageSize(paths[0])
    // 세로 사진은 정사각, 가로 사진은 16:10 — 크기를 미리 알아 카드 높이가 바뀌지 않는다
    const portrait = size ? size.height > size.width : false
    return (
      <span className={cn('block', className)}>
        <PhotoSlot
          src={imageUrl(thumbPath(paths[0]))}
          alt=""
          size={size}
          lazy
          className={cn('w-full rounded-xl', portrait ? 'aspect-square' : 'aspect-[16/10]')}
        />
      </span>
    )
  }
  const more = paths.length - 2
  return (
    <span className={cn('grid grid-cols-2 gap-1.5', className)}>
      {paths.slice(0, 2).map((path, i) => (
        <PhotoSlot
          key={path}
          src={imageUrl(thumbPath(path))}
          alt=""
          size={imageSize(path)}
          lazy
          className="aspect-square w-full rounded-xl"
        >
          {i === 1 && more > 0 ? (
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center bg-ink/[0.5] text-hero text-white"
            >
              +{more}
            </span>
          ) : null}
        </PhotoSlot>
      ))}
    </span>
  )
}

const ratioOf = (path: string) => {
  const s = imageSize(path)
  return s ? s.width / s.height : 4 / 3
}

/**
 * 상세 사진 칸의 비율: 첫 사진(대표)에 맞추되 4:5 ~ 16:9 안으로 — 제목이 첫 화면에서 밀려나지 않게.
 * 이름의 크기는 올린 사람이 정하므로 이상한 값이어도 이 범위를 넘지 않는다.
 */
function galleryRatio(paths: string[]): number {
  return Math.min(16 / 9, Math.max(4 / 5, ratioOf(paths[0])))
}

/** 칸과 비율이 거의 같으면 채우고(cover), 많이 다르면 자르지 않고 여백을 둔다(contain). */
function fitFor(path: string, boxRatio: number): 'cover' | 'contain' {
  return Math.abs(ratioOf(path) / boxRatio - 1) <= 0.12 ? 'cover' : 'contain'
}

/**
 * 글 상세 사진(PostDetail 아트보드): 화면 폭 전체, 옆으로 밀어 넘기기(스크롤 스냅) + 이전·다음 + "1 / 3" + 작은 그림 줄.
 * 자리 높이는 사진 이름의 크기로 정해 그림이 늦게 와도 글이 밀리지 않는다. 비율이 다른 사진은 자르지 않는다(fitFor).
 * regionName: 사진 위 왼쪽 아래 알약(글의 읍·면 — 기기 위치가 아니다).
 */
export function PostGallery({ paths, regionName, className }: { paths: string[]; regionName?: string | null; className?: string }) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const settle = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(settle.current), [])
  const n = paths.length
  if (n === 0) return null
  const ratio = galleryRatio(paths)
  const current = Math.min(index, n - 1)

  const go = (to: number) => {
    const el = scroller.current
    const next = (to + n) % n // 끝에서 다음 = 처음(버튼이 사라져 초점을 잃지 않게)
    setIndex(next)
    if (!el) return
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: next * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }
  const onScroll = () => {
    // 부드러운 스크롤은 매 프레임 이벤트를 낸다 → 멈춘 뒤 한 번만 읽는다(밀기·go()·끊긴 go() 모두)
    window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      const el = scroller.current
      if (!el || el.clientWidth === 0) return
      const i = Math.round(el.scrollLeft / el.clientWidth)
      if (i >= 0 && i < n) setIndex(i)
    }, 120)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (n < 2) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(current + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(current - 1)
    }
  }
  const photoLabel = (i: number) => t('postDetail.photo').replace('{n}', String(i + 1))

  return (
    // 여러 장이면 이름은 초점을 받는 묶음에만 둔다('사진 3장'이 들어갈 때 두 번 읽히지 않게)
    <section aria-label={n > 1 ? undefined : t('board.photoCount').replace('{n}', String(n))} className={cn('-mx-5', className)}>
      <div className="relative">
        <div
          ref={scroller}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          // 여러 장이면 초점을 받아 ←/→로 넘긴다
          role={n > 1 ? 'group' : undefined}
          tabIndex={n > 1 ? 0 : -1}
          // 이름은 고정('사진 3장'): 몇 번째인지는 아래 aria-live 한 곳에서만 읽는다
          aria-label={n > 1 ? t('board.photoCount').replace('{n}', String(n)) : undefined}
          className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          style={{ aspectRatio: String(ratio) }}
        >
          {paths.map((path, i) => (
            <div key={path} className="relative h-full w-full shrink-0 snap-center snap-always">
              <PhotoSlot
                src={imageUrl(path)}
                alt={n > 1 ? `${photoLabel(i)} / ${n}` : photoLabel(i)}
                size={imageSize(path)}
                fit={fitFor(path, ratio)}
                lazy={i > 0}
                detailed
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
        {regionName ? (
          <span
            className="pointer-events-none absolute bottom-3 left-3 flex h-[30px] max-w-[60%] items-center gap-1 rounded-full pl-2 pr-2.5 text-caption font-bold glass"
          >
            <Icon name="pin" size={14} strokeWidth={2.25} />
            <span className="truncate">{regionName}</span>
          </span>
        ) : null}
        {n > 1 ? (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3 right-3 flex h-[30px] items-center rounded-full px-3 text-caption font-bold tracking-wide glass"
            >
              {current + 1} / {n}
            </span>
            {/* 넘길 때 몇 번째인지 읽어 준다 */}
            <span className="sr-only" aria-live="polite">
              {`${photoLabel(current)} / ${n}`}
            </span>
            <button
              type="button"
              onClick={() => go(current - 1)}
              aria-label={t('postDetail.prevPhoto')}
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full glass"
            >
              <Icon name="back" size={22} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={() => go(current + 1)}
              aria-label={t('postDetail.nextPhoto')}
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full glass"
            >
              <Icon name="chevron" size={22} strokeWidth={2.25} />
            </button>
          </>
        ) : null}
      </div>
      {n > 1 ? (
        <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
          {paths.map((path, i) => (
            <button
              key={path}
              type="button"
              onClick={() => go(i)}
              aria-label={photoLabel(i)}
              aria-current={i === current ? 'true' : undefined}
              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg"
            >
              <PhotoSlot src={imageUrl(thumbPath(path))} alt="" size={imageSize(path)} lazy className="h-full w-full rounded-lg" />
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute inset-0 rounded-lg',
                  i === current ? 'border-2 border-da-600' : 'border border-transparent',
                )}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
