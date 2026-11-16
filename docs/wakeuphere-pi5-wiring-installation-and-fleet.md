# WakeUpHere：Pi 5 接線、安裝與多台部署手冊

更新日期：2026-11-16。

> 已新增 [一鍵安裝器](wakeuphere-one-click-install.md)。新裝置建議優先使用安裝器；下方手動設定保留供接線、原理與舊版維修參考。安裝器改用直接 lgpio 讀取及自動偵測控制器，不再需要手改 chip 編號。

本文件整理本次實機設定流程。已確認搖桿方向可控制頁面、SW 測試能讀到按下 0／放開 1；使用者實機採 labwc 桌面。本文的多台部署流程是後續建議，尚未進行整批實機驗證。

## 1. 裝置架構與零件

```text
HW-504 搖桿 VRx／VRy → MCP3008 → Pi 5 SPI
HW-504 搖桿 SW → Pi GPIO17
Pi 5 → HDMI 螢幕
Pi 5 → USB 音訊喇叭
Pi 5 Chromium → Vercel 線上 WakeUpHere → Notion API
```

每台裝置需要 Pi 5、已安裝 OS 的 microSD、適用的電源與散熱、HDMI 螢幕及其電源、USB 音訊喇叭、HW-504、16 腳 DIP MCP3008、麵包板與杜邦線。建議 MCP3008 旁加 0.1µF 去耦電容。

網站網址：<https://wakeupmap-globalversion.vercel.app/wakeuphere/>

Pi 只需執行瀏覽器與搖桿程式，不需要安裝整個網站、Node.js 或在 Pi 保存 Notion secret。網頁部署由 GitHub main → Vercel 負責。

## 2. 接線

**關機並拔掉 Pi 電源後接線。Pi 實體排針位置、BCM GPIO 編號與 MCP3008 晶片腳號是三種不同編號。所有以下訊號使用 3.3V，不把 5V 接入 Pi GPIO。**

### 2.1 MCP3008 方向

從晶片頂部看、半圓缺口朝上，左上為 1、右上為 16。晶片跨在麵包板中央溝槽：

```text
           缺口
        ┌── ∪ ──┐
 CH0  1 │       │ 16 VDD
 CH1  2 │       │ 15 VREF
 CH2  3 │       │ 14 AGND
 CH3  4 │       │ 13 CLK
 CH4  5 │       │ 12 DOUT
 CH5  6 │       │ 11 DIN
 CH6  7 │       │ 10 CS
 CH7  8 │       │  9 DGND
        └───────┘
```

### 2.2 MCP3008 → Pi 5

| MCP3008 腳號 | Pi 實體腳位 | 功能 |
| --- | --- | --- |
| 16：VDD | 1 | 3.3V |
| 15：VREF | 1，共用電源軌 | 3.3V 參考電壓 |
| 14：AGND | 6 | GND |
| 9：DGND | 6，共用接地軌 | GND |
| 13：CLK | 23 | GPIO11／SCLK |
| 12：DOUT | 21 | GPIO9／MISO |
| 11：DIN | 19 | GPIO10／MOSI |
| 10：CS | 24 | GPIO8／CE0 |

剩下未使用的類比通道 CH2～CH7 不接。0.1µF（104）陶瓷電容可跨接 MCP3008 第 16 腳與第 9 腳，靠近晶片。

### 2.3 HW-504 → MCP3008／Pi

按搖桿板上文字接線，不靠照片中的排針左右順序判斷。

| 搖桿標示 | 接到 |
| --- | --- |
| GND | 與 Pi、MCP3008 共用的 GND 軌 |
| +5V | 本方案接 **3.3V 軌**，不接 5V |
| VRx | MCP3008 第 1 腳 CH0 |
| VRy | MCP3008 第 2 腳 CH1 |
| SW | **Pi 實體第 11 腳，GPIO17** |

