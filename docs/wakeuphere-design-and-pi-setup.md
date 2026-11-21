# WakeUpHere 設計與 Raspberry Pi 安裝指南

> 2026-11-21 更新：[同城市名單](wakeuphere-active-bookings.md) 已改為每個帳號最新的有效預約，支援取消同步、每分鐘刷新與失敗重試；下文以「帳號＋城市」找歷史列的敘述為舊版行為。

> 2026-11-16 更新：已加入 [真正的每日城市八點鬧鐘](wakeuphere-daily-alarm.md)，會保存並還原已選城市及排程。本文件後文未實作排程／不保存城市的描述是舊版狀態，現行行為以鬧鐘文件為準。

> 2026-11-16 補充：Pi 5 搖桿接線、GPIO 相容性修正、開機與多台部署，請以 [最新硬體安裝手冊](wakeuphere-pi5-wiring-installation-and-fleet.md) 為準。網站已加入 [部署自動更新](wakeuphere-auto-update.md)，下文的手動重新整理描述為早期行為。

更新日期：2026-11-11。依目前程式撰寫；本文的 Pi 安裝方式是部署建議，尚未在實體 Pi 上驗證。本文將「pie」視為 Raspberry Pi。

## 1. 系統概念

WakeUpHere 是以圓形螢幕為視覺中心的城市甦醒互動裝置。使用者依序選擇洲、國家與城市，再進入預約甦醒畫面，閱讀城市故事、查看城市時間，並看見預約同一城市的使用者名稱。

每台 Pi 執行同一個線上網站，只在自己的 Chromium 設定檔儲存使用者名稱。網站與 API 由 Vercel 提供，Pi 不需要各自架設 Node.js、Notion API 或複製網站原始碼。

正式網址：<https://wakeupmap-globalversion.vercel.app/wakeuphere/>

```text
每台 Raspberry Pi
  └─ Chromium kiosk + 獨立持久設定檔
       ├─ WakeUpHere HTML / 城市資料 ← Vercel
       ├─ 地圖圖磚 ← OpenStreetMap
       ├─ 使用者名稱 ← 此設定檔的 localStorage
       └─ /api/wakeuphere ← Vercel → Notion 資料庫
```

## 2. 視覺與操作設計

- 圓形視窗依螢幕短邊縮放，背景為黑色，保留綠色輪廓、中心準星、掃描線與標記光暈。
- 地圖使用 Leaflet 1.9.4。底圖來源為 `https://tile.openstreetmap.org/{z}/{x}/{y}.png`，不需要 API key。
- `.wakeuphere-basemap` 只對底圖套用反相、低飽和與亮度濾鏡，綠色標記與介面保持原色。這是原始彩色圖磚的深色轉換，不是 CARTO 原生深色樣式。
- 畫面下方保留 OpenStreetMap 署名。服務需連網，應遵循其圖磚政策，不做大量預抓或離線下載。

| 階段 | 畫面與行為 |
| --- | --- |
| Stage 0 | 選擇洲，預設縮放 2 |
| Stage 1 | 選擇國家，預設縮放 5 |
| Stage 2 | 選擇城市，預設縮放 10 |
| Stage 3 | 顯示預約城市、名稱、故事與時間切換，嘗試同步 Notion |
| 響鈴展示 | 手動觸發音效、城市標記與模擬時鐘；空白鍵停止 |

| 輸入 | 現有功能 |
| --- | --- |
| 方向鍵 | 選擇階段平移地圖並吸附最近選項；確認視窗內切換是／否 |
| 空白鍵 | 確認選項；響鈴時停止；預約畫面開啟重新選址確認 |
| 畫面上一個／下一個、確認按鈕 | 切換與確認選項 |
| `+` / `−` 畫面按鈕 | 地圖縮放 |
| Shift | Stage 3 切換所選城市目前時間 |
| Ctrl + U（Pi）／Command + U（Mac） | 開啟使用者名稱輸入視窗 |
| Ctrl + H（Pi）／Command + H（Mac） | 觸發響鈴展示 |

