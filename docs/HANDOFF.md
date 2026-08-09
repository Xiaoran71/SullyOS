# SullyOS Fork 长期维护交接

> 最后更新：2026-08-10（Asia/Shanghai）
> 维护对象：`Xiaoran71/SullyOS` 个人 fork
> 干净上游基线：`ce7f1128`（`qegj567-cloud/SullyOS:master`）
> 发布分支：`master`（由 `codex/shortcut-clean-baseline-20260810` 验证后切换）

## 1. 当前目标

本 fork 当前只长期维护一个定制功能：**可配置 iOS 快捷动作**。其他曾讨论或实现过的 fork 专项均不是当前路线，除非用户以后重新明确提出。

维护优先级：

1. 保护原始聊天、Memory Palace、角色资料和完整备份。
2. 保持旧备份安全导入、完整备份可靠往返、分享角色卡不携带本机隐私。
3. 默认保持官方 SullyOS 行为；只有配置了快捷动作的角色启用定制能力。
4. 让官方更新尽量由 Git 和 GitHub Actions 自动完成；真实冲突或回归才人工介入。

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
