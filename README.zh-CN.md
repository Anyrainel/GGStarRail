# GGStarRail

GGStarRail 是一个本地优先的《崩坏：星穹铁道》账号、背包、配装与遗器整理工作台。
当前仓库提供完全独立的应用基础，不包含 GenshinTools 的游戏引擎、数据、资源、
导入格式、持久化结构或云资源。

首个提交即包含类型化的英文与简体中文词条。角色、光锥、遗器等领域数据始终使用
稳定 ID，切换语言不会改变存储结构，也无需后续进行“英文字段转多语言字段”的迁移。

## 本地运行

```powershell
npm install
npm run data:sync
npm run assets:sync
npm run dev
```

`data:sync` 会先校验同级 GIlore 仓库中的规范化数据包，再写入本仓库已忽略的
本地生成目录。全新检出时，需要先在 GIlore 中生成其未纳入 Git 的数据包，或通过
`--source` 指定另一个已验证的数据包；详见[数据来源要求](docs/source-provenance.md)。
`assets:sync` 只消费 GIlore 已生成并校验的资源包，将图片写入本仓库忽略的本地缓存；
GGStarRail 不提交或主张拥有上游游戏美术资源。

Vite 默认监听 `http://localhost:5173`。可另行运行 `npm run dev:worker`
启动不带任何线上绑定的 Worker 外壳；它目前只提供 `GET /api/health`。

## 当前真实范围

已实现：React 19 应用外壳、响应式路由、双语目录、星铁领域模型、完整且按需加载的
GIlore 图鉴数据、可复现的数据同步与完整性校验、Zustand 版本化持久化、独立备份
封装、可搜索筛选并查看详细数据的角色/光锥/遗器图鉴、账号背包视图、使用真实图鉴
ID 的演示账号、导入前审阅的本地 JSON 文件流程、GGStarRail 与 GOODScanner 的显式
适配器、基础评分/计算筛选/建议整理服务、安全错误处理、Worker 健康检查以及测试和
边界规则。校验失败的导入不会修改当前账号数据。

后续接入：实时扫描采集与正式扫描器交接、HoYoLAB 网络请求、完整配装编辑器、云备份、
身份认证、Worker 存储与生产配置。

明确排除：队伍伤害优化、原神伤害引擎和充能计算器。

身份 Cookie 只允许在单次导入请求期间保留在内存中，随后必须清除；不得写入
localStorage、sessionStorage、IndexedDB、备份、URL、日志或错误详情。

更多设计说明见 [架构文档](docs/architecture.md)、[MVP 范围](docs/mvp-scope.md)、
[数据来源要求](docs/source-provenance.md)、[安全边界](docs/security.md)与
[后续里程碑](docs/milestones.md)。
