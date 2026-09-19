# Database Design

## PostgreSQL on Neon

PostgreSQL is the single runtime datastore for Review 3.

### Core entities

| Entity | Purpose |
|---|---|
| User | Authentication and role identity |
| Member | Member-specific profile |
| Membership | Subscription / plan information |
| Trainer | Trainer directory |
| Attendance | Member check-ins |
| Workout | Training history |
| Payment | Payment records |
| Equipment | Equipment inventory |

### Relationships

- User → Member: 1:1
- Member → Membership: 1:N
- Member → Attendance: 1:N
- Member → Workout: 1:N
- Member → Payment: 1:N
- Trainer → Workout: 1:N
- Membership → Payment: 1:N

### Integrity rules

- User email is unique.
- Member userId is unique.
- Attendance uses a composite unique constraint on memberId + date.
- Payment amount uses PostgreSQL Decimal.
- Enum fields constrain status values.
- Foreign keys maintain referential integrity.
