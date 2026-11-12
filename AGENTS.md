# AGENTS — DICOM ROI Analyzer

Static, browser-only DICOM ROI / line-profile tool. No build step, no backend.

## Files
- `index.html` — full workstation markup (image canvas, bottom dock, action bar, dialogs).
- `app.js` — state, DICOM loading, rendering, ROI / line tools, CSV export.
- `workstation.js` — layout behaviour only: fit-to-canvas, dock splitter, dialogs, summary bar.
- `analysis-core.js` — pure functions: pixel decoding, ROI statistics, slice selection. Shared by the page and the Worker.
- `analysis-workflow.js` — analysis run orchestration (preview, Worker tasks, cancel, results).
- `analysis-worker.js` — Worker entry; loads `dicomParser.min.js` + `analysis-core.js`.
- `style.css` base tokens/components; `workstation.css` workstation layout.

## Rules
- Any DICOM-derived string inserted with `innerHTML` must go through `escapeSeriesHtml()`; prefer `textContent`.
- Display transforms (WW/WL, MONOCHROME1 inversion, zoom, rotation) never change sampled ROI values.
- Keep relative URLs so the site works under a GitHub Pages sub-path.
- UI copy is Traditional Chinese first; keep DICOM tag names, units and values as-is.

## Local preview
```sh
python3 -m http.server 8000 --bind 127.0.0.1
```
Open `http://127.0.0.1:8000`. Use synthetic, non-patient DICOM for testing; never commit patient data.
