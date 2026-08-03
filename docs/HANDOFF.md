# SullyOS Fork 长期维护交接

> 最后更新：2026-08-03（Asia/Shanghai）
> 维护对象：`Xiaoran71/SullyOS` 个人 fork
> 当前分支：`codex/sync-upstream-20260803`
> 上游同步基线：`d521b8e Merge pull request #484 from qegj567-cloud/fix/amsg2-push-subscription-selfheal`

本文档是本 fork 的长期交接入口，记录已经验证的状态、设计原因、风险和后续方向。它不替代各功能的专项文档。无法从仓库、Git 历史或用户实测确认的信息统一标记为“未知”。

## 1. 项目目标与维护原则

这个 fork 的目标是在保留 SullyOS 原有聊天、Memory Palace、备份兼容性和 MCP 能力的基础上，逐步增加个人化监督、iOS 快捷指令、外部数据读取和长期聊天管理。

维护时优先遵守：

1. 原始聊天和 Memory Palace 数据安全高于功能开发速度。
2. 新字段应保持可选；旧角色、旧备份缺少字段时必须安全降级。
3. 不为个人设备配置污染可分享的角色卡；API、MCP、快捷指令和运行时状态不得随角色卡外泄。
4. 完整系统备份必须保留本机配置和新功能状态，且继续兼容原 SullyOS 备份。
5. 原版行为默认不变；新行为只对用户明确配置的角色、规则或工具生效。
6. Memory Palace 属于高价值且难以肉眼发现回归的系统；没有明确收益和可验证方案时，不改其核心提取、向量化和召回逻辑。
7. 长期聊天归档应先导出、再验证、最后由用户确认清理；不得把“生成了文件”当作“文件已安全保存”。

## 2. 仓库与分支状态

### 远端

- `origin`：`https://github.com/Xiaoran71/SullyOS.git`（个人 fork，可 fetch/push）
- `upstream`：`https://github.com/qegj567-cloud/SullyOS.git`（原项目，可 fetch/push；是否拥有上游 push 权限：未知）

### 分支

- `custom/stage-3-mcp-preflight`：同步前的完整可回退基线，保留不动；业务代码终点为 `31b3300`，文档终点为 `ed2f2ec`。
- `codex/sync-upstream-20260803`：当前工作分支；从 `upstream/master@d521b8e` 新建，逐提交移植阶段 2/3 定制，避免在 1971 个上游提交上直接 merge 老分支。

当前定制提交序列：

1. `8d84925` — 可配置 iOS 快捷指令动作
2. `5a9a3c8` — 聊天“＋”动作面板每页固定最多 8 个图标
3. `5de4145` — 回复前自动调用可配置 MCP 工具
4. `ee65398` — 保持“回复前读取”状态可见
5. `29e4e68` — 曾加入临时 MCP 监控会话确认
6. `c06bf55` — 强制/禁用工具不再同时暴露给模型普通调用
7. `f28b3db` — MCP 模式简化为三种互斥模式
8. `31b3300` — 删除导致聊天页崩溃的过期 proposal state 重置

同步时的主要冲突点为 `apps/Chat.tsx`、`components/chat/ChatInputArea.tsx`、`utils/chatParser.ts`、`utils/chatPrompts.ts`、`apps/Settings.tsx` 和 `utils/mcpToolBridge.ts`；均已按上游当前架构适配。

## 3. 仓库结构速览

| 路径 | 主要职责 |
|---|---|
| `App.tsx` / `index.tsx` | 应用入口、App 路由与手机壳集成 |
| `apps/` | 各个 SullyOS App；聊天主界面位于 `apps/Chat.tsx` |
| `components/` | 通用 UI 和各 App 子组件；聊天 UI 位于 `components/chat/` |
| `context/` | 全局状态与持久化协调；`OSContext.tsx` 负责大量设置、备份和导入导出 |
| `hooks/` | 跨组件业务流程；`useChatAI.ts` 是私聊生成主链路 |
| `utils/` | 数据库、提示词、API、备份、MCP、消息解析等核心工具 |
| `utils/memoryPalace/` | Memory Palace 提取、向量、召回、事件盒、巩固和数据库逻辑 |
| `worker/` | Instant Push、主动消息、MCP 代理、邮局等 Worker |
| `api/` / `netlify/` / `cloudflare/` / `server/` | 部署平台接口与代理实现 |
| `public/` / `assets/` / `icons/` | 静态资源和 PWA 资源 |
| `docs/` | 专项设计与维护文档；本文件为 fork 总交接入口 |
| `types.ts` | 大量全局业务类型和角色配置结构 |
| `utils/db.ts` | IndexedDB `AetherOS_Data` 的 schema、CRUD、完整数据导入导出 |
| `package.json` | Vite、Vitest、Capacitor 与 Worker 构建命令 |

