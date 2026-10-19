# Weekline

Weekline turns a timetable into a reviewable weekly calendar. It keeps source evidence, overlap decisions, proposed changes, approval, and read-back verification visible in one workflow.

## Current capabilities

- Collects a cohort/section, electives, and a timetable source.
- Accepts pasted text, public static HTML/text/PDF URLs, and uploaded PDFs with selectable text.
- Extracts text from PDFs with PDF.js, preserving page-row order as far as the document's text layer allows.
- Parses class and exam sessions, flags overlaps, and retains rows it cannot parse with source locations and reasons.
- Proposes new, changed, and unchanged calendar entries before requiring a human approval action.
- Writes to a local demo calendar, reads those events back independently, and exports an `.ics` calendar.
- Includes the four official demo scenarios (TC1–TC4) and a separate exam-conflict example.
- Includes ten reusable synthetic timetable samples under `public/samples/timetables/`, selectable from the workspace.
- Persists runs, proposals, scenario results, and demo calendar entries as JSON under `.data` by default. Set `DATA_DIR` to use another directory.

This is an evidence-first deterministic workflow. It does not claim to use an LLM, bypass institutional logins, or synchronize directly with Google/Outlook. Public-source fetching is limited to static public HTML, text, and PDF responses; login-protected pages, JavaScript-only schedules, and image-only scanned PDFs require a permitted manual/OCR step. The URL fetcher rejects local and private network targets.

## Run locally

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Run as a persistent container

The production image uses Next.js standalone output and mounts a volume for the local audit data:

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). The hosting platform must retain the `/app/data` volume. This JSON-backed storage is intended for a single application instance; a multi-instance deployment should use a shared database. A public deployment still needs a hosting account and a persistent volume configured by its operator.

## Included PDF sample

[`public/samples/Godfrey-Okoye-University-FCIT-Lecture-Timetable-2026-2027.pdf`](public/samples/Godfrey-Okoye-University-FCIT-Lecture-Timetable-2026-2027.pdf) is a selectable-text 2026/2027 lecture timetable from the [official Godfrey Okoye University timetable page](https://gouni.edu.ng/lecture-time-table/). In the app, choose **Upload a PDF** and select **Use the included Godfrey Okoye University lecture timetable PDF**. This is a public demonstration source; the organizer's mock page/PDF has not been supplied.

## Sample timetables and source checks

The ten sample text files cover computer science, business, engineering, nursing, arts, data science, law, architecture, science, and elective overlaps. They use a consistent pipe-delimited layout and can be loaded as samples or pasted into the text source field. To verify all ten fixtures plus pasted text, the included PDF upload, and the public Godfrey Okoye PDF URL against a running local app, run:

```bash
node scripts/verify-timetable-samples.mjs
```

The Godfrey Okoye source omits AM/PM on many class ranges. Those slots are inferred as common daytime hours and deliberately marked for human review before calendar approval. Some wrapped titles, lecturer names, and other non-session PDF lines remain listed as unparsed source evidence.

## Deploy to Render

The app needs a Docker web service because its API routes and local JSON storage are part of the application. To keep saved reviews after redeploys, use a Render web service with a persistent disk:

1. Push this project to a GitHub repository and connect that repository when creating a new Render **Web Service**.
2. Select **Docker** as the runtime so Render builds the included `Dockerfile`.
3. Set `DATA_DIR` to `/app/data` and `PORT` to `10000` in the service environment.
4. Add a persistent disk mounted at `/app/data` (Render persistent disks require a paid web service).
5. Deploy. Render will provide a public `onrender.com` URL. Open it and run TC1–TC4, then verify the exported `.ics` and saved run history.

The app's JSON files support one service instance. If you need multiple instances, move persistence to a shared database before scaling. See [Render's Docker deployment guide](https://render.com/docs/docker) and [persistent disk guide](https://render.com/docs/disks).

## Demo flow

1. Choose one of the four official scenarios, the supplemental exam example, paste a timetable, enter a public timetable URL, or upload a text-based PDF.
2. Review the extracted text, source reference, and retrieval timestamp.
3. Inspect extracted sessions, clash evidence, and unparsed rows.
4. Review the calendar diff, then explicitly approve the local demo-calendar write.
5. Check the independent read-back verification and download the `.ics` file.

## Official scenarios

The Scenarios view runs TC1–TC4 against synthetic fixtures and records each case's expected result, actual result, and evidence. The exam example is supplemental and is not presented as an official test case.