常見的此類電位器搖桿可用 3.3V；若換成其他廠牌／帶主動電路的板，需重新確認規格。SW 使用內部上拉，放開讀到 1、按下讀到 0。

麵包板電源軌可能在中間斷開，需確認各區段實際連通。電源腳位共用請經電源軌分配，不要將多條杜邦線硬擠在同一個 Pi 排針上。

### 2.4 螢幕與音訊

- 螢幕接 Pi 5 micro-HDMI，並依螢幕標示另外供電；HDMI 不等於螢幕電源。
- 喇叭接 USB，在桌面音效設定選為音訊輸出。部分 USB 喇叭只有 USB 供電，音訊需另接 3.5mm，請核對型號。
- 電池供電需穩壓電源方案，不能直接接裸鋰電池；完整系統須另計螢幕與喇叭耗電。

## 3. OS 與套件安裝

以下命令在 **Pi Terminal** 執行，除非明確寫「管理電腦」。範例 Linux 帳號是 `futurethingslab0314`；其他帳號要替換服務與 autostart 中的絕對路徑。

使用 Raspberry Pi Imager 安裝有桌面的 Raspberry Pi OS 64-bit。每台設定獨立 hostname，例如 `wakeup-pi-01`，配置 Wi-Fi、Linux 帳號、密碼與 SSH。

```bash
sudo apt update
sudo apt install -y chromium curl gpiod python3-spidev python3-gpiozero python3-lgpio python3-evdev
sudo raspi-config
```

在 raspi-config：

1. Interface Options → SPI → Enable。
2. System Options → Boot / Auto Login → Desktop Autologin。
3. 確認時區與網路時間同步；桌面設定停用螢幕自動熄滅。選單依版本可能不同。

```bash
sudo reboot
```

開機後檢查：

```bash
ls /dev/spidev0.0
gpiodetect
pgrep -a labwc
```

應有 SPI 裝置、`pinctrl-rp1` GPIO 控制器與 labwc 程序。若沒有 labwc，不要套用後面的 labwc autostart，需依桌面調整。

## 4. Pi 5 GPIO 編號與本次相容性修正

本台 `gpiodetect` 顯示：

```text
gpiochip15 [pinctrl-rp1] (54 lines)
```

所以使用 **chip=15**。不同 Pi／核心版本可能是 0、4 或其他編號，必須以各台輸出為準；它不代表實體第 15 腳。

本台 GPIO Zero 的 `LGPIOFactory.__init__` 會無條件重設傳入的 chip，造成 `LGPIOFactory(chip=15)` 仍試圖開不存在的 gpiochip0。下方程式使用 `RP1Factory` 繞過此初始化問題，不修改系統套件。新版套件可能已修復，但保留此相容處理時仍需實測。

## 5. 安裝搖桿程式

```bash
mkdir -p ~/wakeuphere
nano ~/wakeuphere/joystick.py
```

貼上完整程式。`GPIO_CHIP` 依該台 `gpiodetect` 結果填寫；以下保留實機已使用的 15。

