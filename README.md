# E-Portfolio 匯出助手 📋

> 醫學影像部評量表單分析工具 - 完全客戶端處理，資料不上傳雲端

[![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-blue)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0-orange)](https://github.com)

## ✨ 功能特色

- 🔒 **完全客戶端處理** - 所有資料都在您的瀏覽器中處理，不會上傳到任何伺服器
- 📁 **多檔案支援** - 支援批次上傳和處理多個 HTML 評量表單
- 📊 **即時預覽** - 立即查看解析結果的完整資料表格
- 💾 **CSV 匯出** - 一鍵匯出為 Excel 可編輯的 CSV 格式
- 🎨 **現代化介面** - 深色主題，直覺易用的操作體驗
- 📱 **回應式設計** - 支援桌面、平板等多種裝置

## 🏥 支援的表單類型

- ✅ DOPS (Direct Observation of Procedural Skills) 直接觀察操作技巧評量
- ✅ Mini-CEX (Mini-Clinical Evaluation Exercise) 臨床評核測驗
- ✅ CBD (Case-Based Discussion) 案例討論評量
- ✅ EPA (Entrustable Professional Activities) 工作職場評估
- ✅ Milestone 里程碑評量
- ✅ 一般評量表單
- ✅ 整體實習成效回饋

## 🚀 使用方法

### 線上使用（推薦）

直接訪問 GitHub Pages 部署版本：

```
https://[你的使用者名稱].github.io/e-portfolio-web-tool/
```

### 本地使用

1. 下載或克隆此專案
2. 在瀏覽器中開啟 `index.html`
3. 上傳您的 HTML 評量表單檔案
4. 查看解析結果並匯出 CSV

## 📖 操作步驟

1. **上傳檔案** 📤
   - 將下載的 e-portfolio HTML 評量表單檔案拖放到上傳區域
   - 或點擊上傳區域選擇檔案（支援多選）

2. **預覽資料** 👀
   - 系統自動解析表單內容
   - 包含學員姓名、教師、日期、評分、回饋等完整資訊

3. **匯出 CSV** 💾
   - 點擊「匯出 CSV」按鈕
   - 下載完整的分析結果檔案
   - 可用 Excel 或其他試算表軟體開啟

## 🔐 隱私保證

**所有檔案處理都在您的瀏覽器中完成，不會上傳任何資料到伺服器。**

此工具使用純前端技術（HTML + CSS + JavaScript）開發：
- 沒有後端伺服器
- 沒有資料庫連接
- 沒有網路請求（除了載入頁面本身）
- 您的資料完全保留在本機電腦中

您可以：
- 開啟瀏覽器的開發者工具查看網路請求
- 離線使用此工具（下載後本地開啟）
- 查看原始碼確認安全性

## 🛠️ 技術架構

- **HTML5** - 結構與內容
- **CSS3** - 現代化深色主題設計
- **JavaScript (ES6+)** - 客戶端邏輯
- **DOMParser API** - HTML 解析
- **File API** - 檔案讀取
- **Blob API** - CSV 匯出

## 📦 專案結構

```
e-portfolio-web-tool/
├── index.html          # 主頁面
├── style.css           # 樣式表
├── parser.js           # HTML 解析引擎
├── app.js              # 應用程式邏輯
├── README.md           # 專案說明
└── .github/
    └── workflows/
        └── deploy.yml  # GitHub Actions 自動部署
```

## 🚢 部署到 GitHub Pages

### 方法一：使用 GitHub Actions（推薦）

1. 將專案推送到 GitHub：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/[你的使用者名稱]/e-portfolio-web-tool.git
   git push -u origin main
   ```

2. 在 GitHub 專案設定中啟用 GitHub Pages：
   - 前往 Settings > Pages
   - Source 選擇 "GitHub Actions"

3. 推送程式碼後會自動部署

### 方法二：手動部署

1. 前往 GitHub 專案的 Settings > Pages
2. Source 選擇 `main` 分支
3. 資料夾選擇 `/ (root)`
4. 點擊 Save

## 🔄 版本歷史

### v1.0 (2026-01-08)
- ✨ 首次發布
- 🎨 現代化深色主題介面
- 📊 支援所有主要評量表單類型
- 💾 CSV 匯出功能
- 🔒 完全客戶端處理

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 授權

MIT License - 自由使用、修改和分發

## 💬 常見問題

**Q: 我的資料真的不會上傳到雲端嗎？**  
A: 是的！所有處理都在您的瀏覽器中完成。您可以開啟開發者工具檢查網路請求，或離線使用此工具。

**Q: 支援哪些瀏覽器？**  
A: 支援所有現代瀏覽器，包括 Chrome、Firefox、Safari、Edge 等。

**Q: 可以處理多少個檔案？**  
A: 理論上沒有限制，但處理大量檔案時可能會受到瀏覽器記憶體限制。建議一次處理不超過 100 個檔案。

**Q: CSV 檔案用 Excel 開啟亂碼怎麼辦？**  
A: 檔案已使用 UTF-8 with BOM 編碼，Excel 應該能正確開啟。如果仍有問題，請嘗試：
1. 用記事本開啟 CSV 檔案
2. 另存新檔，編碼選擇 UTF-8
3. 再用 Excel 開啟

## 📧 聯絡方式

如有問題或建議，請開啟 GitHub Issue。

---

**由 Python 版本轉換而來 | 醫學影像部評量分析工具**
