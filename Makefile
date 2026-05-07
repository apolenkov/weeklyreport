.PHONY: help doctor gsd-defaults gsd-defaults-codex

help:
	@echo "CustomReport"
	@echo ""
	@echo "Usage:"
	@echo "  make doctor             Verify Codex/GSD runtime and local compose config"
	@echo "  make gsd-defaults       Install project GSD defaults"
	@echo "  make gsd-defaults-codex Install project GSD defaults with GSD_RUNTIME=codex"

doctor:
	@GSD_RUNTIME=$${GSD_RUNTIME:-codex} bash scripts/doctor.sh

gsd-defaults:
	@bash scripts/bootstrap-gsd-defaults.sh

gsd-defaults-codex:
	@GSD_RUNTIME=codex bash scripts/bootstrap-gsd-defaults.sh
