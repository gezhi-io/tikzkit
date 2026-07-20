# Example Workbench

This folder is the staging area for new TikZ examples before they become stable
fixtures.

Use it for small snippets that are being investigated against TikZKit and local
`tikztosvg`. Do not put generated SVG, PNG, PDF, or TeX auxiliary files here;
generated artifacts belong under `test/fixtures/examples/output/`.

Each runnable workbench case still needs a `manifest.json` entry so the shared
render and diff scripts can find it.

