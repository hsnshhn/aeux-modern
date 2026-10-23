# Optional GitHub Actions workflow

Copy `modern.yml` to `.github/workflows/modern.yml` with a GitHub credential that can create workflows. It runs `npm run check` on macOS and uploads the built ZIP archives. The credential used to publish this fork did not have GitHub's `workflow` permission, so the workflow is provided as a template. Local automated and native validation is documented in `modern/docs/VALIDATION.md`.
