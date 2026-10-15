/**
 * dsh-bigger-choice — 客户端半身：把输入框右下角那个内置「模型选择器」的下拉框放大，
 * 让「这是哪个提供商的模型」一眼可见；再在搜索框右侧放一枚「免费」开关，
 * 并在每个提供商内部把模型按价格从低到高排好。
 *
 * 背景：那个下拉框由 @deepseek-ai/dsh-client-ui-model-selection 渲染，宿主对它的
 * 尺寸写死了两个上限——`max-height:min(360px,100vh - 96px)`、
 * `max-width:min(420px,100vw - 32px)`——所以 756px 高的窗口里只能看到十行左右。
 * 而提供商名（CodeArts Agent、CodeBuddy…）是 11px 的 tertiary 灰字、透明底，
 * 只有吸顶那一刻才铺底色，平时基本看不见。
 *
 * 宽度则相反：宿主本来就让弹层 `width:max-content`（跟着最长的那行自适应），
 * 是我们第一版给的 360px `min-width` 把它撑宽了，名字与打勾之间才空出一大片。
 * 现在 min-width 退回宿主的 240px 量级，宽度重新由内容决定。
 *
 * 为什么可以用一份样式表解决尺寸/色带这两件事：这个弹层虽然是 React portal，
 * 但宿主自己会测量它、自己摆位置——见该插件的 ModelSelect：
 *
 *   const lw = menuRef.current?.offsetWidth ?? 0
 *   const lh = menuRef.current?.offsetHeight ?? 0
 *   let y = rect.top - 8 - lh
 *   if (lh > 0) y = Math.min(Math.max(y, MARGIN), window.innerHeight - lh - MARGIN)
 *
 * 也就是说：弹出前先测量真实高度，再把 top 夹进视口（MARGIN = 12），并在
 * scroll / resize 时重算。我们的样式表在插件加载时就已经生效，所以宿主第一次测量
 * 拿到的就是放大后的高度，位置由它自己摆正——不需要我们碰 top/left，也不会顶出屏幕。
 *
 * 选择器是刻意写死的（这是"覆盖宿主弹层"，不是"挑选插槽"）：
 *
 *   ._7KE1Ra_menu
 *       本机这一版 DSH 构建出来的 CSS-module 类名（hash 由源码内容决定）。
 *   [id$="-menu"][class*="_menu"]:has([class*="_groups"])
 *       DSH 升级后 hash 会变，这一条是兜底：宿主给弹层的 id 是自己拼的
 *       `id={id}-menu`，而 `_menu` / `_groups` 是该模块**本地**的类名，本地类名
 *       不变则后缀不变；再要求弹层里真的装着那个滚动容器（`_groups`），
 *       以避开其它恰好叫 `*_menu` 的弹层。
 *
 * 第二个目标（提供商名）不用挑 hash，见下面 data-menu-group-* 那一段的注释。
 *
 * 免费开关 + 价格排序（本版新增）不再只是一份样式表，而是一小段 DOM 控制器：
 *
 *   * 弹层是 portal 到 document.body 的，所以在 body 上挂一个 MutationObserver
 *     （只看 childList，不看 subtree）发现弹层挂载/卸载；挂载后再给这个弹层挂一个
 *     childList+subtree 的观察器——面板切换（根面板/模型面板/推理档位）、搜索输入、
 *     清空按钮出现消失等 React 重渲染都会走到这里。
 *   * 每次变更过一个 microtask 批处理（flush），并且只有模型面板才动手：
 *     判据是弹层里存在 id 以 -models 结尾的滚动容器（宿主 `id={id}-models`），
 *     根面板与推理档位面板都没有它，天然免疫。
 *   * 「免费」开关是一个 <button>，绝对定位钉在搜索行（宿主 searchRow 是
 *     position:relative）右侧：不占流内空间，弹层的 max-content 宽度与内容高度
 *     都不受它影响，宿主 useLayoutEffect 第一次量到的尺寸也就不会偏。
 *     搜索框有内容时宿主会弹出清空按钮（right:4px、24px 宽），开关让到它左边
 *     （data-query="on"），同时给搜索框补 82px 右内边距，打字时文字不会钻到按钮底下。
 *   * 筛选/排序只改 DOM（display 与子节点顺序），不碰 React 的 state 与 itemRefs：
 *     键盘上下键走的仍是宿主自己的 visibleModels 顺序（有意的取舍，见 README），
 *     且 appendChild 移动的是宿主自己的节点，不会触发 React 校验错误。
 *   * 免费判定：名称含 free（不分大小写）/ 0.00 / 免费，或解析出的 x 价格为 0；
 *     价格判定：名称里 x 前缀的小数（x0.06、x1.16 这种部署里的标注格式），
 *     要求带小数点，避免把 "V4.1"、"1.13"、"X1" 这类版本号误当成价格。
 *   * 排序：免费的最前，然后按价格从低到高，没有价格标注的排到本组最后，
 *     同价保持原序（用户明确说同价内不做要求）。
 *   * 开关状态（freeOnly）是模块级变量：同一次会话里反复开关弹层都保持。
 *
 * 所有旋钮都走 CSS 自定义属性，想再调大/调小、想换个标题色，直接改即可，不必重装：
 * devtools 里改 :root 上的 --dsh-bigger-choice-*，或另写一份样式表覆盖。
 */
