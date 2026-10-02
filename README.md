# GymFit

GymFit is a review-focused full-stack gym management and coaching project built for a short internal college demonstration. It keeps the strongest flows visible and removes clutter.

## What the project demonstrates

### Public
- Simple paper-morphism landing page
- Join Now
- Exactly two memberships: Personal Coaching and AI Coach
- Sign in

### Authentication
- Create a member account
- Every account receives a unique 6-digit Gym Key
- Member login: Gym Key + password
- Staff login: Gym Key + password
- Backend role routing for ADMIN / TRAINER / MEMBER
- Forgot Gym Key / password with OTP recovery
  - Brevo email OTP when configured
  - local development OTP fallback when email is not configured

### Member
- Overview
- Today: workout, diet, attendance state and recovery day
- Workout logging unlocks only after attendance
- Progress: weight, attendance, consistency, adherence and streaks
- Membership purchase/history
- Profile with Gym Key, age, height, weight, body type and goal
- AI Coach preferences only when AI membership is active

### Trainer
- Overview
- My Members
- Simple daily plan editor
- Assign training day or recovery day
- Assign workout and diet
- Profile and Staff Key

### Admin
- Overview
- Members
- Trainers
- Face Attendance
- Memberships
- Payments

## Face Attendance

GymFit uses local browser-side face descriptors for the academic demo. The admin enrolls a consenting member with 3 face samples. At entry, GymFit compares a fresh descriptor against enrolled profiles. The backend only accepts a confident, non-ambiguous match and prevents duplicate attendance for the same member/day.

A 6-digit Gym Key check-in is available as a fallback when face matching is unclear.

GymFit stores numeric face descriptors for matching; the enrollment photos themselves are not uploaded or retained by this application.

On desktop, live camera works best on `localhost`. On phones connected through a LAN HTTP address, browsers may block live camera access; the Attendance page therefore also supports **Take photo / Choose photo** using the phone camera.

The first run downloads the local face engine/model files through `SETUP_FACE_ENGINE.ps1`. If that download is unavailable, the rest of GymFit still works and attendance can use the Gym Key fallback.

## Memberships

Only two active public plans are seeded:

1. **Personal Coaching** — admin assigns a trainer; the trainer publishes the member's daily workout, diet and recovery day.
2. **AI Coach** — GymFit's local rules engine generates an adaptive program from profile/onboarding data. It is fitness guidance, not medical diagnosis or treatment.

## Tech stack

- React 19 + Vite
- Node.js + Express 5
- Prisma ORM
- PostgreSQL / Neon
- Cashfree sandbox payments
- bcrypt password hashing
- JWT in HttpOnly session cookie
- Zod validation
- Helmet, CORS, rate limiting and Origin guard
- Server-Sent Events for live updates

## Environment

Real secrets are intentionally not included in the submission ZIP.

Copy:

```text
backend/.env.example -> backend/.env
frontend/.env.example -> frontend/.env
```

Then fill your existing Neon/Cashfree/admin settings in `backend/.env`.

Brevo is optional for the college demo. Add these later for real email OTP:

```env
BREVO_API_KEY=
EMAIL_FROM=
EMAIL_FROM_NAME="GymFit"
```

## Windows one-click run

Double-click:

```text
RUN_GYMFIT.bat
```

It will:

1. install/update backend packages
2. generate Prisma Client
3. safely sync the database schema
4. seed the admin account, optional trainer account and the two memberships
5. download Face Attendance assets if missing
6. install/update frontend packages
7. start API and web app
8. open `http://127.0.0.1:5173`

To stop both local servers:

```text
STOP_GYMFIT.bat
```

## Phone testing

The Vite server listens on the local network. `RUN_GYMFIT.bat` prints the LAN URL, for example:

```text
http://192.168.x.x:5173
```

Connect the phone and laptop to the same Wi-Fi. Member, trainer and admin pages are responsive. For Face Attendance on a phone LAN URL, use **Take photo / Choose photo** if live camera is blocked by the browser's secure-context rule.

## Recommended 10–15 minute review flow

1. Show the public page and the two memberships.
2. Create/login using Gym Key.
3. Show Member Overview + Today.
4. Show Admin Face Attendance and check in the member.
5. Show the member workout unlock.
6. Show Trainer -> My Members -> assign today's workout/diet.
7. Show Progress analytics.
8. Show Membership/Payment briefly.
9. Finish with the Prisma schema and security/role explanation.

## Important submission note

Do **not** submit `node_modules`, `dist`, `.env`, old patch backups, or database secrets. They are ignored by `.gitignore` and excluded from the clean ZIP.
