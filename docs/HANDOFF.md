# SullyOS Fork 长期维护交接

> 最后更新：2026-08-14（Asia/Shanghai）
> 维护对象：`Xiaoran71/SullyOS` 个人 fork
> 当前上游基线：`daefc4d1`（`qegj567-cloud/SullyOS:master`）
> 发布分支：`master`（由 `codex/shortcut-clean-baseline-20260810` 验证后切换）

## 1. 当前目标

本 fork 当前长期维护的产品定制仍以**可配置 iOS 快捷动作**为主；此外保留已由用户明确要求、且有专项文档约束的即时对话能力和局部网络稳定性修复。其他曾讨论或实现过的 fork 专项均不是当前路线，除非用户以后重新明确提出。

维护优先级：

1. 保护原始聊天、Memory Palace、角色资料和完整备份。
2. 保持旧备份安全导入、完整备份可靠往返、分享角色卡不携带本机隐私。
3. 默认保持官方 SullyOS 行为；只有配置了快捷动作的角色启用定制能力。
4. 让官方更新尽量由 Git 和 GitHub Actions 自动完成；真实冲突或回归才人工介入。

项目级 `AGENTS.md` 已将“性能与复杂度”和“上游兼容与低冲突”列为最靠前的长期 Fork 开发原则。后续实现应优先保持简单、低开销、低侵入，并在效果接近时选择更易同步上游的方案；本段仅记录该规则已建立，权威内容以 `AGENTS.md` 为准。

## 2. Git 结构

- `origin`：`https://github.com/Xiaoran71/SullyOS.git`，个人 fork。
- `upstream`：`https://github.com/qegj567-cloud/SullyOS.git`，官方仓库。本地仅用于 fetch，push URL 已禁用以防误推。
- `master`：可部署的 custom release，应该始终是“官方历史 + 少量 fork 提交”。
- `upstream-mirror`：自动化维护的纯官方镜像，禁止放个人提交。
- `automation/sync-upstream`：自动同步使用的临时 PR 分支，可以被 workflow 更新。
- `codex/shortcut-clean-baseline-20260810`：从官方 `ce7f1128` 建立并验证的干净基线来源分支。

旧 `master@877e4e3c` 另存为 `backup/master-before-clean-baseline-20260810`；历史 `custom/*` / `codex/sync-upstream-20260803` 分支也保留，可用于回退或审计，不应删除。

## 3. 干净基线包含的 fork 提交

相对官方基线，候选分支只保留以下职责清晰的提交：

1. `feat(chat): add configurable iOS shortcut actions`
2. `fix(chat): keep action panel pages within eight tiles`
3. `chore(compat): strip retired local MCP fields from cards`
4. 本项目维护规则与交接文档
5. 安全 upstream 同步 workflow 与说明

第 3 项不恢复已移除的 MCP 功能：它只在分享角色卡时剥离旧备份中可能残留的两个本机字段，避免历史配置外泄。运行代码、UI 和提示词均不读取它们。

## 4. 快捷动作现有行为

- 每个角色可以配置多个动作：名称、角色可见描述、触发条件、快捷指令名称/链接、弹窗和按钮文字、是否阻塞、冷却时间、每日上限。
- 模型只能请求用户预配置的动作 ID，不能生成任意 URL。
- 运行链接仅接受 `shortcuts://`；iCloud 分享地址不作为运行链接。
- 阻塞动作必须执行或应急解锁后才能继续聊天；pending 状态随角色持久化。
- 冷却与每日次数保存在可选运行时字段中。
- 支持无副作用的测试弹窗。
- “＋”动作面板每页最多 8 个入口；快捷动作位于第三页，与提示音、记忆链接同页。
- 旧角色缺少所有快捷动作字段时等价于未启用，不改变官方行为。

用户此前已确认电脑弹窗与 iOS 快捷指令调用正常；新基线仍需再做一次真机验证。

## 5. 数据、备份与隐私

快捷动作使用 `CharacterProfile` 上的可选字段：

- `shortcutActions`
- `pendingShortcutAction`
- `shortcutActionRuntime`

