# 图采集 ImageGrab

使用 Codex 按教程开发的 Chrome Manifest V3 电商图片提取与 PNG 批量下载插件，包含无构建依赖的静态官网。

- 官网：https://luwww0720-spec.github.io/imagegrab/
- 仓库：https://github.com/luwww0720-spec/imagegrab
- 插件安装包：[下载 ZIP](https://luwww0720-spec.github.io/imagegrab/downloads/imagegrab-extension.zip)

## 安装与使用

1. 下载并解压官网提供的插件 ZIP。
2. Chrome 打开 `chrome://extensions`，Edge 打开 `edge://extensions`。
3. 开启开发者模式，点击“加载已解压的扩展程序”，选择含 `manifest.json` 的文件夹。
4. 刷新已打开的商品页，向下滚动让详情图片加载。
5. 点击商品详情页右下角“获取图片”，或点击工具栏插件图标后提取。
6. 在新打开的图片工作台全选、反选、按尺寸筛选，点击“下载选中 · PNG”。
7. 文件保存到浏览器下载目录的“图采集”子目录，命名为 `商品图_001.png`。

## 功能与边界

- 按商品详情页 URL 注入浮动按钮，支持淘宝、天猫、京东、拼多多常见商品详情路由。
- 扫描 `img`、`srcset`、`picture`、懒加载属性和 CSS 背景图，补全相对 URL、去重、读取真实尺寸，过滤小于 100×100 图片及常见图标链接。
- 扩展页预览并显示尺寸，支持全选、反选、仅显示已选、100/300/600 px 尺寸筛选。
- Service Worker 使用 `fetch → createImageBitmap → OffscreenCanvas → PNG → chrome.downloads`。等待浏览器报告文件保存完成后才计为成功，逐张显示进度及错误。
- 素材不上传到第三方服务器，不收集账号信息，不绕过登录、防盗链或站点访问控制。
- 仅处理当前 DOM 可读取的图片；未加载图片、封闭组件或跨域 iframe 中的图片不保证获取。平台改版可能需要更新选择器或路由判断。
- 图片 CDN 权限按显式域名列出；不申请全站访问。未列入的域名会过滤或下载失败。
- GIF 等动态图会转换为静态 PNG；转换不放大或提升原图清晰度。
- 平台兼容性是基于常见页面结构的实现，自动化测试使用受控商品页和原创素材，不表示已登录并实测所有电商平台。

## 项目结构

```text
extension/        可直接加载的插件，Manifest V3
docs/             官网，原生 HTML / CSS / JavaScript
  assets/         原创 SVG 插画，无 CDN 资源依赖
  downloads/      可下载插件 ZIP
tests/            受控商品页及浏览器验收脚本
MCP-SETUP.md      Codex 与教程 mcp.json 的等效配置说明
BUGFIX.md         按复现、日志、定位、修复、回归记录验收
```

## 官网本地预览与发布

双击 `docs/index.html` 即可查看；或者 `python -m http.server 4173 --directory docs` 后访问 `http://localhost:4173`。在 `docs/css/style.css` 的 `:root` 调整主色等设计变量；在 `docs/index.html` 修改文案。

GitHub Pages 设置为从 `main` 分支 `/docs` 发布。插件本身需要在浏览器扩展管理中加载；GitHub Pages 只承载官网和安装包。

## 授权

MIT。仅下载你拥有合法使用权的图片。本项目为独立学习项目，与所列平台无隶属关系。
