# Design QA

## Current layout (2026-11-12)

The workstation layout is static in `index.html`. `workstation.js` only handles layout behaviour.

- Top bar: logo, Series button and the active Series summary, theme toggle, help.
- Image canvas: black DICOM canvas with corner overlays and an empty state that has load actions.
- Viewer bar: slice navigation, slice location, ROI / line tool, image settings dialog, fit to canvas, zoom, fullscreen.
- Splitter: drag or use arrow keys to resize the dock; Home or 重設布局 resets it.
- Dock: left 「ROI 清單」/「線段剖面」, right 「分析條件」.
- Action bar: run summary and status, 明細, 匯出 CSV, 開始分析 / 取消.
- Dialogs: 影像設定 and 分析預覽與結果 are native `<dialog>`; Series manager, help, export fields, display tags, raw header and line detail use `.modal`.

## Checks run

- Viewports: 1024 × 768 and 375 × 812, dark theme.
- Synthetic, non-patient DICOM: CT (3 slices, 256 × 256), MONOCHROME1 DX, and a CT with HTML in text tags.
- Empty state: status reads 先載入 Series; 明細 buttons are disabled; no false 「處理待確認項目」.
- Loaded: ROI placement, analysis, details dialog, export field dialog, line mode switch.
- 375 px: no horizontal overflow; analysis card content stays inside its border.
- Browser console: no errors.

## Remaining polish

- Corner overlays can touch each other on very narrow screens with long patient names.
- Toast messages still mix Chinese and English in some line-profile actions.
