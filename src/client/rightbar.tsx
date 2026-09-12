/**
 * subagent-view, browser half: the right-sidebar (rightbar) tab type.
 *
 * Two stages, exactly the platform's public path:
 *  - stage one (`subagentTabDefinition`) is a *page* type: it claims no resource
 *    address, is opened by kind, and offers one guide entry so the user reaches
 *    it from the pane strip's add control (or as the seeded default page). Its
 *    `id` is the identity every later stage keys on.
 *  - stage two registers the body into the keyed `sidebar.right.pane.tab` seat
 *    under that same `id`, not under the kind.
 *
 * The body is a second host of the shared monitor in `monitor.tsx` — same
 * store, same poller, same panel card as the left-sidebar docked panel — with
 * the two layout deviations the integration contract requires: it fills the tab
 * pane, and its header carries no click-to-collapse affordance.
 *
 * Both imports below are type-only, so the built client bundle gains no runtime
 * require on the rightbar package (no second copy of the tab system) and the
 * plugin never calls `ctx.sidebarRight.*`.
 */
import type { ReactElement } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarRightTabDefinition } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import { SubagentMonitorPanel, useMonitorPolling, useMonitorSession } from './monitor'

/** This implementation's identity in the tab system, and the key its body registers under. */
export const SUBAGENT_VIEW_ID = 'subagent-view'

/** The tab kind `openTab` names; a page type is opened by kind only. */
export const SUBAGENT_VIEW_KIND = 'subagent-view'

/**
 * Stage one: what the tab type IS. Pure and side-effect free so a harness can
 * capture the object it hands the registry.
 *
 * `patterns`, `canOpen` and `priority` are deliberately absent: this is a page
 * type, and an absent band is the `extension` default (a type from outside the
 * product). The guide entry sets no icon — the guide draws its documented
 * placeholder — and sorts after the shipped Files entry (`order: 10`).
 */
export function subagentTabDefinition(): SidebarRightTabDefinition {
  return {
    id: SUBAGENT_VIEW_ID,
    kind: SUBAGENT_VIEW_KIND,
    title: () => 'Subagents',
    guide: [
      {
        order: 20,
        title: () => 'Subagents',
        description: () => 'Live subagent runs for the selected session',
      },
    ],
  }
}

/**
 * Stage two: the tab body.
 *
 * It is a session-scope seat, so the session it draws arrives as the
 * `sessionId` standard prop (the same session the seat's store belongs to) and
 * `useSessions` supplies the Back-to-main fact. Presentation (normal vs
 * fullscreen, shown vs hidden, floats) is the platform's decision and is not
 * read here; the shared poller is host-independent, so `tab.signal` is
 * deliberately ignored.
 */
export function SubagentRightbarTab({
  sessionId, useSessions,
}: PropsRuntime<'sidebar.right.pane.tab'>): ReactElement {
  useMonitorSession(sessionId)
  useMonitorPolling()
  return <SubagentMonitorPanel variant="tab" useSessions={useSessions} />
}