主要技术栈：React 18、TypeScript、Vite、IndexedDB、JSZip、Capacitor、Cloudflare/Netlify Worker。项目是 local-first：原始聊天主要保存在浏览器 IndexedDB。

## 4. 已完成和已验证的基础工作

### 4.1 阶段 0：运行与数据迁移

已由用户确认：

- 个人 fork 已建立并克隆到本地。
- 项目可以本地运行，访问地址曾为 `http://127.0.0.1:5173/`。
- 主聊天 API 已配置成功，聊天可正常使用。
- 旧备份 `Sully_Backup_text_only_1784319355910.zip` 已成功导入。
- 用户确认聊天记录与现有数据导入后全部正常。
- 用户在导入前保存了当时状态的完整备份。

未确认：

- 当前完整备份文件的最新保存位置和最近一次备份日期：未知。
- iOS/桌面多浏览器间是否都做过同一份备份的往返恢复：未知。
- 上游新增版本与当前 fork 的长期合并策略是否已实际演练：未知。

### 4.2 阶段 1：界面整理

原计划是在 `constants.tsx` 的 `INSTALLED_APPS` 中隐藏不需要的 App，不删除代码。用户后来明确决定跳过，当前没有该阶段的定制提交。

设计原因：隐藏 App 的收益当时不高，优先把精力放到快捷指令和 MCP 联动，同时避免无必要地偏离上游。

### 4.3 2026-08-03 上游大版本同步

已完成：

- 拉取并核对 `upstream/master@d521b8e`（其最新业务提交为 `27435cb`）；共同基线 `ac7f739` 之后，上游新增 1971 个提交、397 个文件发生变化。
- 在新分支上保留上游完整历史，再移植 iOS 快捷动作和三模式 MCP；旧定制分支没有被重写。
- 上游动作面板已新增第三页和「记忆链接」；快捷动作与强制 MCP 均放入第三页，继续满足每页最多 8 个网格入口。
- 上游已将 MCP 工具命名/重名映射抽到 `utils/mcpFireCore.ts`；本 fork 的强制/禁用排除逻辑现在复用该映射，不再维护第二套工具命名算法。
- 删除已不可达的 `PreReplyMcpProposalModal`，并停止在保存三模式配置时改写废弃的临时会话状态。

上游重叠能力结论：

- 「阶段 4 主动消息/Web Push/Cloudflare Cron」不应再按旧计划自建；上游已提供主动消息 2.0、后台 Worker、多任务、防穿帮闸、MCP 和推送诊断。后续只做个人部署与真机验证。
- 上游已增加 Memory Palace 高水位 IndexedDB 镜像自愈、记忆修补入口和大备份稳定性修复；这些不再需要 fork 重复实现。
- 「记忆提取备用 LLM API」仍未由上游覆盖。当前仍只有一个 `lightLLM`，且 250 条子批次中部分失败、部分成功时，仍可能把高水位推到整段末尾；旧设计仍有价值。
- 「长期私聊归档 ZIP（Markdown + JSONL + manifest + 验证后清理）」仍未由上游覆盖。上游的自动话题/记忆归档与完整系统备份都不等于可恢复的单角色聊天归档。

## 5. 已完成定制：阶段 2 — iOS 快捷指令动作

### 当前能力