快捷鍵須讓網頁取得焦點。部分作業系統或瀏覽器可能攔截組合鍵；若名稱視窗未出現，使用第 5 節的 Console 方法。重新選址確認視窗開啟時，先關閉視窗再改名。

## 3. 現有功能邊界

- 名稱會持久儲存；所選城市與目前階段主要保存在記憶體，重新整理或重開機後需重新選址，沒有從 Notion 自動恢復預約的流程。
- 現在顯示 `08:00 AM`，但沒有每日當地八點自動排程判斷；`triggerAlarmSimulation()` 才是目前觸發響鈴的入口。畫面的 `ALARM ACTIVE` 不代表已具備可靠鬧鐘排程。
- 城市故事主要來自 `cities_data.js`，缺少時使用固定備援文字；此頁不是每次即時產生 AI 故事。
- 同城名稱在進入預約／展示時載入，沒有持續即時訂閱。
- 不包含 GPIO 驅動。若使用實體按鈕或旋鈕，需要另外實作輸入橋接，或使用可輸出方向鍵／空白鍵的 USB HID 控制器。

## 4. 各台 Pi 安裝與自動開啟

### 4.1 前置條件

建議使用 Raspberry Pi 4／5、有桌面的 Raspberry Pi OS 64-bit、螢幕、穩定電源與網路。首次安裝準備鍵盤與滑鼠，並確認音訊輸出。以下自動啟動範例適用於 **labwc 桌面工作階段**；舊版 X11／Wayfire 的啟動設定位置不同。

透過 Raspberry Pi Imager 安裝 OS，為每台裝置設定不同 hostname、Linux 帳號、Wi-Fi 與 SSH。Linux 登入名稱和 WakeUpHere 的 `userName` 是兩個獨立設定，不會自動連動。

登入 Pi 桌面後，在 Pi 的 Terminal 執行：

```bash
sudo apt update
sudo apt install -y chromium
command -v chromium
```

在系統設定中啟用桌面自動登入、停用螢幕自動熄滅，並確認系統時間同步與正確時區。實際選單依 OS 版本而異。

### 4.2 建立固定的瀏覽器設定檔

在 **Pi 桌面的 Terminal** 執行以下指令；首次不要加 kiosk，方便設定名稱：

```bash
chromium \
  --user-data-dir="$HOME/.config/wakeuphere-chromium" \
  --no-first-run \
  'https://wakeupmap-globalversion.vercel.app/wakeuphere/'
```

依第 5 節設定名稱，確認畫面名稱正確後，關閉這個 Chromium，再繼續自動啟動設定。不要讓兩個程序同時使用同一個設定檔。

不要使用 `--incognito`、`--guest`，也不要每次啟動前刪除這個設定檔，否則名稱無法穩定保存。從其他瀏覽器或其他設定檔設定名稱，不會套用到這個 kiosk 設定檔。

### 4.3 labwc 開機自動啟動

在 Pi 的 Terminal 執行：

```bash
mkdir -p ~/.config/labwc
nano ~/.config/labwc/autostart
```

保留檔案原有內容，在最後新增以下一行，且只加一次：

```bash
chromium --user-data-dir="$HOME/.config/wakeuphere-chromium" --kiosk --no-first-run 'https://wakeupmap-globalversion.vercel.app/wakeuphere/' &
```

儲存後執行 `sudo reboot`，確認桌面自動登入後進入全螢幕網站。此設定以桌面登入為啟動點，不是開機前的系統服務；單從 SSH 執行瀏覽器指令可能缺少圖形工作階段環境。

網站音效應先透過按鍵或點擊互動啟用，並實測響鈴。若無聲，先檢查 Pi 的音訊裝置、音量與瀏覽器限制。

