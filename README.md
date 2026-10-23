# EndfieldSkill：終末地四人戰術編排台

一款針對《明日方舟：終末地》的確定性隊伍與技能循環輔助工具。玩家選擇自己實際擁有的四名角色、玩家等級與劇情進度後，頁面會從版本化資料庫中匹配隊伍、輸出技能釋放順序與觸發條件，並列出配裝候選及已知門檻。

MVP 线上测试站：[https://aaaeeezynx.github.io/EndfieldSkill/](https://aaaeeezynx.github.io/EndfieldSkill/)

## 解決的問題

網上攻略通常圍繞一套固定四人隊展開。玩家若缺少其中一名角色，影片或文章裡的整套循環往往無法直接照抄。

本專案採用「先整理可信資料，再用確定性規則排列組合」的方式：

- 使用玩家已有的四名角色，而不是要求玩家先湊出攻略固定隊。
- 對完全匹配的来源队伍展示經過整理的攻略循環。
- 對其他四人組合展示明確標註的規則回退，不把推導結果偽裝成實測攻略。
- 按裝備穿戴等級、角色定位、元素和推薦關係篩選配裝候選。
- 執行時不呼叫 AI，不生成沒有資料依據的答案。

## 當前 MVP

 - 必須恰好選擇 4 名不同角色。
- 輸入玩家等級；章節選擇會在有已核驗章節資料時啟用。
- 展示技能順序、觸發條件、共享技力、能量、冷卻與注意事項。
- 展示每名角色的最佳候選、目前候選與替代裝備，並顯示已知解鎖門檻。
- 不保存隊伍或玩家資料，刷新後重新選擇。
- 不讀取遊戲帳號，不提供帳號聯動或自動同步。
- 響應式支援桌面與 390 px 行動端。

目前資料庫包含：

 - 34 名可玩角色、99 個技能
- 276 件裝備（其中 258 件有本地官方圖，18 件缺圖並以「來源缺圖」標示）
- 2 套來源隊伍
- 1 套來源攻略循環
- 7 個資料或攻略來源
- 遊戲資料版本：`1.6.4`，表版本 `11262943-8`

## 重要資料邊界

這是 MVP 測試版，不是完整戰鬥模擬器。以下限制會直接反映在介面中：

 - 唯一已整理的來源攻略循環是「萊萬汀 / 卡繆 / 狼衛 / 艾爾黛拉」四人單目標循環。
- 其他四人組合使用標籤與技能類型規則生成回退順序，並標記為「規則生成，待人工核對」。
- 來源循環是條件式順序，不聲稱幀級或秒級最優軸。
- 角色專屬技能中文名、部分連攜觸發條件與定位標籤仍待補齊。
- 章節到裝備／配方權限的映射尚未核驗，因此目前不會聲稱裝備「已經可以製造」。
- 裝備門檻中的 `minWearLv` 只代表裝備穿戴等級，不等同玩家等級、劇情進度或配方權限。
- 配方權限、劇情章節與製造狀態未確認時會顯示為未知，而不是當作已解鎖。

## 技術棧

 - 前端：Vue 3、TypeScript、Vite、Pinia、Vue Router、Tailwind CSS
- 前端測試：Vitest
- 資料管線：Python 標準函式庫，無第三方執行期依賴
- 資料來源：JSON 表格鏡像、官方教學／公告與人工核驗的攻略摘錄
- 部署：GitHub Actions + GitHub Pages
- 路由：Hash History，適配 GitHub Pages 專案子路徑 `/EndfieldSkill/`

## 本地啟動

環境建議：

 - Node.js 22 或更新版本
- npm 10 或更新版本
- Python 3.11 或更新版本

### 前端

```powershell
cd A:\EndfieldSkill\apps\web
npm ci
npm run dev
```

預設開發位址由 Vite 輸出。正式建構：

```powershell
npm run build
npm run preview
```

`npm run build` 會先執行 `scripts/sync-data.mjs`，把 `data/v1/` 同步到 `apps/web/public/data/v1/`。同步出的 JSON 是建構產物，不提交到 Git；canonical 資料仍保存在根目錄 `data/v1/`。

### 資料管線與測試

首次線上更新資料：

```powershell
cd A:\EndfieldSkill
python -m crawler update --source all
python -m crawler validate
python -m unittest discover -s crawler\tests -v
```

已有通過校驗的本機快取時，可做離線重建：

```powershell
python -m crawler update --source all --offline
```

完整前端驗收：

```powershell
cd A:\EndfieldSkill\apps\web
npm test
npm run build
npm audit --audit-level=low
```

## 資料更新流程

遊戲新增角色或調整裝備後，按以下流程發布新版本：

1. 執行 `python -m crawler update --source all`，取得最新版本化遊戲表格。
2. 檢查 `data/v1/meta.json` 的版本、覆蓋率、缺失技能和 unresolved 項目。
3. 僅在有可信來源時，更新 `crawler/sources.py` 中的人工核驗隊伍、循環與配裝摘錄。
4. 執行資料校驗、Python 測試、前端測試與生產建構。
5. 提交並推送 `main`，由 GitHub Actions 重新部署 Pages。

資料檔案：

 - `data/v1/characters.json`：角色、定位、元素與技能。
- `data/v1/equipment.json`：裝備、屬性、配方及已知門檻。
- `data/v1/progressions.json`：章節進度；未核驗時不寫入猜測。
- `data/v1/team-presets.json`：來源隊伍。
- `data/v1/rotation-presets.json`：來源技能循環。
- `data/v1/sources.json`：URL、抓取時間、雜湊與擷取欄位。
- `data/v1/meta.json`：版本、覆蓋率、限制與未解決項目。


## UI/UX 設計

前端介面參考《終末地》官方網站的工業科幻風格，採用以下設計系統：

- **字體**：Rajdhani（標題、編號、代碼）＋ IBM Plex Sans（正文、清單）
- **色彩**：白底工業編輯風，黑色粗體標題、黃色 `#fffa00` 切角色塊、藍色 `#2257d6` 重點、橘色 `#ff6b00` 警告
- **動效**：入場漸顯、掃描線、狀態點呼吸與細微懸停回饋
- **網格**：細線網格底紋、硬邊切角面板、黑色 footer
- **角色圖**：35 張官方角色立繪從官方 CDN 下載至本地，配備 lazy loading 與錯誤回退
- **裝備圖**：258 張官方裝備圖，配備五級稀有度色框（灰／綠／藍／紫／金）與 18 筆缺圖 fallback

所有角色圖片資產來源、原始 URL 與使用注意事項記錄在 [`apps/web/ASSET_SOURCES.md`](apps/web/ASSET_SOURCES.md)。
本项目明确标示为非官方第三方攻略工具，不宣称官方授权或关联。

## 主要資料來源

 - [AKEDatabase 遊戲表格鏡像](https://data.akedata.wiki/manifest.json)：角色、技能、裝備、配方與屬性；視為結構化二手資料。
- [官方網站](https://endfield.gryphline.com/zh-tw#home)：共享技力、連攜、能量與終結技機制與官方視覺參考。
- [官方開發通訊 2674](https://endfield.hypergryph.com/news/2674)：裝備材料與權限等級門檻。
- [Prydwen Combat Basics](https://www.prydwen.gg/arknights-endfield/guides/combat-basics)：四人隊伍與共享技力交叉核對。
- [GameWith 隊伍攻略](https://gamewith.net/akendfield/72598)：Pulse 四人隊人工摘錄。
- [Game8 萊萬汀隊伍循環](https://game8.co/games/Arknights-Endfield/archives/577071)：單目標循環人工摘錄。
- [Game8 裝備攻略](https://game8.co/games/Arknights-Endfield/archives/576118)：明確可映射的套裝推薦。

來源衝突、無法映射或無法核驗的欄位會保留在 `meta.json` 的 `unresolved` 中，不會用猜測填補。本專案只保存結構化事實與短摘錄，不複製完整第三方文章。

## GitHub Pages 部署

推送 `main` 會自動觸發 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)：

1. 安裝前端依賴並執行 Vitest。
2. 以 `VITE_BASE=/EndfieldSkill/` 建構。
3. 上傳 `apps/web/dist` 並由 GitHub Pages 部署。

也可以在 GitHub Actions 頁面手動執行 `workflow_dispatch`。

若倉庫首次部署後仍顯示 404，請到倉庫 `Settings > Pages`，確認 Source 設為 `GitHub Actions`。

## 專案結構

```text
.
|-- apps/web/                  # Vue 3 前端与测试
|-- crawler/                   # Python 资料抓取、解析、校验与测试
|-- data/v1/                   # canonical 版本化 JSON
|-- data/schemas/              # JSON Schema
|-- docs/                      # 产品规划与架构文件
|-- .github/workflows/         # GitHub Pages 部署
 `-- README.md
```

## 非目標

 - 執行時 AI 問答或生成式配隊。
- 自動讀取玩家遊戲帳號、角色庫存或養成進度。
- 裝備掉落率與完整材料庫存管理。
- 逐幀戰鬥模擬或自動操作遊戲。
- 未經驗證的攻略內容自動轉成「最佳答案」。

本專案為非官方玩家工具，與 Hypergryph / Gryphline 無隸屬關係。遊戲名稱、角色與素材權利歸原權利人所有。