完整系统备份应保留这些字段。分享角色卡的导入和导出两侧都必须剥离它们，因为快捷指令名称、URL、pending 弹窗和限流计数属于本机配置，不属于角色人设。

旧备份里可能还有已经停用的 `preReplyMcpRules` 和 `temporaryPreReplyMcpSessions`。数据库完整备份依旧按原始对象无损往返；分享角色卡时继续剥离。不要为了“清理”主动删除用户数据库里的未知旧字段。

本次 Git 基线迁移不执行数据库迁移，不读取或删除浏览器 IndexedDB，不改变 Memory Palace、聊天存储或备份格式。

## 6. 重要定制文件

主要独立模块：

- `utils/shortcutActions.ts`
- `utils/shortcutActions.test.ts`
- `components/chat/ShortcutActionsModal.tsx`
- `components/chat/ShortcutActionOverlay.tsx`

与官方代码的接入点：

- `apps/Chat.tsx`
- `components/chat/ChatInputArea.tsx`
- `types.ts`
- `utils/chatParser.ts`
- `utils/chatPrompts.ts`
- `utils/characterCard.ts`
- `utils/characterCard.test.ts`
- `utils/backupRoundtrip.test.ts`

维护时应把业务逻辑留在独立模块，只在官方热点文件中保留薄接入，避免格式化或重构无关代码。

## 7. 自动同步策略

`.github/workflows/sync-upstream.yml` 每周或手动运行：

1. 获取官方 `master` 并刷新 `upstream-mirror`。
2. 从 custom `master` 创建/更新临时同步分支。
3. 使用普通 Git merge 尝试合入 upstream。
4. 发生文本冲突时 abort，创建或更新冲突 issue，不推送半成品。
5. 无冲突时安装锁定依赖。
6. 运行快捷动作、角色卡隐私和备份往返专项测试。
7. 运行生产 build。
8. 全部通过后才推送 `automation/sync-upstream` 并创建/更新 PR。

PR 保留为最终安全闸。若将来启用 GitHub auto-merge，应同时要求上述测试/build 检查通过。完整操作说明见 `docs/UPSTREAM_SYNC.md`。

## 8. 验证状态

2026-08-10 已完成：

- 快捷动作、角色卡隐私、完整备份专项：3 个文件、23 项测试通过。
- 全量 Vitest：212 个测试文件、3038 项测试全部通过。
- Worker bundles 与 Vite 生产构建通过。
- workflow YAML 可解析，`git diff --check` 通过。
- 旧 `master@877e4e3c` 已保存为远端 `backup/master-before-clean-baseline-20260810`；干净基线已安全切换为 `master`。
- GitHub Actions 对切换提交 `9edb2332` 的 Pages 部署与 Worker bundle 同步均成功。
- 当前官方 lockfile 中 `@rei-standard/amsg-server@2.6.0-next.16` 尚在 Codex 最小发布时间保护窗口内，标准 `pnpm install --frozen-lockfile` 因供应链策略返回非零；未放宽策略、未改 lockfile。本轮使用已下载的 lockfile 包在临时 worktree 补齐符号链接后完成测试和构建。

自动测试不能替代以下人工验证：

- 打开旧备份恢复的角色，确认快捷动作配置仍存在。
- 测试弹窗、真实 `shortcuts://` 跳转、阻塞刷新恢复和应急解锁。
- 检查原始聊天、Memory Palace、角色卡、媒体和设置仍正常。
- 导出一份新版本完整备份并妥善保存。

## 9. 当前未完成事项

- 用户已于 2026-08-10 确认切换前的最新完整系统备份已完成。
- 新版部署完成后仍需要用户做上述 iOS/PWA 与数据人工验收。
- Memory Palace 备用 API、长期聊天归档、动作面板编辑排列等旧提案均处于暂停状态，不是当前维护计划。

## 10. 2026-08-10 瞬时网络失败体验修正

