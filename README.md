# DICOM ROI Analyzer 🔬

一個可部署在 GitHub Pages 的 DICOM 影像 ROI 分析工具。

## 功能特色

- 📂 **拖曳資料夾** - 直接將包含 DICOM 檔案的資料夾拖曳到網頁
- 🖼️ **影像檢視** - 瀏覽 DICOM 影像，使用方向鍵或按鈕切換
- 🔍 **全螢幕模式** - 按 F 鍵可將影像放大至全螢幕檢視
- 🎚️ **Window Width / Window Level** - 滑鼠右鍵拖曳調整影像對比與亮度
- 🎯 **ROI 選擇** - 點擊影像設定圓形 ROI 的圓心位置
- 📊 **批次分析** - 自動分析所有影像的 ROI 平均值和標準差
- ✅ **選擇輸出標籤** - 在匯出前選擇要包含的 DICOM 標籤
- 📥 **CSV 匯出** - 下載分析結果為 CSV 檔案

## 使用方法

1. 拖曳包含 DICOM 檔案的資料夾到上傳區域
2. 使用 ◀ ▶ 按鈕或鍵盤 A/D 鍵切換影像
3. 在影像上點擊設定 ROI 圓心位置
4. 調整 ROI 半徑（預設 25 像素）
5. 點擊「⚡ 分析全部影像」進行批次處理
6. 點擊「📥 選擇標籤並匯出」
7. 勾選需要輸出的 DICOM 標籤
8. 確認後下載 CSV 報告

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
| Enter | 確認 ROI 位置 |

## 滑鼠操作

| 操作 | 功能 |
|------|------|
| 左鍵點擊 | 選取 ROI 圓心位置 |
| 右鍵拖曳 | 調整 Window Width / Window Level |

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
