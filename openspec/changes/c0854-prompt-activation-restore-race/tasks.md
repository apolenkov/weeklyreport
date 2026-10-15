# Tasks

- [ ] 1. Add a PostgreSQL regression that drives the real stale-activation, winning-activation and restore schedule, run it on the unchanged source, and record the observed outcome without assuming a victim.
- [ ] 2. If it fails and the failure is reviewed, lock the feature control row before activation reads the pointer, keeping unrelated errors propagating; otherwise keep the regression as the contract and change no product code.
- [ ] 3. Run the applicable gates, obtain an independent review, and deliver.
