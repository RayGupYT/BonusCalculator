# Bonus Calculator

Web app that tracks employee performance, client revenue, and bonus earnings
throughout the year.

**Status:** auth, employee and project dashboards, monthly revenue tracking,
the bonus dial with pacing, CSV import, and shareable read-only reports.
Productivity tracking is next.

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

## Importing data from a CSV

**Employees → Import CSV** creates employees, their projects, and the monthly
revenue behind the bonus dial in one pass. Choosing a file shows a preview of
exactly what would change; nothing is written until you press **Import**.

Employees and projects are matched to what you already have by name
(case- and spacing-insensitive), so re-importing an updated export tops up the
existing records instead of duplicating them.

A header row is required. `Employee` and `Project` are the only mandatory
columns, and revenue can be laid out either way:

**One row per month**

```csv
Employee,Project,Client,Year,Month,Amount
Alex Johnson,Acme Website,Acme Corporation,2026,Jan,12500
Alex Johnson,Acme Website,Acme Corporation,2026,Feb,"$13,000"
Dana Smith,Northwind Retainer,Northwind Inc,2026,2,15000
```

**One column per month**

```csv
Employee,Project,Client,Jan 2026,Feb 2026,Mar 2026
Alex Johnson,Acme Website,Acme Corporation,12500,13000,
Dana Smith,Northwind Retainer,Northwind Inc,,15000,15000
```

Plain `Jan`…`Dec` headers also work when the file carries a `Year` column.

### Columns

| Column | Applies to | Notes |
|--------|-----------|-------|
| `Employee` | employee | Required. Aliases: `Staff`, `Person`, `Sales Rep`, `Account Manager` |
| `Project` | project | Required. Aliases: `Job`, `Engagement` |
| `Client` | project | Aliases: `Customer`, `Account`, `Company` |
| `Year` / `Month` / `Amount` | revenue | Row-per-month layout. `Period` works in place of `Year`+`Month` |
| `Jan 2026`, `2026-02`, … | revenue | Column-per-month layout |
| `MRR` | project | Monthly recurring revenue used to prefill new months |
| `Active` | project | `yes`/`no`, `true`/`false`, `active`/`inactive` |
| `Min` / `Max` / `Threshold` / `Bonus Rate` | employee | Bonus dial settings |
| `Hire Date` | employee | `YYYY-MM-DD` or `M/D/YYYY`; prorates the dial for the hire year |

Columns named `Total`, `Notes` or `ID` are ignored on purpose; anything else
unrecognised is skipped and listed in the preview.

### Details worth knowing

- Amounts may include `$`, thousands separators and spaces. Use `.` for
  decimals. Negative amounts are rejected.
- A blank amount is skipped; an explicit `0` is stored as zero.
- Months that already hold a value are replaced by default, or can be left
  alone — the dialog has the choice.
- Rows that cannot be read are reported with their line number and block the
  import, unless you opt to import the valid rows only.
- Comma, semicolon and tab delimiters are detected automatically, so you can
  also paste rows straight out of a spreadsheet.
- Limits: 4 MB per file, 20,000 rows, 500 employees, 3,000 projects.

## Sharing read-only reports

**Share report** on an employee's dashboard mints a link like
`/r/<token>` that anyone can open without an account. It shows that one
employee's bonus report for one year — the dial, the pacing bar, the bonus
terms, and the month and project breakdown — and nothing else.

What the viewer gets:

- No sign-in, no app shell, no editing: the page has no form, input or button.
- Exactly the owner's figures. The dashboard and the shared report are drawn by
  the same renderer (`public/report-view.js`) over the same server-side maths
  (`lib/employeeSummary.js`), so they cannot drift apart.
- Live revenue. Later edits to the months show up on the report; only the
  *year* is pinned at the moment the link is created.
- `noindex` and `no-referrer`, so the link stays out of search engines and is
  not handed to other sites in a referer header.

What the link does not expose: any other employee, any database id, the owner's
email, or anything writable. The public payload is assembled field by field
rather than reusing the signed-in response.

### Managing links

The share dialog lists every link for that employee with its year, expiry,
view count and when it was last opened. Links can expire after 7, 30, 90 or
365 days, or never. **✕** revokes one, which breaks the URL immediately;
deleting an employee revokes theirs too. A revoked or expired link renders a
plain "not available" page with no data on it. An account may hold 100 links at
a time.

The token is 32 random bytes (base64url) and is stored as-is so you can copy
the link again later — treat the URL itself as the secret, the way you would a
"anyone with the link" share elsewhere.

## Deploy (Render)

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- Set `DATABASE_URL` and `JWT_SECRET` in the service's Environment tab.
- MongoDB Atlas → Network Access must allow `0.0.0.0/0`.
- Health check endpoint: `/healthz` (reports server + database status).

Pushing to `main` triggers an automatic deploy.
