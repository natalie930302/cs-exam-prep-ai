# CSIE Prep Hub

Node.js + Express + SQLite (through libSQL) web app for a Taiwanese CS grad
school (資工所) exam: a calendar of the foundation-phase video queue, the six
subjects' chapters, and a study room where each lecture video plays next to 3D
concept animations, subtitles, notes and quizzes. There is no AI feature in
the app. It runs locally (`npm start`, port 3210, data in `data/prep.db`) and
on Vercel with a Turso database; the cloud copy holds the real progress (see
`docs/雲端部署.md`).

- `server.js` — Express app + the APIs the pages use (settings, finished
  videos, study-room state, search) and the login. Pages are served at clean
  paths: `/calendar[/YYYY-MM-DD]`, `/subjects[/<subj>[/<chapter>]]`,
  `/study/<subj>/<chapter>?v=<video>&t=<tab>` (chapter numbers start at 1).
  `api/index.js` is the same app as a Vercel function.
- `auth.js`, `middleware.js` — one site password (`SITE_PASSWORD`; unset
  locally = no login). middleware.js does the check on Vercel before static
  files are served.
- `db.js` — database layer (async; local file, or Turso when
  `TURSO_DATABASE_URL` is set)
- `public/` — frontend: `index.html` + `app.js` (calendar, 六科, search),
  `study.html` + `study.js` (study room), `data.js` (subjects, chapters,
  videos), `motion.js` (show/hide animations), `lab/` (3D concept labs:
  `lab-engine.js`, `lab-shell.js`, `chapters/*.js`), `notes/`,
  `transcripts/` (subtitles, generated, not in git)

After changing anything, run `npm run check` (`tools/check.mjs`). It checks the
notes, quizzes and index; loads the main pages at phone and desktop widths and
looks for errors; confirms the 日曆／六科／搜尋 buttons stay fixed while
scrolling; and plays every scene of each lab chapter changed in the working
tree (use `--labs=all` for every chapter, about 20 minutes). It exits non-zero
on any problem.
