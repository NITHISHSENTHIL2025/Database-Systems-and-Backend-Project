# API Overview

## Public

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/register`

## Authenticated

- `GET /api/auth/me`
- `GET /api/dashboard`

## Admin-only

- `GET /api/members`
- `POST /api/members`
- `GET /api/admin/memberships`
- `GET /api/admin/trainers`
- `POST /api/admin/trainers`
- `GET /api/admin/attendance`
- `POST /api/admin/attendance`
- `GET /api/admin/workouts`
- `POST /api/admin/workouts`
- `GET /api/admin/equipment`
- `POST /api/admin/equipment`
- `PATCH /api/admin/equipment/:id`
- `GET /api/admin/payments`

## Member-only

- `GET /api/member/memberships`
- `GET /api/member/attendance`
- `GET /api/member/workouts`
- `GET /api/member/payments`