- 普通聊天继续使用 `utils/safeApi.ts` 原有 retry（默认最多重试 2 次），没有叠加第二套重试。每个未到最终次数的网络失败由请求元数据标为 retry pending；`context/OSContext.tsx` 仍记录该 attempt 的后台 API 日志，但只在最终网络失败时写用户可见 `SYSTEM ERROR`。已有 HTTP 响应仍按原逻辑处理，400/401/403 等明确业务响应不被隐藏。
- `GET /get-user-key` 仅在请求没有取得业务响应、被分类为网络失败或 timeout 时等待 400ms 重试一次。401/403、`INVALID_CLIENT_TOKEN` 等明确鉴权响应不重试，也不被改写成网络问题。检查未发现网络异常被主动改写为“key 无效”；原问题是该无副作用 GET 没有 retry，且全局网络日志会立即显示。
- 即时对话调用链为 `hooks/useChatAI.ts` → `utils/amsgInstantChat.ts` → `utils/activeMsgClient.ts` → `POST /instant-chat` → `worker/amsg/src/instantChat.ts` → 上游 `PUT /client-state` / `POST /schedule-message`。此前外层 POST 没有 retry；现在只对没有 HTTP 响应的网络失败等待 400ms 重放一次，明确业务错误不重试。
- 为避免 POST 重放产生两条即时消息，客户端复用上游既有的任务 `uuid` 和 D1 唯一索引：首次与重放请求共用完全相同的 body、task uuid 和 client task id。Worker 将同 uuid 的 `TASK_UUID_CONFLICT` 视为首次请求已落库并返回同一 202；旧 Worker 的同类冲突也由新客户端识别为已受理。没有新增表、去重服务或额外网络探测。
- 网络失败耗时改用 `performance.now()` 计算单个实际 fetch attempt 的起点到抛错，不再受系统时钟跳变影响。Resource Timing 仅关联 startTime 与本次请求匹配的条目；无法可靠匹配时不显示旧条目。后续实测确认 `12020ms` / `28368ms` 是该次 fetch 的真实经过时间，不是 timeout 配置值；诊断文案不再仅凭时长断言“连接建立阶段被吞”，只陈述实测时间并明确浏览器没有暴露具体失败阶段。
- 双日志排查结果：没有发现一次用户生成并发发送两条主聊天 POST。主聊天是一个 `safeFetchJson` 串行 retry 链；近似时间的两条记录可能来自后台 API 记录与用户可见网络日志两个入口，或确实是相邻的 retry attempt。另发现全局 fetch / console.error 拦截器此前没有卸载逻辑，Provider 经 StrictMode、HMR 或结构重挂载后可能再包一层，造成同一次失败被两个监听器记成同 timestamp；现以条件恢复原函数的局部 cleanup 修复。修改不改变后台 attempt 记录和正常 retry。
- 重要文件：`context/OSContext.tsx`、`utils/safeApi.ts`、`utils/networkFailureDiagnosis.ts`、`utils/activeMsgClient.ts`、`worker/amsg/src/instantChat.ts` 及对应测试；部署 bundle 仅同步 `worker/amsg/worker.bundle.js` 的局部生成结果，没有重排其他 Worker bundle。
- 验证：相关 5 个测试文件共 275 项通过；Worker bundles 源码构建曾成功，最终手工保留的最小 bundle 差异另经 `node --check` 通过。全量 Vitest 为 210 个文件通过、1 个文件已有 2 项 `/debug` schema 诊断断言失败（3029/3031 通过），另因本地 `node_modules` 缺少 `jsdom` 有 1 个未处理环境错误；这些失败与本次文件无交集。Vite build 因本地缺少已在 lockfile 声明的 `@capacitor/push-notifications` 无法完成，不应描述为通过。
- 尚需人工验证：在真实网络环境分别复现普通聊天、user key 和即时对话第一次 `Load failed` 后成功，确认不出现首次红色提示；确认两次即时对话 POST body/taskUuid 相同且最终只收到一条回复。此次不修改聊天存储、Memory Palace、备份格式或角色卡字段，也不读取或删除用户数据。

## 11. 2026-08-10 上游 `ec7ad049` 同步