Kiosk 模式下可使用 `Alt + F4` 關閉瀏覽器回桌面；要停止每次開機自動開啟，將新增的 autostart 那行註解掉。不要刪除設定檔。

## 5. 設定每台裝置的使用者名稱

### 5.1 建議方法：名稱快捷鍵

1. 使用第 4 節指定的 Chromium 設定檔開啟 WakeUpHere。
2. 點一下網頁，按 **Ctrl + U**。
3. 在「請輸入 userName」視窗輸入分配給這台裝置的名稱，例如 `YUTING`，按確定。
4. 選擇洲、國家、城市，進入預約畫面，檢查顯示的名稱。
5. 關閉並重新開啟同一個設定檔，確認名稱仍存在；重新選一次城市驗證。

建議在選城市前設定名稱。改名會立即更新本機名稱與畫面，但不會立即送出 Notion；重新選址並進入 Stage 3 才會以新名稱同步。改名也不會替你清理 Notion 中舊名稱的資料。

### 5.2 備援方法：瀏覽器 Console

如果 Ctrl + U 被攔截，先離開 kiosk，以相同設定檔開啟一般 Chromium。在 WakeUpHere 網頁開啟開發者工具 Console，手動輸入：

```javascript
localStorage.setItem('wakeuphere.userName', 'YUTING');
location.reload();
```

檢查目前儲存值：

```javascript
localStorage.getItem('wakeuphere.userName');
```

上述是 **瀏覽器 JavaScript**，不能直接貼到 Pi 的 Terminal 或 SSH 執行。以實際分配的名稱替換 `YUTING`。

### 5.3 名稱保存規則

| 項目 | 目前實作 |
| --- | --- |
| 儲存 key | `wakeuphere.userName` |
| 未設定／空白時 | 使用 `YuPie` |
| 前後空白 | 儲存時移除 |
| 重新整理／正常重開機 | 同一設定檔一般會保留名稱 |
| 清除網站資料／換設定檔 | 名稱不會帶過去，需重新設定 |
| 網域改變 | localStorage 不共用，需重新設定 |
| URL `?userName=YUTING` | **WakeUpHere 目前沒有讀取此參數** |
| Linux 帳號／hostname | 不會自動作為名稱 |
| 是否為登入驗證 | 否，名稱是公開識別文字，沒有密碼驗證 |

不要把每台 Pi 都留在預設 `YuPie`。建議建立設備對照表，以下僅為範例：

| 裝置 hostname | WakeUpHere userName | 備註 |
| --- | --- | --- |
| wakeup-pi-01 | YUTING | 使用者 A |
| wakeup-pi-02 | AKIRA | 使用者 B |
| wakeup-pi-03 | SARAH | 使用者 C |

複製 SD 卡或瀏覽器設定檔後，需修改 hostname 與 WakeUpHere 名稱；複製品會帶著原本儲存的名稱。不同使用者請用不同名稱；Notion 比對名稱會轉小寫，因此不要只用大小寫區分兩人。

## 6. Notion 與 API 行為

Pi 只需連到線上網站。以下環境變數設在 **Vercel 伺服器端**，不要寫入 Pi 的啟動指令或前端檔案：

| 變數 | 用途 |
| --- | --- |
| `NOTION_API_KEY` | Notion integration secret；需能存取指定資料庫 |
| `WAKEUPHERE_PAGE_ID` | 雖名為 PAGE_ID，目前程式用作 Notion database ID |

建議資料庫欄位如下；程式也支援部分別名與型別：

| 欄位 | 建議型別 | 用途 |
| --- | --- | --- |
| `userName` | Title | 使用者名稱 |
| `setup_city` | Rich text | 城市英文名稱 |
| `setup_city_zh` | Rich text | 城市中文名稱 |
| `setup_country` | Rich text | 國家英文名稱 |
| `setup_country_zh` | Rich text | 國家中文名稱 |
| `press` | Checkbox 或 Select | 停止響鈴時寫入；Select 使用 `yes` |

