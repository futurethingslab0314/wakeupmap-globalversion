# 全球早餐網絡 (Global Breakfast Network) - UI 設計說明書

本文件記錄了今日針對用戶介面 (UI) 與響應式設計 (Responsive Design) 所做的重大調整與優化。

## 1. 核心 UI 調整

### 1.1 頂部控制與資訊
- **語言切換 (Language Toggle)**: 
  - **位置**: 從左側選單移至 **右上角** (`top-10 right-10`)。
  - **樣式**: 採用極簡的 Monospace 字體，搭配 `Globe2` 圖示。
- **時間顯示 (Time Display)**: 
  - **變更**: 根據需求 **移除** 了原有的 UTC 即時時間顯示，以簡化視覺干擾。
- **地圖模式切換按鈕**:
  - **按鈕**: 「我的甦醒地圖」與「今日誰醒來？」。
  - **調整**: 整體位置 **往上移動**，並優化了按鈕的間距與陰影效果。
  - **文字顏色**: 「已發現位置」的計數文字從螢光綠改為 **黑色**，增強閱讀對比度。

### 1.2 底部導覽列 (Mobile Navigation)
- **樣式**: 採用 **滿版、直角、黑色線框** 的設計。
- **位置**: 固定於螢幕最底部 (`bottom-0`)。
- **功能**:
  - **左側**: 返回/切換至日誌頁面。
  - **中間**: 「現在覺醒」主功能按鈕，採用螢光綠背景與太陽圖示。
  - **右側**: 切換至詳情頁面。

---

## 2. 響應式與交互設計 (Responsive & Interaction)

### 2.1 側邊面板 (Side Panels)
- **手機版 (Mobile)**: 當開啟「日誌」或「詳情」時，面板會以 **100% 寬度 (Full Screen)** 覆蓋地圖，提供沉浸式閱讀體驗。
- **電腦版 (Desktop)**: 面板維持在側邊滑出，不遮擋核心地圖區域。

### 2.2 觸控與手勢 (Touch & Gestures)
- **地圖交互**: 
  - 支持 **雙指縮放 (Pinch to Zoom)** 與 **單指旋轉 (Drag to Rotate)**。
  - 透過 D3.js 的 `zoom` 行為實現流暢的地球儀操作。
- **頁面切換**: 
  - 底部導覽列在側邊面板開啟時會自動調整狀態，中間按鈕消失，左右箭頭維持在邊緣，方便快速切換回地圖模式。

---

## 3. 重點程式碼參考

### 底部導覽列實作 (`App.tsx`)
```tsx
{/* Mobile Navigation Controls */}
<div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] pointer-events-auto bg-white border-t border-black">
  <div className="flex items-center w-full h-16">
    {/* 左箭頭 */}
    <motion.button className="flex-1 h-full border-r border-black ...">
      <ChevronLeft className="w-6 h-6 text-black" />
    </motion.button>

    {/* 中間主按鈕 (地圖模式顯示) */}
    <AnimatePresence mode="wait">
      {!isAnyPanelOpen && (
        <motion.button className="flex-[3] h-full bg-[#45e945] ...">
          <Sun className="w-4 h-4" />
          <span>現在覺醒</span>
        </motion.button>
      )}
    </AnimatePresence>

    {/* 右箭頭 */}
    <motion.button className="flex-1 h-full border-l border-black ...">
      <ChevronRight className="w-6 h-6 text-black" />
    </motion.button>
  </div>
</div>
```

### 地圖縮放與旋轉邏輯 (`Map.tsx`)
```tsx
const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
  .scaleExtent([1, 8]) // 限制縮放範圍
  .on('zoom', (event) => {
    const { transform } = event;
    // 更新投影縮放與旋轉
    projection.scale(initialScale * transform.k);
    // 處理單指拖拽旋轉
    if (event.sourceEvent.type === 'mousemove' || event.sourceEvent.type === 'touchmove') {
      // 旋轉邏輯...
    }
    render();
  });
```

---

## 4. 重點檔案清單與位置
- **`/src/App.tsx`**: 
  - **底部導覽列 (Mobile Nav)**: 約於 `L378 - L435`。包含滿版直角按鈕、`AnimatePresence` 切換邏輯。
  - **頂部控制項 (Header)**: 約於 `L438 - L550`。包含操作員身份輸入、地圖模式切換按鈕。
  - **語言切換 (Language Toggle)**: 約於 `L614 - L620`。固定於右上角的切換邏輯。
- **`/src/components/Map.tsx`**: 
  - **交互邏輯 (Interaction)**: 處理 D3 地球儀的 `zoom` 與 `drag` 觸控手勢，支持縮放與旋轉。
- **`/src/index.css`**: 
  - **全域樣式**: 定義 Tailwind 主題、螢光綠變數與基礎 Monospace 字體導入。

---
*本文件由系統自動生成，記錄 2026-03-23 之 UI 更新。*
