# FRAMEKIT 摄影工具箱

FRAMEKIT 是一个 Windows 桌面摄影工具箱，基于 Electron、TypeScript 和原生 HTML/CSS/JavaScript 构建。

## 功能

- JPG/JPEG 图片打开、拖拽导入和预览
- EXIF 信息读取与导出写入
- 拍摄时间、ISO、EV、快门、光圈、焦距、GPS、相机品牌/型号/序列号编辑
- 工具网址收藏、添加、修改、复制和删除
- 暗色/亮色主题持久化
- 无边框窗口、最小化、最大化和关闭
- 相机镜头汇聚启动动画
- Windows NSIS 安装包

## 开发环境

- Node.js 20+
- Windows x64

安装依赖：

```powershell
npm install
```

开发运行：

```powershell
npm start
```

TypeScript 编译：

```powershell
npm run build:ts
```

生成未安装目录：

```powershell
npm run pack
```

生成 Windows 安装包：

```powershell
npm run dist
```

安装包输出到：

```text
release/FRAMEKIT-Setup-1.0.6.exe
```

## 项目结构

```text
app/
├── electron/
│   ├── main.ts       Electron 主进程和 IPC
│   ├── preload.ts    安全渲染进程桥接
│   ├── photos.ts     图片和 EXIF 操作
│   ├── storage.ts    主题和网址 JSON 存储
│   └── types.ts      TypeScript 类型
├── web/
│   ├── index.html    页面结构
│   ├── style.css     页面样式和启动动画
│   ├── app.js        前端交互
│   └── lib/          Leaflet 地图资源
├── icon.ico          Windows 应用图标
├── icon.png          应用图标预览
├── package.json      依赖和打包配置
├── tsconfig.json     TypeScript 配置
└── release/          构建输出目录
```

用户设置和网址数据保存在 Electron 用户数据目录，不写入安装目录：

```text
%APPDATA%/FRAMEKIT/
```
