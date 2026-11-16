# WakeUpHere Pi 5 一鍵安裝

更新日期：2026-11-16。

## 適用環境

- Raspberry Pi 5，已安裝 Raspberry Pi OS **桌面版**，採 labwc＋LightDM。
- 已依 [硬體手冊](wakeuphere-pi5-wiring-installation-and-fleet.md) 接好 HW-504＋MCP3008（SPI0/CE0、SW=BCM17）、HDMI 螢幕、USB 音訊喇叭。
- 已建立一般 Linux 帳號並連上網路。OS Lite、其他桌面或其他型號不在本版支援範圍。

安裝器完成了自動化測試與語法檢查；尚未在新 Pi 實際跑完套件安裝、桌面重開機及硬體驗收。請先在一台設備驗收再大量安裝。

## 下載與執行

以下在 **Pi 的 Terminal** 執行；不要在 Mac／Windows 電腦執行。先停止手動執行的舊 `joystick.py`（Ctrl+C）；已由 `wakeuphere-joystick.service` 管理的版本會自動升級。

```bash
curl -fL 'https://raw.githubusercontent.com/futurethingslab0314/wakeupmap-globalversion/main/scripts/install-wakeuphere-pi.sh' -o /tmp/install-wakeuphere-pi.sh
sudo bash /tmp/install-wakeuphere-pi.sh --reboot
```

第一行成功下載後再執行第二行。使用先下載後執行方式，下載失敗不會執行不完整的管線。安裝需要 sudo 密碼；`--reboot` 表示安裝成功後自動重開機，期間放開搖桿供中心校正。透過 SSH 執行同樣可以，重開機時連線會中斷。

若不希望自動重開機：

```bash
sudo bash /tmp/install-wakeuphere-pi.sh
```

若你是以 root 登入，或要替其他桌面帳號安裝：

```bash
sudo bash /tmp/install-wakeuphere-pi.sh --user futurethingslab0314 --reboot
```

`--user` 是既有的 **Linux 桌面帳號**，不是網站 userName。腳本不建立或更改帳號密碼。

只檢查硬體／桌面／帳號條件，不安裝：

```bash
sudo bash /tmp/install-wakeuphere-pi.sh --check
```

## 安裝內容

1. 檢查 Pi 5、一般使用者、labwc／LightDM 與 Wayland session。
2. 安裝 Chromium、curl、gpiod、Python spidev／lgpio／evdev。
3. 使用 raspi-config 啟用 SPI、設定 uinput 開機載入。
4. 將搖桿程式與瀏覽器啟動器放到 root 擁有的 `/opt/wakeuphere/`。
5. 建立／更新 `wakeuphere-joystick.service`，啟動失敗會每 10 秒重試。
6. 設定指定帳號的 LightDM 桌面自動登入與 graphical target。
7. 保留 labwc autostart 其他內容，建立單一 WakeUpHere 管理區塊；取代前一版手動新增的 `~/wakeuphere/start-browser.sh &` 標準寫法。
8. 用原本的 `~/.config/wakeuphere-chromium` 設定檔，全螢幕開網站；等待連線、瀏覽器結束後會重新啟動。

GPIO 控制器在搖桿服務每次啟動時以 `gpiodetect` 的 `pinctrl-rp1` 標籤偵測，不寫死 0／4／15。按鈕直接使用 lgpio 讀取並做軟體去彈跳，避免舊 GPIO Zero 忽略 chip 參數的問題。按壓仍映射空白鍵。

重跑安裝會更新相同檔案、不累加啟動行，保留方向反轉設定及瀏覽器資料。被取代的系統／autostart 檔案備份在 `/var/backups/wakeuphere/時間-程序編號/`。這是檔案備份，不是完整系統快照；失敗不會自動撤回已安裝的 apt 套件或其他已完成步驟，修正錯誤後可重跑。

專用 Chromium 使用 `--password-store=basic`，避免 Default Keyring 解鎖視窗；它不加密儲存的密碼，所以不要在此設定檔保存私人密碼。腳本不刪除系統鑰匙圈。

