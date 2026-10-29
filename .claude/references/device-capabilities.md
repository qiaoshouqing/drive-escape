# 小工具能力清单

> 小工具运行在受限容器中：**纯本地、不联网**，把它当作一个能力受限的浏览器页面。
> **以本文为基线**：命中「不可用」项必须移除或改用替代写法。

## 目录

- §1 可用能力
- §2 Native 能力（JSBridge）
- §3 不可用能力（Web API）
- §4 不可用行为
- §5 WebGL / 图形计算边界
- §6 常见交互怎么实现
- §7 能力扫描清单

---

## 1. 可用能力

### 页面与渲染

标准 HTML / CSS / JS 完整可用：Flexbox / Grid / 动画 / 媒体查询、Canvas 2D（`getContext('2d')`）、WebGL（`getContext('webgl'/'webgl2')`，边界见 §4）、文本选择不限制。

### 媒体与文件

| 能力 | 用法 | 约束 |
| --- | --- | --- |
| 摄像头 | `navigator.mediaDevices.getUserMedia({ video: true })` | 用户手势触发 + 系统弹窗授权 |
| 麦克风 | `navigator.mediaDevices.getUserMedia({ audio: true })` | 用户手势触发 + 系统弹窗授权 |
| 选择图片 / 拍照 | `<input type="file">` | 系统选择器接管，**仅能选图片和视频**（无论 `accept` 如何设置） |
| 音视频播放 | `<video>` / `<audio>` | 内联播放，媒体文件须打包在内 |

### 数据存储

`localStorage` / `sessionStorage` / `IndexedDB` / `Cookie` / `Cache API` 均可用，按小工具独立隔离，其他小工具与外部无法访问。

Cookie 仅作本地存储：可读写、按 origin 隔离，但因不联网**不会随请求发往服务端**，不能用于登录态 / 鉴权。需要本地存储优先用 `localStorage` / `IndexedDB`。数据不保证永久持久化。

### 交互

`alert()` / `confirm()` 可用，以原生 UI 展示。

---

## 2. Native 能力（JSBridge）

容器会注入 **`window.xhs.miniTool.*`**，通过它调用 Native 能力（发笔记、存相册、跳 App 页等）。

| 规则 | 说明 |
| --- | --- |
| 唯一入口 | 只用 `window.xhs.miniTool.<apiName>(options)`，**禁止**自行 `postMessage` 到 bridge |
| 契约来源 | 以 [`jsbridge-api.md`](./jsbridge-api.md) 为准 |
| 参数校验 | 必填项、长度、数组上限等以 [`jsbridge-api.md`](./jsbridge-api.md) 为准 |
| 本地路径 | `saveImageToPhotosAlbum.filePath` 不支持网络 URL；base64 可先 `writeTempFile` 换 `filePath` |
| data:uri | `writeTempFile.data` 必须是完整 `data:<mime>;base64,...`（`canvas.toDataURL()` 原样传），裸 base64 会失败 |
| 发笔记 | `postNote.mediaInfo` 必填；图片走 `image_resources[].url`，视频走 `video_resources` |
| 跳原生页 | `openRedPage.type` 须命中 Native 规则表白名单，`params` 为语义参数 |

完整 API 列表、字段表与示例 → **[jsbridge-api.md](./jsbridge-api.md)**。

---

## 3. 不可用能力（Web API）

以下 API 已禁用，调用会抛异常、返回空值或被拦截，必须移除或改用替代写法。

| 分类 | 涉及 API | 替代方案 |
| --- | --- | --- |
| 定位 | `navigator.geolocation.getCurrentPosition` / `watchPosition` | 移除 |
| 剪贴板 | `navigator.clipboard.readText` / `writeText`、`document.execCommand('copy'/'cut'/'paste')` | 展示可选中文本，引导用户长按 / 选中手动复制 |
| 硬件连接 | `navigator.bluetooth` / `navigator.usb` / `navigator.hid` / `navigator.serial` | 移除 |
| 传感器 | `new Accelerometer()` / `new Gyroscope()` / `new Magnetometer()`、环境光、`DeviceMotionEvent` / `DeviceOrientationEvent` | 改用触摸 / 指针手势（见 §5），摇一摇类移除 |
| 实时通信 | `new WebSocket()`、`new EventSource()`、`new RTCPeerConnection()` | 移除（不联网，无轮询替代） |
| 后台运行 | Web Worker、SharedWorker、Service Worker（`navigator.serviceWorker.register`） | 移除，逻辑放主线程 |
| 屏幕 | `getDisplayMedia`（屏幕共享）、`Element.requestFullscreen`（全屏由容器统一管理） | 全屏用 CSS 沉浸式布局实现视觉全屏 |
| 设备信息 | `navigator.getBattery`、`navigator.connection`、`navigator.mediaDevices.enumerateDevices` | 移除 |
| 存储进阶 | `navigator.storage.persist`（持久化）、跨域存储访问 | 移除，本地缓存用 `localStorage` / `IndexedDB` |
| 凭据 | `navigator.credentials.get` / `create`（WebAuthn）、`navigator.locks` | 移除 |
| 窗口 | `window.open`（弹新窗口）、`window.prompt` | 单页内 JS 切换视图 DOM；输入用页内 Modal |

