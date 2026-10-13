/**
 * dsh-bigger-choice — 客户端半身：把输入框右下角那个内置「模型选择器」的下拉框放大，
 * 并让「这是哪个提供商的模型」一眼可见。两件事都只是一份样式表。
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
 * 为什么可以用一份样式表解决：这个弹层虽然是 React portal，但宿主自己会测量它、
 * 自己摆位置——见该插件的 ModelSelect：
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
`

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

    return {
      name: 'dsh-bigger-choice',
      inject: [],
      apply(ctx) {
        if (typeof ctx?.effect === 'function') ctx.effect(install, 'bigger-choice: model picker styles')
        else install()
      },
    }
  },
})