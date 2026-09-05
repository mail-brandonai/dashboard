# SVWAP audit dashboard

This public repository hosts the redacted GitHub Pages dashboard for the private SVWAP CSV audit project.

The private repository publishes data/report.json after a completed audit when the repository secret SVWAP_AUDIT_PAGES_TOKEN is configured. The public report contains dispositions and aggregate overlap information only; it does not contain raw CSV data, producer packets, storage paths, hashes, or exact mismatch values.

The site is deployed by GitHub Actions from the main branch.