移动端 WebView 本身也不支持：支付 `PaymentRequest`、系统通知 / 推送、NFC、MIDI、XR / AR / VR、后台同步 / 下载、PWA 安装、窗口管理、指针 / 键盘锁定。一律移除。

---

## 4. 不可用行为

| 行为 | 说明 | 替代方案 |
| --- | --- | --- |
| 网络请求 | `fetch` / `XMLHttpRequest`、加载外部图片 / 字体 / 媒体等一切联网请求 | 所有资源打包在内，改本地相对引用；数据用包内 `.json` 或写死在 JS |
| 动态执行代码 | `eval()`、`new Function()` | 改写为静态逻辑 |
| WebAssembly | WASM 编译执行（依赖 WASM 的库无法运行） | 移除或改用纯 JS 实现 |
| iframe / object | 内嵌 iframe / object，或被外部页面嵌入 | 内容直接写进页面 |
| 表单跳转提交 | `<form>` 提交跳转 | `addEventListener('submit', e => e.preventDefault())` 后用 JS 处理 |
| 文件下载 | `a[download]`、blob 下载 | 移除 |
| 打开外链 / 新窗口 | `target="_blank"`、`window.open`、跳转站外 URL | 单页内 JS 切换视图 DOM |
| 跳转其他小工具 | 小工具间互相跳转 | 移除 |
| 长按菜单 | 系统长按菜单已禁用 | 用自定义交互替代 |
| 插件 | Flash 等浏览器插件 | 移除 |

---

## 5. WebGL / 图形计算边界

纯 WebGL 渲染可用，组合能力受限：

| 场景 | 是否可用 |
| --- | --- |
| 包内资源 / Canvas / 内存对象作为纹理 | ✅ |
| 外部域名图片作为纹理 | 🔴 不联网，纹理须打包在内 |
| 依赖 WASM 的加速库（Draco / Basis / ONNX / 抠图算法等） | 🔴 |
| 依赖 Worker 的离屏渲染（OffscreenCanvas + Worker） | 🔴 |
| SharedArrayBuffer 多线程 | 🔴 |

WebGL 适合用包内资源做本地渲染；AI 图像处理等重计算（需联网或 WASM 模型）无法支持。

---

## 6. 常见交互怎么实现

| 需求 | 实现 |
| --- | --- |
| 手势 / 拖拽 / 滑动 | `addEventListener('touchstart'/'touchmove'/'touchend')` 或 Pointer Events（`pointerdown`/`move`/`up`） |
| 拍照 / 录音 | `getUserMedia(...)`，由按钮点击等用户手势触发 + 授权 |
| 选择图片 / 视频 | `<input type="file">` |
| 复制文本 | 展示可选中文本，引导用户长按 / 选中复制 |
| 视觉全屏 | CSS 布局（`100vh` / flex + 隐藏滚动） |
| 页面跳转 | 单页内用 JS 切换视图 DOM |
| 输入弹窗 | 页内 Modal 组件 |
| 保存图片到相册 | `writeTempFile({ data: canvas.toDataURL(...) })`（须完整 data:uri）→ `saveImageToPhotosAlbum({ filePath })`，见 [jsbridge-api.md](./jsbridge-api.md) |
| 发布笔记 | `postNote({ mediaInfo, title?, content? })` |
| 跳转 App 搜索 / 用户页等 | `openRedPage({ type, params? })`，`type` 须在白名单内 |

---

## 7. 能力扫描清单

扫描代码，命中下列模式则**必须删除或改用替代写法**：

```
fetch( / XMLHttpRequest / new WebSocket( / new EventSource( / new RTCPeerConnection(
navigator.geolocation.getCurrentPosition / watchPosition
navigator.clipboard.readText / writeText  ·  document.execCommand('copy')
navigator.bluetooth / navigator.usb / navigator.hid / navigator.serial
navigator.getBattery / navigator.connection / navigator.credentials / navigator.locks
navigator.mediaDevices.enumerateDevices / navigator.mediaDevices.getDisplayMedia
navigator.storage.persist / navigator.serviceWorker.register
new Worker( / new SharedWorker(
new Accelerometer() / new Gyroscope() / new Magnetometer()
DeviceMotionEvent / DeviceOrientationEvent / addEventListener('devicemotion' / 'deviceorientation')
Element.requestFullscreen / webkitRequestFullscreen
eval( / new Function( / WebAssembly.
window.open( / window.prompt(
location.href = / location.assign(   （跳转站外 URL）
<form ...> 提交跳转  ·  <a ... download>  ·  target="_blank"
<iframe> / <object>
<script src="https://..."> / <link href="https://..."> / <img src="https://..."> / CSS url(https://...)
    —— 外部资源一律加载不到，须下载后打进 zip 改本地相对引用
```

**允许保留**：

```
navigator.mediaDevices.getUserMedia({ video / audio })   // 用户手势 + 授权
<input type="file">                                       // 选图片 / 视频
localStorage / sessionStorage / IndexedDB / Cookie / Cache API   // 独立隔离
alert() / confirm()
touch / pointer events                                    // 手势交互
标准 DOM / CSS / Canvas 2D / WebGL 渲染
```
