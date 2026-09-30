# 每日清单

一个轻量的 Windows 桌面待办小组件，使用 Electron 构建。把今天要做的事放在桌面一角，支持提前安排明天的事项，并按长期项目整理任务。

## 功能

- 管理今天和明天的待办，标记完成、编辑、删除和拖动排序。
- 将事项归入长期项目，查看项目进度和日历中的每日记录。
- 对昨天未完成的事项逐项选择是否带入今天。
- 拖动窗口、收起、最小化和置顶。
- 数据保存在本机，不需要账号或网络服务。

## 运行环境

- Windows
- Node.js 与 npm

## 从源码运行

```powershell
npm.cmd ci
npm.cmd start
```

安装依赖后，也可以双击 `启动每日清单.vbs` 启动。

## 构建 Windows 便携版

```powershell
npm.cmd ci
npm.cmd run dist
```

构建结果在 `dist/` 目录。此目录属于本机构建产物，不纳入源码仓库。

## 数据说明

事项保存在 Electron 的本机用户数据目录中的 `daily-list-data.json`，同时写入应用本地存储。打开应用时只显示今天或明天的清单；昨天未完成的事项可由用户选择是否带入今天。长期项目可通过项目日历查看相关历史事项。

## 技术与资源

- Electron、原生 JavaScript、HTML 和 CSS。
- 随项目附带的 Noto Sans SC 字体遵循 [SIL Open Font License 1.1](src/fonts/OFL-LICENSE.txt)。

## 许可

本项目目前未声明开源许可证。字体的授权以其独立许可证为准。
