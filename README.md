# dsh-bigger-choice

把输入框右下角那个**内置模型选择器**的下拉框做大做清楚：一屏能直接看到十几个模型，并且随时看得出「这批模型属于哪个提供商」。

纯客户端插件：只往页面里注入一份样式表，不动任何逻辑、不接管任何插槽。装完即生效（刷新页面后）。

## 它改了什么

内置下拉框由 `@deepseek-ai/dsh-client-ui-model-selection` 渲染，宿主对它的尺寸写死了上限：

| | 原生 | 本插件 |
|---|---|---|
| `max-height` | `min(360px, 100vh - 96px)` | `min(78vh, 100vh - 24px)` |
| `width` | `max-content`（跟着内容） | `max-content`（重申，别被拉走） |
| `min-width` | `min(240px, 100vw - 32px)` | `min(240px, 100vw - 24px)`（保留原下限） |
| `max-width` | `min(420px, 100vw - 32px)` | `min(720px, 100vw - 24px)` |

行高（34px）不动，所以 756px 高的窗口里可见行数从约 10 行涨到约 15–16 行；窗口越高看到越多。

**宽度是自适应的**：宿主本来就给弹层 `width: max-content`——最长的一行（模型名或提供商名 + 末尾的打勾）有多宽，弹层就有多宽。第一版把它连同 `min-width` 一起撑到 360px，于是每行都空出一道「名字 → 打勾」的空白。现在 `min-width` 退回 240px 这个原下限，宽度重新由内容决定；`max-width` 只兜住超长名字，不让弹层拉穿视口。

> 已知边界：列表长到需要滚动时，竖直滚动条会吃掉内容区约 8px 宽，**最长的那个名字**可能因此被省略号截掉一两个字符。这是「宽度跟随内容」与「滚动条占位」的固有矛盾（滚动条不参与 `max-content` 计算），代价最小的一侧就是放过最长那一行。

## 提供商名（分组标题）

「CodeArts Agent」「CodeBuddy（腾讯）」这类行是 `MenuGroup` 渲染的 sticky 标题，
宿主样式是 **11px / `label-tertiary` 灰字 / 透明底**，只有真正吸顶那一刻才铺一层底色——
所以平时几乎看不见，也就分不清某个模型属于谁。本插件把它改成一条常驻色带：

| | 原生 | 本插件 |
|---|---|---|
| 字号 / 字重 | 11px / 500 | 12px / 600 |
| 颜色 | `--dsw-alias-label-tertiary` | `--dsw-alias-label-primary` |
| 背景 | 透明（仅吸顶时铺色） | 常驻 `--dsw-alias-menu-group-header-fill` |
| 内边距 | `4px 7px 2px` | `8px 8px 5px` |
| 组间距 | `3px` | `8px` |
| 下沿 | 无 | 1px `--dsw-alias-border-l2` |

关键是**常驻**：色带一直钉在列表顶部，所以「眼下这批模型属于哪个提供商」永远看得见，
不用往回滚去找那一行。吸顶时不再变色，也就没有滚动闪烁。

选择器在这里**不用 hash**——`MenuGroup` 会给标题打 `data-menu-group-heading`，
宿主自己的 `observeStickyMenuGroups()` 就是靠这个属性找分组的，属于它自己的契约面，
升级不会变。外面仍然限定在模型选择器的弹层里（用滚动容器的 `id$="-models"` 收窄），
不会波及别处恰好也用 MenuGroup 的菜单。

## 为什么改样式表就够了

弹层是 React portal（`position: fixed`），但**位置和尺寸都是宿主自己算的**：弹出前先
`menuRef.current.offsetHeight` 量一次，再把 `top` 夹进视口（`MARGIN = 12`），并在
`scroll` / `resize` 时重算。我们的样式表在插件加载时就已生效，所以宿主第一次量到的
就是放大后的高度，它会自己把菜单摆正——不会顶出屏幕，也不需要我们碰 `top/left`。

## 弹层的选择器

```css
._7KE1Ra_menu,
[id$="-menu"][class*="_menu"]:has([class*="_groups"]) { … }
```

* `._7KE1Ra_menu`：本机这一版 DSH 构建出的 CSS-module 类名（hash 由源码内容决定）。
* 第二条是 **DSH 升级后的兜底**：hash 变了也没关系——宿主给弹层的 id 是自己拼的
  `id={id}-menu`，而 `_menu` / `_groups` 是该模块**本地**的类名（本地类名不变则后缀不变）；
  再要求弹层里真的装着那个滚动容器，避开其它恰好叫 `*_menu` 的弹层。

两条都靠 CSS-module 的 `<hash>_<localName>` 命名约定，不改任何宿主代码。

## 想再调大/调小、想换标题色

五个旋钮都走 CSS 自定义属性，devtools 或你自己的样式表里覆盖即可，不用重装：

```css
:root {
  /* 弹层尺寸 */
  --dsh-bigger-choice-max-height: min(90vh, 100vh - 16px);
  --dsh-bigger-choice-min-width: min(320px, 100vw - 24px);
  --dsh-bigger-choice-max-width: min(760px, 100vw - 24px);
  /* 提供商标题栏 */
  --dsh-bigger-choice-group-color: var(--dsw-alias-label-secondary);
  --dsh-bigger-choice-group-size: 13px;
}
```

想让每行都空出固定宽度（例如把「名字 → 打勾」那块拉开），把 `min-width` 调大即可——
宽度本来跟着内容走，`min-width` 一抬高就成了一条固定的下限。

## 结构

| 文件 | 作用 |
|---|---|
| `package.json` | bundle 元数据（`dsh.bundle.patch` + `dsh.client`） |
| `cordis.patch.yml` | 插入一行 `dsh-bigger-choice` |
| `index.js` | 宿主半身，空实现（本插件不需要宿主服务） |
| `client.js` | 客户端半身：注入 `/1` 中的那份样式表 |
| `icon.svg` | 图标 |

## 已知边界

* 这是**刻意覆盖宿主弹层**，不是官方插槽能力：`_7KE1Ra_menu` 这个 hash 会随 DSH 升级变化，
  届时靠第二条选择器继续命中；若某次升级连 `_menu` / `_groups` 的本地类名也改了，需要重新对一次。
* 只放大「模型选择器」这一个弹层。宽度是自适应的（跟随最长一行），模型名不会换行。
* 提供商色带是**常驻**的：宿主原本只在吸顶时铺底色，这里改成一直铺。如果你更想要宿主的
  原行为（只在吸顶时铺色），把那一行的背景换成透明即可。

## 验证到什么程度

* 宿主侧：`cordis.yml` 里已落行（`- id: dsh-bigger-choice` / `name: dsh-bigger-choice`），
  运行中的 Loader 也能查到这条 entry（`include:dsh-bigger-choice`，`status: absent`＝无 Config，正常）。
* 客户端半身：用 DOM 桩子真跑了一遍 `client.js`（注册 → factory → `apply(ctx)`），**42 项断言全过**——
  含「脚本执行期不碰 DOM」「`apply` 只挂一份 `<style>`」「重复 `apply` 不叠加」「没有 `ctx.effect` 也能生效」、
  样式表的花括号配平、**每个 `var()` 引用的自定义属性都有定义**（防 token 名写错），
  以及四个盒模型属性、宽度确实走 `max-content`、`min-width` 没有被人为提高、
  提供商色带的两条选择器与取值确实写对了。
* 没做：真实浏览器里的视觉截图。这一步需要带 token 的页面（无头访问 `/` 得到 401），
  所以「刷新后肉眼看到框变大 / 变宽」由使用者确认。