- 用户可为角色配置多个快捷动作。
- 规则包含名称、给角色看的描述、触发条件、快捷指令名称/链接、弹窗文字、按钮文字、是否阻塞、冷却时间和每日上限。
- 角色可以通过受限标记请求动作；程序只接受用户预先配置的动作 ID，不允许模型生成任意 URL。
- 弹窗可阻塞聊天，必须执行或使用应急解锁后才能继续。
- 支持测试弹窗。
- 当前仅允许 `shortcuts://` 链接；iCloud 分享链接不是运行链接。
- 快捷动作运行时状态会记录触发时间和每日次数。
- 聊天“＋”动作面板保持每页最多 2 行 × 4 列（8 个入口），避免第二页出现孤立的第 9 个图标。

### 为什么这样设计

- 用白名单动作 ID 隔离模型与真实设备 URL，避免模型编造或调用未经用户授权的快捷指令。
- 配置保存在角色资料中，使不同角色可以拥有不同动作语义和台词。
- `pendingShortcutAction` 持久化，使阻塞弹窗不会因普通重渲染立即消失。
- 冷却和每日上限防止角色或模型重复触发真实设备动作。
- 保留应急解锁，避免配置错误导致聊天界面永久锁死。
- 角色卡分享时剥离快捷指令配置和运行时状态，因为它们属于本机自动化，不属于角色人设。

### 用户验证状态

用户已确认电脑弹窗和 iOS 快捷指令调用测试正常。动作面板分页修正也已确认可见。

### 重要文件

- `utils/shortcutActions.ts`：规则标准化、URL 构造、限流、提示词
- `utils/shortcutActions.test.ts`：兼容性、URL 安全和限流测试
- `components/chat/ShortcutActionsModal.tsx`：配置 UI
- `components/chat/ShortcutActionOverlay.tsx`：阻塞弹窗
- `components/chat/ChatInputArea.tsx`：聊天动作面板入口与分页
- `apps/Chat.tsx`：弹窗状态、执行和持久化协调
- `utils/chatParser.ts` / `utils/chatPrompts.ts`：模型动作标记的提示与解析
- `types.ts`：`ShortcutActionRule`、pending/runtime 类型和角色字段

### 已确认但未实施

- 动作面板“编辑排列”模式进入待办，暂不开发。

## 6. 已完成定制：阶段 3 — 回复前 MCP

### 当前三模式

用户可在聊天页“强制 MCP”中，针对明确配置过的单个服务器工具选择：

1. `角色按需调用`：完全保留 SullyOS 原版行为，模型可以自行调用，用户也可以在对话中要求调用。
2. `每次回复强制调用`：用户触发角色回复后，前端先直接调用工具，把结果作为本轮易变上下文交给角色；同一工具不再同时暴露给模型，避免重复调用。
3. `禁用`：既不自动调用，也不向模型暴露。

没有进入“强制 MCP”配置的工具保持原版行为。

### 为什么这样设计

- MCP 服务器的总启用状态仍由“设置 → MCP 工具服务器”负责；“强制 MCP”只决定当前角色如何使用某个已启用工具。
- 一个工具只有一个互斥模式，避免“设置里启用、自动 MCP 又有多个开关”的叠加语义。
- 强制模式由前端使用固定参数直接调用，不让模型决定是否调用或修改参数，适合每轮读取手机使用数据等确定性任务。
- 工具结果只进入本轮 prompt，不伪造成用户消息，也不写入聊天记录，避免污染共同聊天历史。
- 强制/禁用工具从模型工具清单中保留（reserve）出来，避免“先自动调用一次，模型又普通调用一次”。
- 每条规则可设置失败后继续回复或中止本轮，以覆盖“辅助数据可缺失”与“关键数据缺失不能回答”两类场景。
- 配置不随角色卡分享，因为 MCP server ID、参数和用途属于本机隐私配置；完整系统备份仍应保留这些字段。

### 当前数据流

```text
用户让角色回复
→ useChatAI 从 DB 读取本轮聊天上下文
→ runPreReplyMcpRules 执行 mode=always 的规则
→ 状态栏显示“回复前读取 / 已读取”
→ 结果按用户可编辑模板渲染
→ 作为 volatile context 注入 buildChatRequestPayload
→ 构造模型可见工具时排除 mode=always / disabled 的工具
→ 调用聊天模型
```