## 首次啟動還要確認的事

- Linux hostname／Wi-Fi／SSH 由 Imager 預先設定，安裝器不會自動更換這些身分。
- 首次在網站按 **Ctrl+U** 設定每台專屬的 userName。安裝器不會自動指定網站身份；名稱不會從 Linux 帳號推導。
- 螢幕分辨率／方向、音訊輸出與音量需依各台硬體確認。桌面可能仍有自己的省電／鎖定設定，需在設備驗收時停用不適用的選項。
- 保持搖桿置中等待 Ready；方向與按壓要能完成選址流程。
- 新版網站部署後會每 60 秒檢查更新；不需要因網站更新重跑安裝器。
- 網頁重載後瀏覽器可能需要搖桿／滑鼠互動才允許播放音效；本腳本不修改全域瀏覽器音訊安全政策。

真正的每日八點自動響鈴未包含於安裝器；目前是現有網頁及手動展示功能。

## 檢查與維修

```bash
sudo systemctl status wakeuphere-joystick --no-pager
sudo journalctl -u wakeuphere-joystick -b -n 60 --no-pager
```

直接查看 X／Y／SW（先停服務）：

```bash
sudo systemctl stop wakeuphere-joystick
sudo python3 /opt/wakeuphere/joystick.py --diagnose
```

X／Y 為 0～1023，中心通常接近 512；SW 放開=1、按下=0。Ctrl+C 結束，再：

```bash
sudo systemctl start wakeuphere-joystick
```

方向相反時編輯：

```bash
sudo nano /etc/default/wakeuphere-joystick
```

將對應的 `INVERT_X=0`／`INVERT_Y=0` 改為 `1`，再重啟搖桿服務。不要同時啟動舊的 `~/wakeuphere/joystick.py`。

新版瀏覽器會自動重新啟動，因此需要維修時，從 SSH 或桌面 Terminal 先建立維修標記：

```bash
mkdir -p ~/.config/wakeuphere
touch ~/.config/wakeuphere/maintenance
```

再按 Alt+F4 關閉瀏覽器，讓它保持關閉。搖桿仍會控制有焦點的視窗，維修時也應停止搖桿服務。恢復：

```bash
rm ~/.config/wakeuphere/maintenance
sudo systemctl start wakeuphere-joystick
```

瀏覽器啟動器若仍在執行會於數秒內重開；否則重新登入或重開機。

要暫停開機啟動，註解 `~/.config/labwc/autostart` 中 WakeUpHere 管理區塊的啟動行，並執行 `sudo systemctl disable --now wakeuphere-joystick`。這不會撤回自動登入；該設定在 `/etc/lightdm/lightdm.conf.d/90-wakeuphere.conf`，可移走此檔並依你的桌面需求重新設定。沒有自動解除安裝指令。

## 多台安裝

每台用乾淨 OS，配置獨立 hostname，例如 wakeup-pi-01、02、03。下載相同安裝腳本並執行即可，不需要逐台編輯 GPIO 編號或服務路徑。首次 userName 仍需逐台設定。

建議先驗收一台，再固定安裝腳本的 Git commit 版本下載，避免大量裝到一半腳本剛好更新。管理電腦可透過 SSH 執行安裝；建議逐台或小批驗證，不要一開始就讓所有設備同時重開機。

本版提供：安裝腳本、嵌入的控制程式與啟動器、檔案備份及測試。沒有包含 SD 卡燒錄、Wi-Fi 配網、Ansible fleet 管理或裝置名稱遠端佈署功能。

## 開發驗證

在電腦可執行不接觸系統設定的 payload 匯出及測試：

```bash
bash scripts/install-wakeuphere-pi.sh --extract /tmp/wakeuphere-payload
python3 -m unittest discover -s tests -p 'test_pi_installer.py' -v
```

參考：[Pi 官方 kiosk 教學](https://www.raspberrypi.com/tutorials/how-to-use-a-raspberry-pi-in-kiosk-mode/)、[raspi-config 原始碼](https://github.com/RPi-Distro/raspi-config)。
