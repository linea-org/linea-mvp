# Users Module

> User profile management — read and update the current user's profile.

## Base Path
`/v1/users`

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/me` | authenticated | Get the current user's profile |
| PATCH | `/me` | authenticated | Update name or avatar URL |
| POST | `/me/onboard` | authenticated | Mark onboarding complete |

## Business Logic

- Users are created/synced by the `auth` module (Clerk webhook); this module only exposes read/update
- `onboardedAt` is set once on `POST /me/onboard` and never cleared

## Changelog

_No recent changes._

## Status

Stable.
