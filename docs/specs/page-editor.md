# 页面装修编辑器约束

- 当后台画布复用公开商城组件时，必须同步提供该组件在线上布局依赖的 React Context。当前 `PublicHome` 会渲染使用 `usePublicCart` 的 `ProductCard`，因此编辑器预览必须位于 `PublicCartProvider` 内；违反此约束会导致页面打开或拖入商品组件时发生客户端异常。
- 后台预览中的购物车 Context 只用于满足共享组件的运行环境，不代表预览可以提交订单或写入线上业务数据。