- `master` 已合入上游 `ec7ad049`。上游新增主动消息 2.0 的 `llm_credentials` / `credRefs` 凭据引用、服务端消息账本补收、识图 API 完整设置、故事世界书修正及相关诊断；旧 Worker 继续走内联凭据兼容路径，新 Worker 由 `/init-tenant` 幂等补齐新表，不要求用户手工迁移 D1。
- 唯一文本冲突位于 `utils/activeMsgClient.ts` 的即时对话发送段。解决方式是完整保留上游 credRefs：凭据值变化时先上传，常态指纹命中时零额外请求，`CREDENTIAL_NOT_FOUND` 仍只补传自愈一次；随后在同一条调用上保留 fork 的固定 task UUID 与一次 400ms 网络重放。两次网络 attempt 复用相同加密 body，Worker 继续将 `TASK_UUID_CONFLICT` 解释为首个请求已落库，避免重复消息。
- `worker/amsg/src/instantChat.ts`、对应测试和 `worker/amsg/worker.bundle.js` 均由 Git 三方自动合并，已核对 `taskUuid` 校验、冲突转 202、上游 server `2.6.0-next.19` 与 `llm-credentials` 能力仍同时存在。没有改动 D1 绑定、Secrets、Cron、备份格式、Memory Palace 或聊天数据。
- 本地 `pnpm install --frozen-lockfile` 已下载 lockfile 内容，但 Codex 的最小发布时间策略拒绝为 2026-08-09 发布的 `@rei-standard/amsg-client@2.9.0-next.11` 和 `@rei-standard/amsg-server@2.6.0-next.19` 建立项目链接；未放宽或绕过该策略。因此本地完成了合并文件的 esbuild 语法打包、最终 Worker bundle `node --check` 和 `git diff --check`。GitHub Pages 对合并提交 `505509e8` 的干净环境安装与生产构建已成功；本轮未在本地补跑全量 Vitest，不能将其描述为已通过。
- GitHub Pages 前端已经发布。用户自己的 `sullyos-amsg` 主动消息 / 即时对话 Worker 通过既有 `Xiaoran71/sullyos-workers` Git 集成同步，仅修改 `amsg/worker.bundle.js` 并产生部署仓库提交 `0b2f425a`；Cloudflare 构建成功，版本 `c9cd2f16` 已成为 100% 流量的 Active deployment。部署没有修改既有 D1、AMSG/VAPID Secrets、Cron 或 `sullyos-amsg.rlbxgkpl.workers.dev` URL；仍需用户在真实网络环境完成人工验收。

## 12. 2026-08-10 网络日志二次收敛

- 真实日志确认重复的全局拦截器记录已经消失，但 AMSG 前端 `PUT /client-state` 的单次网络失败仍会被全局监听器抢先展示。该请求的交互路径已有 `[0, 400, 1200]ms` 固定短重试，后台 fire pack / 工具配置 / 凭据同步则保留待传状态并按 `30s → 60s → 120s` 重排；聊天 presence 是非关键 best-effort。因此 `context/OSContext.tsx` 现在只对精确的 `PUT */client-state` 延后用户可见网络错误，保留调用方原有最终错误，不改 retry 次数、请求体或写入语义。
- 普通聊天最终失败时出现的同 timestamp `Network: Load failed` + `Application: Load failed` 是同一异常的两个记录入口，不是第二条聊天 POST。全局 console 拦截器现在仅对“与刚写入的 Network message 完全相同、且在 1.5s 内”的 Application 镜像做日志面板去重；原始 `console.error` 仍照常输出，带上下文前缀或不同内容的应用错误不会被吞。
- 全局网络失败不再自动执行 no-cors 连通性复检。该复检会额外发送一次请求，而且 opaque 成功/失败不足以可靠断定 CORS、限流页或代理阶段；相关纯工具暂留以减少无关删除，但不在正常失败链路调用。
- `失败于 xxx ms` 继续使用单次 fetch 的 `performance.now()` 实测 elapsed。长短耗时提示已改为不做阶段归因，避免把真实等待时长进一步误译成“长时间握手 / 代理黑洞”。
- 修改文件：`context/OSContext.tsx`、`utils/networkFailureDiagnosis.ts`、`utils/networkFailureDiagnosis.test.ts`、`docs/HANDOFF.md`。没有修改 Worker、聊天存储、Memory Palace、备份、D1、请求 body 或任务 UUID；本轮不需要重新部署主动消息 Worker，只需发布前端。
- 验证：`utils/networkFailureDiagnosis.test.ts` 34/34 通过；全量 Vitest 214 个文件、3112 项测试全部通过；Worker bundles 与 Vite 生产构建通过；`git diff --check` 通过。仍需真实网络人工确认 `/client-state` 单次失败不再出现红色 Network 日志、普通聊天最终失败只保留一条 Network 诊断，以及成功 retry 不弹首次错误。

