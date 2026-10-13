# CSIE Prep Hub

Node.js + Express + SQLite (built-in `node:sqlite`) local web app for a
Taiwanese CS grad school (資工所) exam: a calendar of the foundation-phase
video queue, the six subjects' chapters, and a study room where each lecture
video plays next to 3D concept animations, subtitles, notes and quizzes.
There is no AI feature in the app.

- `server.js` — Express app + API routes (settings, task progress, learning
  evidence, backup export/import, restart mode). Pages are served at clean
  paths: `/calendar[/YYYY-MM-DD]`, `/subjects[/<subj>[/<chapter>]]`,
  `/study/<subj>/<chapter>?v=<video>&t=<tab>` (chapter numbers start at 1).
- `db.js` — SQLite access layer
- `public/` — frontend: `index.html` + `app.js` (calendar, 六科, search),
  `study.html` + `study.js` (study room), `data.js` (subjects, chapters,
  videos), `motion.js` (show/hide animations), `lab/` (3D concept labs:
  `lab-engine.js`, `lab-shell.js`, `chapters/*.js`), `notes/`,
  `transcripts/` (subtitles, generated, not in git)