### 用户验证状态

- 初版自动读取曾成功调用 `device-event-logger`，返回 55 条事件，角色可以读取并影响回复。
- “回复前读取”状态最初不可见，修正后用户确认可见。
- 之后 MCP 服务曾出现 `Failed to fetch`；2026-07-23 用户确认根因是梯子节点故障，换回可用节点后连接恢复，并非已确认的 SullyOS CORS 缺陷。
- 三模式简化后曾出现 `setPreReplyMcpProposal is not defined` 导致聊天页崩溃；当前提交 `31b3300` 已删除过期引用。
- 2026-07-23 用户复测确认“每次回复强制调用”可以正常执行。
- 用户把已配置的 `query_events` 切换为“禁用”后，界面不再显示强制 MCP 提示，但角色仍发生了一次普通 MCP 自主调用。角色自述它只能看到/调用 `list_events`，不能调用 `query_events`；这与“禁用规则只保留指定工具、同一服务器的其他未配置工具仍保持原版按需行为”的当前实现相符，但实际调用工具名和完整工具清单尚未通过日志核实。
- 因此当前“禁用”对指定工具是否正确生效：初步看可能已生效；用户是否会把它理解为禁用整个 MCP 服务器、以及其他工具为何被模型自主调用：**待排查/待澄清产品语义**。

### 重要文件

- `utils/preReplyMcp.ts`：规则迁移、三模式语义、直接调用与 prompt 注入
- `utils/preReplyMcp.test.ts`：模式迁移、调用和保留工具测试
- `components/chat/PreReplyMcpRulesModal.tsx`：三模式配置、参数预览和测试调用
- `hooks/useChatAI.ts`：回复前执行、状态展示、结果注入和模型工具过滤
- `utils/chatRequestPayload.ts`：易变 MCP 上下文加入本轮请求
- `utils/mcpToolBridge.ts`：构造模型工具时排除 reserved tools
- `apps/Settings.tsx`：MCP 设置相关文字调整
- `types.ts`：`PreReplyMcpRule` 等角色字段

### 已处理的遗留与仍保留的兼容层

三模式简化前曾实现“角色提议临时开启 MCP 监控会话”。2026-08-03 同步时已确认它与当前产品语义冲突：

- 已删除不可达的 `components/chat/PreReplyMcpProposalModal.tsx`。
- 已删除保存当前三模式配置时清空旧临时会话的运行时写操作。
- `TemporaryPreReplyMcpSession`、`temporaryPreReplyMcpSessions` 及旧规则字段仍保留为纯兼容结构：旧完整备份导入后可无损再导出，而角色卡剥离列表仍防止它们外泄。它们不参与当前运行主链路。

## 7. 数据、备份与角色卡兼容

### 已确认

- 主数据库为 IndexedDB `AetherOS_Data`，当前 schema 版本 70。
- 原始私聊消息存储在 `messages` 表，主要通过 `charId` 区分，没有独立 `conversationId`。
- 新增的快捷动作和 MCP 规则使用可选角色字段；旧角色缺失字段时标准化为空配置，不应改变原版行为。
- 完整系统备份往返测试覆盖快捷动作、运行时状态和 MCP 规则。
- 可分享角色卡会双向剥离快捷动作、MCP 规则、临时会话和运行时状态，防止本机配置及隐私外泄。

### 现有备份资源逻辑

项目已有 v2 分片备份、资源抽取/回填、向量二进制旁路、完整/纯文字/纯媒体模式和移动端分片写盘逻辑。未来聊天归档应优先复用：

- `context/OSContext.tsx` 中 `exportSystem`、资源收集和 ZIP 生成流程
- `utils/db.ts` 中完整数据导入导出与分批写入
- `utils/backupFormat.ts` 及其测试中的 manifest、分片、组装与完整性保护
- Blob/资源引用相关工具与测试，例如 `utils/blobRef.ts`、`utils/assetUrl.ts`