```python
import time
import spidev
import lgpio
from gpiozero import Button
from gpiozero.pins.lgpio import LGPIOFactory, LGPIOPin
from gpiozero.pins.local import LocalPiFactory
from evdev import UInput, ecodes as E

GPIO_CHIP = 15
INVERT_X = False
INVERT_Y = False

class RP1Factory(LGPIOFactory):
    def __init__(self, chip):
        LocalPiFactory.__init__(self)
        self._handle = lgpio.gpiochip_open(chip)
        self._chip = chip
        self.pin_class = LGPIOPin

spi = spidev.SpiDev()
spi.open(0, 0)
spi.max_speed_hz = 500_000

factory = RP1Factory(chip=GPIO_CHIP)
button = Button(17, pull_up=True, bounce_time=0.05,
                pin_factory=factory)
keys = [E.KEY_LEFT, E.KEY_RIGHT, E.KEY_UP, E.KEY_DOWN, E.KEY_SPACE]
keyboard = UInput({E.EV_KEY: keys}, name="WakeUpHere Joystick")

def read_adc(channel):
    result = spi.xfer2([1, (8 + channel) << 4, 0])
    return ((result[1] & 3) << 8) | result[2]

def tap(key):
    keyboard.write(E.EV_KEY, key, 1)
    keyboard.syn()
    time.sleep(0.02)
    keyboard.write(E.EV_KEY, key, 0)
    keyboard.syn()

try:
    print("Keep joystick centered: calibrating...", flush=True)
    time.sleep(1)
    center_x = sum(read_adc(0) for _ in range(30)) / 30
    center_y = sum(read_adc(1) for _ in range(30)) / 30
    if not (250 < center_x < 775 and 250 < center_y < 775):
        raise RuntimeError(
            f"Unexpected center X={center_x:.0f}, Y={center_y:.0f}. Check wiring."
        )
    print(f"Center X={center_x:.0f}, Y={center_y:.0f}", flush=True)
    print("Ready. Focus WakeUpHere. Ctrl+C to stop.", flush=True)
    time.sleep(1)
    previous_button = button.is_pressed
    next_move = 0
    while True:
        dx = read_adc(0) - center_x
        dy = read_adc(1) - center_y
        if INVERT_X:
            dx = -dx
        if INVERT_Y:
            dy = -dy
        now = time.monotonic()
        if max(abs(dx), abs(dy)) > 220 and now >= next_move:
            if abs(dx) >= abs(dy):
                key = E.KEY_RIGHT if dx > 0 else E.KEY_LEFT
            else:
                key = E.KEY_DOWN if dy > 0 else E.KEY_UP
            tap(key)
            next_move = now + 0.18
        pressed = button.is_pressed
        if pressed and not previous_button:
            tap(E.KEY_SPACE)
        previous_button = pressed
        time.sleep(0.02)
except KeyboardInterrupt:
    pass
finally:
    keyboard.close()
    button.close()
    factory.close()
    spi.close()
```

Nano 儲存：Ctrl + O → Enter → Ctrl + X。

啟動時保持搖桿置中：

```bash
sudo modprobe uinput
sudo python3 ~/wakeuphere/joystick.py
```

看到 Ready 後點一下 WakeUpHere 網頁取得焦點。方向對應方向鍵，按壓對應空白鍵（確認／停止響鈴）。此虛擬鍵盤會操作目前有焦點的視窗，維修時先停服務。反向可調整 `INVERT_X`／`INVERT_Y`。

## 6. 瀏覽器與每台使用者名稱

另開 Pi Terminal，先以一般視窗設定：

```bash
chromium --user-data-dir="$HOME/.config/wakeuphere-chromium" --password-store=basic --no-first-run 'https://wakeupmap-globalversion.vercel.app/wakeuphere/'
```

點網頁後按 **Ctrl + U**，輸入該台的 WakeUpHere 名稱，例如 `YUTING`。重新選城市進入預約畫面，驗證名稱及 Notion 記錄。若 Ctrl + U 被攔截，可在該頁的開發者 Console 輸入：

```javascript
localStorage.setItem('wakeuphere.userName', 'YUTING');
location.reload();
```

這段 JavaScript 只能在瀏覽器 Console 執行，不是 Linux Terminal 指令。

- 名稱保存在此瀏覽器設定檔的 `localStorage`，key 是 `wakeuphere.userName`；未設定時是 `YuPie`。
- Linux 帳號、hostname、WakeUpHere 名稱三者不會自動連動；網址 `?userName=` 目前也不會替此頁設定名稱。
- 不使用無痕／訪客模式；不同人不要沿用相同預設名稱，也不要只用大小寫區分兩人。
- `--password-store=basic` 用來避免開機時 Default Keyring 解鎖視窗；密碼儲存不加密，此專用瀏覽器不要保存私人帳號密碼。不必刪除系統鑰匙圈。

