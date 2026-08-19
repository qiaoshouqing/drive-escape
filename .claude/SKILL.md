---
name: minitool-zip-builder
description: >-
  小红书小工具构建开发指南：把 H5 页面打包成符合容器规范的离线 zip。
  新建或改写小工具 / H5 页面、打包小工具 zip、处理端能力限制与容器 CSP 约束时使用。
metadata:
  version: "1.4.0"
---

# 小工具 ZIP 构建指南

**小工具是一种基于离线 H5 实现的 app 形式**：你写一套标准网页（以 `index.html` 为入口），打包成 `.zip`，由容器（PC 模拟器 / 真机 WebView）加载运行。它本质就是 Web，HTML/CSS/JS 经验直接适用——只是运行在受控容器里：**纯本地、不联网，所有资源须打包在内**，且部分 Web 能力被收紧。

目标产物：可直接上传的 **`.zip` 静态包**，在 PC 模拟器与真机行为一致。

## 何时使用

- 从零新建小工具页面并打包成 `.zip`
- 将已有纯 H5 页面改写为小工具规范并打包

## 工作流程

每一步**动手前必须先读对应 reference 并严格遵守其全部约束**，不要凭记忆产出：

1. **编写 / 适配 HTML** — 先读 [zip-artifact-spec.md](references/zip-artifact-spec.md)：目录结构、`index.html` 模板、路径与资源引用规则，按其编写
2. **端能力合规** — 先读 [device-capabilities.md](references/device-capabilities.md)：对照「不可用能力 / 行为」逐项核对，命中项移除或改用其给出的替代写法
3. **Native 能力（JSBridge）** — 需要发笔记、存相册、跳原生页等能力时，先读 [jsbridge-api.md](references/jsbridge-api.md)：仅使用文档列出的 `window.xhs.miniTool.*` API，参数与必填项以该文档为准，未列出的字段不要传
4. **跨端适配** — 先读 [cross-platform-h5.md](references/cross-platform-h5.md)：触摸、滚动、安全区、PC vs 真机差异
5. **正确性自查** — 静态核对页面能正常运行、无违规能力（被禁 API 无调用 / 残留、脚本加载顺序、引用资源都在 zip 内、改写时未误改业务逻辑），见 [zip-artifact-spec.md](references/zip-artifact-spec.md) 自检清单
6. **打包** — 逐条核对各 reference 末尾的自检清单，全部通过后再打包

> **产出前提**：交付的 zip 必须同时满足 `zip-artifact-spec.md`、`device-capabilities.md` 与（若使用 JSBridge）`jsbridge-api.md` 的全部约束。任何约束以 reference 为准。

## Reference

| 文档 | 何时读 |
| --- | --- |
| [zip-artifact-spec.md](references/zip-artifact-spec.md) | 写 HTML / 打包时：目录结构、`index.html` 模板、路径与资源引用规则、打包自检 |
| [device-capabilities.md](references/device-capabilities.md) | 处理端能力时：哪些 Web 能力可用 / 不可用及替代写法、如何实现常见交互（手势、拍照、选图等） |
| [jsbridge-api.md](references/jsbridge-api.md) | 调用 Native 能力时：`window.xhs.miniTool.*` 全量 API、参数约束、示例与常见组合 |
| [cross-platform-h5.md](references/cross-platform-h5.md) | 适配多端时：触摸、滚动、安全区、PC 模拟器与真机差异 |
