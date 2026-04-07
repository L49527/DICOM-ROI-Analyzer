# DICOM ROI Analyzer 修改紀錄 (Change Log)

## 2026-04-07: 單張分析匯出功能擴充 (Single Image Export Enhancement)

### 變更項目 (Changes):
- **單張分析增加標籤選擇 (Tag Selection for Single Analysis)**:
  - 更新 `app.js` 中的 `state` 物件，新增 `exportMode` 以辨識當前是批次還是單張匯出。 (Added `exportMode` to `state` in `app.js`).
  - 修改 `exportSingleBtn` 的行為，改為開啟 `openTagModal('single')` 而非直接下載。 (Modified `exportSingleBtn` to open `tagModal` with 'single' mode).
  - 更新 `confirmExportBtn` 的監聽器，根據 `exportMode` 決定執行的匯出函式。 (Updated `confirmExportBtn` logic to handle both batch and single modes).
- **動態提取 DICOM Tags (Dynamic Tag Extraction)**:
  - 修改 `finishAnalysis` 和 `displaySingleAnalysisResults` 函式，分析後自動將結果中的所有欄位名稱加入 `state.availableTags`。 (Updated analysis functions to dynamically populate `availableTags` from results).
- **文件更新 (Documentation)**:
  - 更新主角 `README.md`，新增功能說明。 (Updated main `README.md` with feature description).

### 技術摘要 (Technical Summary):
- 統一了單張與批次分析的標籤過濾機制。 (Unified tag filtering mechanism for both modes).
- 解決了原本單張分析匯出時欄位固定且無法選擇的問題。 (Fixed the issue where single analysis fields were fixed and unselectable).
- 確保所有輸出(CSV)皆遵循用戶在 UI 介面上勾選的項目。 (Ensured all CSV outputs follow user-selected items in the UI).
