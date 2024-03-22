import { getMarkRange, posToDOMRect, Range } from "@tiptap/core";
import { EditorView } from "@tiptap/pm/view";
import { Mark } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";

import type { BlockNoteEditor } from "../../editor/BlockNoteEditor";
import { BlockSchema, InlineContentSchema, StyleSchema } from "../../schema";
import { UiElementPosition } from "../../extensions-shared/UiElementPosition";
import { EventEmitter } from "../../util/EventEmitter";
import { findScrollContainer } from "../../util/browser";

export type LinkToolbarState = UiElementPosition & {
  // The hovered link's URL, and the text it's displayed with in the
  // editor.
  url: string;
  text: string;
};
export const composePath = (
  el: HTMLElement,
  unit = (el: HTMLElement) => el.tagName === "html"
) => {
  const path = [] as HTMLElement[];
  while (el) {
    path.push(el);

    if (unit(el) || !el.parentElement) {
      return path;
    }
    el = el.parentElement;
  }
  return path;
};
class LinkToolbarView {
  public state?: LinkToolbarState;
  public emitUpdate: () => void;
  private timer: any
  menuUpdateTimer: ReturnType<typeof setTimeout> | undefined;
  startMenuUpdateTimer: () => void;
  stopMenuUpdateTimer: () => void;

  mouseHoveredLinkMark: Mark | undefined;
  mouseHoveredLinkMarkRange: Range | undefined;

  keyboardHoveredLinkMark: Mark | undefined;
  keyboardHoveredLinkMarkRange: Range | undefined;

  linkMark: Mark | undefined;
  linkMarkRange: Range | undefined;

  constructor(
    private readonly editor: BlockNoteEditor<any, any, any>,
    private readonly pmView: EditorView,
    emitUpdate: (state: LinkToolbarState) => void
  ) {
    this.emitUpdate = () => {
      if (!this.state) {
        throw new Error("Attempting to update uninitialized link toolbar");
      }

      emitUpdate(this.state);
    };

    this.startMenuUpdateTimer = () => {
      this.menuUpdateTimer = setTimeout(() => {
        this.update();
      }, 500);
    };

    this.stopMenuUpdateTimer = () => {
      if (this.menuUpdateTimer) {
        clearTimeout(this.menuUpdateTimer);
        this.menuUpdateTimer = undefined;
      }

      return false;
    };

    this.pmView.dom.addEventListener("mouseover", this.mouseOverHandler);
    document.addEventListener("click", this.clickHandler, true);
    this.timer = setTimeout(() => {
      findScrollContainer(this.pmView.dom).addEventListener("scroll", this.scrollHandler);
    })
    
  }

  mouseOverHandler = (event: MouseEvent) => {
    // Resets the link mark currently hovered by the mouse cursor.
    this.mouseHoveredLinkMark = undefined;
    this.mouseHoveredLinkMarkRange = undefined;

    this.stopMenuUpdateTimer();
    const path = composePath(
      event.target as HTMLElement,
      (el) => el.dataset.nodeType === "blockContainer" || el.nodeName === "HTML"
    );
    const target = path.find((el) => el.nodeName === "A");
    if (
      target?.nodeName === "A"
    ) {
      // Finds link mark at the hovered element's position to update mouseHoveredLinkMark and
      // mouseHoveredLinkMarkRange.
      const hoveredLinkElement = target;
      const posInHoveredLinkMark =
        this.pmView.posAtDOM(hoveredLinkElement, 0) + 1;
      const resolvedPosInHoveredLinkMark =
        this.pmView.state.doc.resolve(posInHoveredLinkMark);
      const marksAtPos = resolvedPosInHoveredLinkMark.marks();

      for (const mark of marksAtPos) {
        if (
          mark.type.name === this.pmView.state.schema.mark("link").type.name
        ) {
          this.mouseHoveredLinkMark = mark;
          this.mouseHoveredLinkMarkRange =
            getMarkRange(resolvedPosInHoveredLinkMark, mark.type, mark.attrs) ||
            undefined;

          break;
        }
      }
    }

    this.startMenuUpdateTimer();

    return false;
  };

  clickHandler = (event: MouseEvent) => {
    const editorWrapper = this.pmView.dom.parentElement!.parentElement;

    if (
      // Toolbar is open.
      this.linkMark &&
      // An element is clicked.
      event &&
      event.target &&
      // The clicked element is not the editor.
      !(
        editorWrapper === (event.target as Node) ||
        editorWrapper.contains(event.target as Node)
      )
    ) {
      if (this.state?.show) {
        this.state.show = false;
        this.emitUpdate();
      }
    }
  };

  scrollHandler = () => {
    if (this.linkMark !== undefined) {
      if (this.state?.show) {
        this.state.referencePos = posToDOMRect(
          this.pmView,
          this.linkMarkRange!.from,
          this.linkMarkRange!.to
        );
        this.emitUpdate();
      }
    }
  };

