# Users Module

> User profile management — read and update the current user's profile.

## Base Path
`/v1/users`

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/me` | authenticated | Get the current user's profile. Returns `{ id, email, name, avatarUrl, onboardedAt }`. |
| PATCH | `/me` | authenticated | Update profile. Body: `{ name?, avatarUrl? }`. Returns updated profile. |
| POST | `/me/onboard` | authenticated | Mark onboarding complete. Sets `onboardedAt = now()`. Returns updated profile. No-op if already onboarded. |

## Business Logic

- Users are created/synced by the `auth` module (Clerk webhook); this module only exposes read/update
- `onboardedAt` is set once on `POST /me/onboard` and never cleared

## Changelog

_No recent changes._

## Missing / Gaps

- **Account deletion**: no `DELETE /me` for a user to delete their own account — must go through Clerk dashboard
- **Email change**: email is synced from Clerk but can't be changed via this API
- **Preferences**: no `PATCH /me/preferences` for UI preferences (theme, notification settings, etc.) beyond `name` and `avatarUrl`

## Status

Stable.
