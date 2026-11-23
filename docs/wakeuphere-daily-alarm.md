# WakeUpHere 城市當地早上八點鬧鐘

2026-11-16 起實作。網頁檢查與邏輯測試完成；實際喇叭音量、瀏覽器音訊政策與 Pi 長時間執行仍需實機驗收。

## 排程規則

- 選好城市進入預約畫面後，以城市的 IANA timezone（例如 America/Anchorage）計算下一個當地 08:00，與 Pi 自己設定的時區無關。
- 若選址當下已過當地八點，排到隔天；不是立即補響今天的八點。
- 每天響一次，日曆日期換日後重新計算，因此支援夏令時間，不是固定加 24 小時。
- 畫面顯示下一次響鈴的城市當地日期與時間。無效／缺少時區時顯示不可排程，不偷偷使用 Pi 時區。
- 每秒檢查一次；瀏覽器恢復顯示時也檢查。若已預約的時刻在暫停／關機期間經過，恢復時補響一次，不補播每個錯過的日期。
- Pi 必須有電、瀏覽器開著且系統時間正確才可能準時響鈴；網頁排程不能喚醒已關機的 Pi。

## 停止、重選與測試

- 搖桿按壓映射空白鍵，響鈴時停止，沿用原 Notion `press: yes` 同步。
- 停止後保留城市及隔天八點排程，今天不會因重整再響一次。
- 再按一次可開啟重新選址確認；確認重選會取消原排程。
- Ctrl+H 保留為手動響鈴展示，不消耗／取消真正的八點排程。

## 持久化與自動更新

`localStorage` 的 `wakeuphere.dailyAlarm` 儲存 userName、洲／國家／城市及排程狀態。重新整理、網站自動更新或正常重開機後，會還原同一 userName 的城市與排程；未停止的響鈴會恢復。

改名後，原身份的預約不會自動套到新身份；重新預約以新的名稱計算。清除網站資料、換瀏覽器設定檔或網域，會失去本機排程。

部署這項功能時，舊頁面透過原本版本檢查重新載入。如果舊頁面已完成選址，其 sessionStorage 選址可還原並建立排程；否則更新後需重新選一次城市。

響鈴前先保存待停止狀態，停止時再保存已停止狀態。自動更新在響鈴中延後，避免中途切斷音效。手動重整時若仍有待停止鬧鐘，新頁面會恢復響鈴。

## Pi 無人操作時的音效

Chromium 的 Web Audio 受自動播放政策限制。選址時搖桿／點擊互動一般可啟用當前頁面音訊；但重開機／自動重載後的新頁面不能假設仍有權限。網站在音訊未啟用時會顯示提示，可推搖桿或點畫面啟用。

若要整台無人操作、重開機後也能響鈴，專用 kiosk 啟動器需加入：

```text
--autoplay-policy=no-user-gesture-required
```

新版一鍵安裝器已包含此參數。**既有 Pi 的本機腳本不會因 GitHub 網頁部署自動改變**，只需手動加一次，不必重裝整台。

前面手動安裝的 Pi：

```bash
nano ~/wakeuphere/start-browser.sh
```

在最後的 Chromium 區塊加上參數，保留現有其他內容，例如：

```bash
exec chromium \
    --user-data-dir="$HOME/.config/wakeuphere-chromium" \
    --password-store=basic \
    --autoplay-policy=no-user-gesture-required \
    --kiosk \
    --no-first-run \
    'https://wakeupmap-globalversion.vercel.app/wakeuphere/'
```

若已改用一鍵安裝器，實際啟動器在 `/opt/wakeuphere/start-browser.sh`，用 `sudo nano` 編輯該檔；在 `chromium` 指令加參數，保留迴圈與其他設定。

儲存後重新開機。這會允許該專用 Chromium 的頁面自動出聲，請將此瀏覽器保留作 kiosk 用途。參數只解決瀏覽器政策，仍需確認 USB 音訊輸出及音量。

[Chrome 官方自動播放說明](https://developer.chrome.com/blog/autoplay/)。

## 驗證

```bash
npm run test:wakeuphere-alarm
npm run test:wakeuphere-update
npm run build
```

涵蓋 Anchorage 冬令時、春／秋夏令時切換、年末換日、非整點時差、跨日期變更線、到點只觸發一次、晚恢復補響、搖桿空白鍵停止、重載去重、未停止響鈴恢復與手動展示不影響排程。測試使用可控時鐘，不需要把實機系統時間改來改去。

## 醒來確認紀錄

真正鬧鐘響起後按下確認鍵，也會將醒來事件同步到 WakeUp Map；詳見 [醒來確認紀錄](wakeuphere-awake-records.md)。WakeUpHere 介面維持原樣。

## 到站語音（2026-11-23）

先播兩遍「國家的城市到了」，中間停 3 秒，接原鬧鈴；失敗備援與 Pi 驗收見 [到站語音](wakeuphere-alarm-announcement.md)。
