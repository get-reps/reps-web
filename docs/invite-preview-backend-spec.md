# Invite preview — backend spec (NOT built, NOT deployed)

Status 2026-10-04: the invite page (`invite.html` + `js/invite-preview.js`) is built against
this contract. Until the endpoint exists the request 404s and every visitor sees the generic
"A friend is inviting you to REPS" page. Building and deploying the endpoint below is Mike's
call.

## Why a new read is needed

No existing read is safe to reuse:

- `redeem_invite_code(p_code, p_surface)` — authenticated only, and it **writes** attribution.
  It also returns `inviter_id` and an `inviter_name` that falls back to `nickname`/full `name`.
- `get_public_user_profile(p_user_id)` — takes a user id (the page only has a code) and returns
  id, username, full name, bio, stats. Far more than a first name and picture.
- `public.users` is not readable by `anon` for `referral_code`/`first_name`/`avatar_url`.

## Endpoint (reps-web edge function)

`GET https://getreps.io/api/invite-preview?code=<CODE>` → `api/invite-preview.ts`, `runtime = "edge"`.

Response — always `200`, always this exact shape:

```json
{ "first_name": "Sam", "avatar_url": "https://<project>.supabase.co/storage/v1/object/public/avatars/..." }
```

Generic / not-found shape (identical for invalid code, unknown code, ineligible or private
inviter, missing data, any internal error):

```json
{ "first_name": null, "avatar_url": null }
```

- Validate `code` against `^[A-HJ-NP-Z2-9]{8}$` (after `trim().toUpperCase()`) before any DB call.
- `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` on every response (both
  shapes), so repeat opens of a shared link never reach the database.
- Never 500: wrap everything and return the generic shape.

## Database read (new SQL function)

```sql
create or replace function public.get_invite_preview(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object(
              'first_name', nullif(btrim(u.first_name), ''),
              'avatar_url', case when u.avatar_url like 'https://%' then u.avatar_url end)
       from public.users u
      where u.referral_code = upper(btrim(p_code))
        and u.is_active is true
        and u.is_system_account is not true
        and u.deletion_requested_at is null
        and u.profile_visibility = 'public'
        and nullif(btrim(u.first_name), '') is not null),
    jsonb_build_object('first_name', null, 'avatar_url', null));
$$;
revoke all on function public.get_invite_preview(text) from public, anon, authenticated;
grant execute on function public.get_invite_preview(text) to service_role;
```

The edge function calls it with the service-role key already configured for `api/support.ts`.

## Privacy rules (binding)

- Only `users.first_name` (never `nickname`, `name`, `username`, email, id) and `avatar_url`.
- Inviters whose `profile_visibility` is `friends` or `private` get the generic shape — no name,
  no picture. Same for deleted / deactivated / system accounts and anyone with no first name.
- A picture is never returned without a name; the page also refuses to show one alone.
- Unknown codes are indistinguishable from private ones, so the endpoint cannot be used to test
  whether a code exists beyond "this one shows a name".

## Rate limiting / enumeration

- Code space is 32^8 ≈ 1.1 trillion, so random guessing finds essentially nothing.
- Add a Vercel Firewall rate-limit rule on `/api/invite-preview`: 30 requests / minute / IP,
  action = deny (429). The page treats 429 as generic.
- Edge caching (above) absorbs legitimate bursts from a shared link going viral.

## Front-end guarantees already shipped

`js/invite-preview.js` — 2.5 s timeout, no cookies sent, https-only pictures, first word of the
name only (max 24 chars, letters required), picture shown only after it fully loads (otherwise
the inviter's initial), and any failure leaves the generic page untouched. Tests:
`lib/invite-preview.test.ts`.

## Decisions (supervisor, 2026-10-04)

- `friends`-visibility inviters get the generic shape (no name, no picture), as specified above.
- The endpoint is to be built later as a separate task, exactly as specified, and deployed only
  after Mike's go.