## 7. 搖桿開機服務

先在手動執行的程式按 Ctrl + C，再確認沒有另一份程式占用 GPIO：

```bash
pgrep -af 'python3.*joystick.py'
```

若有程序，回原視窗停止；找不到視窗時，確認 PID 後用 `sudo kill 實際PID` 停止。不要同時跑服務與手動測試。

```bash
echo uinput | sudo tee /etc/modules-load.d/wakeuphere.conf
sudo nano /etc/systemd/system/wakeuphere-joystick.service
```

貼上；帳號不同必須改路徑：

```ini
[Unit]
Description=WakeUpHere Joystick Controller
After=systemd-modules-load.service
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
User=root
WorkingDirectory=/home/futurethingslab0314/wakeuphere
ExecStart=/usr/bin/python3 -u /home/futurethingslab0314/wakeuphere/joystick.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

此服務以 root 讀硬體及建立虛擬鍵盤，執行的腳本必須由可信任的管理者維護。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wakeuphere-joystick.service
sudo systemctl status wakeuphere-joystick.service --no-pager
```

確認 active (running)。若修好錯誤後服務已因重試次數過多停止：

```bash
sudo systemctl reset-failed wakeuphere-joystick
sudo systemctl restart wakeuphere-joystick
```

## 8. 開機全螢幕網站

```bash
nano ~/wakeuphere/start-browser.sh
```

貼上：

```bash
#!/bin/bash

for attempt in {1..30}; do
    if curl --silent --fail --location \
        --connect-timeout 2 --max-time 2 \
        --output /dev/null \
        'https://wakeupmap-globalversion.vercel.app/wakeuphere/'; then
        break
    fi
    sleep 2
done

exec chromium \
    --user-data-dir="$HOME/.config/wakeuphere-chromium" \
    --password-store=basic \
    --kiosk \
    --no-first-run \
    'https://wakeupmap-globalversion.vercel.app/wakeuphere/'
```

這是有限次連線等待，最壞情況約兩分鐘；不是無限重試或瀏覽器崩潰監控。若開機長時間沒有網路，可能仍需重新開啟／重新整理。網頁載入成功後才有網站版本檢查功能。

```bash
chmod +x ~/wakeuphere/start-browser.sh
mkdir -p ~/.config/labwc
nano ~/.config/labwc/autostart
```

檔案空白可直接新增；有內容則保留原有設定。最後新增一次：

```bash
/home/futurethingslab0314/wakeuphere/start-browser.sh &
```

關閉先前用同一設定檔開啟的一般 Chromium，然後：

```bash
sudo reboot
```

開機時放開搖桿，等校正完成。Alt + F4 可退出 kiosk 回桌面。此設定依賴桌面自動登入，不要用 sudo 開啟 Chromium。

## 9. 按鈕測試與排錯

先停止搖桿服務，避免 GPIO busy：

```bash
sudo systemctl stop wakeuphere-joystick
```

以下整段貼到 Pi Terminal；若該台 RP1 編號不同，替換 15：

```bash
sudo python3 - <<'PY'
import time
import lgpio
h = lgpio.gpiochip_open(15)
try:
    lgpio.gpio_claim_input(h, 17, lgpio.SET_PULL_UP)
    previous = None
    print("請按下、放開搖桿；Ctrl+C 結束", flush=True)
    while True:
        value = lgpio.gpio_read(h, 17)
        if value != previous:
            print("放開：1" if value else "按下：0", flush=True)
            previous = value
        time.sleep(0.02)
except KeyboardInterrupt:
    pass
finally:
    lgpio.gpiochip_close(h)
PY
```

搖桿垂直往下按，不是推方向。正常交替顯示按下 0／放開 1。Ctrl + C 結束後重啟服務：

```bash
sudo systemctl start wakeuphere-joystick
```

