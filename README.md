# Bonus Calculator

Web app that tracks employee performance, client revenue, and bonus earnings
throughout the year.

**Status:** auth (sign up / log in) and signed-in homepage. Dashboard, projects,
and productivity tracking are next.

## Stack

- Node.js 24 / Express 5
- MongoDB (Atlas) via Mongoose
- JWT auth (bcryptjs + jsonwebtoken)
- Vanilla HTML/CSS/JS frontend served from `public/`

## Local development

```bash
npm install
copy .env.example .env   # then fill in DATABASE_URL and JWT_SECRET
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Name | Purpose |
|------|---------|
| `DATABASE_URL` | MongoDB Atlas connection string (include a database name in the path) |
| `JWT_SECRET` | Secret for signing login tokens — long random string |
| `PORT` | Optional locally; Render sets it automatically |

## Deploy (Render)

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- Set `DATABASE_URL` and `JWT_SECRET` in the service's Environment tab.
- MongoDB Atlas → Network Access must allow `0.0.0.0/0`.
- Health check endpoint: `/healthz` (reports server + database status).

Pushing to `main` triggers an automatic deploy.
