# DICOM De-ID WebEngine v3

![Version](https://img.shields.io/badge/Version-3.0_Batch-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![PureFrontend](https://img.shields.io/badge/Architecture-100%25_Streaming_Client-orange)

DICOM De-ID WebEngine v3 是一個專為**巨量醫療影像 (Massive Batch)** 所打造的極致開源去識別化工具。
採用 100% 純網頁前端架構 (Pure Client-Side Web Architecture) 並結合最新的 **File System Access API**，您不需要安裝任何伺服器或 Python 環境，只需要一個瀏覽器即可高速處理數百 GB 甚至是 TB 級別的 DICOM 資料，且**完全不會消耗記憶體導致當機**。
所有的運算皆在本地端完成，**您的醫療影像資料（PHI）絕對不會上傳到任何網路伺服器。**

DICOM De-ID WebEngine v3 is a **Massive Batch** privacy-first, open-source medical image de-identification tool.
Built on a 100% Pure Client-Side Web Architecture utilizing the cutting-edge **File System Access API**, it requires no server or Python environment. It can stream-process hundreds of GBs of DICOM data with **zero memory crashes**. All data processing happens locally, and **Your Protected Health Information (PHI) is never uploaded to any network server.**

---

## ✨ 核心特色 / Key Features

1. **無限容量串流讀寫 (Infinite Streaming I/O)**
   - 捨棄傳統的 JSZip 記憶體耗盡問題，程式將請求您的硬碟權限，讀取、覆寫並立刻存回您的新資料夾，可一次處理 1000 位病人以上的巨量資料。
   - Bypasses traditional JSZip memory limits. Streams files directly to disk, allowing you to process 1000+ patients' scans simultaneously.
2. **自動分類與對照表歸檔 (Auto-Structuring & Mapping)**
   - 處理完成後，程式會自動使用**原始 ID**為您建立完美階層：`Output / 原_Patient_ID / 原_AccessionNo / 檔案.dcm`。並在根目錄自動附上 `Mapping.csv`。
   - Automatically builds a neat directory tree using the **Original IDs**: `Output / Orig_Patient_ID / Orig_Accession / files.dcm` and outputs a `Mapping.csv`.
3. **自訂去識別化標籤清單 (Custom De-ID Tags Panel)**
   - 除了強制的 `PatientID, AccessionNo, PatientName` 外，支援圖形化勾選超過 10 個以上的敏感去識別化標籤（包含生日、性別、醫生、操作員等）。
   - Besides the forced core identifiers, provides a UI checklist to wipe 10+ common PII tags.
4. **百分百隱私安全 (100% Privacy Secure)**
   - 所有的資料處理皆在瀏覽器本地端完成，網頁載入後可完全離線運作。
   - Completely offline after initial load.
5. **現代化簡約介面 (Modern Minimalist UI)**
   - 採用 Tailwind CSS 打造如同現代化醫療工作站般明亮、俐落的極致簡約介面。
   - Features a bright, clean, premium interface built with Tailwind CSS.

## 🚀 如何使用 / How to Use

📍 **⚠️ 重要：由於系統需要最新的直接硬碟存取技術，請務必使用電腦版的 Google Chrome 或 Microsoft Edge 開啟。** (safari 目前不支援)

1. 下載或 Clone 此專案資料夾。
2. 點兩下開啟 `index.html`。
3. 點擊 **「選擇輸入資料夾 (Input)」**，選取包含大量原始 DICOM 的目錄。
4. 點擊 **「選擇輸出資料夾 (Output)」**，選取一個空的準備接收檔案的目錄。(**當瀏覽器詢問是否允許網站查看或儲存檔案時，請點擊允許**)。
5. 在左側清單中打勾需要去識別化的個別標籤。
6. 點選右側的「**開始串流轉換**」，完成！

---

## ⚠️ 注意事項 / Important Notes

- **DICOM 標準**: 網頁版採用覆寫 (In-place patching) 標籤的方式以保持極致的速度。新產生的 `Subject_XXX` 長度會被填充至與原本的 `PatientID` 等長以符合 DICOM Length 的位元規範。

## 📦 使用套件 / Libraries Used
- [Tailwind CSS](https://tailwindcss.com/) (Styling)
- [dicomParser](https://github.com/cornerstonejs/dicomParser) (DICOM tag parsing & patching)
- [FontAwesome](https://cdnjs.cloudflare.com/ajax/libs/font-awesome) (Icons)
