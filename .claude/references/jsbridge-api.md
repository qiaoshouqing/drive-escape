# 小工具 JSBridge API 规范

容器会注入 **`window.xhs.miniTool.*`**，业务代码通过它调用 Native 能力。字段以本文档为准，表中未声明的字段不要传。

## 调用约定

| 项 | 规则 |
| --- | --- |
| 入口 | `window.xhs.miniTool.<apiName>(options)` |
| 两种用法 | 不传回调 → 返回 `Promise`；传 `success` / `fail` / `complete` 任一 → 返回 `undefined`，经回调拿结果 |
| 成功 | Promise resolve / `success(result)`；关注业务字段（见各 API「结果」），无业务字段则结果为空 |
| 失败 | Promise reject / `fail(error)`；失败原因看 `error.errMsg`（形如 `<apiName>:fail …`），可能带 `errCode` |
| `complete` | 成功或失败都会回调，参数为对应的 result / error |
| 禁止 | 不要调用本文未列出的 API，不要传字段表未声明的字段 |

## API 索引

| API | 说明 |
| --- | --- |
| [`postNote`](#postnote) | 发布笔记 |
| [`saveImageToPhotosAlbum`](#saveimagetophotosalbum) | 保存图片到系统相册 |
| [`openRedPage`](#openredpage) | 通用原生页面跳转 |
| [`writeTempFile`](#writetempfile) | base64 转临时文件 |

## postNote

发布笔记。

- **调用**：`window.xhs.miniTool.postNote(options)`

### 使用规则

- `mediaInfo` 必填；`image_resources`（图文）、`video_resources`（视频）、`live_photo_resources`（实况）至少传一种，可同时传。
- 所有地址（`url` / `video_url` / `cover_url`）承载 base64 data:uri 或网络地址，格式由 Native 侧校验。

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `title` | string | 否 | 标题，最长 20 |
| `content` | string | 否 | 正文，最长 1000 |
| `pageType` | `"video_publish" \| "photo_publish" \| "slides_edit"` | 否 | 页面类型 |
| `mediaInfo` | object | 是 | 见「mediaInfo」 |
| `tags` | string | 否 | 标签 |

**`mediaInfo`**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `image_resources` | `{ url }[]` | 否 | 图文，1–18 张；`url` 图片地址 |
| `video_resources` | `{ video_url, cover_url? }` | 否 | 视频；`video_url` 视频地址，`cover_url` 可选封面 |
| `live_photo_resources` | `{ url, video_url }[]` | 否 | 实况，1–18 张；`url` 动图封面，`video_url` 动图视频 |

### 结果

成功结果仅含通用 `errMsg`，无额外业务字段。

### 示例

图文笔记：

```js
await window.xhs.miniTool.postNote({
  title: "标题",
  content: "正文",
  pageType: "photo_publish",
  mediaInfo: {
    image_resources: [{ url: "data:image/png;base64,..." }],
  },
});
```

视频笔记：

```js
await window.xhs.miniTool.postNote({
  pageType: "video_publish",
  mediaInfo: {
    video_resources: { video_url: "...", cover_url: "..." },
  },
});
```

## saveImageToPhotosAlbum

保存图片到系统相册。

- **调用**：`window.xhs.miniTool.saveImageToPhotosAlbum(options)`

### 使用规则

- `filePath` 只接受 base64 data:uri 或本地路径，传网络地址（`http(s)://`）会失败。
- 已有 base64 时可先调 `writeTempFile` 换取本地 `filePath`，再传入本 API。
- 需由用户主动操作触发；首次调用可能弹系统相册权限。

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `filePath` | string | 是 | 本地图片路径（base64 data:uri 或本地引用），不支持网络地址 |

### 结果

成功结果仅含通用 `errMsg`，无额外业务字段。

### 示例

```js
await window.xhs.miniTool.saveImageToPhotosAlbum({
  filePath: "data:image/png;base64,...",
});
```

## openRedPage

通用原生页面跳转。

- **调用**：`window.xhs.miniTool.openRedPage(options)`

### 使用规则

- `type` 命中 Native 规则表白名单才放行，未命中直接失败；规则表由客户端维护。
- `params` 为语义参数，由规则表映射到目标页面；信任字段由客户端强制注入。
- 跳转会离开当前小工具页面，调用前应完成本地状态持久化。

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `type` | string | 是 | 规则表 key（如 search / note / user…） |
| `params` | object | 否 | 语义参数（如 `{ keyword }`） |

### 结果

成功结果仅含通用 `errMsg`，无额外业务字段。

### 示例

```js
await window.xhs.miniTool.openRedPage({
  type: "search",
  params: { keyword: "连衣裙" },
});
```

## writeTempFile

base64 转临时文件，返回可传给其他 API 的 `filePath`。

- **调用**：`window.xhs.miniTool.writeTempFile(options)`

### 使用规则

- 用于把内存中的 base64（Canvas 导出、选图预览等）落成本地文件，换取 `filePath`。
- **`data` 必须是完整 data:uri**，即 `data:<mime>;base64,<payload>` 开头（如 `data:image/png;base64,iVBORw0KGgo...`）；只传裸 base64 字符串会失败。
- `canvas.toDataURL()` / `FileReader.readAsDataURL()` 的返回值已是 data:uri，**不要**再截取 `,` 之后的部分。
- 返回的 `filePath` 为临时文件，即用即弃。

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `data` | string | 是 | 完整 data:uri（`data:<mime>;base64,<payload>`），不接受裸 base64 |

### 结果

成功结果在通用 `errMsg` 之外附带：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `filePath` | string | 转换得到的临时文件路径 |

### 示例

```js
// canvas.toDataURL() 直接就是 data:uri，原样传入
const { filePath } = await window.xhs.miniTool.writeTempFile({
  data: canvas.toDataURL("image/png"), // "data:image/png;base64,iVBORw0KGgo..."
});
await window.xhs.miniTool.saveImageToPhotosAlbum({ filePath });
```

错误用法：

```js
// ✗ 裸 base64，会失败
await window.xhs.miniTool.writeTempFile({ data: "iVBORw0KGgo..." });
// ✗ 手动去掉了 data:uri 前缀
await window.xhs.miniTool.writeTempFile({
  data: canvas.toDataURL("image/png").split(",")[1],
});
```