window.__ModuleLoader__.load({
  id: 'dsh-bigger-choice',
  factory() {
    const STYLE_ID = 'dsh-bigger-choice-style'

    const CSS = `
/* 尺寸旋钮（改这里，或在你自己的样式里覆盖这些变量，不必重装插件）。 */
:root {
  --dsh-bigger-choice-max-height: min(78vh, 100vh - 24px);
  --dsh-bigger-choice-min-width: min(240px, 100vw - 24px);
  --dsh-bigger-choice-max-width: min(720px, 100vw - 24px);
  /* 提供商标题栏（下面那条色带）的文字颜色与字号。 */
  --dsh-bigger-choice-group-color: var(--dsw-alias-label-primary);
  --dsh-bigger-choice-group-size: 12px;
}

/*
 * 内置模型选择器的弹层：原生上限 360px 高 / 420px 宽。
 *
 * 宽度跟着内容走——最长的一行（模型名或提供商名 + 末尾那个打勾）有多宽，
 * 弹层就有多宽。width: max-content 本来就是宿主自己的值，这里显式重申一次，
 * 免得以后宿主改了、我们又把它拉回去；关键是别再拿一个固定的 min-width 去撑它，
 * 那样只会撑出一道空档（名字与打勾之间那一大片）。min-width 保留宿主的
 * 240px 下限（连搜索框都放不满就没意义了），max-width 只用来兜住超长名字，
 * 不让弹层拉穿视口。
 */
._7KE1Ra_menu,
[id$="-menu"][class*="_menu"]:has([class*="_groups"]) {
  width: max-content !important;
  max-height: var(--dsh-bigger-choice-max-height) !important;
  min-width: var(--dsh-bigger-choice-min-width) !important;
  max-width: var(--dsh-bigger-choice-max-width) !important;
}

/*
 * 提供商名。它由 primitives 的 MenuGroup 渲染：一行 sticky 的
 * <div data-menu-group-heading>，宿主的样式是 11px / tertiary 色 / 透明底
 * ——只有在真正吸顶的那一刻才铺一层底色，所以平时几乎看不见，也就分不清
 * 某个模型属于哪个提供商。
 *
 * 这里改成一条常驻的分组色带（吸顶时也不再变色，避免滚动时闪），并把文字提到
 * primary 色、12px / 600。滚动时色带一直钉在列表顶部，因此「眼下这批模型属于
 * 哪个提供商」永远看得见。
 *
 * 选择器用 data-menu-group-* 这两个属性，而不是 CSS-module 的 hash：宿主的
 * observeStickyMenuGroups() 就是靠它们找分组的（见 MenuGroup.tsx），所以它们是
 * 宿主自己的契约面，升级不换。外层仍旧限定在模型选择器的弹层里——用
 * [id$="-models"]（宿主的滚动容器 id）把范围收窄，不波及别处的菜单分组。
 */
._7KE1Ra_menu [data-menu-group-heading],
[id$="-menu"]:has([id$="-models"]) [data-menu-group-heading] {
  padding: 8px 8px 5px;
  background: var(--dsw-alias-menu-group-header-fill, rgba(127, 127, 127, 0.12)) !important;
  color: var(--dsh-bigger-choice-group-color, currentColor) !important;
  font-size: var(--dsh-bigger-choice-group-size, 12px) !important;
  font-weight: 600 !important;
  letter-spacing: 0.015em;
  box-shadow: inset 0 -1px 0 0 var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.25));
}

/* 组与组之间留出呼吸，色带才读得出「分节」而不是「又一行」。 */
._7KE1Ra_menu [data-menu-group] + [data-menu-group],
[id$="-menu"]:has([id$="-models"]) [data-menu-group] + [data-menu-group] {
  margin-top: 8px;
}

/*
 * 「免费」开关。绝对定位钉在搜索行右侧（宿主 .searchRow 是 position:relative）：
 * 不占流内空间，所以弹层的 max-content 宽度、流内内容高度都不变，宿主
 * useLayoutEffect 量到的尺寸也就不会偏（这是刻意不用流内布局的原因）。
 * hover 底色用 currentColor 混色，不依赖任何可能不存在的 token。
 */
.dsh-bigger-choice-free-toggle {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  z-index: 1;
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.35));
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, currentColor);
  font-family: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
}
.dsh-bigger-choice-free-toggle:hover {
  background: color-mix(in srgb, currentColor 10%, transparent);
  color: var(--dsh-bigger-choice-group-color, currentColor);
}
.dsh-bigger-choice-free-toggle[aria-pressed="true"] {
  border-color: var(--dsw-alias-state-business-primary, #4d6bfe);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4d6bfe) 14%, transparent);
  color: var(--dsw-alias-state-business-primary, #4d6bfe);
}
/* 搜索框有内容时宿主会弹出清空按钮（right:4px、24px 宽）：把开关让到它左边。 */
.dsh-bigger-choice-free-toggle[data-query="on"] {
  right: 32px;
}

/* 免费筛选下确实一个免费模型都没有时的空态提示；点一下恢复显示全部。 */
.dsh-bigger-choice-free-empty {
  display: block;
  width: 100%;
  padding: 8px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, currentColor);
  font-family: inherit;
  font-size: 12px;
  line-height: 18px;
  text-align: center;
  cursor: pointer;
}
.dsh-bigger-choice-free-empty:hover {
  color: var(--dsw-alias-label-secondary, currentColor);
}
`

    /* ---------- 免费开关 + 价格排序（DOM 控制器） ---------- */

    // 免费：名称含 free（不分大小写）/ 独立的 0.00 / 免费；或 x 价格解析为 0。
    // 0.00 用前后不邻数字与小数点的写法，免得 "x10.00" 这种十块被误判成免费。
    const FREE_WORD = /free/i
    const FREE_ZERO = /(?<![\d.])0\.00(?![\d.])/
    // 价格：x 前缀的小数（部署里的标注形如 "GLM-5-3 · x0.75"）。要求带小数点，
    // 免得把 "V4.1"、"1.13"、"X1" 这类版本号误当成价格。
    const PRICE_RE = /x(\d+\.\d+)/i

    // 开关状态：模块级，会话内反复开关弹层都保持。
    let freeOnly = false

    const priceOf = (name) => {
      const match = PRICE_RE.exec(name)
      return match === null ? null : Number(match[1])
    }

    const isFreeName = (name, price) =>
      FREE_WORD.test(name) === true ||
      FREE_ZERO.test(name) === true ||
      name.includes('免费') === true ||
      price === 0

    const setStyle = (el, prop, value) => {
      if (el.style[prop] !== value) el.style[prop] = value
    }

    /** 切换开关并立刻重新同步按钮状态、重新筛选排序；焦点还给搜索框。 */
    function setFreeOnly(menu, value) {
      freeOnly = value
      syncSearchChrome(menu)
      applyTo(menu)
      const searchbox = menu.querySelector('[role="searchbox"]')
      if (searchbox !== null) searchbox.focus()
    }

    /**
     * 保证搜索行里有那枚「免费」开关，并同步它的状态与避让位置。
     * 搜索框锚点用宿主契约面 role="searchbox"；行用 searchRow 的本地类名兜底
     * （parentElement 命中宿主 .search 包装层时也工作——开关是绝对定位，
     * 最近的 position:relative 祖先仍是 searchRow）。
     */
    function syncSearchChrome(menu) {
      const input = menu.querySelector('[role="searchbox"]')
      if (input === null) return
      const row = input.closest('[class*="_searchRow"]') ?? input.parentElement
      if (row === null || row === menu) return

      let toggle = row.querySelector(':scope > .dsh-bigger-choice-free-toggle')
      if (toggle === null) {
        toggle = document.createElement('button')
        toggle.type = 'button'
        toggle.className = 'dsh-bigger-choice-free-toggle'
        toggle.textContent = '免费'
        toggle.addEventListener('click', () => setFreeOnly(menu, freeOnly === false))
        row.appendChild(toggle)
      }
      toggle.setAttribute('aria-pressed', freeOnly ? 'true' : 'false')
      toggle.title = freeOnly ? '显示全部模型（取消免费筛选）' : '只看免费模型'
      const hasClear = menu.querySelector('[class*="_searchClear"]') !== null
      toggle.dataset.query = hasClear ? 'on' : 'off'
      // 搜索框有内容时宿主会弹出清空按钮：把开关让到它左边，并给搜索框补出右侧
      // 留白（82px 覆盖清空按钮 24px + 间距 + 开关约 42px），免得文字钻到按钮底下。
      const box = input.closest('[class*="_search"]') ?? input.parentElement
      if (box !== null && box !== menu) {
        setStyle(box, 'paddingRight', hasClear ? '82px' : '')
      }
    }

    /**
     * 对模型面板做筛选 + 排序（只改 DOM）：
     *   * freeOnly 开：隐藏非免费行、隐藏没有任何可见行的分组；
     *   * 每组内排序：免费最前 → 价格从低到高 → 无价格标注的排最后 → 同价保持原序；
     *   * 全列表一个免费模型都没有时，挂一条可点的空态提示（点一下恢复全部）。
     * 宿主 itemRefs / visibleModels 不动，键盘导航仍走宿主自己的顺序。
     */
    function applyTo(menu) {
      const viewport = menu.querySelector('[id$="-models"]')
      if (viewport === null || viewport.hidden === true) {
        // 还没加载出列表、或宿主自己的空态：撤掉我们可能留下的空态提示。
        const stale = menu.querySelector(':scope > .dsh-bigger-choice-free-empty')
        if (stale !== null) stale.remove()
        return
      }
      let anyVisible = false
      for (const section of viewport.querySelectorAll(':scope > [data-menu-group]')) {
        const rows = [...section.querySelectorAll(':scope > button[role="menuitemradio"]')].map((el, order) => {
          const name = el.getAttribute('title') ?? el.textContent ?? ''
          const price = priceOf(name)
          return { el, order, price, free: isFreeName(name, price) }
        })
        for (const row of rows) setStyle(row.el, 'display', freeOnly === true && row.free === false ? 'none' : '')
        const visible = freeOnly === true ? rows.filter((row) => row.free === true) : rows
        if (visible.length > 0) anyVisible = true
        const sorted = [...rows].sort((a, b) => {
          if (a.free !== b.free) return a.free ? -1 : 1
          const pa = a.price === null ? Number.POSITIVE_INFINITY : a.price
          const pb = b.price === null ? Number.POSITIVE_INFINITY : b.price
          if (pa !== pb) return pa - pb
          return a.order - b.order
        })
        const live = [...section.querySelectorAll(':scope > button[role="menuitemradio"]')]
        let changed = live.length !== sorted.length
        if (changed === false) {
          for (let i = 0; i < sorted.length; i += 1) {
            if (live[i] !== sorted[i].el) {
              changed = true
              break
            }
          }
        }
        // 只在顺序真的变了才动 DOM：appendChild 移动已有节点不新增 mutation，
        // 观察器不会自我喂食；heading 与 start 哨兵是前两个子节点，不受影响。
        if (changed === true) for (const row of sorted) section.appendChild(row.el)
        setStyle(section, 'display', freeOnly === true && visible.length === 0 ? 'none' : '')
      }
      let notice = menu.querySelector(':scope > .dsh-bigger-choice-free-empty')
      if (freeOnly === true && anyVisible === false) {
        if (notice === null) {
          notice = document.createElement('button')
          notice.type = 'button'
          notice.className = 'dsh-bigger-choice-free-empty'
          notice.textContent = '没有免费模型'
          notice.title = '点击显示全部模型'
          notice.addEventListener('click', () => setFreeOnly(menu, false))
          menu.appendChild(notice)
        }
      } else if (notice !== null) {
        notice.remove()
      }
    }

    /**
     * 观察弹层：body 上只看 childList（portal 直接把弹层挂在 body 下），
     * 命中 `id$="-menu"` 且像模型选择器（装着菜单项/搜索框/分组）的弹层，
     * 再给它挂一个 childList+subtree 的观察器；每次变更过一个 microtask 批处理。
     * 只跟踪、不假设——applyTo 自己判断是不是模型面板（有 -models 滚动容器）。
     */
    function watch() {
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}
      const body = document.body
      if (body === null) return () => {}

      const menuWatchers = new Map()
      const pendingMenus = new Set()
      let flushQueued = false

      const flush = () => {
        flushQueued = false
        for (const menu of pendingMenus) {
          pendingMenus.delete(menu)
          if (menu.isConnected !== true) continue
          if (menu.querySelector('[id$="-models"]') === null) {
            const stale = menu.querySelector(':scope > .dsh-bigger-choice-free-empty')
            if (stale !== null) stale.remove()
            continue
          }
          syncSearchChrome(menu)
          applyTo(menu)
        }
      }
      const schedule = (menu) => {
        pendingMenus.add(menu)
        if (flushQueued === false) {
          flushQueued = true
          queueMicrotask(flush)
        }
      }

      const looksLikeMenu = (node) =>
        node instanceof Element &&
        typeof node.id === 'string' &&
        node.id.endsWith('-menu') === true &&
        node.querySelector('[role="menuitem"], [role="menuitemradio"], [role="searchbox"], [data-menu-group]') !== null

      const trackMenu = (menu) => {
        if (menuWatchers.has(menu) === true) return
        const watcher = new MutationObserver(() => schedule(menu))
        watcher.observe(menu, { childList: true, subtree: true })
        menuWatchers.set(menu, watcher)
        schedule(menu)
      }
      const untrackMenu = (menu) => {
        const watcher = menuWatchers.get(menu)
        if (watcher !== undefined) {
          watcher.disconnect()
          menuWatchers.delete(menu)
        }
        pendingMenus.delete(menu)
      }

      const bodyWatcher = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) if (looksLikeMenu(node) === true) trackMenu(node)
          for (const node of record.removedNodes) {
            if (node instanceof Element && typeof node.id === 'string' && node.id.endsWith('-menu') === true) untrackMenu(node)
          }
        }
      })
      bodyWatcher.observe(body, { childList: true, subtree: false })
      // 插件加载（或热重载）时弹层可能已经开着：先扫一遍现有的。
      for (const child of body.children) if (looksLikeMenu(child) === true) trackMenu(child)

      return () => {
        bodyWatcher.disconnect()
        for (const watcher of menuWatchers.values()) watcher.disconnect()
        menuWatchers.clear()
        pendingMenus.clear()
      }
    }

    /**
     * 样式表挂在 document.head 上：弹层是 portal，挂 body 下也行，但 head 里不会被
     * 应用根节点的替换波及。重复 apply（热重载）时先摘掉旧的，避免叠加多份。
     */
    function install() {
      if (typeof document === 'undefined') return () => {}
      const previous = document.getElementById(STYLE_ID)
      if (previous) previous.remove()
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.dataset.plugin = 'dsh-bigger-choice'
      style.textContent = CSS
      document.head.appendChild(style)
      return () => style.remove()
    }

    function installAll() {
      const disposeStyle = install()
      const disposeWatch = watch()
      return () => {
        disposeStyle()
        disposeWatch()
      }
    }

    return {
      name: 'dsh-bigger-choice',
      inject: [],
      apply(ctx) {
        if (typeof ctx?.effect === 'function') ctx.effect(installAll, 'bigger-choice: model picker styles + free filter & price sort')
        else installAll()
      },
    }
  },
})
