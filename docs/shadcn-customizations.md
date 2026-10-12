# shadcn 本地改动

## Card · 2026-10-12

文件：`src/components/ui/card.tsx`。

- Card：移除外壳 `py-6` 和区块间 `gap-6`，内部留白由各区块负责。
- CardHeader：默认使用 flex，移除固定两行 grid 和下边框触发的 `pb-6`；有 CardAction 时仍使用 grid。
- Card：增加 `asChild`，让 TeamCard、BuildCard 保留 article 语义及拖拽 ref。

更新时审查并重新应用这些差异，不直接覆盖。Card 登记为自定义组件，接受普通 UI 样式检查；其余 stock 组件继续校验源码哈希。

本仓库没有 stock Select，现有 LightweightSelect 使用普通高度类，没有 `data-size` 高度覆盖问题，本次保留。