| 狀況 | 檢查方式 |
| --- | --- |
| 沒有 `/dev/spidev0.0` | 確認拼字有 v、SPI 已啟用並重開機 |
| can not open gpiochip | 執行 gpiodetect，確認 RP1 編號與 RP1Factory 設定 |
| GPIO busy | 停止服務／手動程式，避免兩個程序同時占用 SW |
| SW 一直為 1 | 關機拔電後查 SW → 實體 11、GND 共地、杜邦線鬆脫 |
| SW 一直為 0 | 關機拔電後查 SW 是否短接 GND |
| 方向有反應、網頁按壓沒反應 | 先單獨測試 SW，再確認網頁取得焦點 |
| 中心值異常／地圖漂移 | 放開搖桿重啟服務；查電源、CH0／CH1、接地及雜訊 |
| Default Keyring 密碼視窗 | 確認專用 Chromium 啟動有 password-store=basic，關閉既有瀏覽器再重啟 |
| 沒聲音 | 確認是真正 USB 音訊裝置、桌面輸出選擇／音量，先在網頁互動啟用音訊 |

服務紀錄：

```bash
sudo journalctl -u wakeuphere-joystick.service -b -n 60 --no-pager
```

## 10. 網站與 Pi 程式的更新差別

| 修改內容 | 更新方式 |
| --- | --- |
| 網站介面／地圖／瀏覽器邏輯 | 電腦修改 → GitHub main → Vercel 部署成功 → 網頁自動偵測 |
| joystick.py／系統服務／開機設定 | SSH／管理工具更新 Pi，不會跟網站部署自動更新 |
| 每台名稱 | 各台瀏覽器設定，不由 hostname 推導 |

已部署的新版每 60 秒檢查網站版本，不同版本才重整。斷網不重整，響鈴中延後；名稱保留，已完成選址會嘗試還原。第一次載入這個功能仍需先重新整理／重開機一次。詳見 [自動更新說明](wakeuphere-auto-update.md)。

新版網頁已加入 [每日城市當地八點排程](wakeuphere-daily-alarm.md)，Ctrl + H 仍是獨立手動展示。舊 Pi 啟動器需依該文件補上無互動音效參數，並實測音訊輸出。

## 11. 多台部署：推薦做法

### 11.1 小批量先採「乾淨 OS＋共用安裝素材」

不用把整個開發專案裝到每台。將第一台已驗證的檔案集中成 `wakeuphere-pi-bundle`：

```text
wakeuphere-pi-bundle/
  joystick.py
  start-browser.sh
  wakeuphere-joystick.service
  README.md
```

本文件提供的是可複用設定與流程，沒有另外產出／測試一鍵安裝器；上述資料夾需從母機匯出。先凍結一版 OS、Python 套件與硬體接線，避免每台差異。

每台都用 Imager 刷乾淨 OS，設定獨立 hostname／SSH，使用相同 Linux 帳號可省下服務路徑替換。接上同一區網，之後由管理電腦操作：

```bash
# 在管理電腦執行；先準備好本機 bundle 資料夾。
scp -r ./wakeuphere-pi-bundle futurethingslab0314@wakeup-pi-02.local:~/
ssh futurethingslab0314@wakeup-pi-02.local
```

首次連線核對裝置身分；網路不支援 .local 時使用該台 IP。登入後依本手冊安裝套件，將 Python 與 shell 檔放到 `~/wakeuphere/`、服務放到 `/etc/systemd/system/`，依該台 RP1 編號修改 Python，設定 SPI／自動登入／autostart，再執行驗收。

此方式每台都有新系統身分，瀏覽器名稱仍需首次設定。可在首次正常瀏覽器視窗設定後，再進入 kiosk；目前不能只在裝置清單填 userName 就自動寫入網站。

### 11.2 台數增加後，用 Ansible 集中管理

若常要同時更新多台，下一步是把第 3～8 節變成可重複執行的 Ansible playbook：

