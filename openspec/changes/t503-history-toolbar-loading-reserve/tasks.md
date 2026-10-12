# Tasks

- [x] 1. Spec delta for `loading-layout-stability`.
- [x] 2. Render the resolved frame invisible and inert while the role is unknown.
- [x] 3. Unit tests: frame parity, reserved slot and toggle, hidden and inert attributes, interactive roles unchanged.
- [ ] 4. WR lane: list pages and read annotations for /reports through onui-local before judging the UI.
- [ ] 5. WR lane (agent-browser): /reports with the session request held pending, as Lead and Head at 375 and 1440 CSS px; toolbar and History panel boxes differ by at most 1 px between loading and resolved; whole-page screenshots show no defect.
- [ ] 6. WR lane: no layout-shift entry attributed to the toolbar or panel; Tab and click never reach the reserve while loading.
- [ ] 7. WR lane: width sweep 440-520 px with archived reports present, record any wrap flip.