進入 Stage 3 時，前端向 `/api/wakeuphere` 發送 POST，包含名稱及城市／國家。後端以「名稱＋城市」找既有記錄，找到就更新，沒有就新增；同一人換城市可能留下多筆資料。

響鈴展示中按空白鍵停止時，POST 額外包含 `press: "yes"`。一般預約 POST 不會自動將舊的 press 重設為否，因此它不是每日重設的出勤／甦醒狀態。

同城姓名以 GET 查詢，例如：

```text
/api/wakeuphere?setup_city=Taipei
```

GET 可依城市或名稱查詢，但前端沒有用此 API 自動還原每台裝置的預約。前端同步 POST 也尚未檢查 HTTP 失敗狀態，因此「畫面正常」不代表 Notion 已成功寫入；安裝驗收需檢查 Network 回應與資料庫實際內容。

## 7. 每台裝置驗收與排錯

1. 重新開機後，確認自動進入 WakeUpHere、地圖有地理內容、深色底圖與署名可見。
2. 設定並確認該台的專屬名稱，重新開啟相同設定檔驗證保存。
3. 使用方向鍵／按鈕與空白鍵完成洲 → 國家 → 城市；Stage 3 顯示正確名稱及城市。
4. 檢查 Notion 新增／更新資料是否符合名稱與城市，或在 Network 確認 POST 成功。
5. 在網頁取得焦點時以 Ctrl + H 觸發響鈴展示，確認音效與綠色標記；空白鍵停止後，確認 Notion `press` 更新。
6. 用 Shift 檢查城市時間。重開網頁後需重新選址，這是目前行為。

| 問題 | 檢查方向 |
| --- | --- |
| 所有裝置都叫 YuPie | 尚未逐台設定，或使用無痕模式／不同設定檔 |
| 改名後重開不見 | 核對 `--user-data-dir`，檢查網站資料是否被清除、儲存空間是否可寫 |
| 地圖顯示 API KEY REQUIRED | 可能仍載入舊 CARTO 版本，強制重新整理並檢查圖磚網域 |
| 地圖空白但名稱與按鈕存在 | 檢查 OSM 圖磚、Leaflet CDN、網路與 Network 錯誤 |
| 名稱正確但 Notion 沒資料 | 重新選址進入 Stage 3，檢查 POST、Vercel 環境變數與資料庫授權 |
| 網站開不起來 | 確認開機後網路已連線，再重新整理；此範例沒有自動網路重試／崩潰重啟機制 |
| 到了早上八點未響鈴 | 目前未實作定時響鈴，需另行開發 |

## 8. 程式位置與維護

- `public/wakeuphere/index.html`：獨立 HTML 頁、狀態流程、地圖、名稱與音效。
- `public/wakeuphere/cities_data.js`：城市、位置與故事資料。
- `api/wakeuphere.ts`：Notion GET／POST API。
- `vercel.json`：路由設定。

修改網站後以 `npm run build` 驗證，並確認 `dist/wakeuphere/index.html` 包含修改。推送 GitHub `main` 後由既有 Vercel Git 整合部署；在 GitHub 確認 Vercel 狀態成功，再讓各台 Pi 重新整理頁面。已開啟的頁面不會自動套用新程式。

可另行規劃的功能：URL／裝置設定檔指定名稱、城市預約持久化與復原、真正的時區鬧鐘排程、API 失敗提示，以及裝置監控。以上不是本次文件新增的產品功能。

## 9. 參考資料

- [Raspberry Pi 官方 Kiosk 教學](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/)：labwc autostart 與 Chromium kiosk 設定依據；本文調整為單一網站及持久設定檔。
- [OpenStreetMap 圖磚使用政策](https://operations.osmfoundation.org/policies/tiles/)：圖磚 URL、可見署名與使用限制。
