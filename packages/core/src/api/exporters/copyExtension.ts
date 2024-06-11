import { Extension } from "@tiptap/core";
import { NodeSelection, Plugin } from "prosemirror-state";
import { Node } from "prosemirror-model";

import type { BlockNoteEditor } from "../../editor/BlockNoteEditor";
import { BlockSchema, InlineContentSchema, StyleSchema } from "../../schema";
import { createExternalHTMLExporter } from "./html/externalHTMLExporter";
import { createInternalHTMLSerializer } from "./html/internalHTMLSerializer";
import { cleanHTMLToCopyText } from "./markdown/markdownExporter";
// cleanHTMLToCopyText
import { EditorView } from "prosemirror-view";

function selectedFragmentToHTML<
  BSchema extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema
>(
  view: EditorView,
  editor: BlockNoteEditor<BSchema, I, S>
): {
  internalHTML: string;
  externalHTML: string;
  plainText: string;
} {
  const selectedFragment = view.state.selection.content().content;

  const internalHTMLSerializer = createInternalHTMLSerializer(
    view.state.schema,
    editor
  );
  const internalHTML =
    internalHTMLSerializer.serializeProseMirrorFragment(selectedFragment);

  const externalHTMLExporter = createExternalHTMLExporter(
    view.state.schema,
    editor
  );
  let externalHTML =
    externalHTMLExporter.exportProseMirrorFragment(selectedFragment);
  externalHTML = transformExternalHtml(externalHTML).innerHTML
  const plainText = cleanHTMLToCopyText(externalHTML)
  // const plainText = cleanHTMLToCopyText(externalHTML);
  // console.log('-plainText---', cleanHTMLToCopyText(externalHTML), '----分割线--',cleanHTMLToMarkdown(externalHTML))
  return { internalHTML, externalHTML, plainText };
}
export function transformExternalHtml(html: string) {
  const oDiv = document.createElement("div");
  oDiv.innerHTML = html;
  oDiv.querySelectorAll('[data-type="inlineTips"]').forEach((outputDom: Element) => {
    if (outputDom?.parentElement) {
      const container = document.createElement("span");
      const newChild = document.createElement("a");
      const link = outputDom.getAttribute("data-tip-link") || "";
      newChild.href = link;
      newChild.innerHTML = link;
      const textNode1 = document.createTextNode(" ");
      const textNode2 = document.createTextNode(" ");
      container.appendChild(textNode1);
      container.appendChild(newChild);
      container.appendChild(textNode2);
      outputDom.parentElement.replaceChild(container, outputDom);
    }
  });
  return oDiv;
}
export const createCopyToClipboardExtension = <
  BSchema extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema
>(
  editor: BlockNoteEditor<BSchema, I, S>
) =>
  Extension.create<{ editor: BlockNoteEditor<BSchema, I, S> }, undefined>({
    name: "copyToClipboard",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            handleDOMEvents: {
              copy(view, event) {
                // Stops the default browser copy behaviour.
                event.preventDefault();
                event.clipboardData!.clearData();

                // Checks if a `blockContent` node is being copied and expands
                // the selection to the parent `blockContainer` node. This is
                // for the use-case in which only a block without content is
                // selected, e.g. an image block.
                if (
                  "node" in view.state.selection &&
                  (view.state.selection.node as Node).type.spec.group ===
                    "blockContent"
                ) {
                  view.dispatch(
                    view.state.tr.setSelection(
                      new NodeSelection(
                        view.state.doc.resolve(view.state.selection.from - 1)
                      )
                    )
                  );
                }

                const { internalHTML, externalHTML, plainText } =
                  selectedFragmentToHTML(view, editor);

                // TODO: Writing to other MIME types not working in Safari for
                //  some reason.
                event.clipboardData!.setData("blocknote/html", internalHTML);
                event.clipboardData!.setData("text/html", externalHTML);
                event.clipboardData!.setData("text/plain", plainText);

                // Prevent default PM handler to be called
                return true;
              },
              // This is for the use-case in which only a block without content
              // is selected, e.g. an image block, and dragged (not using the
              // drag handle).
              dragstart(view, event) {
                // Checks if a `NodeSelection` is active.
                if (!("node" in view.state.selection)) {
                  return;
                }

                // Checks if a `blockContent` node is being dragged.
                if (
                  (view.state.selection.node as Node).type.spec.group !==
                  "blockContent"
                ) {
                  return;
                }

                // Expands the selection to the parent `blockContainer` node.
                view.dispatch(
                  view.state.tr.setSelection(
                    new NodeSelection(
                      view.state.doc.resolve(view.state.selection.from - 1)
                    )
                  )
                );

                // Stops the default browser drag start behaviour.
                event.preventDefault();
                event.dataTransfer!.clearData();

                const { internalHTML, externalHTML, plainText } =
                  selectedFragmentToHTML(view, editor);

                // TODO: Writing to other MIME types not working in Safari for
                //  some reason.
                event.dataTransfer!.setData("blocknote/html", internalHTML);
                event.dataTransfer!.setData("text/html", externalHTML);
                event.dataTransfer!.setData("text/plain", plainText);

                // Prevent default PM handler to be called
                return true;
              },
            },
          },
        }),
      ];
    },
  });