## 13. 2026-08-14 上游 `daefc4d1` 同步

- 从 `ec7ad049` 同步到 `daefc4d1`，共纳入 110 个上游提交、285 个变化文件。主要包括 Live2D/VRM 桌面陪伴与通话、房间备份及 Memory Palace 管线修复、主动消息补收与凭据更新、Android 更新、PDF 导入、iOS/PWA/Live2D 修复、故事剧场重复计费保护以及上游静态 Cloudflare 站点部署文件。
- Git 实际只产生 3 个文本冲突：`context/OSContext.tsx`、`utils/networkFailureDiagnosis.ts`、`utils/safeApi.apiCallLog.test.ts`。快捷动作的 `apps/Chat.tsx`、`types.ts`、解析器、提示词、角色卡隐私和备份测试均由 Git 自动合并，已逐项核对接入仍在。
- 冲突解决以上游新的“可能计费的 `/chat/completions` 不自动重放”为准，避免重复扣费；同时保留 fork 中无副作用 `GET /get-user-key` 的一次 400ms 网络重试、AMSG `/client-state` caller-managed 错误延后、单调时钟耗时和重复日志去重。同时纳入上游 Timing-Allow-Origin 正确判断与 MediaPipe 良性 stderr 过滤。
- 上游新增的 Cloudflare 静态站点部署和隐私审计绑定上游账号/统计实例；两个 workflow 的 job 均加了 `github.repository == 'qegj567-cloud/SullyOS'` 归属条件，避免本 fork 因缺少上游 Cloudflare secret 假失败或误审计上游服务。本 fork 仍由 `deploy-pages.yml` 发布前端，并由 `sync-workers-repo.yml` 同步 Worker bundle。
- 依赖锁定内容通过 580 项供应链策略检查。由于大包 CDN 两次超时，最终使用同一 lockfile 以长超时、单并发完成下载；pnpm 因 `canvas@2.11.2` 构建脚本未审批返回非零，未执行或放宽该脚本，但所需依赖已安装且后续测试/构建均可运行。
- 验证：全量 Vitest 259 个文件、3468 项测试全部通过；5 类 Worker bundle 构建成功；Vite 生产构建成功；`git diff --check` 通过。`pnpm build` 的外层 Codex 依赖预检因上述 canvas 审批提示未直接跑到 scripts，已分别执行其完全等价的 `node scripts/build-workers.mjs` 和 `vite build`，两者均通过。
- 本轮不执行数据库迁移，不读取或删除浏览器数据，不改变快捷动作的备份/角色卡隐私边界。部署后仍需人工检查原聊天、Memory Palace、快捷动作真机跳转、Live2D/PDF 新功能及 AMSG 即时对话。
- 合并提交 `41003393` 已推送到 `origin/master`。公开 GitHub Actions 状态徽章确认 `Deploy to GitHub Pages` 与 `Sync worker bundles to deploy repo` 均为 `passing`；前端发布和 Worker 部署仓库同步已完成。Cloudflare 上 AMSG Worker 的新部署版本/流量状态仍需在 Cloudflare 控制台或真实请求中确认。
- 冲突减量结论：当前快捷动作已符合“独立模块 + 热点文件薄接入”；仍会稳定造成冲突的是 `OSContext.tsx`/网络诊断和 AMSG 修正。若要接近直接 sync，优先将这些通用修正以小 PR 回馈上游，上游合入后从 fork 删除对应补丁；不建议再造一套复杂 patch 重放系统。每周同步必须及时合入已验证 PR，避免再累积 110 个提交后一次处理。
