# EndfieldSkill：终末地四人战术编排台

一款针对《明日方舟：终末地》的确定性队伍与技能循环辅助工具。玩家选择自己实际拥有的四名角色、玩家等级与剧情进度后，页面会从版本化资料库中匹配队伍、输出技能释放顺序与触发条件，并列出配装候选及已知门槛。

MVP 线上测试站：[https://aaaeeezynx.github.io/EndfieldSkill/](https://aaaeeezynx.github.io/EndfieldSkill/)

## 解决的问题

网上攻略通常围绕一套固定四人队展开。玩家若缺少其中一名角色，视频或文章里的整套循环往往无法直接照抄。

本项目采用「先整理可信资料，再用确定性规则排列组合」的方式：

- 使用玩家已有的四名角色，而不是要求玩家先凑出攻略固定队。
- 对完全匹配的来源队伍展示经过整理的攻略循环。
- 对其他四人组合展示明确标注的规则回退，不把推导结果伪装成实测攻略。
- 按装备穿戴等级、角色定位、元素和推荐关系筛选配装候选。
- 运行时不调用 AI，不生成没有资料依据的答案。

## 当前 MVP

- 必须恰好选择 4 名不同角色。
- 输入玩家等级；章节选择会在有已核验章节资料时启用。
- 展示技能顺序、触发条件、共享技力、能量、冷却与注意事项。
- 展示每名角色的最佳候选、当前候选与替代装备，并显示已知解锁门槛。
- 不保存队伍或玩家资料，刷新后重新选择。
- 不读取游戏账号，不提供账号联动或自动同步。
- 响应式支持桌面与 390 px 行动端。

目前资料库包含：

- 34 名可玩角色、99 个技能
- 276 件装备
- 2 套来源队伍
- 1 套来源攻略循环
- 7 个资料或攻略来源
- 游戏资料版本：`1.6.4`，表版本 `11262943-8`

## 重要资料边界

这是 MVP 测试版，不是完整战斗模拟器。以下限制会直接反映在界面中：

- 唯一已整理的来源攻略循环是「莱万汀 / 卡缪 / 狼卫 / 艾尔黛拉」四人单目标循环。
- 其他四人组合使用标签与技能类型规则生成回退顺序，并标记为「规则生成，待人工核对」。
- 来源循环是条件式顺序，不声称帧级或秒级最优轴。
- 角色专属技能中文名、部分连携触发条件与定位标签仍待补齐。
- 章节到装备／配方权限的映射尚未核验，因此当前不会声称装备「已经可以制造」。
- 装备门槛中的 `minWearLv` 只代表装备穿戴等级，不等同玩家等级、剧情进度或配方权限。
- 配方权限、剧情章节与制造状态未确认时会显示为未知，而不是当作已解锁。

## 技术栈

- 前端：Vue 3、TypeScript、Vite、Pinia、Vue Router、Tailwind CSS
- 前端测试：Vitest
- 资料管线：Python 标准库，无第三方运行时依赖
- 资料来源：JSON 表格镜像、官方教学／公告与人工核验的攻略摘录
- 部署：GitHub Actions + GitHub Pages
- 路由：Hash History，适配 GitHub Pages 项目子路径 `/EndfieldSkill/`

## 本地启动

环境建议：

- Node.js 22 或更新版本
- npm 10 或更新版本
- Python 3.11 或更新版本

### 前端

```powershell
cd A:\EndfieldSkill\apps\web
npm ci
npm run dev
```

默认开发地址由 Vite 输出。正式构建：

```powershell
npm run build
npm run preview
```

`npm run build` 会先执行 `scripts/sync-data.mjs`，把 `data/v1/` 同步到 `apps/web/public/data/v1/`。同步出的 JSON 是构建产物，不提交到 Git；canonical 资料仍保存在根目录 `data/v1/`。

### 资料管线与测试

首次在线更新资料：

```powershell
cd A:\EndfieldSkill
python -m crawler update --source all
python -m crawler validate
python -m unittest discover -s crawler\tests -v
```

已有通过校验的本机快取时，可做离线重建：

```powershell
python -m crawler update --source all --offline
```

完整前端验收：

```powershell
cd A:\EndfieldSkill\apps\web
npm test
npm run build
npm audit --audit-level=low
```

## 资料更新流程

游戏新增角色或调整装备后，按以下流程发布新版本：

1. 执行 `python -m crawler update --source all`，取得最新版本化游戏表格。
2. 检查 `data/v1/meta.json` 的版本、覆盖率、缺失技能和 unresolved 项目。
3. 仅在有可信来源时，更新 `crawler/sources.py` 中的人工核验队伍、循环与配装摘录。
4. 执行资料校验、Python 测试、前端测试与生产构建。
5. 提交并推送 `main`，由 GitHub Actions 重新部署 Pages。

资料文件：

- `data/v1/characters.json`：角色、定位、元素与技能。
- `data/v1/equipment.json`：装备、属性、配方及已知门槛。
- `data/v1/progressions.json`：章节进度；未核验时不写入猜测。
- `data/v1/team-presets.json`：来源队伍。
- `data/v1/rotation-presets.json`：来源技能循环。
- `data/v1/sources.json`：URL、抓取时间、哈希与撷取字段。
- `data/v1/meta.json`：版本、覆盖率、限制与未解决项目。


## UI/UX 设计

前端界面参考《终末地》官方网站的工业科幻风格，采用以下设计系统：

- **字体**: Rajdhani（标题、编号、代码）+ IBM Plex Sans（正文、列表）
- **色彩**: 深色背景 + 酸黄强调色 + 青色交互提示 + 暖橙警告
- **动效**: 入场渐显、扫描线、呼吸灯与细微悬停反馈
- **网格**: 56px 网格底纹 + 切角面板 + 渐变光晕
- **角色图**: 35 张官方角色立绘从官方 CDN 下载至本地，配备 lazy loading 与错误回退

所有角色图片资产来源、原始 URL 与使用注意事项记录在 [`apps/web/ASSET_SOURCES.md`](apps/web/ASSET_SOURCES.md)。
本项目明确标示为非官方第三方攻略工具，不宣称官方授权或关联。

## 主要资料来源

- [AKEDatabase 游戏表格镜像](https://data.akedata.wiki/manifest.json)：角色、技能、装备、配方与属性；视为结构化二手资料。
- [官方战斗教学](https://endfield.games/zh-Hans/tutorials/battle/)：共享技力、连携、能量与终结技机制。
- [官方开发通讯 2674](https://endfield.hypergryph.com/news/2674)：装备材料与权限等级门槛。
- [Prydwen Combat Basics](https://www.prydwen.gg/arknights-endfield/guides/combat-basics)：四人队伍与共享技力交叉核对。
- [GameWith 队伍攻略](https://gamewith.net/akendfield/72598)：Pulse 四人队人工摘录。
- [Game8 莱万汀队伍循环](https://game8.co/games/Arknights-Endfield/archives/577071)：单目标循环人工摘录。
- [Game8 装备攻略](https://game8.co/games/Arknights-Endfield/archives/576118)：明确可映射的套装推荐。

来源冲突、无法映射或无法核验的字段会保留在 `meta.json` 的 `unresolved` 中，不会用猜测填补。本项目只保存结构化事实与短摘录，不复制完整第三方文章。

## GitHub Pages 部署

推送 `main` 会自动触发 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)：

1. 安装前端依赖并执行 Vitest。
2. 以 `VITE_BASE=/EndfieldSkill/` 构建。
3. 上传 `apps/web/dist` 并由 GitHub Pages 部署。

也可以在 GitHub Actions 页面手动执行 `workflow_dispatch`。

若仓库首次部署后仍显示 404，请到仓库 `Settings > Pages`，确认 Source 设为 `GitHub Actions`。

## 专案结构

```text
.
|-- apps/web/                  # Vue 3 前端与测试
|-- crawler/                   # Python 资料抓取、解析、校验与测试
|-- data/v1/                   # canonical 版本化 JSON
|-- data/schemas/              # JSON Schema
|-- docs/                      # 产品规划与架构文件
|-- .github/workflows/         # GitHub Pages 部署
`-- README.md
```

## 非目标

- 运行时 AI 问答或生成式配队。
- 自动读取玩家游戏账号、角色库存或养成进度。
- 装备掉落率与完整材料库存管理。
- 逐帧战斗模拟或自动操作游戏。
- 未经验证的攻略内容自动转成「最佳答案」。

本项目为非官方玩家工具，与 Hypergryph / Gryphline 无隶属关系。游戏名称、角色与素材权利归原权利人所有。

