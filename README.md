# Backlink Inspector

基于 WXT、React 和 TypeScript 的 Chrome Manifest V3 扩展。插件通过 Chrome Side Panel 扫描当前页面中的目标域名链接与纯文本提及，并提供非侵入式高亮、定位、链接属性分类、本地保存和导出能力。

## 本地开发

```bash
pnpm install
pnpm dev
```

在 Chrome 的 `chrome://extensions` 中开启开发者模式，然后加载 WXT 输出的开发扩展目录。

## 校验命令

```bash
pnpm typecheck
pnpm test
```

## 已实现能力

- Chrome Side Panel 常驻界面
- 域名、子域名和完整 URL 匹配
- 普通链接、图片链接、纯文本提及和常见跳转链接识别
- `nofollow`、`ugc`、`sponsored` 等 `rel` 属性分类
- 正文、评论、导航、侧栏和 Footer 位置判断
- 可见性、页面 `noindex` 与页面级 `nofollow` 检测
- Overlay 高亮与结果定位，不改写原始文字节点
- Open Shadow DOM 扫描和动态页面防抖重扫
- 本地项目、收藏记录、JSON 与 CSV 导出
- `activeTab` 与按站点申请的可选权限