能否直接抽取为聊天归档的独立复用接口：**未知，需要专项代码阅读**。如果完整附件复用成本过高，第一版允许降级为：JSONL 保留原始消息结构，Markdown 对附件给出可读占位说明；但必须在 manifest 中明确附件未打包，不能声称可完整恢复附件。

## 8. Memory Palace 当前结论与保护边界

### 已确认工作方式

- 角色正常回复完成后，如果已启用 Memory Palace 且 API 配置有效，会后台调用 `processNewMessages()`。
- 当前每次检查先通过 `DB.getMessagesByCharId(charId, true)` 全量读取该角色私聊，再计算热区与缓冲区。
- 最近 200 条语义消息为热区；高水位之后、热区之前累计至少 100 条才自动处理；每次处理缓冲区前 85%。
- 大范围处理按每 250 条拆成 LLM 子批次。
- 记忆提取 LLM 当前有瞬时错误重试；Embedding 也有有限重试和部分 400 降级。
- 核心保存成功后更新 localStorage 高水位 `mp_lastMsgId_{charId}`，并写入 IndexedDB 镜像以便不稳定浏览器中自愈；原始聊天不会因为进入 Memory Palace 而被物理删除。

### 已确认风险

- 没有实际接入私聊自动管线的持久化任务队列；`memory_batches`/`MemoryBatchDB` 当前更像未使用基础设施。
- 整轮完全失败通常不推进高水位，下次回复仍可重试，但没有脱离聊天触发的定时后台重试。
- 当一次处理被拆成多个 250 条子批次时，如果前面子批次失败、后面成功，只要最终存入了一些记忆，当前代码可能把高水位推进到整个处理范围末尾，越过失败区间。
- Memory Palace 的全量 `getAll()` 在约一万条文字消息时用户暂未感知明显问题；几十万条时可能形成内存和延迟压力。

### 已确认设计决定

- 暂不优化 Memory Palace 全量读取；若将来 SullyOS 本地只保留约 3000 条，它的成本也会受到自然限制。
- 暂不重写 Memory Palace 核心任务系统，因为该功能非常重要、回归难以肉眼发现，现阶段实际失败不频繁。
- Embedding 不做自动供应商/模型切换。不同 Embedding 模型即使维度相同也不能假定处于同一向量空间。
- 只计划为“记忆提取 LLM”增加备用 API 节点。
- 高水位只有在当前处理范围的所有必要子批次得到合法结果、Embedding 成功、节点和向量保存并验证后才能推进；不得越过失败子批次。

## 9. 已确认的下一阶段设计：记忆提取备用 API

状态：**已设计，未实现。**

目标是在不改变记忆 prompt、分类、Embedding、EventBox 和召回逻辑的前提下，提高 `/chat/completions` 提取服务的可用性。

要求：

1. Memory Palace 设置支持一个主提取节点和有序备用节点。
2. 每个节点包含名称、Base URL、API Key、模型、启用状态和超时。
3. 主节点在现有重试耗尽后依次切备用节点。
4. 网络、超时、429、5xx、HTML、空响应、completion 结构缺失和无法解析的非空输出视为失败。
5. 合法 `[]` 视为“成功但无值得保存的记忆”，不因结果为空自动切节点。
6. Embedding 配置保持单一，不自动切换。
7. 日志记录节点、尝试次数、切换原因和最终成功节点，但不得泄露 API Key。
8. 一个处理范围内的每个子批次都必须成功或被明确记录；任一子批次失败时不得把高水位推进到它之后。
9. 旧备份只有单一 `lightLLM` 时，应迁移为主节点；兼容策略的具体字段结构：未知，实施前决定。

## 10. 已确认的下一阶段设计：长期聊天归档

状态：**已设计，未实现。**

### 产品流程

```text
按角色统计本地聊天
→ 超过 4000 条时定量提醒
→ 建议归档最旧约 1000 条，使本地回到约 3000 条
→ 一键生成 Markdown + JSONL + manifest 的 ZIP
→ 用户保存到 iPhone“文件”或其他位置
→ 用户重新选择刚保存的 ZIP
→ SullyOS 验证完整性
→ 用户确认后才清理本地对应消息 ID
```

默认参数：

