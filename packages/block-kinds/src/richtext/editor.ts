/**
 * The heavy half of the richtext kind: prosemirror-view and friends.
 * Loaded ONLY via dynamic import from RichtextEditView, so the publish
 * pipeline (Bun, no DOM) and the initial reader bundle never touch it.
 * Exposes a deliberately narrow handle — the React side never holds PM
 * types.
 */
import { baseKeymap, lift, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import {
  inputRules,
  textblockTypeInputRule,
  wrappingInputRule,
} from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { Node as PmModelNode, type MarkType } from 'prosemirror-model';
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import { EditorState, type Command } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { PmNode } from './richtext';
import { richtextSchema as schema } from './schema';

export type ToolbarCommand =
  | 'strong'
  | 'em'
  | 'code'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet_list'
  | 'ordered_list'
  | 'blockquote'
  | 'undo'
  | 'redo';

export type EditorHandle = {
  destroy: () => void;
  focus: () => void;
  exec: (cmd: ToolbarCommand) => void;
  /** Apply (href) or clear (null) an external link on the selection. */
  setLink: (href: string | null) => void;
  /** Mark the selection as a page link; with an empty selection, insert
   * the page title as linked text. */
  insertPageLink: (pageId: string, title: string) => void;
  /** Toolbar highlight states, recomputed per transaction. */
  active: () => Record<ToolbarCommand | 'link' | 'pagelink', boolean>;
  /** True when the selection is empty (link buttons need a target). */
  selectionEmpty: () => boolean;
  /** True while the PM surface owns focus (bubble visibility). */
  hasFocus: () => boolean;
  /** Apply (css color) or clear (null) the color mark on the selection. */
  setColor: (color: string | null) => void;
  /** Color of the selection's first colored text, if any. */
  activeColor: () => string | null;
  /** Viewport coords spanning the selection — bubble anchor. */
  selectionCoords: () => { x: number; top: number; bottom: number } | null;
  /** Viewport coords of a doc position — slash-menu anchor. */
  posCoords: (pos: number) => { x: number; top: number; bottom: number } | null;
  /** Remove a doc range (slash-trigger cleanup). */
  deleteRange: (from: number, to: number) => void;
};

export function mountEditor(opts: {
  place: HTMLElement;
  doc: PmNode;
  onDocChanged: (docJson: unknown) => void;
  /** Fires after every dispatched transaction — toolbar re-render tick. */
  onTick: () => void;
  /** "/" typed — the host component opens its floating block menu at
   * this doc position (Notion affordance, module-owned UI). */
  onSlash?: (pos: number) => void;
  /** A mouse gesture settled on a non-empty selection (drag-select
   * mouseup, or right-click on a selection) — open the format menu.
   * Right-clicks arrive with `viaContextMenu` so the caller knows the
   * native menu was suppressed. */
  onSelectionMenu?: (point: { x: number; y: number }, viaContextMenu: boolean) => void;
}): EditorHandle {
  let doc: PmModelNode;
  try {
    doc = PmModelNode.fromJSON(schema, opts.doc);
  } catch {
    // unknown/legacy JSON degrades to an empty doc — never a crash
    doc = schema.node('doc', null, [schema.node('paragraph')]);
  }

  const rules = inputRules({
    rules: [
      textblockTypeInputRule(/^(#{1,3})\s$/, schema.nodes.heading, (m) => ({ level: (m[1] ?? '#').length })),
      wrappingInputRule(/^\s*([-*])\s$/, schema.nodes.bullet_list),
      wrappingInputRule(/^(\d+)\.\s$/, schema.nodes.ordered_list),
      wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote),
    ],
  });

  const state = EditorState.create({
    doc,
    plugins: [
      history(),
      rules,
      keymap({
        'Mod-z': undo,
        'Mod-y': redo,
        'Mod-Shift-z': redo,
        'Mod-b': toggleMark(schema.marks.strong),
        'Mod-i': toggleMark(schema.marks.em),
        'Mod-`': toggleMark(schema.marks.code),
        Enter: splitListItem(schema.nodes.list_item),
        Tab: sinkListItem(schema.nodes.list_item),
        'Shift-Tab': liftListItem(schema.nodes.list_item),
      }),
      keymap(baseKeymap),
    ],
  });

  const view = new EditorView(opts.place, {
    state,
    dispatchTransaction(tr) {
      const next = view.state.apply(tr);
      view.updateState(next);
      if (tr.docChanged) opts.onDocChanged(next.doc.toJSON());
      opts.onTick();
    },
    handleTextInput(_view, from, _to, text) {
      // fires BEFORE insertion: the "/" lands at [from, from+1)
      if (text === '/' && opts.onSlash) opts.onSlash(from);
      return false; // never consume — the character still types
    },
    handleDOMEvents: {
      // drag-select settles → format menu at the pointer (M9-D3)
      mouseup(v, e) {
        if (!opts.onSelectionMenu) return false;
        const point = { x: e.clientX, y: e.clientY };
        // selection state settles after the event — defer one tick
        setTimeout(() => {
          if (!v.isDestroyed && !v.state.selection.empty) opts.onSelectionMenu!(point, false);
        }, 0);
        return false;
      },
      // right-click on a selection re-enters the same menu; empty
      // selection keeps the native menu (copy/paste belongs there)
      contextmenu(v, e) {
        if (!opts.onSelectionMenu || v.state.selection.empty) return false;
        e.preventDefault();
        opts.onSelectionMenu({ x: e.clientX, y: e.clientY }, true);
        return true;
      },
    },
  });

  const run = (command: Command) => {
    command(view.state, view.dispatch, view);
    view.focus();
  };

  /** Toggle heading level n ↔ paragraph. */
  const heading = (level: number): Command => (state, dispatch, v) => {
    const inHeading =
      state.selection.$from.parent.type === schema.nodes.heading &&
      state.selection.$from.parent.attrs.level === level;
    return inHeading
      ? setBlockType(schema.nodes.paragraph)(state, dispatch, v)
      : setBlockType(schema.nodes.heading, { level })(state, dispatch, v);
  };

  /** Toggle a list wrap: lift when already inside, wrap otherwise. */
  const list = (type: typeof schema.nodes.bullet_list): Command => (state, dispatch, v) =>
    inNode(state, type)
      ? liftListItem(schema.nodes.list_item)(state, dispatch, v)
      : wrapInList(type)(state, dispatch, v);

  const blockquote: Command = (state, dispatch, v) =>
    inNode(state, schema.nodes.blockquote) ? lift(state, dispatch, v) : wrapIn(schema.nodes.blockquote)(state, dispatch, v);

  const commands: Record<ToolbarCommand, Command> = {
    strong: toggleMark(schema.marks.strong),
    em: toggleMark(schema.marks.em),
    code: toggleMark(schema.marks.code),
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    bullet_list: list(schema.nodes.bullet_list),
    ordered_list: list(schema.nodes.ordered_list),
    blockquote,
    undo,
    redo,
  };

  return {
    destroy: () => view.destroy(),
    focus: () => view.focus(),
    exec: (cmd) => run(commands[cmd]),

    setLink: (href) => {
      const { from, to, empty } = view.state.selection;
      if (empty) return;
      const tr = view.state.tr;
      if (href === null) {
        tr.removeMark(from, to, schema.marks.link).removeMark(from, to, schema.marks.pagelink);
      } else {
        tr.removeMark(from, to, schema.marks.pagelink).addMark(from, to, schema.marks.link.create({ href }));
      }
      view.dispatch(tr);
      view.focus();
    },

    insertPageLink: (pageId, title) => {
      const { from, to, empty } = view.state.selection;
      const mark = schema.marks.pagelink.create({ pageId });
      const tr = empty
        ? view.state.tr.insertText(title, from).addMark(from, from + title.length, mark)
        : view.state.tr.removeMark(from, to, schema.marks.link).addMark(from, to, mark);
      view.dispatch(tr);
      view.focus();
    },

    active: () => ({
      strong: markActive(view.state, schema.marks.strong),
      em: markActive(view.state, schema.marks.em),
      code: markActive(view.state, schema.marks.code),
      link: markActive(view.state, schema.marks.link),
      pagelink: markActive(view.state, schema.marks.pagelink),
      h1: headingActive(view.state, 1),
      h2: headingActive(view.state, 2),
      h3: headingActive(view.state, 3),
      bullet_list: inNode(view.state, schema.nodes.bullet_list),
      ordered_list: inNode(view.state, schema.nodes.ordered_list),
      blockquote: inNode(view.state, schema.nodes.blockquote),
      undo: false,
      redo: false,
    }),

    selectionEmpty: () => view.state.selection.empty,

    hasFocus: () => view.hasFocus(),

    setColor: (color) => {
      const { from, to, empty } = view.state.selection;
      if (empty) return;
      const tr = view.state.tr.removeMark(from, to, schema.marks.color);
      if (color !== null) tr.addMark(from, to, schema.marks.color.create({ color }));
      view.dispatch(tr);
      view.focus();
    },

    activeColor: () => {
      const { from, to, empty, $from } = view.state.selection;
      if (empty) {
        const m = schema.marks.color.isInSet(view.state.storedMarks ?? $from.marks());
        return m ? (m.attrs.color as string) : null;
      }
      let found: string | null = null;
      view.state.doc.nodesBetween(from, to, (node) => {
        if (found) return false;
        const m = schema.marks.color.isInSet(node.marks);
        if (m) found = m.attrs.color as string;
        return true;
      });
      return found;
    },

    selectionCoords: () => {
      const { from, to, empty } = view.state.selection;
      if (empty) return null;
      try {
        const a = view.coordsAtPos(from);
        const b = view.coordsAtPos(to);
        return { x: (a.left + b.left) / 2, top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom) };
      } catch {
        return null;
      }
    },

    posCoords: (pos) => {
      try {
        const c = view.coordsAtPos(Math.max(0, Math.min(pos, view.state.doc.content.size)));
        return { x: c.left, top: c.top, bottom: c.bottom };
      } catch {
        return null;
      }
    },

    deleteRange: (from, to) => {
      view.dispatch(view.state.tr.delete(from, to));
    },
  };
}

function markActive(state: EditorState, type: MarkType): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks ?? $from.marks());
  return state.doc.rangeHasMark(from, to, type);
}

function headingActive(state: EditorState, level: number): boolean {
  const parent = state.selection.$from.parent;
  return parent.type === schema.nodes.heading && parent.attrs.level === level;
}

function inNode(state: EditorState, type: { name: string }): boolean {
  const $from = state.selection.$from;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === type.name) return true;
  }
  return false;
}
