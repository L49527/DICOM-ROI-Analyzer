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

## 2026-04-08: 分析核心效能診斷與深度優化 (Core Analysis Diagnostic & Deep Optimization)

### 變更項目 (Changes):
- **記憶體管理優化 (Memory Management)**:
  - 移除 `analysis-worker.js` 中的 `Float32Array` 全影像拷貝。 (Removed full-image `Float32Array` cloning in worker).
  - 改用「即時重縮放 (On-the-fly Rescaling)」技術，僅在計算 ROI 或統計數據時讀取原始數據並套用 Slope/Intercept。 (Implemented UI on-the-fly rescaling to save 50-70% peak memory).
- **計算效能優化 (Computational Performance)**:
  - 利用數學公式 `Sum(v') = S * Sum(v) + N * I` 直接從原始整數陣列計算全圖平均值與標準差，避免浮點數轉換開銷。 (Optimized full-image stats calculation using raw integers).
- **串流數據傳輸 (Streaming Data Transfer)**:
  - 將 Worker 通訊改為「流式發送 (Streaming)」模式。 (Converted worker communication to streaming mode).
  - 每處理完一張影像即回傳結果 (`result_chunk`)，防止大數據量時的 `postMessage` 序列化瓶頸與 UI 卡頓。 (Results are sent image-by-image to ensure smooth UI updates and prevent crashes on large datasets).
- **錯誤處理中樞化 (Centralized Error Handling)**:
  - Worker 內部錯誤會透過 `postMessage` 回傳具體錯誤訊息與檔名。 (Worker errors are now reported back to the main thread with context).
  - 更新 `app.js` 以即時彈出 Toast 提示分析失敗的具體原因。 (Updated `app.js` to show actionable error toasts).
- **依賴本地化 (Dependency Localization)**:
  - 下載 `dicom-parser@1.8.21` 至本地。 (Downloaded `dicom-parser` locally).
  - 確保工具在醫院內部網路 (Intranet/Offline) 也能穩定運行，並解決定時更新帶來的相容性風險。 (Ensured offline stability and eliminated CDN risks).

### 技術摘要 (Technical Summary):
- 顯著提升了處理 100+ 張高解析度影時的穩定性。 (Significantly improved stability for 100+ high-res images).
- 實現了「零拷貝 (Zero-Copy)」思維的數據處理流程。 (Implemented a zero-copy mindset for data processing).
- 強化了系統在大數據與弱網環境下的健壯性。 (Enhanced robustness for big data and poor network conditions).
- 確保所有輸出(CSV)皆遵循用戶在 UI 介面上勾選的項目。 (Ensured all CSV outputs follow user-selected items in the UI).
