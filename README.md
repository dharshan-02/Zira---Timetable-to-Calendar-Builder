# Weekline 

**Turn a timetable into a reviewable weekly calendar.** Weekline extracts class and exam sessions from timetable text, public pages, and selectable-text PDFs, checks for clashes, and shows proposed calendar changes for approval before exporting an iCalendar file.

[Open the live demo](https://zira-timetable-to-calendar-builder.onrender.com/) · [View the source on GitHub](https://github.com/dharshan-02/Zira---Timetable-to-Calendar-Builder)

> Weekline is a deterministic, evidence-first timetable workflow. It does not claim to use an AI model, connect to Google or Outlook, or sync with a university system. Calendar writes are made to the app's local demo calendar.

## What it does

- **Bring in a timetable:** use a built-in sample, paste text, provide a public static HTML/text/PDF URL, or upload a PDF with selectable text.
- **Review the source:** inspect extracted text and source references before working with the schedule.
- **Extract sessions:** identify classes and exams with course, day, time, room, instructor, source row, and confidence details where available.
- **Audit clashes:** flag overlapping sessions and highlight unreadable or unparsed rows with their source evidence.
- **Preview changes:** compare proposed new, updated, unchanged, and removed calendar entries before anything is written.
- **Approve deliberately:** approve the proposal to write it to the local demo calendar, then independently read the entries back for verification.
- **Keep an audit trail:** reopen saved reviews from Review history and export approved calendar entries as `.ics`, `.xlsx`, `.docx`, or `.pdf`.
- **Explore scenarios:** run the four benchmark cases (TC1–TC4) and try ten synthetic timetable examples.

## Workflow

```text
Choose source → Retrieve → Extract sessions → Audit clashes
      → Review proposed changes → Human approval → Write → Verify and export
```

Every review retains its source snapshot, parsed sessions, clash evidence, proposal, and verification results so a person can inspect the work before approving it.

## Supported sources and limits

| Source | Support | Notes |
| --- | --- | --- |
| Built-in scenarios and text samples | Yes | Includes TC1–TC4, an exam-conflict example, and ten sample schedules. |
| Pasted timetable text | Yes | Best results come from consistent rows with course, day, and time information. |
| Public timetable URL | Yes | Supports public static HTML tables, text, CSV, and PDF responses. |
| PDF upload | Yes | Selectable-text PDFs up to 12 MB. |
| Scanned or image-only PDF | Limited | Requires OCR or manual transcription; image-only PDFs are not silently treated as readable text. |
| Login-protected or JavaScript-only source | No | Use an authorized export or paste the timetable text instead. |

Timetable layouts vary. Weekline keeps rows it cannot confidently parse visible for human review; extracted times and course details should be checked against the source before approval. The source picker includes official [Godfrey Okoye University lecture timetable](https://gouni.edu.ng/lecture-time-table/) and [exam timetable](https://gouni.edu.ng/exam-timetable/) pages. When a page is fetched, the final URL, source name, content type, and retrieval time are attached to its saved review. The official exam PDF currently uses a date-column matrix; it is retained as source evidence, but ambiguous course/date cells still require a human to map them before approval. A public lecture timetable PDF is also included at [`public/samples/Godfrey-Okoye-University-FCIT-Lecture-Timetable-2026-2027.pdf`](public/samples/Godfrey-Okoye-University-FCIT-Lecture-Timetable-2026-2027.pdf).

## Tech stack

- Next.js App Router and React
- TypeScript
- Tailwind CSS
- PDF.js for selectable-text PDF extraction
- FullCalendar for weekly calendar views
- ExcelJS, docx, and pdf-lib for Excel, Word, and PDF calendar exports
- JSON file persistence for the single-instance demo deployment

## Run locally

Requirements: Node.js and npm. The production container is based on Node.js 24.

```bash
npm ci
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

To create an optimized production build and run it locally:

```bash
npm run build
npm run start
```

## Verify the project

Start the app with `npm run dev`, then run the checks from another terminal:

```bash
npm run lint
npx tsc --noEmit
npm run test:all
```

The API, sample, and scenario scripts use `http://localhost:3000` by default. Set `BASE_URL` to point them at another running instance. For a password-protected deployment, set `AUTHORIZATION` to its Basic Auth header value when running the scripts.

## Run in Docker

The included Dockerfile builds a standalone Next.js server. Docker Compose also mounts persistent storage for review history and the local demo calendar:

```bash
docker compose up --build
```

Visit [http://localhost:3000](http://localhost:3000). Stop the service with `Ctrl+C`; remove the Compose container with `docker compose down`. The named `weekline-data` volume remains so saved review data is retained.

## Deploy to Render

The app requires a **Web Service** because it uses server-side API routes. Deploy the repository with the included Dockerfile:

1. In Render, choose **New → Web Service** and connect this GitHub repository.
2. Leave **Root Directory** blank; the Dockerfile is at the repository root.
3. Select **Docker**, choose a region and service plan, then configure the service.
4. Add these environment variables:

   | Key | Value |
   | --- | --- |
   | `DATA_DIR` | `/app/data` |
   | `PORT` | `10000` |

5. Set `WORKSPACE_PASSWORD` to a long, random password (and optionally `WORKSPACE_USERNAME`; it defaults to `weekline`) in Render's Environment settings. The app returns HTTP 503 in production if the password is missing, so the shared workspace cannot be exposed by an incomplete setup. The browser will request Basic Auth credentials when you open the service.
6. To retain review history across deploys and restarts, attach a persistent disk mounted at `/app/data`. Render persistent disks require a paid service.
7. Create the service, wait for deployment, and open its `onrender.com` URL. Run TC1–TC4 and check PDF intake, approval, history, and all calendar exports.

See Render's [Docker deployment guide](https://render.com/docs/docker) and [persistent disk guide](https://render.com/docs/disks) for current platform details.

## Data, privacy, and deployment notes

- Review records and demo-calendar entries are stored as JSON under `.data` by default. Set `DATA_DIR` to change the location.
- Only files written under the persistent disk mount survive a Render deploy or restart. Without a disk, treat saved history as temporary.
- JSON persistence is designed for one application instance. Use a shared database before scaling to multiple instances.
- The demo uses one password-protected shared workspace, not per-user data separation. Use synthetic or non-sensitive data and do not reuse a personal password.
- Public URL fetching rejects local/private targets, validates each redirect, and pins the HTTP connection to the exact public IP address that was validated.
- TC1–TC4 use synthetic fixture data. Running them records the source fixture, actual result, and evidence but does not write to or clear the shared calendar. Approve a real timetable proposal explicitly before calendar writes.
- Weekline does not directly write to Google Calendar or Outlook. Use the `.ics` export to import events into a calendar you control.

## Repository layout

```text
src/app/              Next.js pages and API routes
src/components/       Calendar, scenario, history, and presentation views
src/lib/              Parsing, clash detection, persistence, and verification logic
public/samples/       Public PDF and synthetic timetable fixtures
scripts/              API and timetable sample verification scripts
Dockerfile            Production container build
docker-compose.yml    Local container setup with persistent data volume
```

## License

No license is currently declared. Contact the repository owner before redistributing or reusing this project outside the repository's stated purpose.
