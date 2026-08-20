# ERM System

Phase 1 foundation for a Business ERP, Inventory, Sales and Financial Management System.

## Local setup

1. Install PostgreSQL and create a database named `erm_system`.
2. Copy `.env.example` to `backend/.env` and set a JWT secret of at least 32 characters.
3. Run:

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate -- --name init
npm --prefix backend run prisma:seed
npm run dev
```

The API runs on `http://localhost:4000`; the Vite app runs on `http://localhost:5173`.

Seed users:

- `admin@erm.local` / `Admin@12345`
- `manager@erm.local` / `Manager@12345`
- `staff@erm.local` / `Staff@12345`

## Phase 1 API

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me` with `Authorization: Bearer <token>`
- `POST /api/auth/users` (Admin only)
