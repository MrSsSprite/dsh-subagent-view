/**
 * subagent-view, browser half: shared subagent hierarchy renderer.
 *
 * Replicates the DSH-canonical disclosure tree visual (the authority pattern
 * from `@deepseek-ai/dsh-client-ui-subagent`'s catalog rows): rows that have
 * children get a chevron-right ">" disclosure button on their left, which
 * rotates 90° to point downward when the branch is expanded, and gray
 * "L"-shaped guide lines (a vertical line through the parent's chevron column
 * plus a short horizontal tick reaching each child row's chevron) mark the
 * parent-child relationships.
 *
 * Geometry contract with the row cards and the CSS in src/client/index.ts
 * (mirrors the canonical catalog row numbers):
 * - a row card carries class `${cls}-row`, is `position: relative`, and is
 *   padded 11px from the left so the 14px disclosure's center sits at x=18px;
 * - every nested level renders as a `.${cls}-children` block (margin-left
 *   18px + padding-left 4px) of `.${cls}-node` wrappers, each node holding
 *   one row card plus, when expanded, its own children block;
 * - the guide lines are drawn purely by CSS: a per-node vertical line at
 *   left:-4px (the parent's chevron column), a per-row horizontal tick at
 *   left:-4px / top:16px (the chevron's vertical center), a 17px-tall final
 *   segment on the last sibling, and a vertical bridge (the
 *   `.${cls}-row-branch-open` pseudo-element) from an expanded parent's
 *   chevron down to its children. The bridge spans the row's full remaining
 *   height, so rows of any height (details blocks, purpose lines) stay
 *   connected.
 */
import { useMemo, type ReactElement } from 'react'
import { IconChevronRightOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'

/** Minimal wire shape every tree row must satisfy. */
export interface TreeRowLike {
  id: string
  /** Direct parent session id; rows whose parent is absent from `rows` are roots. */
  parentId?: string
  /** Human-readable name used in the disclosure's accessible name. */
  label?: string
}

/** Per-row context handed to the row renderer. */
export interface TreeRowContext {
  /** The row has at least one rendered child. */
  hasChildren: boolean
  /** The row's children are currently rendered. */
  expanded: boolean
  /** The row is the last child of its parent (its vertical guide line stops at its tick). */
  last: boolean
  /** Root-relative depth. */
  depth: number
  /** Canonical disclosure control: the chevron button, or an alignment spacer for leaves. */
  disclosure: ReactElement
}

export interface SubagentTreeProps<Row extends TreeRowLike> {
  /** All rows of one forest; any order, parents need not precede children. */
  rows: readonly Row[]
  /** Ids whose children are hidden. */
  collapsed: ReadonlySet<string>
  onToggle(id: string): void
  /** CSS class prefix shared by the row card and the guide-line selectors. */
  cls: string
  /** Renders one row card; its root element must carry the `${cls}-row` class. */
  renderRow(row: Row, ctx: TreeRowContext): ReactElement
}

/** Build the forest over `rows`, then recurse only through expanded branches. */
export function SubagentTree<Row extends TreeRowLike>(props: SubagentTreeProps<Row>): ReactElement {
  const { rows, collapsed, onToggle, cls, renderRow } = props

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Row[]>()
    const known = new Set<string>()
    for (const row of rows) known.add(row.id)
    for (const row of rows) {
      if (row.parentId === undefined || !known.has(row.parentId)) continue
      const siblings = map.get(row.parentId)
      if (siblings === undefined) map.set(row.parentId, [row])
      else siblings.push(row)
    }
    return map
  }, [rows])

  const roots = useMemo(() => {
    const known = new Set<string>()
    for (const row of rows) known.add(row.id)
    return rows.filter(row => row.parentId === undefined || !known.has(row.parentId))
  }, [rows])

  const renderNode = (row: Row, depth: number, last: boolean, nodeKey: string): ReactElement => {
    const children = childrenByParent.get(row.id) ?? []
    const hasChildren = children.length > 0
    const expanded = hasChildren && !collapsed.has(row.id)
    const name = row.label !== undefined && row.label !== '' ? row.label : 'subagent'
    const disclosure = hasChildren
      ? (
        <button
          className={`${cls}-disclosure${expanded ? ` ${cls}-disclosure-open` : ''}`}
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${name} descendants` : `Expand ${name} descendants`}
          title={expanded ? 'Collapse descendants' : 'Expand descendants'}
          onClick={(event) => {
            event.stopPropagation()
            onToggle(row.id)
          }}
        >
          <IconChevronRightOutline14 />
        </button>
        )
      : <span className={`${cls}-disclosure-space`} aria-hidden="true" />
    return (
      <div className={`${cls}-node`} key={nodeKey}>
        {renderRow(row, { hasChildren, expanded, last, depth, disclosure })}
        {expanded
          ? (
            <div className={`${cls}-children`} role="group">
              {children.map((child, index) => renderNode(
                child,
                depth + 1,
                index === children.length - 1,
                child.id,
              ))}
            </div>
            )
          : null}
      </div>
    )
  }

  return (
    <>
      {roots.map((row, index) => renderNode(
        row,
        0,
        index === roots.length - 1,
        row.id,
      ))}
    </>
  )
}
