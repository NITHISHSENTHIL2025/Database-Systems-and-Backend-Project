# Review 3 Presentation Guide

## 1. Front-End Development

Show the login page, public member signup, admin dashboard, Members module and member portal.

Explain that the UI is componentized into Brand, Sidebar, Topbar, cards, tables and modal forms rather than putting the entire application into one file.

## 2. Database Design

Show `backend/prisma/schema.prisma` and explain:

- User 1—1 Member
- Member 1—N Membership
- Member 1—N Attendance
- Member 1—N Workout
- Member 1—N Payment
- Trainer 1—N Workout
- Membership 1—N Payment
- Equipment as operational inventory

Highlight the use of primary keys, foreign keys, uniqueness, enums and Decimal for money.

## 3. Live flow

1. Admin login
2. Dashboard reads live PostgreSQL metrics
3. Open Members
4. Add a real member
5. Show the new member record in the table
6. Sign out
7. Register a new member publicly
8. Show the customer/member portal
9. Open Neon and show the relational records

## 4. Payment feature

Say: "The payment domain is already present in the database and UI, but online gateway checkout and webhook verification are planned for the next phase."