- 目标本地保留：3000 条
- 安全缓冲：1000 条
- 触发提醒：超过 4000 条
- 单次建议归档：最旧约 1000 条

应允许按角色关闭提醒、稍后提醒和调整阈值。第一版不做无人值守自动删除，也不要求 Obsidian 常驻。

### 归档包

建议结构：

```text
manifest.json
conversation.md
messages.jsonl
assets/（可选，尽量复用现有备份资源逻辑）
```

- `conversation.md`：面向 Obsidian 阅读、搜索，按日期和发言人组织。
- `messages.jsonl`：面向 SullyOS 精确恢复，逐行保留完整 `Message` 对象。
- `manifest.json`：装箱单与验证依据，至少记录格式版本、archiveId、角色、消息 ID 范围、条数、生成时间、数据库版本、附件状态和校验值。
- `assets/`：能可靠复用现有资源导出时保存；否则第一版允许只写附件类型/占位说明，并在 manifest 标明“不含完整附件”。

### 清理安全要求

1. 归档选择和删除都使用明确消息 ID，不以日期模糊删除。
2. 生成 ZIP 不能改变本地消息。
3. 必须重新读取用户保存的文件并验证 ZIP、manifest、JSONL、条数、起止 ID 和校验值。
4. Memory Palace 高水位未越过清理范围时默认不允许清理，并提示先“一键存入”；高级强制行为是否提供：未知。
5. 只删除已经被通过验证的 archiveId 覆盖的消息。
6. 删除必须使用事务，不能留下“界面显示成功但只删除了一部分”的状态。
7. 归档历史应保留 archiveId、范围、文件名、验证状态和清理状态。
8. 在用于真实聊天前，必须用测试角色完成导出 → 清理 → 恢复的往返测试。
9. 第一版聊天归档到底包含哪些 `source=date/call` 或跨 App 特殊消息：**未知，必须先审计各消息来源，不能直接假定全部可删。**

## 11. 当前已知问题与未知项

### 需要优先复测

1. MCP 外部服务此前的 `Failed to fetch` 已由用户确认是梯子节点故障，当前连接恢复；若以后再次出现，应先核对代理节点，再排查证书、Mixed Content、CORS 和 MCP 代理配置。
2. 三模式简化和崩溃修复后的真实端到端行为仍需补齐：
   - 未配置工具保持原版调用
   - `角色按需调用`
   - `每次回复强制调用`已确认能执行；仍需通过日志确认同一工具不会再普通调用一次
   - `禁用`后通过日志确认指定工具确实从模型工具清单移除
   - 确认本次普通自主调用的实际工具是否为未配置的 `list_events`，以及它为何满足模型的调用条件
   - 决定 UI 中“禁用”的产品语义究竟是“只禁用当前工具”还是“禁用整个 MCP 服务器”；当前代码语义是前者
   - 失败时继续/中止
3. iOS Safari/PWA 与快捷指令在长期使用、页面恢复和阻塞弹窗持久化方面的完整回归范围：未知。

### 功能待办

- 聊天“＋”动作面板编辑排列。
- Memory Palace 记忆提取备用 LLM API，并同时修复“部分子批次失败却跨过失败区间推进高水位”。
- 长期聊天归档提醒、双格式导出、保存后验证、清理和恢复。
- 主动消息 2.0 只需做个人 Cloudflare/Push 配置和真机验证；不再开发 fork 自有的第二套 Web Push/Cron。

### 维护风险

- 当前同步分支相对 `upstream/master@d521b8e` 修改 22 个文件，约新增 1506 行、删除 21 行（包含 `AGENTS.md` 和本交接文档）。
- `apps/Chat.tsx`、`hooks/useChatAI.ts`、`types.ts`、`utils/chatRequestPayload.ts` 是上游也可能频繁改动的热点，未来合并上游容易冲突。
- `progress.md` 记录的是上游/其他历史开发任务，不是本 fork 的当前路线，不能作为本项目状态的唯一来源。
- 上游当前锁定的 `@rei-standard/amsg-client@2.9.0-next.7`、`amsg-server@2.6.0-next.12`、`amsg-sw@2.4.0-next.3` 在 2026-08-03 仍处于 Codex 供应链最小发布年龄阻断期；不应为了消除警告放宽安全策略。
- 本地浏览器 IndexedDB 可能因清缓存、浏览器站点数据清理或设备故障丢失；完整备份仍是第一道保护，聊天归档不能替代完整系统备份。

