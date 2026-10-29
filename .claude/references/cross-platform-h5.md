# 跨端 H5 适配

> 小工具同一份 H5 同时跑在 PC 模拟器与真机 WebView。以下是保证两端一致体验的适配要点。

---

## 1. 触摸

```css
body { -webkit-touch-callout: none; }
.touchable:active { opacity: 0.7; }
html { touch-action: manipulation; }
```

交互优先用 Pointer Events（`pointerdown/move/up`）统一处理鼠标与触摸；纯触摸场景用 `touchstart/touchmove/touchend`。

---

## 2. 滚动

```css
.scroll-container {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}
```

纵向回弹由容器控制，HTML 无需额外配置。

---

## 3. 安全区

```css
.custom-nav { padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px)); }
.bottom-bar { padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)); }
```

需配合 `<meta name="viewport" ... viewport-fit=cover>`。PC 模拟器不产生真实 `env()`，而是注入 `--safe-area-inset-*` 变量模拟安全区；真机 `env()` 为真实值。用 `var(--safe-area-inset-*, env(...))` 组合，两端都生效。

---

## 4. 布局与媒体

- 页面级容器用 `%` / `flex` / `vw`，勿写死 `width: 375px`
- 图片 `max-width: 100%`
- 用系统字体栈，避免非必要 `.woff2`

---

## 5. PC 模拟器 vs 真机

| 特性 | PC 模拟器 | 真机 | 建议 |
| --- | --- | --- | --- |
| 触摸 | 鼠标 → touch 模拟 | 原生 touch | 用 pointer events 统一 |
| 安全区 | 注入 `--safe-area-inset-*` 变量模拟 | `env()` 真实值 | 用 `var(--safe-area-inset-*, env(safe-area-inset-*, 0px))` 组合 |
| 软键盘 | 无 | 遮挡输入框 | 监听 `visualViewport` 处理 |

---

## 6. 自检

- [ ] 交互用 pointer / touch events，未依赖鼠标 hover 才能触发的关键操作
- [ ] 布局自适应，无写死像素宽度
- [ ] 安全区用 `var(--safe-area-inset-*, env(safe-area-inset-*, 0px))` 组合，配合 `viewport-fit=cover`
- [ ] 图片自适应且体积受控