- 裝套件、啟用 SPI、配置 uinput。
- 複製搖桿與瀏覽器程式、安裝服務。
- 依各台帳號、GPIO chip、方向反轉設定產生檔案。
- 確保 autostart 不重複新增、只在需要時重啟服務。
- 收集服務狀態並保留可回復的前一版檔案。

這是建議架構，尚未建立 playbook。名稱的無鍵盤佈署仍需要另外開發「裝置設定 → 瀏覽器身份」橋接；目前網站不具備此功能。

### 11.3 SD 卡整張複製：適合相同硬體的快速備機

可先完成並驗收一台母機，**正常關機後**將 SD 卡讀成 image，再寫入其他卡；不要複製正在執行、仍有寫入的系統。目標卡實際容量必須足以容納 image，同標稱容量也可能略有不同。

複製可省下套件安裝，但會一起複製 hostname、Linux 帳號、Wi-Fi、瀏覽器名稱、machine-id 與 SSH host keys，不能直接當成一群身分獨立的裝置同時上線。

若選此方法，需建立離線／首次開機個人化流程，在副本進入正式區網前處理：

1. 每台獨立 hostname、machine-id 與 SSH host keys；不要刪除你正在遠端連線使用的母機金鑰。
2. 更換每台瀏覽器 userName，避免沿用母機 `YuPie`／其他人的名字。
3. 移除母機私人資料、瀏覽器登入狀態及不應共用的憑證。
4. 重新確認 gpiodetect、音效裝置、網路與全螢幕啟動。
5. 從一張副本開始驗收，再整批製作。

沒有做好這套個人化流程前，推薦上一節的乾淨 OS 方法。不要把已設定完的 image 視為「完全不用逐台設定」。

### 11.4 設備清單

用表格維護各台差異，例：

| 裝置 | hostname | Linux 帳號 | RP1 chip | WakeUpHere 名稱 | 版本／驗收 |
| --- | --- | --- | --- | --- | --- |
| 01 | wakeup-pi-01 | futurethingslab0314 | 實測填寫 | YUTING | 待填 |
| 02 | wakeup-pi-02 | futurethingslab0314 | 實測填寫 | AKIRA | 待填 |

備份安裝素材與設備清單，不把密碼／Wi-Fi secret 提交到公開 GitHub。

## 12. 每台出機驗收

- 接線與晶片方向確認，供電穩定。
- SPI 存在，RP1 chip 編號正確，SW 能讀到 0／1。
- 開機放開搖桿後，服務 active，沒有重複 joystick 程序。
- 桌面自動登入，Chromium 全螢幕，沒有鑰匙圈密碼視窗。
- 推方向、按壓可完成洲 → 國家 → 城市。
- 專屬名稱正確，重開機後仍保留；Notion 同步實際成功。
- USB 音訊正常，手動響鈴／停止可用。
- 網站更新檢查已載入；SSH 可以進行後續維修。

## 13. 參考與關聯文件

- [Raspberry Pi 官方安裝指南](https://www.raspberrypi.com/documentation/computers/getting-started.html)：Imager、OS 與設備初始化。
- [Raspberry Pi 官方 kiosk 教學](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/)：labwc 與 Chromium kiosk。
- [MCP3008 接線參考](https://learn.adafruit.com/mcp3008-spi-adc/python-circuitpython)。注意本文 CS 採 CE0，不同範例的 CS 可能不同。
- [Pi GPIO 腳位](https://www.raspberrypi.com/documentation/computers/raspberry-pi.html)。
- [GPIO Zero LGPIOFactory 原始碼](https://gpiozero.readthedocs.io/en/stable/_modules/gpiozero/pins/lgpio.html)：與本台安裝版本比較時，須查看實際本機原始碼。
- [Chromium 密碼儲存說明](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/linux/password_storage.md)。
- [WakeUpHere 設計與名稱設定](wakeuphere-design-and-pi-setup.md)：較早的設計文件，硬體安裝以本手冊為準。
