/**
 * subagent-view — browser (client) half.
 *
 * PLACEHOLDER — replaced by the client implementation task. The real half
 * will:
 *   - register one entry into the `sidebar.footer.action` slot that renders
 *     the compact bottom bar ("n running · m done · k failed") and, when
 *     open, the expandable panel above it (both inside the sidebar column);
 *   - poll /api/subagent-view/snapshot once per second while mounted;
 *   - handle open-conversation, back-to-main-session, clear-finished,
 *     rail-collapse and mobile-default-collapsed behavior.
 */
export const inject: string[] = []

export function apply(_ctx: unknown): void {
  // No-op until the client implementation lands.
}
