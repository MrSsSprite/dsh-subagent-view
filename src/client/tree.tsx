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
import {
  IconChevronRightOutline14,
  IconFolderClose16,
  IconFolderOpen16,
} from '@deepseek-ai/dsh-client-ui-primitives'

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

// ---- Archived folder ----

/** Rows that can carry the archived grouping facts. */
export interface ArchivableRow extends TreeRowLike {
  mode?: string
  status: string
}

/** Result of splitting one forest into the main list and the Archived folder. */
export interface ArchivedSplit<Row extends ArchivableRow> {
  /** Rows that stay in the main forest, in original order. */
  main: Row[]
  /** Archive members plus every row nested under them, in original order. */
  archived: Row[]
  /** Number of archive members (member descendants excluded). */
  count: number
}

/**
 * Partition `rows` into the main forest and the Archived folder. A member is
 * a completed one-shot row; the folder takes each member's whole subtree, so
 * the tree never orphans a child of a moved row. Nested members stay nested:
 * only the outermost archived ancestor becomes a folder root.
 */
export function splitArchived<Row extends ArchivableRow>(rows: readonly Row[]): ArchivedSplit<Row> {
  const isMember = (row: Row): boolean => row.mode === 'one-shot' && row.status === 'completed'
  const memberIds = new Set<string>()
  for (const row of rows) {
    if (isMember(row)) memberIds.add(row.id)
  }
  const archiveRoots = new Set<string>()
  for (const row of rows) {
    if (!memberIds.has(row.id)) continue
    if (row.parentId === undefined || !memberIds.has(row.parentId)) archiveRoots.add(row.id)
  }
  const byId = new Map<string, Row>()
  for (const row of rows) byId.set(row.id, row)
  const inFolder = (row: Row, seen: Set<string>): boolean => {
    if (archiveRoots.has(row.id)) return true
    if (row.parentId === undefined || seen.has(row.id)) return false
    seen.add(row.id)
    const parent = byId.get(row.parentId)
    return parent !== undefined && inFolder(parent, seen)
  }
  const moved = new Set<string>()
  let count = 0
  for (const row of rows) {
    if (!inFolder(row, new Set())) continue
    moved.add(row.id)
    if (isMember(row)) count += 1
  }
  const archived = rows.filter(row => moved.has(row.id))
  const main = rows.filter(row => !moved.has(row.id))
  return { main, archived, count }
}

export interface ArchivedFolderProps<Row extends ArchivableRow> {
  /** The archive portion of the split (members + their subtrees). */
  rows: readonly Row[]
  /** Number of archive members; rendered in the header. */
  count: number
  /** CSS class prefix shared with the row cards. */
  cls: string
  /** Branch collapse ids; forwarded to the inner tree. */
  collapsed: ReadonlySet<string>
  onToggle(id: string): void
  renderRow(row: Row, ctx: TreeRowContext): ReactElement
  /** Whether the folder body is currently rendered. */
  open: boolean
  onToggleFolder(): void
}

/**
 * The "Archived" container: a disclosure-style header (chevron + folder icon +
 * member count) whose body renders the archive forest with the same tree
 * visuals as the main list. Renders nothing while empty.
 */
export function ArchivedFolder<Row extends ArchivableRow>(props: ArchivedFolderProps<Row>): ReactElement | null {
  const { rows, count, cls, collapsed, onToggle, renderRow, open, onToggleFolder } = props
  if (rows.length === 0) return null
  return (
    <div className={`${cls}-folder`}>
      <button
        className={`${cls}-folder-header${open ? ` ${cls}-folder-open` : ''}`}
        type="button"
        aria-expanded={open}
        title={open ? 'Collapse archived' : 'Expand archived'}
        onClick={onToggleFolder}
      >
        <span className={`${cls}-folder-chevron${open ? ` ${cls}-folder-chevron-open` : ''}`} aria-hidden="true">
          <IconChevronRightOutline14 />
        </span>
        {open
          ? <IconFolderOpen16 size={14} className={`${cls}-folder-icon`} />
          : <IconFolderClose16 size={14} className={`${cls}-folder-icon`} />}
        <span className={`${cls}-folder-label`}>Archived</span>
        <span className={`${cls}-folder-count`}>{count}</span>
      </button>
      {open
        ? (
          <div className={`${cls}-folder-body`}>
            <SubagentTree
              rows={rows}
              collapsed={collapsed}
              onToggle={onToggle}
              cls={cls}
              renderRow={renderRow}
            />
          </div>
          )
        : null}
    </div>
  )
}
