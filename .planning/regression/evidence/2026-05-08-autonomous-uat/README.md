# Autonomous UAT Evidence - 2026-05-08

web: http://localhost:3000
api: http://localhost:3002

pass: 9
fail: 2
blocked: 1

fail:

- SC-17-06 admin panel: user selector stayed hidden
- SC-17-08 navigation active state: no active nav link detected

blocked:

- SC-16-02 theme toggle current build: no ThemeProvider/theme toggle surface

See uat-live-results.json and screenshots/.
