# JistAI 二次开发维护说明

本分支基于 QuantumNous/new-api `v1.0.0-rc.21`，保留原项目名称、版权、NOTICE 和 AGPL-3.0 许可信息。JistAI 的定制代码只扩展首页和模型请求并发控制，不替换上游项目身份。

## 首页

默认主题在 `HomePageContent` 为空时渲染 JistAI 首页。管理员配置的 Markdown、HTML 或 iframe 首页仍具有最高优先级，不会被定制页面覆盖。

首页从 `/api/status` 读取以下公开配置：

- `system_name`：站点名称，缺失时使用 `JistAI`。
- `logo`：品牌图片，缺失或加载失败时使用 JistAI 固定 Logo。
- `server_address`：API 地址，页面会去掉结尾斜杠并补充 `/v1`。
- `docs_link`：文档地址，缺失时使用 new-api 官方文档。

生产启用新首页前，必须先备份当前 `HomePageContent`，再由管理员明确授权清空。回滚时恢复备份值即可，不需要数据库迁移。

## 并发限制

系统设置的“请求限制”中新增两个 option：

- `ModelRequestConcurrencyLimit`：每个用户的全局最大并发数。
- `ModelRequestConcurrencyLimitGroup`：分组覆盖，例如 `{"default":5,"vip":20}`。

规则如下：

- `0` 表示不限制。
- 未列出的分组继承全局值；显式分组值 `0` 表示该组不限制。
- 同一用户的所有 API Key 共享额度，Redis key 按用户 ID 隔离。
- Token 分组优先于用户分组，与现有 `ModelRequestRateLimit` 的分组选择一致。
- 作用范围与现有模型请求速率限制一致：同步 `/v1` 和 `/v1beta` relay。
- Playground、Midjourney、Suno、Kling、Jimeng 和其他异步任务协议不在此额度内。异步任务的 HTTP 提交生命周期不等于后台任务运行生命周期，需要单独设计任务并发策略。

达到额度时返回 OpenAI 兼容的 `429` 错误，并包含 `Retry-After: 1`。Redis 已启用但无法获取租约时返回 `503`，不会绕过限制继续请求。

Redis 模式使用每用户 ZSET 租约和 Lua 原子操作，默认租期 90 秒、每 30 秒续租；续租持续到 relay handler 真正返回。获取、续租和释放均使用独立超时，获取结果不确定时会按同一 lease ID 做幂等处理和尽力清理。Redis 未启用时使用单进程内存计数，因此多实例部署必须启用共享 Redis。

Redis 网络分区超过租期或 Redis 主动逐出租约 key 时，正在执行且尚未返回的请求无法继续获得严格的跨节点额度保证。不要为解决该问题直接把客户端断连 context 绑定到所有上游请求；这可能在供应商已经接单或计费后触发本地退款。需要更强保证时，应单独设计带账务结算语义的服务端取消和 fencing 机制。

## 验证

提交前至少执行：

```bash
go test ./setting ./model ./middleware ./router
go test -race ./setting ./model ./middleware

cd web/default
bun test src/features/jistai-home/__tests__/public-config.test.ts \
  src/features/system-settings/request-limits/concurrency-limit.test.ts
bun run typecheck
bun run build

cd ../classic
bun run build
```

还应使用仓库 Dockerfile 完成全镜像构建，并在隔离预览中检查：

- 首页桌面、手机、亮色和暗色布局。
- API 地址复制成功和失败反馈。
- 登录前后的 CTA 路由。
- 管理后台全局并发、分组可视化和 JSON 编辑模式。
- 两个 API Key 使用同一用户 ID 时共享并发额度。
- Redis 故障返回 `503`，达到额度返回 `429`，请求结束后额度释放。

## 跟随上游升级

1. 从目标 upstream tag 创建新的干净集成分支和独立 worktree。
2. 先核对 option、relay router、认证 context、Default/Classic 设置页面和首页覆盖机制是否变化。
3. 重新应用 JistAI 提交；不要直接把长期开发目录当生产发布目录。
4. 运行单测、竞态检查、两套前端构建、完整镜像构建和隔离视觉验收。
5. 生产发布必须使用不可变镜像和可回滚 release，并另外取得部署授权。
6. 发布前备份数据库和 `HomePageContent`；健康检查失败立即切回上一 release。

## 构建版本

上游仓库提交的 `VERSION` 是空占位文件，官方 CI 会在 Docker 构建前写入发布标签。JistAI 构建也必须在隔离的 Git archive 构建上下文中注入明确版本，例如 `v1.0.0-rc.21-jistai.<12 位提交号>`，不要为了单次发布修改源码工作树中的占位文件。

镜像还必须使用完整 Git 提交号作为不可变 tag，并写入 `org.opencontainers.image.revision` OCI label。后台显示版本、镜像 tag 和 revision label 三者共同用于定位实际源码；不能把二次开发镜像标记成未经修改的上游 `v1.0.0-rc.21`。

本功能不新增数据库表或迁移。两个 option 继续使用 new-api 现有 option 持久化机制。