  editLink(url: string, text: string) {
    const tr = this.pmView.state.tr.insertText(
      text,
      this.linkMarkRange!.from,
      this.linkMarkRange!.to
    );
    tr.addMark(
      this.linkMarkRange!.from,
      this.linkMarkRange!.from + text.length,
      this.pmView.state.schema.mark("link", { href: url })
    );
    tr.setMeta("preventAutolink", true);
    this.pmView.dispatch(tr);
    this.pmView.focus();

    if (this.state?.show) {
      this.state.show = false;
      this.emitUpdate();
    }
  }

  deleteLink() {
    this.pmView.dispatch(
      this.pmView.state.tr
        .removeMark(
          this.linkMarkRange!.from,
          this.linkMarkRange!.to,
          this.linkMark!.type
        )
        .setMeta("preventAutolink", true)
    );
    this.pmView.focus();

    if (this.state?.show) {
      this.state.show = false;
      this.emitUpdate();
    }
  }

  update() {
    if (!this.pmView.hasFocus() && this.state?.show === true ) {
      return;
    }

    // Saves the currently hovered link mark before it's updated.
    const prevLinkMark = this.linkMark;

    // Resets the currently hovered link mark.
    this.linkMark = undefined;
    this.linkMarkRange = undefined;

    // Resets the link mark currently hovered by the keyboard cursor.
    this.keyboardHoveredLinkMark = undefined;
    this.keyboardHoveredLinkMarkRange = undefined;

    // Finds link mark at the editor selection's position to update keyboardHoveredLinkMark and
    // keyboardHoveredLinkMarkRange.
    // if (this.pmView.state.selection.empty) {
    //   const marksAtPos = this.pmView.state.selection.$from.marks();

    //   for (const mark of marksAtPos) {
    //     if (
    //       mark.type.name === this.pmView.state.schema.mark("link").type.name
    //     ) {
    //       this.keyboardHoveredLinkMark = mark;
    //       this.keyboardHoveredLinkMarkRange =
    //         getMarkRange(
    //           this.pmView.state.selection.$from,
    //           mark.type,
    //           mark.attrs
    //         ) || undefined;

    //       break;
    //     }
    //   }
    // }

    if (this.mouseHoveredLinkMark) {
      this.linkMark = this.mouseHoveredLinkMark;
      this.linkMarkRange = this.mouseHoveredLinkMarkRange;
    }

    // Keyboard cursor position takes precedence over mouse hovered link.
    if (this.keyboardHoveredLinkMark) {
      this.linkMark = this.keyboardHoveredLinkMark;
      this.linkMarkRange = this.keyboardHoveredLinkMarkRange;
    }

    if (this.linkMark && this.editor.isEditable) {
      this.state = {
        show: true,
        referencePos: posToDOMRect(
          this.pmView,
          this.linkMarkRange!.from,
          this.linkMarkRange!.to
        ),
        url: this.linkMark!.attrs.href,
        text: this.pmView.state.doc.textBetween(
          this.linkMarkRange!.from,
          this.linkMarkRange!.to
        ),
      };
      this.emitUpdate();

      return;
    }

    // Hides menu.
    if (
      this.state?.show &&
      prevLinkMark &&
      (!this.linkMark || !this.editor.isEditable)
    ) {
      this.state.show = false;
      this.emitUpdate();

      return;
    }
  }

  destroy() {
    this.pmView.dom.removeEventListener("mouseover", this.mouseOverHandler);
    findScrollContainer(this.pmView.dom).removeEventListener("scroll", this.scrollHandler);
    document.removeEventListener("click", this.clickHandler, true);
    clearTimeout(this.timer)
  }
}


export const linkToolbarPluginKey = new PluginKey("LinkToolbarPlugin");

export class LinkToolbarProsemirrorPlugin<
  BSchema extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema
> extends EventEmitter<any> {
  private view: LinkToolbarView | undefined;
  public readonly plugin: Plugin;

  constructor(editor: BlockNoteEditor<BSchema, I, S>) {
    super();
    this.plugin = new Plugin({
      key: linkToolbarPluginKey,
      view: (editorView) => {
        this.view = new LinkToolbarView(editor, editorView, (state) => {
          this.emit("update", state);
        });
        return this.view;
      },
    });
  }

  public onUpdate(callback: (state: LinkToolbarState) => void) {
    return this.on("update", callback);
  }

  /**
   * Edit the currently hovered link.
   */
  public editLink = (url: string, text: string) => {
    this.view!.editLink(url, text);
  };

  /**
   * Delete the currently hovered link.
   */
  public deleteLink = () => {
    this.view!.deleteLink();
  };

  /**
   * When hovering on/off links using the mouse cursor, the link toolbar will
   * open & close with a delay.
   *
   * This function starts the delay timer, and should be used for when the mouse
   * cursor enters the link toolbar.
   */
  public startHideTimer = () => {
    this.view!.startMenuUpdateTimer();
  };

  /**
   * When hovering on/off links using the mouse cursor, the link toolbar will
   * open & close with a delay.
   *
   * This function stops the delay timer, and should be used for when the mouse
   * cursor exits the link toolbar.
   */
  public stopHideTimer = () => {
    this.view!.stopMenuUpdateTimer();
  };
}
