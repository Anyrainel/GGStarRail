# GGStarRail

GGStarRail 是一个本地优先的《崩坏：星穹铁道》账号、背包、配装与遗器整理工作台。
当前仓库提供完全独立的应用，不包含 GenshinTools 的游戏引擎、数据、资源、
导入格式、持久化结构或云资源。

首个提交即包含类型化的英文与简体中文词条。角色、光锥、遗器等领域数据始终使用
稳定 ID，切换语言不会改变存储结构，也无需后续进行“英文字段转多语言字段”的迁移。

## 本地运行

```powershell
npm install
npm run data:sync
npm run assets:sync
npm run demo:start
```

`data:sync` 会先校验同级 GIlore 仓库中的规范化数据包，再写入本仓库已忽略的
本地生成目录。全新检出时，需要先在 GIlore 中生成其未纳入 Git 的数据包，或通过
`--source` 指定另一个已验证的数据包；详见[数据来源要求](docs/source-provenance.md)。
`assets:sync` 只消费 GIlore 已生成并校验的资源包，将图片写入本仓库忽略的本地缓存；
GGStarRail 不提交或主张拥有上游游戏美术资源。

`demo:start` 会在 `http://127.0.0.1:41737` 启动与终端分离的本地演示站，
在复用现有端口前会校验 GGStarRail 页面标识，日志写入
`%TEMP%\ggstarrail-demo`。它不是重启后自动运行的 Windows 服务。如需前台调试，
可使用 `npm run dev`；另可运行 `npm run dev:worker` 启动不带存储绑定的本地
Worker，它提供健康检查和严格白名单限制的账号导入代理路由。

## 当前真实范围

已实现：React 19 应用外壳、响应式路由、双语目录、星铁领域模型、完整且按需加载的
GIlore 图鉴数据、可复现的数据同步与完整性校验、Zustand 版本化持久化、独立备份
封装、可搜索筛选并查看详细数据的角色/光锥/遗器图鉴和账号背包视图。账号数据页
提供响应式主导入入口，支持公开 UID 展示页、国际服与国服分开的战绩工具、
GGStarRail 原生格式、GOODScanner HSR v1/v2 以及 Reliquary、HSR-Scanner、Kel 和
Fribbels v4 文件，且在写入前先校验和审阅。使用真实图鉴 ID 的演示账号
仅作为次要的开发辅助。

已实现 4+2 与进阶 2+2 配装编辑、可编辑评分权重、遗器与整套配装评分、
计算筛选、推荐配装、整理建议和 GOODScanner 管理器指令预览。公开 UID 和战绩
工具只会合并其实际返回的角色与已装备物品，不会冒充完整背包，也不会删除扫描器
导入的更完整数据。账号身份不明时必须明确选择合并或替换，UID 不同时必须确认
替换。校验失败的导入不会修改当前账号数据，网站本身也不会修改游戏。

尚受外部条件限制：实时扫描采集与正式扫描器交接；未使用用户授权凭据验证过的
HoYoLAB/米游社登录成功和最小 Cookie 字段集合；完整工作区备份文件界面、云备份、
身份认证、Worker 存储与生产密钥。遇到安全验证时须在 HoYoLAB/米游社中由用户
自行完成，本站不会自动破解。

明确排除：队伍伤害优化、原神伤害引擎和充能计算器。

身份 Cookie 只允许在单次导入请求期间保留在内存中，随后必须清除；不得写入
localStorage、sessionStorage、IndexedDB、备份、URL、日志或错误详情。

更多设计说明见 [架构文档](docs/architecture.md)、[MVP 范围](docs/mvp-scope.md)、
[数据来源要求](docs/source-provenance.md)、[安全边界](docs/security.md)与
[账号导入契约](docs/account-imports.md)、[后续里程碑](docs/milestones.md)。
