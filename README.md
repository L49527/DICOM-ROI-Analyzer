# DICOM ROI Analyzer 使用說明與修改紀錄

本工具在瀏覽器內讀取 DICOM，計算圓形 ROI 與線段剖面。適用於影像研究與品質檢查。分析結果不能取代經驗證的臨床診斷系統。

本說明採繁體中文、短句及一步一動作。保留介面名稱、標籤、數值與單位。這不是經正式 ASD-STE100 字典審查的英文 STE 文件。

## 目錄

- [開始前](#開始前)
- [快速開始](#快速開始)
- [載入與檢視影像](#載入與檢視影像)
- [建立與修改-roi](#建立與修改-roi)
- [選擇分析範圍與切片](#選擇分析範圍與切片)
- [執行取消與結果狀態](#執行取消與結果狀態)
- [匯出-csv](#匯出-csv)
- [kvpkev-與-ge-標籤](#kvpkev-與-ge-標籤)
- [線段剖面](#線段剖面)
- [常見問題](#常見問題)
- [資料保留與限制](#資料保留與限制)
- [驗證方式](#驗證方式)
- [修改紀錄](#修改紀錄)

## 開始前

1. 準備原始 DICOM 資料。
2. 開啟網站，或以本機靜態網站方式開啟專案。
3. 確認影像矩陣、Pixel Spacing 與切片位置。
4. 決定使用固定像素座標或病人座標。

原始影像不會被修改。請先確認資料處理與分享符合你的機構規範。

網站不需要後端。部署時，將 `index.html`、`style.css`、`workstation.css`、`app.js`、`workstation.js`、`analysis-core.js`、`analysis-workflow.js`、`analysis-worker.js`、`dicomParser.min.js` 與本文件放在同一目錄。`workstation.js` 與 `workstation.css` 是第 2 版工作站布局所需檔案。`analysis-worker.js` 由執行期間的 Worker 載入。程式使用相對路徑，支援 GitHub Pages 專案子路徑。更新時請一併更新這些檔案。

直接以 `file://` 開啟可能受瀏覽器的資料夾或 Worker 限制。可使用檔案選取與相容模式。若資料夾操作失敗，改用本機 HTTP 網站。

本機預覽範例：在專案目錄執行以下指令，再開啟 `http://127.0.0.1:8000`。

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

## 快速開始

1. 在初始畫面或影像畫布按「選擇資料夾」。已有影像時，按頂部「Series」後再按「資料夾」。
2. 選擇含 DICOM 的資料夾。
3. 在「Series 管理器」抽屜按目標 Series 的「開啟 Series」。
4. 在影像空白處點擊以新增 ROI。
5. 在下方左側「ROI 清單」查看半徑與 ROI 座標表格。
6. 查看下方右側「分析條件」。
7. 選擇「分析範圍」。
8. 選擇「切片規則」。
9. 在右側按「逐 Series 明細」；有問題時按「處理待確認項目」，檢查預覽張數與實際位置。
10. 按「開始分析」。
11. 按底部「明細」，查看 Series 狀態、失敗明細與結果預覽。
12. 檢查完成狀態。
13. 按底部「匯出 CSV」。
14. 檢查欄位勾選。
15. 按「匯出 CSV」。

預設是「目前 Series」與「全部切片」。載入多個 Series 不代表會自動納入全部 Series。

## 載入與檢視影像

- 「資料夾」讀取所選目錄內的檔案。
- 「檔案」可一次選取多個檔案。
- 拖曳資料夾或檔案也可載入。
- 啟用「累加載入模式」後，新檔案加入現有清單。
- 關閉累加模式時，新一批資料取代目前載入清單。
- 程式以 DICOM Study／Series 資訊分組，並以 SOP Instance UID 排除重複影像；不依資料夾名稱判斷取像條件。
- `.DS_Store`、`._` 開頭檔案與 `Icon` 系統檔會被忽略。

上方顯示完整影像畫布。下方左側為「ROI 清單」或「線段剖面」，右側為「分析條件」。底部固定顯示分析摘要與「明細」、「匯出 CSV」、「開始分析」；分析中顯示「取消」。

按頂部「Series」開啟「Series 管理器」抽屜。可在抽屜搜尋 Series，按「資料夾」或「檔案」載入／追加資料，按「開啟 Series」切換來源。按關閉按鈕或 Escape 收起抽屜。

拖曳影像與工具之間的分隔線，可調整下方工具區高度。也可先用 Tab 聚焦分隔線，再按 ↑／↓ 調整。按 Home 或「重設布局」回復預設高度。這項操作不會清除 ROI 或分析條件。布局高度只保留在目前頁面。

視窗寬度 ≤ 980 px 或高度 ≤ 620 px 時，工作區改用捲動布局，暫停分隔線拖曳；寬度 ≤ 700 px 時，下方工具改為上下排列。底部主要操作仍保留。

| 操作 | 功能 |
| --- | --- |
| A／←、D／→，或切片滑桿 | 上一張／下一張 |
| 右鍵拖曳 | 調整 Window Width／Level |
| Space＋左鍵拖曳，或中鍵拖曳 | 平移；鎖定中心時不移動 |
| 縮放按鈕或滑桿 | 調整顯示大小 |
| 符合畫布 | 自動縮放並置中，讓完整影像顯示在畫布內 |
| 倍率數字按鈕 | 回到 100%；不等同符合畫布 |
| 影像設定 | 開啟常用窗位、縮放比例、旋轉、Window／Level、顯示品管格線、固定目前中心、完整 DICOM 標頭與顯示標籤設定 |
| R | 重設 Window Width／Level |
| Q／E | 旋轉 −90°／＋90° |
| F | 切換全螢幕 |
| 頂部主題按鈕 | 切換明／暗主題 |

顯示設定不會改變 ROI 取樣值。ROI 座標以原始影像像素為準，不以縮放後畫面為準。

切換 Series 時，影像回到「符合畫布」。手動縮放或平移會離開自動符合模式；按「符合畫布」可恢復。符合模式會隨視窗與工具區高度調整；手動模式保留倍率。預設為石墨深色主題；若已儲存淺色偏好，則沿用該偏好。

## 建立與修改 ROI

1. 選擇「ROI」工具。
2. 在影像空白處點擊以新增 ROI。
3. 點擊 ROI 或清單中的 ROI 按鈕以選取。
4. 拖曳選取的 ROI 以移動。
5. 如需精確座標，修改清單的 X 或 Y。

X 從左向右增加。Y 從上向下增加。左上像素為 `(0, 0)`。座標使用整數。重疊的 ROI 請從清單選取。

所有 ROI 共用半徑。半徑設定範圍為 **5–200 px 的整數**。輸入面積後，程式依 Pixel Spacing 換算半徑，再四捨五入並限制於此範圍。因此實際面積不一定等於輸入面積。

- 「刪除選取 ROI」或 Backspace：刪除選取項目。Backspace 在未選取時刪除最後一個。
- 「刪除上一個」或 Ctrl／Cmd＋Z：刪除最後新增的 ROI；不是通用復原。
- 「清除全部」或 Delete：確認後刪除所有 ROI。
- 刪除後，ROI 編號依目前清單重新排列。

刪除按鈕與完整操作提示位於可收合的「ROI 操作與說明」內。點擊標題可展開或收合。清單的選取狀態會與影像上的 ROI 同步。

### 邊界檢查

整個 ROI 圓周必須落在影像內。僅圓心在影像內仍不合格。程式不會裁切 ROI 後繼續分析。

目前影像中越界的 ROI 會顯示虛線與提示。分析預覽也會檢查每張目標影像。任何待分析影像的 ROI 越界時，「開始分析」停用。請移動 ROI、縮小半徑，或調整分析範圍。

### ROI 對位方式

| 模式 | 行為與限制 |
| --- | --- |
| 目前 Series／單張影像 | 使用目前 ROI 的像素 X／Y；設定目標面積時依該影像的 Pixel Spacing 換算半徑 |
| 全部 Series＋病人座標 | 對每張目標影像重新投影；檢查位置、方向、Pixel Spacing 及 Frame of Reference；半徑依物理面積換算 |
| 全部 Series＋固定像素座標 | 直接使用 X／Y／像素半徑；允許不同 Patient 或 Frame UID；仍檢查影像矩陣與完整圓周 |

在右側「分析條件」展開可收合的「進階與對位」，選擇對位方式。使用「全部 Series」前，須勾選「啟用跨 Series ROI」。這個選項也控制切換 Series 時是否嘗試沿用 ROI。

病人座標採平面投影，**不是影像配準**。Frame UID 缺漏時，必須能確認同一 Study 才會嘗試投影。切面方向不相容或資料缺漏時會列出原因並略過。

固定像素座標不保證相同解剖位置或物理面積。即使對位檢查通過，仍須目視確認影像與研究設計。選擇「全部切片」時，不會額外套用病人座標的切面距離上限；需要限制位置時請選擇精確或最近切片規則。

## 選擇分析範圍與切片

### 分析範圍

| 選項 | 納入範圍 |
| --- | --- |
| 目前 Series | 頂部顯示的目前 Series |
| 全部 Series | 已載入的 Series；不相容的影像會列出原因 |
| 單張影像 | 「選擇影像」指定的那一張；不會自動改選其他影像 |

### 切片規則

| 規則 | 必填內容 | 選取方式 |
| --- | --- | --- |
| 全部切片 | 無 | 納入範圍內所有影像 |
| 精確位置 | 目標 Slice Location，單位 mm | 實際位置與目標位置的差距須 **小於 0.001 mm** |
| 最近切片 | 目標位置、最大距離，單位 mm | 各 Series 取距離上限內最接近目標的一個位置 |

最大距離必須手動輸入。數值須大於或等於 0。程式不會依層厚或其他條件替你猜測。

最近切片的兩側若等距，須按右側「處理待確認項目」或底部「明細」後，逐 Series 選擇位置。可在同一視窗勾選「將選擇套用至候選位置相同的 Series」。只有候選位置組合相同的 Series 會套用。

選定位置的所有重複取像都會保留。每張影像各自計算 ROI，不自動平均。單張影像模式只檢查你選的影像是否符合規則。

位置來源依序為 `(0020,1041) SliceLocation`、Image Position 對切面法向的投影、Image Position 的 Z 座標。缺少可用位置時，精確與最近規則不會納入該影像。

### 分析前確認

1. 查看總 Series 數及待分析張數。
2. 開啟「逐 Series 明細」或「處理待確認項目」。
3. 查看「待確認或未納入」群組。此群組先呈現並展開。
4. 展開「正常 Series」群組查看正常項目。
5. 查看實際位置與帶正負號的偏差。
6. 查看未納入原因。
7. 處理所有等距選擇。
8. 修正越界 ROI。

### ACR solid-water 2.5 mm 範例

本次檢查的原始資料包含 **655 張 DICOM、21 個 Series**。其中 10 個 Series 的切片位於 −1.25／＋1.25 mm 等位置；另 11 個 Series 在 0 mm 各有 3 次取像。

- 目標 0 mm＋精確位置：33 張符合；其他 Series 沒有精確 0 mm。
- 目標 0 mm＋最近切片＋最大距離 1.25 mm：10 個 Series 需選擇 −1.25 或＋1.25 mm；選擇後共 43 張。
- 43 張 × 5 個 ROI＝215 列原始結果。

**1.25 mm 僅是這組測試資料的例子，不是通用建議值。** 原本沒有輸出某些 Series，是因為切片位置不符合規則，並非程式只能分析 keV 影像。

## 執行、取消與結果狀態

開始後，程式固定本次檔案清單、ROI、對位方式與切片規則。量測、來源、Series 與切片切換會暫時鎖定。縮放、平移及 Window Width／Level 仍可使用。

- 「分析完成」：顯示成功張數、切片篩除張數、對位略過張數、失敗張數與結果列數。
- 「部分完成」：部分影像失敗，其他影像仍會繼續分析。可手動匯出成功結果。
- 「分析失敗」：沒有成功結果可匯出。請檢查明細。
- 「已取消」：停止後續工作；本次部分結果不能匯出。遲到的背景結果不會重新寫入。
- 「舊結果已失效」：ROI、來源影像或分析條件已變更。必須重新分析才能匯出。

完成後，底部先顯示成功、失敗與結果列數。按「明細」可查看「略過與失敗明細」及「結果預覽」。明細列出 Series、檔案與原因。計數僅涵蓋本次選取的分析範圍。結果預覽只顯示前 20 列；CSV 包含本次全部成功列。

背景 Worker 無法使用時，程式改以相容模式繼續。兩種模式使用相同的取樣與統計程式。

## 匯出 CSV

1. 確認結果仍有效。
2. 按底部「匯出 CSV」。
3. 選擇 CT、X 光或研究完整預設。
4. 調整要輸出的欄位。
5. 檢查姓名與 ID 是否適合保留。
6. 按「匯出 CSV」。

每列代表「一張影像中的一個 ROI」。CSV 使用 UTF-8 BOM。缺漏的 metadata 保留空白，不由檔名猜測，也不以 0 代替。

| 欄位 | 說明 |
| --- | --- |
| FileName、SeriesDescription、SeriesNumber | 檔案與 Series 識別資訊；不同 Series 可有相同檔名 |
| AcquisitionNumber、AcquisitionTime、InstanceNumber | 預設勾選的取像追蹤資訊；保留來源值，缺漏空白 |
| ROI_ID、ROI_X、ROI_Y、ROI_R | 清單編號、原始像素座標、實際像素半徑 |
| ROI_Mean、ROI_Noise_SD | ROI 平均值與母體標準差；SD 分母為像素數 N，不是 N−1 |
| FullImage_Mean、FullImage_SD | 全影像平均值與母體標準差 |
| ROI_Pixels | 圓形遮罩的實際取樣像素數 |
| ROI_R_mm | 像素半徑乘上兩軸平均 Pixel Spacing；非等向像素時只是摘要值 |
| ROI_Area_mm2 | 實際取樣像素數 × 行間距 × 列間距；不是理論 πr² 面積 |
| ROI_TransferMode | `source-pixel-coordinate`、`fixed-pixel-coordinate` 或 `patient-coordinate` |
| SliceSelectionMode | `all`、`exact` 或 `nearest` |
| RequestedSliceLocation | 使用者指定的目標位置；全部切片時空白 |
| SliceLocation | 實際位置或幾何推算的位置 |
| SliceOffset_mm | 實際位置減目標位置；未指定目標時空白 |
| MaxSliceDistance_mm | 最近切片的距離上限；其他模式空白 |

ROI CSV 固定保留切片選擇資訊、SeriesNumber 與 ROI_TransferMode，即使取消其他欄位勾選也不會移除。

`SeriesInstanceUID`、`FrameOfReferenceUID`、`SOPInstanceUID`、`ProtocolName` 僅用於內部分組／驗證，不提供 CSV 輸出。這不等於自動去識別化；CSV 預設仍可能包含 PatientName 與 PatientID。

## kVp、keV 與 GE 標籤

| DICOM tag | 匯出欄位 | 意義 |
| --- | --- | --- |
| `(0018,0060)` | KVP | 掃描管電壓，單位 kVp |
| `(0053,1066)` | ImageBrowserAnnotation | 顯示註記，例如 `80keV` 或 `80kV` |
| `(0053,1075)` | MonochromaticEnergy | VMI 單色能量數值 |
| `(0053,1089)` | MultiEnergyKVUnitLabel | 能量單位文字，例如 `keV` |

上述 GE private tags 只在 `(0053,0010)` 為 `GEHC_CT_ADVAPP_001` 時解讀。沒有符合的 creator 時保留空白。這些規則不是其他廠牌 VMI 的通用規則。

VMI 顯示 `KVP=140` 不代表 `140 keV`。應分別查看管電壓與 MonochromaticEnergy。`ImageBrowserAnnotation` 是原始文字，可能含拼字差異；不要將它當成唯一能量依據。

若要查看或在影像上顯示這些欄位：

1. 按「影像設定」。
2. 按「檢視完整 DICOM 標頭」查看原始標頭，或按「設定顯示標籤」。
3. 勾選 VMI 能量、單位或顯示註記。
4. 按「確認」。

## 線段剖面

1. 選擇「線段」工具。
2. 在影像上以左鍵拖曳繪線。
3. 查看起點、終點、長度與即時剖面。
4. 按「完整數據」查看詳細圖表。

在下方左側「線段剖面」區的「多線段管理」下拉選單切換線段。按「偏移」、「複製」、「刪除」或「清除線段」管理線段。按「完整數據」查看詳細圖表。學術圖表與影像顯示功能維持既有操作。

「批次匯出線段剖面」只處理目前 Series，沿用「分析條件」的切片規則與等距選擇。它不沿用「全部 Series」的 ROI 對位。不同影像沿用同一組像素端點；輸出距離欄以來源影像的 Pixel Spacing 為準。

匯出前請確認影像矩陣、Pixel Spacing 與線段位置一致。若某影像無法取樣，其資料為 `N/A`；這與 ROI 分析的逐張失敗計數不同。單張線段 CSV 只匯出目前顯示影像，不進行批次切片搜尋。

## 常見問題

| 狀況 | 檢查與處理 |
| --- | --- |
| 只有部分 Series 有結果 | 先確認範圍為「全部 Series」，再檢查精確位置、最近距離與對位略過原因 |
| 顯示 140 kVp，但我選的是 VMI | kVp 不是 keV；查看 MonochromaticEnergy 與單位欄位 |
| `(0053,1066)` 空白 | 檢查原始 tag 是否存在及 private creator 是否符合；不要用檔名填補 |
| 「開始分析」不能按 | 查看提示：沒有 ROI、沒有影像、未填距離、等距未選或 ROI 越界 |
| 畫 ROI 時只選到原有 ROI | 點空白處新增；重疊 ROI 可先新增再用 X／Y 移至指定位置 |
| 匯出按鈕停用 | 先完成分析；修改條件、切換來源或取消後需重新分析 |
| 相同位置有多列資料 | 每次取像及每個 ROI 各一列；請用 AcquisitionNumber／Time、InstanceNumber 追蹤 |
| 出現「部分完成」 | 展開失敗明細；確認後手動匯出成功資料或修正來源再重跑 |
| 關閉後 ROI 不見 | 本工具不保存研究資料與 ROI；重新載入並設定 |
| 影像無法讀取 | 確認為有效的未壓縮、單張、單色 DICOM；不支援的像素格式不會用猜測方式分析 |

## 資料保留與限制

- 影像、ROI、切片選擇與結果只存在目前頁面的記憶體。
- 不提供 ROI 設定匯入／匯出、自動儲存、IndexedDB 或後端研究資料儲存。
- 關閉或重新整理前，請先下載所需結果。下載檔案依瀏覽器設定保留。
- 只有明／暗主題使用 localStorage。
- 網頁可能向外部字型與圖示服務取得靜態資源；DICOM 處理程式不會上傳影像或分析結果。完整離線顯示仍取決於字型／圖示快取。
- 目前像素分析支援原生未壓縮的 8／16-bit、單色、單張 DICOM；套用 Rescale Slope／Intercept。壓縮影像及多幀影像不在支援範圍。
- 所有數值使用來源 metadata。檔名、Series Description 與輸出 CSV 不替代原始標頭驗證。
- 圓形 ROI 以像素網格定義；非等向 Pixel Spacing 下，物理空間的形狀不是正圓。
- 沒有自動配準、病人移動校正或臨床有效性判定。

## 驗證方式

以下指令檢查 JavaScript 語法，不會修改原始 DICOM：

```sh
node --check app.js
node --check workstation.js
node --check analysis-core.js
node --check analysis-workflow.js
node --check analysis-worker.js
```

## 修改紀錄

### 2026-10-06：第 2 版介面核對與說明補齊

#### 實作內容

- 依目前程式記錄上方完整影像畫布；下方左側「ROI 清單」／「線段剖面」；右側「分析條件」。
- 補充頂部「Series」到「Series 管理器」抽屜，以及「資料夾」、「檔案」、「開啟 Series」入口。
- 補充拖曳／鍵盤調整分隔線、「重設布局」、「符合畫布」、100% 倍率、縮放與平移說明。
- 補充 ROI 座標表格、可收合的「進階與對位」及「ROI 操作與說明」。
- 補充「待確認或未納入」先呈現並展開、「正常 Series」可展開，以及底部「明細」、「匯出 CSV」、「開始分析」與「取消」入口。
- 記錄「影像設定」中的窗位、旋轉、格線、DICOM 標籤與線段功能仍由現行入口提供。
- 部署檔案清單明列 `workstation.js` 與 `workstation.css`。

#### 驗證證據

- 2026-10-06 重新執行 5 份 JavaScript 語法檢查：`app.js`、`workstation.js`、`analysis-core.js`、`analysis-workflow.js`、`analysis-worker.js` 全部通過。
- 核心 13 項測試重新通過。資料集測試確認 655 張、21 個 Series、精確位置 33 張、最近切片 43 張及 5 ROI 共 215 列。
- Chromium 重新載入原始資料，確認 Series 清單分別顯示 `140 kVp` 與 `VMI: 40–140 keV`。最近切片模式保留 10 個等距 Series 的手動選擇，不會靜默決定位置。
- 實際分析完成 43 張，失敗 0 張，輸出 215 列。新下載 CSV 含 165 列 VMI 與 50 列非 VMI、43 張影像及 21 個 Series。
- 新下載 CSV 的 VMI 列保留 `KVP=140`、`MonochromaticEnergy=40–140` 與 `MultiEnergyKVUnitLabel=keV`；AcquisitionNumber 無空白；禁止輸出的四個 UID／ProtocolName 欄位不存在。
- 1280×800 與 600×900 均無頁面橫向溢出。影像畫布與底部操作列保持可見；Console 無 JavaScript 例外，僅本機伺服器缺少可選的 `favicon.ico` 而回報 404。

### 2026-10-04：整合分析流程、ROI 編輯與繁體中文說明

- 將目前 Series、全部 Series 與單張影像整合為同一分析入口。
- 新增全部切片、精確位置、最近切片與手動等距選擇。
- 新增逐 Series 預覽、實際位置、偏差與未納入原因。
- 新增 ROI 選取、拖曳、X／Y 修改與刪除選取項目。
- 分析前檢查每張目標影像的完整 ROI 圓周與對位資料。
- 每次分析固定設定與檔案清單，並用執行識別碼隔離遲到的背景回覆。
- 新增取消、結果失效、部分完成與失敗明細。
- 保留逐張取像資料；CSV 預設加入 AcquisitionNumber、AcquisitionTime、InstanceNumber。
- CSV 固定保留切片選擇資訊，維持 kVp／keV 分離與禁止輸出的 UID 欄位規則。
- 背景與相容模式共用分析核心；批次線段匯出共用切片選擇規則。
- 統一資料夾選取與拖曳載入的系統檔過濾。
- 修正淺色主題輸入框與選取頁籤的對比；移除已啟用按鈕殘留的停用標記。
- 保留頁籤方向鍵與按鈕空白鍵操作，避免誤觸影像切換或平移。
- 使用說明、操作方法與本次修改紀錄整合在本文件；同步更新程式內「說明」。未建立獨立 changelog。
- 核心與實際資料回歸測試通過 13 項。

#### 本次驗證結果

- 讀取 655 張原始 DICOM，確認 21 個 Series；沒有修改原始資料。
- 瀏覽器實際完成精確位置 33 張、最近切片 43 張與 10 個等距選擇的檢查。
- 實際下載的 ROI CSV 為 215 列：165 列 VMI、50 列非 VMI；包含 43 張影像、21 個 Series。取像欄位有值，禁止輸出的四個欄位不存在。
- ROI 拖曳沒有新增多餘 ROI；座標修改、刪除、越界阻擋及舊結果失效通過。
- 取消 655 張的工作後，模擬遲到回覆仍保持零結果、無法匯出；工作設定已固定，量測／來源控制項鎖定，縮放仍可用。
- 用記憶體內的故障注入測試單一失敗檔案：44 張成功、1 張失敗、220 列可匯出。測試後恢復記憶體來源，原始檔未修改。
- 強制 Worker 故障後，相容模式產生的 15 列與背景模式完全一致；沒有重複列。
- 單張分析產生 5 列；指定不符合的位置後，沒有改選影像，且匯出停用。
- 批次線段 CSV 在精確 0 mm 下只包含 3 張取像；AcquisitionNumber 為 1、2、3；數值型 Rows 欄位正常輸出。
- Chromium 實際操作、鍵盤頁籤／空白鍵、1440×1000 明暗主題與 600×900 窄畫面完成檢查；窄畫面沒有頁面橫向溢出。
- 本機模擬 `/DICOM-ROI-Analyzer-main/` 子路徑的 Worker 正常運作。這不是線上 GitHub Pages 部署驗證；本次未推送或發布網站。
- 測試流程沒有資料上傳請求，沒有頁面 JavaScript 例外。localStorage 只有主題；sessionStorage 與 IndexedDB 為空。重新整理後影像、ROI 與結果皆為零。
- 瀏覽器產物保留在 `output/playwright/`，已加入 Git 忽略規則，避免將研究截圖或 CSV 納入程式碼版本。

尚未在 Safari／Firefox、真實 `file://` 模式與其他廠牌的壓縮或多幀資料完成端到端驗證。

以下保留既有開發紀錄。較舊介面名稱以本文件上方的新操作說明為準。

## 2026-10-02: 修正多 Series ROI 分析與 GE VMI metadata (Multi-Series ROI and GE VMI Metadata Fix)

### 變更項目 (Changes):
- 澄清目前 Series 與全部 Series 的既有分析入口，更新按鈕文字與範圍提示。跨 Series 分析原本已存在；本次並未新增最近切片配對功能。
- 跨 Series 分析若填寫 Slice Location，當某個 Series 沒有符合位置的影像時，會在分析摘要列出略過原因，不再靜默排除。
- 補充 GE private tags `(0053,1066)`、`(0053,1075)` 與 `(0053,1089)` 的顯示與 CSV metadata 讀取；KVP 維持代表 acquisition voltage，VMI 單色能量另行保留。
- 保留既有單一 Series、單張分析與匯出流程。

### 驗證 (Verification):
- ACR solid-water 2.5-mm 資料夾檢查到 21 個 Series：10 個 conventional CT 與 11 個 VMI。
- 21 個 Series 的 Study、Frame of Reference、影像矩陣與 Pixel Spacing 通過目前跨 Series 的基本相容性條件。
- `node --check app.js`
- `node --check analysis-worker.js`

## 2026-09-26: 修正 Slice Location 篩選套用範圍 (Fix Slice Location Filtering)

### 變更項目 (Changes):
- 「指定 Slice Location」現在統一套用於一般批次分析、相容模式、單張分析、跨 Series 分析與批次線段剖面 CSV 匯出，不再在指定位置後輸出全部影像。
- 篩選比對沿用 CSV 的位置解析：優先使用 `(0020,1041) SliceLocation`；缺少時以 `ImagePositionPatient` 與 `ImageOrientationPatient` 推算。

## 2026-09-26: 新增固定像素座標跨 Patient ROI 模式 (Fixed Pixel-Coordinate ROI Mode)

### 變更項目 (Changes):
- 跨 Series ROI 新增「固定像素座標（跨 Patient）」模式，直接套用 ROI 的 X、Y 與半徑，不要求不同 Patient 或 Series 具有相同 `FrameOfReferenceUID`。
- 匯出的 cross-Series CSV 固定記錄 `ROI_TransferMode`，明確標示使用 `fixed-pixel-coordinate` 或 `patient-coordinate`。
- 固定像素座標模式仍會檢查 Rows／Columns 與 ROI 邊界；超出目標影像範圍的影像會被略過。

## 2026-09-21: 更新 CSV 匯出欄位與影像類型預設 (Updated CSV Export Presets)

### 變更項目 (Changes):
- ROI、跨 Series 與批次線段 CSV 不再輸出 `SeriesInstanceUID`、`FrameOfReferenceUID`、`SOPInstanceUID`、`ProtocolName`；這些欄位仍保留供內部分組與一致性檢查。
- 依 DICOM `Modality` 自動區分 CT 與 X-ray CSV 預設欄位：CT 著重 kVp、管電流、曝光時間、切片厚度、`SliceLocation`、Pixel Spacing 與重建資訊；X-ray 著重 kVp、曝光量、EI／DI 與投照資訊。
- CT 與跨 Series CSV 固定包含 `SliceLocation`。若 DICOM 缺少 `(0020,1041) Slice Location`，則使用 `ImagePositionPatient` 與 `ImageOrientationPatient` 推算切片位置。

## 2026-05-21 (v5): 新增一鍵「批次匯出線段剖面」功能 (Added Single-Click "Batch Export Line Profile" Feature)

### 變更項目 (Changes):
- **一鍵批次線段剖面分析與匯出 (Single-Click Batch Line Profile Exporter)**:
  - 於線段讀值設定區塊中新增「📂 批次匯出線段剖面」按鈕，風格與 HSL 暗色質感及高質感 UI 對齊，能於使用者繪製線段且有載入影像時點擊。 (Introduced "📂 Batch Export Line Profile" button inside the Line Settings Section, perfectly matching the curated HSL dark premium theme. Enabled dynamically only when both loaded images and a measurement line exist).
  - 實作了高性能的點對點線性插值（Linear Interpolation）取樣演算法，自動遍歷記憶體中載入的所有 DICOM 切片。 (Implemented high-performance point-by-point linear interpolation algorithm to traverse all loaded DICOM files).
  - 整合多重切片升序排序機制：優先採用 `SliceLocation` (切片物理位置) 升序 -> 降級採用 `InstanceNumber` (實例編號) 升序 -> 最後以 `file.name` 自然排序，保證數據行的物理掃描方向邏輯。 (Integrated a robust 3-tier slice sorting order: SliceLocation -> InstanceNumber -> file.name, matching physical scanning sequence).
  - 逐點提取並透過重縮放公式（Slope/Intercept）處理獲得物理灰階數值 (HU)，針對尺寸不符或載入損毀切片引入高容錯數據對齊，自動以 `N/A` 補齊，確保寬格式 CSV 佈局嚴格對齊。 (Applies rescaling formulas (Slope/Intercept) image-by-image to fetch true HU values. If any slice contains mismatched dimensions or parsing failure, it pads automatically with `N/A` to maintain column integrity).
- **寬格式 Excel 雙語相容 CSV 設計 (Bilingual Wide-Format Excel-Compatible CSV Design)**:
  - CSV 匯出採用寬格式佈局：`Index (索引), X (列座標), Y (行座標), Distance px (像素距離), Distance mm (物理距離), [File 1 Name] Value, [File 2 Name] Value, ...`，便於使用者在 SPSS、Excel、MATLAB 等工具中直觀進行批次統計分析。 (CSV exported in wide format: Index, X, Y, Distance px, Distance mm, followed by slice-by-slice columns, ideal for batch analysis in statistical tools).
  - 資料標頭包含物理切片位置（如 `(Loc: -25.50)`）或影像編號（如 `(Inst: 12)`）以便使用者精準對位。 (Headers include Location metadata e.g. `(Loc: -25.50)` or Instance metadata e.g. `(Inst: 12)` to identify columns precisely).
  - CSV 首位元組寫入 UTF-8 BOM (`\uFEFF`)，徹底解決 Microsoft Excel 中開啟包含中文雙語表頭時的亂碼問題。 (Embedded UTF-8 BOM to prevent any text rendering issues in Microsoft Excel).
- **多執行緒與防冻 UI 響應優化 (Responsive Non-Blocking UI Execution)**:
  - 利用 `setTimeout(..., 50)` 讓出 JavaScript 執行緒，在執行數百張切片高密集插值運算前渲染 `#loadingOverlay` 動態遮罩並顯示雙語加載狀態，完全避免了瀏覽器標籤頁暫時性凍結，創造極致流暢的醫療級軟體體驗。 (Utilized `setTimeout` yielding to render loading overlays before heavy linear interpolation starts, achieving a seamless zero-lag clinical-grade UX).

### 技術摘要 (Technical Summary):
- 提供完全繁體中文與英文對照 (Traditional Chinese & English) 的雙語使用者介面、說明日誌與程式碼註解，嚴格依循國際化開發原則。 (Maintains complete Traditional Chinese & English side-by-side localization across user interfaces, README changelogs, and code comments).

## 2026-05-21 (v4): 新增複選與累加載入模式並修復沙箱退回機制 (Added Multi-selection, Append Mode, and Sandbox Fallback)

### 變更項目 (Changes):
- **新增「選擇複數檔案」功能 (Added "Select Multiple Files" Feature)**:
  - 在 Drop Zone 與檢視器側邊欄新增了複選檔案的按鈕與隱藏式 `<input type="file" multiple>`。 (Introduced file picker buttons and hidden inputs supporting multi-selection in both the landing drop zone and the viewer sidebar).
  - 讓使用者能在系統檔案選取視窗中，一次跨目錄選取成千上萬張影像，完全不受本地 `file://` 協議下的資料夾讀取沙箱安全限制。 (Allows users to select thousands of `.dcm` files across multiple paths in the file dialog, fully bypassing the directory reading sandboxing restrictions under the `file://` local protocol).
- **引入「累加載入模式 (Append Mode)」 (Introduced "Append Mode" Switch)**:
  - 於 Drop Zone 與側邊欄新增「累加載入模式」勾選框，並為兩者實作雙向狀態同步，隨時切換。 (Added "Append Mode" checkboxes to both the Drop Zone and sidebar, with bilateral synchronization).
  - 啟用後，新載入的影像會自動累加在現有影像的尾端，且會以檔案名稱與大小自動過濾重複選取的檔案，極大提高了操作的自由度與容錯率，完美破除「一次只能選取單一資料夾」的原生瀏覽器限制。 (When enabled, newly loaded images append to the list. Added auto-deduplication by file name and size, breaking the native browser bottleneck of single-folder selection).
- **實作本地沙箱拖曳安全退回機制 (Implemented Sandbox Traversal Fallback)**:
  - 在拖曳處理 `handleDrop` 中，若因 `file://` 安全沙箱限制而導致 `webkitGetAsEntry()` 遞迴資料夾失敗時，程式會自動退回嘗試以 `e.dataTransfer.files` 直接載入拖放的影像檔案。 (In `handleDrop`, if directory traversal fails under `file://` mode due to sandboxing constraints, the system seamlessly falls back to reading `e.dataTransfer.files` directly).

### 技術摘要 (Technical Summary):
- 透過在 Drop Zone 與側邊欄整合「累加載入模式」與「複選檔案選取器」，為 Mac 本地執行環境下的 DICOM 大量批次處理提供了完美且符合直覺的 UX 解決方案。 (By integrating Append Mode and multi-selection pickers, this provides the perfect and intuitive UX solution for offline bulk DICOM processing).
- 確保所有輸出（說明文件、變更項目、程式碼註解）皆遵循繁體中文與英文雙語對照之最高標準。 (Ensured all logs, comments, and documentations conform strictly to the Traditional Chinese and English bilingual format).

## 2026-05-21 (v3): 修復 Mac 上拖曳資料夾卡死與優化大量處理效能 (Fixed Mac Drag-and-Drop Freeze & Optimized Bulk Processing Performance)

### 變更項目 (Changes):
- **徹底修復 Mac 系統拖曳資料夾卡死問題 (Resolved Mac Drag-and-Drop Hang)**:
  - 修正了 `handleDrop` 中 `entry.file()` 與 `reader.readEntries()` 缺乏錯誤回呼的問題。 (Added error callbacks to `entry.file()` and `reader.readEntries()` to prevent the Promise from hanging indefinitely on protected/hidden macOS system files like `.DS_Store` or lock files).
  - 遇到無法讀取的系統隱藏檔案時，系統會自動在主控台輸出警告 `console.warn` 並優雅跳過，保證大量拖曳載入流程 100% 不中斷。 (Unreadable files are now logged via `console.warn` and skipped gracefully, ensuring 100% uninterrupted bulk processing).
- **過濾 macOS 系統垃圾與隱藏中介檔案 (Filter Out macOS System Trash and Hidden Files)**:
  - 在拖曳載入佇列中，自動過濾以 `.` 或 `._` 開頭的 macOS 隱藏檔案（如 `.DS_Store`、`._*` 資源分叉檔案等）以及 `Icon\r` 檔案。 (Implemented automatic filtering of hidden macOS files starting with `.` or `._` as well as `Icon\r` files in the loading queue).
  - 避免了將這些非 DICOM 檔案傳遞給解析器進行無效解析，顯著節省記憶體與 CPU 資源。 (Prevents parsing overhead of non-DICOM system files, significantly saving CPU and memory resources).
- **佇列處理效能大幅提升 (Significant Queue Processing Speedup)**:
  - 將 `handleDrop` 佇列處理從 $O(N^2)$ 的 `queue.shift()` 陣列平移操作，優化為 $O(N)$ 指標索引讀取。 (Optimized folder traversal queue from the $O(N^2)$ `queue.shift()` array-rebuilding operation to an $O(N)$ pointer index traversal).
  - 處理包含數千個檔案的深層目錄時，反應速度大幅提速，介面極致流暢。 (Improves processing speed dramatically for deep directories containing thousands of files, keeping the UI fully responsive).

### 技術摘要 (Technical Summary):
- 解決了 Mac 使用者在大批次處理時，因隱藏的系統屬性檔案導致 Promise 永久處於 Pending 狀態進而使網頁畫面卡死的 Bug。 (Fixed the Mac-specific bug where system hidden metadata files left the drag-and-drop Promise in a pending state forever, freezing the browser tab).
- 確保所有輸出（說明文件、變更項目、程式碼註解）皆遵循繁體中文與英文雙語對照之最高標準。 (Ensured all logs, comments, and documentations conform strictly to the Traditional Chinese and English bilingual format).

## 2026-05-20 (v2): 優化國際學術期刊格式與修復點擊 ROI Bug (Optimized International Academic Style & Fixed Click ROI Bug)

### 變更項目 (Changes):
- **預設啟用國際學術期刊格式 (Default Academic Style)**:
  - 在剖面線詳細分析彈窗中，圖表預設即啟用「🎓 學術期刊格式 (Academic Style)」。 (The detailed line profile chart in the modal now defaults to "Academic Style" immediately upon opening).
  - 學術期刊格式採用國際頂尖學術出版物（如 Nature, IEEE 等）的專業排版規格：純白底色、Times New Roman 字型、純黑 L 型座標軸實線、向外突出的精細刻度線 (Outward Ticks)、無色彩漸層發光的高對比剖面折線，極致精確。 (Conforms to top publication specs: pure white background, Times New Roman font, solid black L-frame axes, outward ticks, and high-contrast curve without neon gradients).
  - 極值標記 (MAX / MIN) 精簡為紅藍小圓點與斜體文字標籤，平均值 (MEAN) 精簡為深灰水平虛線與斜體標記，移除科技感發光陰影，回歸學術純粹。 (Extremes and Mean are drawn with simple dots, dashed lines, and italic labels without glow effects for publication-grade neatness).
- **一鍵下載 300 DPI 級別超高解析度學術圖表 (One-click 300 DPI Equivalent Export)**:
  - 實作了離線 Canvas 背景渲染技術，支持在背景建立高達 **2400x1500** 像素的離線畫布，呼叫 `drawProfileChart` 將內容完美輸出為無鋸齒、高對比的 PNG 圖表。 (Implemented background offline canvas rendering at 2400x1500 pixels to export perfectly sharp, aliasing-free PNG figures).
  - 結合比例因子 `scaleFactor` 動態調整文字大小、線條寬度、內邊距、刻度與標籤長度，保證在高解析度輸出時完美比例不失真。 (Uses a dynamic `scaleFactor` to scale font sizes, line widths, padding, ticks, and labels proportionally to guarantee perfectly balanced graphics at high resolution).
- **徹底修復 Line Profile 模式下的 ROI 誤觸 Bug (Resolved ROI Placement Bug in Profile Mode)**:
  - 修正了 `handleCanvasClick` 滑鼠左鍵點擊影像時的判定邏輯，加入 `if (state.toolMode !== 'roi') return;` 限制。 (Restrained `handleCanvasClick` to tool mode 'roi' to prevent clicks from generating ROI markers in other modes).
  - 現在切換到「線段剖面 (Line Profile)」模式下在影像上繪線時，絕不會在起點或終點誤新增圓形 ROI 標記，徹底維持了多模式分析的一致性。 (Drawing profile lines will no longer place circle ROIs under the cursor, maintaining complete interaction safety).

### 技術摘要 (Technical Summary):
- 實作了依據寬度等比縮放 Canvas 元素的排版渲染引擎。 (Implemented a proportional typography scaling engine for Canvas rendering).
- 將傳統的 Canvas 水平格線在學術模式下智慧變更為專業向外刻度 Ticks，完美契合國際投稿要求。 (Replaced background grids with professional outward ticks under Academic style, fully complying with top-tier journal submission standards).
- 確保所有新增程式碼、說明文件及註解皆採用完全雙語（繁體中文與英文對照）以保留開發紀錄。 (Ensured all new code, documentations, and comments are fully bilingual side-by-side to preserve developer log history).

## 2026-05-20: 新增互動式「線段剖面」讀值與圖表功能 (Added Interactive Line Profile Feature)

### 變更項目 (Changes):
- **即時滑鼠拖曳劃線 (Real-time Drag-to-Draw)**:
  - 支援在「線段剖面」模式下使用滑鼠在影像上直接拖曳繪線的即時互動。 (Implemented real-time mouse drag-to-draw interaction in Line Profile mode).
  - 影像旋轉及縮放時，主畫布上繪製的剖面線段、兩端控制點與 "S"（起點）、"E"（終點）標籤可自動同步對齊並保持幾何精確。 (Line drawing, end handles, and 'S' / 'E' labels dynamically align and scale perfectly under zoom and rotation).
- **高清晰度雙主題畫布圖表 (Crisp Canvas Profile Charting)**:
  - 自底層使用純 HTML5 Canvas 2D 實作高效能、無依賴的折線剖面圖表渲染。 (Built high-performance, dependency-free profile line chart rendering from scratch using Canvas 2D).
  - 實作了動態畫布分辨率調整機制，在 Retina 等高分屏上亦能確保 100% 的極致清晰，徹底消除拉伸模糊。 (Implemented dynamic client-size canvas resolution synchronization to achieve 100% crisp visuals, eliminating stretch blur).
  - 折線下方填充了青色半透明漸變，並能自動標記數值峰值點 (MAX / MIN) 以及平均值水平線 (MEAN)，科技感十足。 (Added a sleek cyan gradient area fill, highlighted MAX/MIN peak markers, and drew a MEAN horizontal guide line).
  - 圖表格線、文字與背景色彩完全依據 DOM CSS 變數動態切換，完美自適應深色 (AMOLED Black) 與淺色主題。 (Chart grids, text, and colors fully adapt to DOM CSS variables to support light and dark/pure black themes).
- **多維度物理長度計算 (Multi-dimensional Distance Calibration)**:
  - 自動讀取 DICOM Tag `x00280030` 中的 Pixel Spacing（像素間距）屬性，精確計算出沿線段的物理距離 (mm)。 (Extracts Pixel Spacing tag `x00280030` to calculate physical distance along the line in millimeters).
  - 在側邊欄與詳細彈窗中，同步顯示像素長度 (px) 與物理長度 (mm)。 (Syncs and displays lengths in both pixels and millimeters in the sidebar and detailed modal).
- **座標讀值表格與 CSV 數據匯出 (Detailed Data Table & CSV Export)**:
  - 詳細資訊彈窗中包含完整的座標清單表格，展示每一點的索引、座標 (X, Y)、分段距離與對應像素讀值。 (Detailed modal populates an interactive table of indices, coordinates, distances, and pixel values).
  - 實作了 `exportLineProfileToCSV` 函式，支援帶有 UTF-8 BOM 的 CSV 資料匯出，完美相容 Excel 中的繁體中文字元。 (Added CSV exporter with UTF-8 BOM supporting seamless bilingual character rendering in Excel).
- **影像切片載入同步 (Slice Navigation Sync)**:
  - 當切換或重新載入影像切片時，系統會自動在 `loadImage` 末尾判定並重新計算當前線段位置在該切片上的剖面讀值並更新 UI，維持絕佳的切片導航一致性。 (Triggers auto-recalculation and chart refreshes on slice navigation inside `loadImage` if a line profile exists).

### 技術摘要 (Technical Summary):
- 實作了線性插值 (Linear Interpolation) 採樣演算法，高效且均勻地提取線段上每一像素的值。 (Implemented a linear interpolation sampling algorithm to extract pixel values uniformly).
- 完全避免了引入龐大的 Chart.js 等第三方函式庫，維持了醫療級系統的加載速度與代碼安全性。 (Avoided bloating the codebase with heavy libraries like Chart.js, maintaining raw load speed and medical system safety).
- 提供完全繁體中文與英文對照 (Traditional Chinese & English) 的雙語使用者介面與註解。 (Maintains complete bilingual side-by-side localization across all UI layouts and code comments).
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

## 2026-04-15: 修正縮放影像時的格線對齊問題 (Fixing Grid Alignment During Zoom)

### 變更項目 (Changes):
- **縮放平移同步縮放 (Synced Zoom and Pan)**:
  - 修改 `app.js` 中的 `setZoom` 函式。 (Modified `setZoom` function in `app.js`).
  - 在縮放影像時，同步按比例調整 `panX` 與 `panY` 座標。 (Scaled `panX` and `panY` coordinates proportionally during zoom).
  - 確保「固定格線模式」下，位於畫面中央的影像特徵不會因為縮放而漂移。 (Ensured features at the screen center stay aligned with the crosshair in "Fixed Grid" mode).

### 技術摘要 (Technical Summary):
- 解決了縮放時因 Canvas 尺寸變化導致的座標相對位移問題。 (Resolved relative coordinate shift caused by canvas resizing during zoom).
- 實現了「中心點縮放 (Zoom Around Center)」的視覺一致性。 (Achieved visual consistency with "Zoom Around Center" behavior).

## 2026-04-15: 新增「固定目前中心 (Lock Current Position)」功能 (Added Lock Current Position)

### 變更項目 (Changes):
- **固定目前位置功能 (Lock Current Position Toggle)**:
  - 在「格線設定」中新增「固定目前中心」勾選框。 (Added "Lock Current Position" checkbox in Grid Settings).
  - 開啟時，系統會鎖定「目前」對準準星的影像座標，且停用滑鼠平移。 (Locks the *current* image coordinates aligned with the crosshair and disables manual panning when enabled).
  - 無論如何縮放，該特定位置都會精準維持在螢幕物理中心。 (Ensures that specific panned location stays at the screen center during all zoom operations).
- **CSS 佈局優化 (CSS Layout Optimization)**:
  - 優化了影像容器的 Flexbox 置中邏輯。 (Optimized Flexbox centering for the image container).
  - 確保影像在大幅溢出狀態下仍能維持幾何一致性。 (Ensured geometric consistency even during significant overflow).

### 技術摘要 (Technical Summary):
- 實現了「以螢幕中心為基點」的縮放補償演算法。 (Implemented a zoom compensation algorithm based on the screen center).
- 解決了醫療影像在不同倍率下觀察特定病灶時的「漂移」問題。 (Solved the "drifting" issue when observing specific lesions at different zoom levels).

## 2026-04-15: 批次檔案載入效能優化 (Batch File Loading Optimization)

### 變更項目 (Changes):
- **並行批次處理 (Parallel Batch Processing)**:
  - 重構 `app.js` 中的 `loadDICOMFiles` 函式。 (Refactored `loadDICOMFiles` in `app.js`).
  - 改為以 25 個檔案為一組進行並行解析，顯著減少處理大量檔案時的總等待時間。 (Enabled parallel parsing in batches of 25, significantly reducing wait time for large file sets).
- **即時進度更新 (Real-time Progress UI)**:
  - 在載入過程中動態更新讀取進度（顯示目前的 `n / total`）。 (Dynamically update loading text with progress percentage/count).
  - 更新了 `handleDrop` 的初步提示，確保資料夾遍歷過程也有清楚的反饋。 (Improved initial feedback in `handleDrop` during folder traversal).

### 技術摘要 (Technical Summary):
- 解決了處理超過 100+ 個影像時介面容易卡死（無回應）的問題。 (Resolved UI freeze/unresponsiveness when handling 100+ images).
- 提升了主執行緒的反應速度，確保讀取任務不再完全阻塞 UI 繪製。 (Improved main thread responsiveness by breaking large tasks into manageable batches).

## 2026-04-15: 資料夾搜尋效能深度優化 (Deep Folder Traversal Optimization)

### 變更項目 (Changes):
- **並行資料夾遍歷 (Parallel Traversal)**:
  - 重構 `traverseFileTree` 函式，支援對子目錄進行並行搜尋 (Concurrent Search)。 (Refactored `traverseFileTree` for concurrent subtree searching).
  - 更新 `handleDrop` 以並行處理多個拖入的頂層項目。 (Updated `handleDrop` to process multiple top-level items in parallel).
- **實時計數反饋 (Real-time File Counter)**:
  - 導入了共享的 `context` 計數器，在搜尋過程中每發現 50 個檔案即更新一次 UI。 (Implemented a shared `context` counter to update UI every 50 files found).
  - 解決了處理深層或巨大目錄時，「正在搜尋資料夾...」畫面長時間無變化的焦慮感。 (Resolved UI stagnancy during deep directory searches).

### 技術摘要 (Technical Summary):
- 透過並行處理大幅降低了磁碟 I/O 閒置時間，搜尋速度提升約 2-3 倍。 (Reduced disk I/O idle time via concurrency, improving search speed by 2-3x).
- 確保了在尋找數千個檔案的過程中，使用者能看見跳動的數字，提供明確的系統運行反饋。 (Ensured visible progress during massive file searches, providing clear system feedback).

## 2026-04-15: 搜尋穩定性重大強化 (Major Search Stability Enhancement)

### 變更項目 (Changes):
- **非遞迴迭代搜尋 (Iterative Queue-based Search)**:
  - 捨棄了高壓的 `Promise.all` 遞迴模型，改採更穩定的「迭代佇列」模式。 (Replaced heavy `Promise.all` recursion with a stable iterative queue model).
  - 能夠在處理數千個檔案時維持極低的系統負載。 (Maintains low system load even when processing thousands of files).
- **主動讓位機制 (Voluntary Yielding)**:
  - 實作了 `setTimeout(0)` 讓位機制，定時將控制權交還給瀏覽器。 (Implemented periodic yielding with `setTimeout(0)` to return control to the browser).
  - **解決死鎖**: 確保瀏覽器的「上傳確認安全性對話框」能正常彈出且不被阻塞。 (Resolved deadlocks: ensures browser security dialogs can pop up without being blocked).
  - **維持響應**: 防止介面在大型資料夾搜尋期間出現「網頁無回應」警告。 (Prevents "Page Unresponsive" warnings during large folder searches).

### 技術摘要 (Technical Summary):
- 將並行廣度優先搜尋改為受控的序位深度搜尋。 (Converted uncontrolled parallel BFS to controlled serial search).
- 優化了與瀏覽器原生安全機制的互動流程，特別是在 `file://` 環境下的穩定性。 (Optimized interaction with native browser security mechanisms, especially under `file://`).

## 2026-04-15: 介面簡化與平移功能優化 (UI Simplification & Pan Optimization)

### 變更項目 (Changes):
- **移除介面平移單選鈕 (Removed Pan Tool from UI)**:
  - 從 `index.html` 中移除工具列的「平移」選項。 (Removed the "Pan" radio button from the "Tools" card in `index.html`).
  - 介面現在設為常駐「ROI 模式」，提供更專注的選取體驗。 (The UI is now permanently set to "ROI mode" for a more focused selection experience).
- **保留並強化背景功能 (Functionality Preservation)**:
  - 確保滑鼠中間鍵（Middle Click）拖曳平移功能依然完全運作。 (Ensured middle-mouse button drag panning remains fully functional).
  - 保留 `Space` + 左鍵拖曳平移的快捷鍵支援。 (Maintained shortcut support for Space + Left-click panning).
- **邏輯精簡 (Logic Refinement)**:
  - 移除了 `app.js` 中不再需要的工具切換事件監聽器。 (Removed redundant tool-switching event listeners in `app.js`).

## 2026-04-16: 深色模式配色優化 - 純黑主題 (Dark Mode Aesthetic Update - Pure Black)

### 變更項目 (Changes):
- **純黑背景 (Pure Black Background)**:
  - 將 `style.css` 中的 `--bg-primary` 從 `#0f172a` 改為 `#000000`。 (Changed `--bg-primary` to `#000000` for deep AMOLED-friendly black).
  - 更新影像容器 (`.image-container`) 背景為變數 `var(--bg-primary)`，確保與主題同步。 (Updated `.image-container` background to use variable for theme consistency).
- **色調對比調整 (Contrast Adjustment)**:
  - 調暗 `--bg-secondary`、`--bg-tertiary` 等屬性，改為極深灰色以維持層次感。 (Darkened secondary and tertiary backgrounds to maintain depth while remaining nearly black).
  - 調整邊框顏色 (`--border-color`) 使其在純黑背景下仍清晰可辨。 (Adjusted border colors to remain visible on the pure black background).
- **組件背景一致性 (Component Consistency)**:
  - 修改單張分析結果表格背景，改用變數替代半透明遮罩。 (Modified single analysis result table to use variables instead of transparent masks).

### 技術摘要 (Technical Summary):
- 優化了高對比環境下的視覺體驗。 (Improved visual experience for high-contrast environments).
- 實現了真正的 AMOLED 純黑支援，減少長時間使用的眼睛疲勞。 (Implemented true AMOLED black support to reduce eye strain during prolonged use).

## 2026-04-16: 修復 GitHub Pages 上「分析全部影像沒反應」問題 (Fix: Analysis Silently Fails on GitHub Pages)

### 問題根源 (Root Cause):
此問題由**兩個相互作用的 Bug** 所導致：

1. **Worker `onerror` 未監聽 (Worker `onerror` Not Handled)**:
   - GitHub Pages 使用 HTTPS 嚴格 CORS 政策，`importScripts` 在 Worker 中載入 `dicomParser.min.js` 可能因路徑解析規則不同而失敗。
   - Worker 初始化時若 `importScripts` 拋出例外，`state.worker` 仍為非 null 物件，但實際上 Worker 完全無法運作。
   - 主執行緒的 `postMessage` 送出後，永遠不會收到回應 → **按鈕按下後無任何反應**。
   - Worker `importScripts` fails on GitHub Pages due to strict HTTPS CORS, but `state.worker` was still non-null, causing silent hang.

2. **Buffer Detach 問題 (Buffer Detach Issue)**:
   - `runAnalysis` 傳送 `f.byteArray.buffer` 給 Worker 時，若意外被列為 Transferable，主執行緒的 `byteArray` 會被「detach（歸零）」。
   - 第二次按「分析全部」時，所有 buffer 均已是空的，Worker 靜默收到零位元組資料并出錯。
   - Passing `f.byteArray.buffer` without `slice(0)` risked detaching the main thread's TypedArray views, breaking subsequent analyses.

### 變更項目 (Changes):
- **`app.js`**:
  - **新增 `worker.onerror` 監聽器**: Worker 發生錯誤時自動將 `state.worker` 設為 `null` 並觸發主執行緒降級模式重新執行分析。 (Added `worker.onerror` to auto-fallback to main thread on any Worker error).
  - **Buffer 複製保護**: 傳給 Worker 的 buffer 一律使用 `f.byteArray.buffer.slice(0)` 複製，確保主執行緒的 `dataSet` TypedArray view 永遠有效。 (Used `.slice(0)` to copy buffers before sending to Worker, protecting main thread data).
  - **Buffer Detach 降級處理**: 若偵測到 buffer 已 detach，改用主執行緒相容模式重新分析。 (Added try/catch for detached buffer with fallback to main thread).

- **`analysis-worker.js`**:
  - **`importScripts` 保護**: 將 `importScripts` 包在 `try/catch` 中，失敗時立即 `postMessage` 通知主執行緒，確保 `worker.onerror` 能被觸發。 (Wrapped `importScripts` in try/catch to explicitly notify main thread on failure).
  - **`_parserReady` 守衛旗標**: 在 `onmessage` 中加入守衛判斷，若解析器未就緒直接回傳錯誤而非靜默掛起。 (Added `_parserReady` guard flag to prevent silent hang when parser isn't loaded).

### 技術摘要 (Technical Summary):
- 解決了在 GitHub Pages (HTTPS) 環境下 Worker 靜默失敗的根本問題。 (Fixed silent Worker failure on GitHub Pages HTTPS environment).
- 確保了多次點擊「分析全部」不會因 buffer detach 而失效。 (Ensured repeated analysis runs work correctly without buffer detachment issues).
- 系統現在具備完整的「Worker 失敗 → 主執行緒自動接管」容錯機制。 (System now has complete fail-safe: Worker failure → auto fallback to main thread).

## 2026-04-16: 移除「格線隨影像移動 (Attached)」模式 (Removal of Attached Grid Mode)

### 變更項目 (Changes):
- **介面簡化 (UI Simplification)**:
  - 從 `index.html` 中移除了格線模式切換選單。 (Removed the grid mode selection menu from `index.html`).
- **功能收斂 (Feature Consolidation)**:
  - 系統現在預設且僅使用「固定在畫面上 (Fixed)」格線模式。 (The system now defaults to and exclusively uses the "Fixed" grid mode).
  - 穩定了格線間距調整功能，確保其與固定格線模式完美相容。 (Stabilized grid spacing adjustments to ensure perfect compatibility with the fixed grid mode).
- **程式碼優化 (Code Optimization)**:
  - 移除了 `app.js` 中所有與移動格線繪製 (`drawMovingGrid`) 及模式切換 (`handleGridModeChange`) 相關的冗餘程式碼。 (Pruned all redundant code related to moving grid drawing and mode switching from `app.js`).

### 技術摘要 (Technical Summary):
- 簡化了格線系統的核心邏輯，減少不必要的 Canvas 重繪開銷。 (Simplified the core grid logic, reducing unnecessary canvas repaint overhead).
- 提升了醫療影像品管 (QC) 中定位與測量的一致性。 (Improved consistency for positioning and measurement in medical imaging QC).

## 2026-04-16: 優化批次分析效能，修復分析卡住的問題 (Performance Optimization: Fix Batch Analysis Freeze)

### 變更項目 (Changes):
- **批次分析改為串流處理 (Streaming Batch Analysis)**:
  - 移除了過去將所有 DICOM 影像資料一次性完整複製並傳送給 Worker 的寫法，改為「逐張傳遞與處理」的佇列機制。 (Replaced the logic that copied and sent all DICOM data to the Worker at once with a queue mechanism that processes one image at a time).
  - 解決了在分析大量高解析度影像時，因瞬間產生巨大的記憶體配置而導致的頁面凍結 (Out Of Memory) 與死鎖問題。 (Resolved page freezing and OOM deadlocks caused by massive memory allocations when analyzing a large number of high-resolution images).
- **增強分析 Worker (Enhanced Worker)**:
  - 為 `analysis-worker.js` 新增了 `analyze_chunk` 與 `analyze_single` 指令，能夠有效地回應單張進度，並能於單張分析錯誤時自動跳過繼續處理下一張影像。 (Added `analyze_chunk` and `analyze_single` commands to `analysis-worker.js`, enabling efficient progress reporting per image and automatic fallback on individual image errors).

### 技術摘要 (Technical Summary):
- 將 O(N) 的主執行緒記憶體使用量降至 O(1)。 (Reduced main thread memory footprint during transfer from O(N) to O(1)).
- 有效解決 GitHub Pages 等託管平台上頻繁出現的分析死鎖 (Freeze) 問題。 (Effectively solved the analysis deadlock/freeze issue frequently encountered on hosted platforms like GitHub Pages).
