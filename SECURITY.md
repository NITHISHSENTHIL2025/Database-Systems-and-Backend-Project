# GymFit Security Notes

GymFit is an academic full-stack project, but the final build keeps the main security boundaries server-side.

## Authentication and authorization
- Passwords are hashed with bcrypt.
- Auth uses a signed JWT stored in an HttpOnly cookie.
- Public signup can create MEMBER accounts only.
- ADMIN / TRAINER / MEMBER access is checked by backend middleware, not only by the UI.
- Every user receives a unique six-digit Gym Key used together with a password.
- Login and recovery endpoints are rate-limited.

## Recovery
- Recovery OTPs expire after 10 minutes.
- Only an HMAC hash of the OTP is stored.
- A recovery code is one-time use.
- Incorrect attempts are limited.
- Brevo is used only when configured. In local development, a clearly labeled demo OTP may be returned instead.

## Database / requests
- Zod validates request input.
- Helmet sets security headers.
- CORS restricts configured origins.
- Mutation requests pass an Origin guard.
- Prisma is reused as a singleton.
- Important actions write audit records internally.

## Payments
- Membership price is read from the server/database.
- Cashfree secrets stay on the backend.
- Membership activation happens only after backend payment verification.
- The browser cannot mark an order as paid by itself.

## Face Attendance
- Face enrollment requires explicit member consent in the admin UI.
- The browser converts a captured face into a numeric descriptor.
- The application stores descriptors, not the captured enrollment photo.
- Matching uses a distance threshold plus an ambiguity gap between the best and second-best candidates.
- Unclear matches are rejected instead of silently choosing a member.
- A Gym Key fallback is available.
- PostgreSQL enforces one attendance record per member/day.

Face matching is a demo convenience feature, not a guarantee of biometric identity. It should not be treated as a high-assurance biometric security system.

## Secrets
- `.env` files are excluded from Git/submission.
- Use `.env.example` for configuration templates.
- Never commit Neon passwords, Cashfree secret keys, Brevo keys or JWT secrets.
