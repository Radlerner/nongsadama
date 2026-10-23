-- D-044 (2026-10-23) 게시글 사진: posts.image_paths + Storage 버킷 post-images + 올리기·지우기 정책.
--
-- 적용 순서: 웹 배포·새 AAB보다 **먼저**. 새 앱은 목록·상세에서 image_paths 열을 읽으므로 이 열이 없으면 게시판 조회가 실패한다.
-- 출시된 1.4.1 은 이 열을 읽지도 쓰지도 않는다 — 사진 없이 글만 보이고, 그 앱에서 글을 고쳐도 사진은 그대로 남는다.
--
-- 파일 모양(앱 src/lib/postImages.ts 와 같아야 함):
--   post-images/<작성자 id>/<uuid>_<가로>x<세로>.jpg  (기기에서 1280px 이하 JPEG로 다시 저장 — 위치 정보(EXIF) 없음)
--   post-images/<작성자 id>/<uuid>_<가로>x<세로>_t.jpg (목록용 작은 그림, 360px 이하)
-- 공개 버킷이다(게시글이 공개라서). 주소만 알면 열리므로 글을 지우면 앱이 파일도 지우고, 계정 삭제 함수가 폴더를 지운다.
--
-- 롤백:
--   drop policy if exists "post_images_insert_own" on storage.objects;
--   drop policy if exists "post_images_select_own" on storage.objects;
--   drop policy if exists "post_images_delete_own" on storage.objects;
--   -- 버킷은 파일을 먼저 비운 뒤(대시보드 또는 Storage API) delete from storage.buckets where id = 'post-images';
--   alter table public.posts drop constraint if exists posts_image_paths_check;
--   alter table public.posts drop column if exists image_paths;

alter table public.posts add column if not exists image_paths text[] not null default '{}';

-- 최대 3장, 빈 값·NULL 없음, 모두 작성자 자기 폴더의 정해진 모양(남의 파일을 내 글에 붙이지 못하게).
alter table public.posts drop constraint if exists posts_image_paths_check;
alter table public.posts add constraint posts_image_paths_check check (
  cardinality(image_paths) <= 3
  and array_position(image_paths, null) is null
  and array_to_string(image_paths, ',') ~ (
    '^(' || author_id::text || '/[0-9a-f-]{36}_[0-9]{1,4}x[0-9]{1,4}[.]jpg'
    || '(,' || author_id::text || '/[0-9a-f-]{36}_[0-9]{1,4}x[0-9]{1,4}[.]jpg)*)?$'
  )
);

-- 버킷: 공개 읽기, 한 파일 1MB 이하 JPEG만(앱이 줄여서 올리므로 보통 100~400KB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 로그인한 사람은 자기 폴더에만, 정해진 이름으로만 올린다. 덮어쓰기(update) 정책은 두지 않는다.
-- 한 사람당 파일 200개(사진 100장 + 작은 그림)까지 — 한 계정이 무료 플랜 1GB를 채우지 못하게(검수 지적).
-- 글을 지우면 앱이 파일도 지우므로 보통은 닿지 않는다. 세는 범위는 아래 select 정책이 보여 주는 자기 폴더뿐이다.
drop policy if exists "post_images_insert_own" on storage.objects;
create policy "post_images_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'post-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}_[0-9]{1,4}x[0-9]{1,4}(_t)?[.]jpg$'
  and (
    select count(*) from storage.objects o
    where o.bucket_id = 'post-images' and o.name like (select auth.uid())::text || '/%'
  ) < 200
);

-- Storage API의 지우기는 select + delete 권한이 함께 필요하다. 자기 폴더만.
drop policy if exists "post_images_select_own" on storage.objects;
create policy "post_images_select_own" on storage.objects
for select to authenticated
using (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "post_images_delete_own" on storage.objects;
create policy "post_images_delete_own" on storage.objects
for delete to authenticated
using (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
