# DICOM ROI Analyzer 🔬

一個可部署在 GitHub Pages 的 DICOM 影像 ROI 分析工具。

## 功能特色

- 📂 **拖曳資料夾** - 直接將包含 DICOM 檔案的資料夾拖曳到網頁
- 🖼️ **影像檢視** - 瀏覽 DICOM 影像，使用方向鍵或按鈕切換
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
| ROI_Mean | ROI 平均值 |
| ROI_Noise_SD | ROI 雜訊標準差 |

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
