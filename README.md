# DICOM ROI Analyzer 🔬

一個可部署在 GitHub Pages 的 DICOM 影像 ROI 分析工具。

## 功能特色

- 📂 **拖曳資料夾** - 直接將包含 DICOM 檔案的資料夾拖曳到網頁
- 🖼️ **影像檢視** - 瀏覽 DICOM 影像，使用方向鍵或按鈕切換
- 🔍 **縮放與平移** - 支援滑鼠滾輪 (Scroll-Wheel) 縮放，按住空白鍵或中鍵可平移
- 🌙 **深色模式** - 提供一鍵切換深淺色系的主題模式 (連動系統設定)
- 🎚️ **Window Width / Window Level** - 滑鼠右鍵拖曳調整影像對比與亮度
- 🎯 **ROI 選擇與復原** - 點擊影像設定 ROI，支援 `Ctrl+Z` 快速復原
- 📏 **中心十字 (Crosshair)** - 支援「隨影像移動」與「固定在視窗」雙模式，協助對齊
- 📊 **批次分析** - 自動分析所有影像的 ROI 平均值和標準差
- ✅ **選擇輸出標籤** - 在匯出前選擇要包含的 DICOM 標籤
- 📥 **CSV 匯出** - 下載分析結果為 CSV 檔案

## 使用方法

1. 拖曳包含 DICOM 檔案的資料夾到上傳區域
2. 使用 ◀ ▶ 按鈕或鍵盤 A/D 鍵切換影像
3. 按住 **Space + 滑鼠左鍵** 或使用 **滑鼠中鍵** 即可在任何比例下平移影像
4. 在影像上點擊設定 ROI 圓心位置
5. 調整 ROI 半徑（預設 25 像素）
6. 點擊「⚡ 分析全部影像」進行批次處理
7. 點擊「📥 選擇標籤並匯出」
8. 勾選需要輸出的 DICOM 標籤
9. 確認後下載 CSV 報告

## 影像檢視功能

### 🔍 全螢幕模式
按 **F 鍵** 可切換全螢幕顯示，再按一次返回正常模式。

### 🎚️ Window Width / Window Level 調整
**滑鼠右鍵按住拖曳** 可即時調整影像對比與亮度：

| 拖曳方向 | 調整項目 | 效果 |
|---------|---------|------|
| ← 往左 | Window Width ↓ | 提高對比度 |
| → 往右 | Window Width ↑ | 降低對比度 |
| ↑ 往上 | Window Level ↑ | 影像變亮 |
| ↓ 往下 | Window Level ↓ | 影像變暗 |

按 **R 鍵** 可重設 WW/WL 到初始值。

## 鍵盤快捷鍵

| 按鍵 | 功能 |
|------|------|
| A / ← | 上一張影像 |
| D / → | 下一張影像 |
| F | 切換全螢幕模式 |
| R | 重設 Window Width / Window Level |
| Q / E | 旋轉影像 ±90° |
| Space + 拖曳 | 平移影像 (Pan) |
| Backspace / `Ctrl+Z` | 復原 (刪除上一個 ROI) |
| Delete | 清除所有 ROI |

## 滑鼠操作

| 操作 | 功能 |
|------|------|
| 左鍵點擊 | 選取 ROI 圓心位置 |
| 右鍵拖曳 | 調整 Window Width / Window Level |
| 滾動滾輪 | 放大 / 縮小影像 |
| **中鍵拖曳** | **平移影像 (Pan)** |
| **Space + 左鍵拖曳** | **平移影像 (Pan)** |

## 可輸出的 DICOM 標籤

工具會自動偵測 DICOM 檔案中的標籤，常見標籤包括：

| 標籤名稱 | 說明 |
|---------|------|
| PatientName | 病人姓名 |
| PatientID | 病人 ID |
| StudyDate | 檢查日期 |
| Modality | 影像模態 |
| Manufacturer | 設備製造商 |
| KVP | 管電壓 |
| ExposureTime | 曝光時間 |
| XRayTubeCurrent | 管電流 |
| ExposureIndex | 曝光指數 |
| TargetExposureIndex | 目標曝光指數 |
| DeviationIndex | 偏差指數 |
| ROI_Mean | ROI 平均值 |
| ROI_Noise_SD | ROI 雜訊標準差 |
| FullImage_Mean | 全影像平均值 |
| FullImage_SD | 全影像標準差 |
| SliceLocation | 切片位置 |
| InstanceNumber | 影像編號 |

## 技術細節

- 純 HTML/CSS/JavaScript，無需後端
- 使用 [dicom-parser](https://github.com/cornerstonejs/dicomParser) 解析 DICOM 檔案
- 所有處理在瀏覽器端完成，資料不會上傳到伺服器
- 支援 16-bit 灰階 DICOM 影像

## 瀏覽器支援

- ✅ Chrome / Edge
- ✅ Firefox
- ✅ Safari

## 授權

MIT License

---

## 更新紀錄 / Change Log

### 2026-04-06 — Priority Bug Fixes (優先錯誤修復)

| # | Issue / 問題 | Fix / 修復 |
|---|---|---|
| 1 | `traverseFileTree` 只讀取資料夾的第一批檔案 (~100)，大型資料夾會遺漏 DICOM 檔案 | 改用重複呼叫 `readEntries()` 直到回傳空陣列，確保讀取所有檔案 |
| 2 | ROI 座標沒有考慮影像旋轉，旋轉後 ROI 會放在錯誤位置 | `getCanvasCoordinates()` 加入旋轉反向轉換；ROI 繪製移入旋轉 transform 內 |
| 3 | `DISPLAY_TAG_MAPPING` 中 `WindowCenter` key 重複定義 | 移除重複的 key |
| 4 | `renderImage()` 每次呼叫都建立新的離螢幕 canvas，造成 GC 壓力 | 改用快取的 `state._offCanvas`，僅在尺寸變更時重建 |
| 5 | 使用 `alert()` 顯示分析結果會阻塞 UI | 改用非阻塞式 Toast 通知系統 (`showToast()`) |
| 6 | `commonTags` 陣列在兩個函式中重複定義 | 提取為全域常數 `COMMON_TAGS` |
| 7 | `updateCustomTagsOverlay()` 含 7 個 debug `console.log()` | 移除所有 debug 輸出 |
| 8 | `runAnalysis()` 中有重複的註解行 | 移除重複的 `// Apply Slice Location Filter` |

### 2026-04-06 — Phase 2 & 3 Enhancements (使用者體驗升級)

| 階段 | 項目分類 | 更新內容 |
|---|---|---|
| P2 | 穩定度修復 | `getContext('2d')` 延遲至 `init()` 內執行，避免 DOM 未載入崩潰 |
| P2 | 效能提升 | `renderImage()` 核心改為 `Uint8ClampedArray` 隱式鉗位，渲染更順暢 |
| P2 | UI/UX | 新增支援滑鼠滾輪 (`Wheel`) 直覺縮放影像 |
| P2 | 程式碼品質 | 將 `index.html` 與 `app.js` 中十餘處 Inline CSS 移至 stylesheet |
| P3 | UI/UX | 🌙 新增全局深色模式 (Dark Theme) 支援，並記憶於 LocalStorage |
| P3 | UI/UX | 🧲 旋轉拉桿新增磁吸效果 (Magnetic Snapping)，靠近 0/90/180° 時自動吸附 |
| P3 | UI/UX | ⌨️ 新增 `Ctrl+Z` 復原 ROI、`Delete` 清空 ROI，並在介面標示快捷鍵提示 |