## 12. 重要文件清单

### 本 fork 已修改

- `AGENTS.md`
- `apps/Chat.tsx`
- `apps/Settings.tsx`
- `components/chat/ChatInputArea.tsx`
- `components/chat/ShortcutActionOverlay.tsx`
- `components/chat/ShortcutActionsModal.tsx`
- `components/chat/PreReplyMcpRulesModal.tsx`
- `hooks/useChatAI.ts`
- `types.ts`
- `utils/shortcutActions.ts`
- `utils/shortcutActions.test.ts`
- `utils/preReplyMcp.ts`
- `utils/preReplyMcp.test.ts`
- `utils/chatParser.ts`
- `utils/chatPrompts.ts`
- `utils/chatRequestPayload.ts`
- `utils/mcpToolBridge.ts`
- `utils/mcpClient.test.ts`
- `utils/characterCard.ts`
- `utils/characterCard.test.ts`
- `utils/backupRoundtrip.test.ts`
- `docs/HANDOFF.md`

### 后续归档工作预计先阅读

- `context/OSContext.tsx`
- `utils/db.ts`
- `utils/backupFormat.ts`
- `utils/backupFormat.test.ts`
- `utils/backupRoundtrip.test.ts`
- `utils/backupExport.test.ts`
- `utils/blobRef.ts`
- `utils/assetUrl.ts`
- `apps/Settings.tsx`
- `types.ts`

## 13. 验证基线

2026-08-03 在 `codex/sync-upstream-20260803` 执行：

```bash
node node_modules/vitest/vitest.mjs run
node scripts/build-workers.mjs
node node_modules/vite/bin/vite.js build
```

结果：

- Vitest：182 个测试文件通过，2363 个测试通过。
- 生产构建：通过；Worker bundles 与 Vite 构建均完成。
- 针对性回归：`shortcutActions`、`preReplyMcp`、`mcpClient`、`characterCard`、`backupRoundtrip` 共 62 个测试通过。
- 测试输出包含上游用例刻意触发的错误/降级日志（Worker 状态损坏、网络失败、天气源回退等），没有测试失败。
- 构建后的主要 bundle 较大，但本轮未进行包体优化。
- `pnpm install` 本身未通过 Codex 供应链政策检查，原因是上述 3 个上游预发布包太新，不是 lockfile 不一致或代码测试失败。本轮使用已按 lockfile 下载的本地可执行文件完成测试与构建。

测试通过不代表外部 MCP、真实 iOS 快捷指令、VPN/CORS 和用户数据恢复已经端到端通过；这些必须单独人工验证。

## 14. 推荐的下一步

当前优先级是先将「同步成功」变成「用户数据和真实设备链路也验证成功」：

1. 在打开新分支对应版本前，先导出一份最新完整备份，记录日期和保存位置；不用旧备份覆盖当前数据。
2. 本地启动后先检查原始私聊、Memory Palace、角色卡、相册/媒体和设置页，再导出一份新版完整备份做往返验证。
3. 在无副作用的 MCP 服务器上逐一真机验证未配置、角色按需、每次强制、禁用和失败继续/中止；日志应确认同一工具不会重复调用。
4. 在 iOS Safari/PWA 验证快捷动作配置、测试弹窗、真实 `shortcuts://` 跳转、阻塞弹窗刷新恢复和应急解锁。
5. 按上游文档部署并验证主动消息 2.0；这取代旧的阶段 4 开发计划，但 Cloudflare Worker、D1、Push 订阅与手机锁屏投递仍必须人工验证。
6. 上述验证通过后，再实施「Memory Palace 子批次全成功才推进高水位 + 记忆提取备用 LLM API」；这仍是同步后最有价值的 fork 专项。
7. 最后进入长期聊天归档的只读导出与验证版本；在测试角色完成往返恢复前，不实现真实聊天删除。
