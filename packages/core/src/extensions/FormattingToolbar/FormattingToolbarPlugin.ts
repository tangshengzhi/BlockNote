import { isNodeSelection, posToDOMRect } from "@tiptap/core";
import { EditorState, Plugin, PluginKey } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import type { BlockNoteEditor } from "../../editor/BlockNoteEditor";
import {
  BaseUiElementCallbacks,
  BaseUiElementState,
<<<<<<< HEAD
} from "../../extensions-shared/BaseUiElementTypes";
import { BlockSchema, InlineContentSchema, StyleSchema } from "../../schema";
import { EventEmitter } from "../../util/EventEmitter";
=======
  BlockNoteEditor,
  BlockSchema,
  findScrollContainer,
} from "../..";
import { EventEmitter } from "../../shared/EventEmitter";
>>>>>>> mine

export type FormattingToolbarCallbacks = BaseUiElementCallbacks;

export type FormattingToolbarState = BaseUiElementState;

export class FormattingToolbarView {
  private formattingToolbarState?: FormattingToolbarState;
  public updateFormattingToolbar: () => void;

  public preventHide = false;
  public preventShow = false;
  public prevWasEditable: boolean | null = null;

  private scrollableContainer: HTMLElement | Document | null = null;

  public shouldShow: (props: {
    view: EditorView;
    state: EditorState;
    from: number;
    to: number;
  }) => boolean = ({ state }) => !state.selection.empty;

  constructor(
    private readonly editor: BlockNoteEditor<
      BlockSchema,
      InlineContentSchema,
      StyleSchema
    >,
    private readonly pmView: EditorView,
    updateFormattingToolbar: (
      formattingToolbarState: FormattingToolbarState
    ) => void
  ) {
    this.updateFormattingToolbar = () => {
      if (!this.formattingToolbarState) {
        throw new Error(
          "Attempting to update uninitialized formatting toolbar"
        );
      }

      updateFormattingToolbar(this.formattingToolbarState);
    };

    pmView.dom.addEventListener("dragstart", this.dragstartHandler);

    pmView.dom.addEventListener("focus", this.focusHandler);
    pmView.dom.addEventListener("blur", this.blurHandler);

    setTimeout(() => {
      this.scrollableContainer = findScrollContainer(pmView.dom) || pmView.dom;
      this.scrollableContainer.addEventListener("scroll", this.scrollHandler);
      this.scrollableContainer.addEventListener(
        "mousedown",
        this.viewMousedownHandler
      );
      this.scrollableContainer.addEventListener(
        "mouseup",
        this.viewMouseupHandler
      );
    });
  }

  viewMousedownHandler = () => {
    this.preventShow = true;
  };

  viewMouseupHandler = () => {
    this.preventShow = false;
    setTimeout(() => this.update(this.pmView));
  };

  // For dragging the whole editor.
  dragstartHandler = () => {
    if (this.formattingToolbarState?.show) {
      this.formattingToolbarState.show = false;
      this.updateFormattingToolbar();
    }
  };

  focusHandler = () => {
    // we use `setTimeout` to make sure `selection` is already updated
    setTimeout(() => this.update(this.pmView));
  };

  blurHandler = (event: FocusEvent) => {
    if (this.preventHide) {
      this.preventHide = false;

      return;
    }

    const editorWrapper = this.pmView.dom.parentElement!;

    // Checks if the focus is moving to an element outside the editor. If it is,
    // the toolbar is hidden.
    if (
      // An element is clicked.
      event &&
      event.relatedTarget &&
      // Element is inside the editor.
      (editorWrapper === (event.relatedTarget as Node) ||
        editorWrapper.contains(event.relatedTarget as Node))
    ) {
      return;
    }

    if (this.formattingToolbarState?.show) {
      this.formattingToolbarState.show = false;
      this.updateFormattingToolbar();
    }
  };

  scrollHandler = () => {
    if (this.formattingToolbarState) {
      this.formattingToolbarState.referencePos = this.getSelectionBoundingBox();
      this.updateFormattingToolbar();
    }
  };

  update(view: EditorView, oldState?: EditorState) {
    const { state, composing } = view;
    const { doc, selection } = state;
    const isSame =
      oldState && oldState.doc.eq(doc) && oldState.selection.eq(selection);

    if (
      (this.prevWasEditable === null ||
        this.prevWasEditable === this.editor.isEditable) &&
      (composing || isSame)
    ) {
      return;
    }

    this.prevWasEditable = this.editor.isEditable;

    // support for CellSelections
    const { ranges } = selection;
    const from = Math.min(...ranges.map((range) => range.$from.pos));
    const to = Math.max(...ranges.map((range) => range.$to.pos));

    const shouldShow = this.shouldShow?.({
      view,
      state,
      from,
      to,
    });

    // Checks if menu should be shown/updated.
    if (
      this.editor.isEditable &&
      !this.preventShow &&
      (shouldShow || this.preventHide)
    ) {
      this.formattingToolbarState = {
        show: true,
        referencePos: this.getSelectionBoundingBox(),
      };

      this.updateFormattingToolbar();

      return;
    }

    // Checks if menu should be hidden.
    if (
      this.formattingToolbarState?.show &&
      !this.preventHide &&
      (!shouldShow || this.preventShow || !this.editor.isEditable)
    ) {
      this.formattingToolbarState.show = false;
      this.updateFormattingToolbar();

      return;
    }
  }

  destroy() {
    this.scrollableContainer?.removeEventListener(
      "mousedown",
      this.viewMousedownHandler
    );
    this.scrollableContainer?.removeEventListener(
      "mouseup",
      this.viewMouseupHandler
    );
    this.pmView.dom.removeEventListener("dragstart", this.dragstartHandler);

    this.pmView.dom.removeEventListener("focus", this.focusHandler);
    this.pmView.dom.removeEventListener("blur", this.blurHandler);

    this.scrollableContainer?.removeEventListener("scroll", this.scrollHandler);
  }

  getSelectionBoundingBox() {
    const { state } = this.pmView;
    const { selection } = state;

    // support for CellSelections
    const { ranges } = selection;
    const from = Math.min(...ranges.map((range) => range.$from.pos));
    const to = Math.max(...ranges.map((range) => range.$to.pos));

    if (isNodeSelection(selection)) {
      const node = this.pmView.nodeDOM(from) as HTMLElement;

      if (node?.getBoundingClientRect) {
        return node.getBoundingClientRect();
      }
    }

    return posToDOMRect(this.pmView, from, to);
  }
}

export const formattingToolbarPluginKey = new PluginKey(
  "FormattingToolbarPlugin"
);

export class FormattingToolbarProsemirrorPlugin extends EventEmitter<any> {
  private view: FormattingToolbarView | undefined;
  public readonly plugin: Plugin;

  constructor(editor: BlockNoteEditor<any, any, any>) {
    super();
    this.plugin = new Plugin({
      key: formattingToolbarPluginKey,
      view: (editorView) => {
        this.view = new FormattingToolbarView(editor, editorView, (state) => {
          this.emit("update", state);
        });
        return this.view;
      },
    });
  }

  public onUpdate(callback: (state: FormattingToolbarState) => void) {
    return this.on("update", callback);
  }
}
