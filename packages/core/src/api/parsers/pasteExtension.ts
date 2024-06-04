import { Extension } from "@tiptap/core";
import { Plugin } from "prosemirror-state";
import type { EditorState } from '@tiptap/pm/state'
import type { BlockNoteEditor } from "../../editor/BlockNoteEditor";
import { BlockSchema, InlineContentSchema, StyleSchema } from "../../schema";
import { nestedListsToBlockNoteStructure } from "./html/util/nestedLists";
import { isNodeActive } from '@tiptap/core'

const acceptedMIMETypes = [
  "blocknote/html",
  "text/html",
  "text/plain",
] as const;
function isInCodeBlock(state: EditorState): boolean {
  try {
    return isNodeActive(state, 'codeBlock')
  } catch(err) {
    return false;
  }
  
}

interface keyMap{
  [key: string]: string
}
function escapeHTML(html: string): string {
  return html.replace(/[&<>"']/g, function(match: string) {
    const escape: keyMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return escape[match];
  });
}
export const createPasteFromClipboardExtension = <
  BSchema extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema
>(
  editor: BlockNoteEditor<BSchema, I, S>
) =>
  Extension.create<{ editor: BlockNoteEditor<BSchema, I, S> }, undefined>({
    name: "pasteFromClipboard",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            handleDOMEvents: {
              paste(_view, event) {
                event.preventDefault();
                let format: (typeof acceptedMIMETypes)[number] | null = null;
                for (const mimeType of acceptedMIMETypes) {
                  if (isInCodeBlock(_view.state) && mimeType !== 'text/plain')  {
                    continue;
                  }
                  if (event.clipboardData!.types.includes(mimeType)) {
                    format = mimeType;
                    break;
                  }
                }

                if (format !== null) {
                  let data = event.clipboardData!.getData(format);
                  
                  if (format === "text/html") {
                    const htmlNode = nestedListsToBlockNoteStructure(
                      data.trim()
                    );

                    data = htmlNode.innerHTML;                    
                  }
                  if (format === "text/plain") {
                    data = escapeHTML(data);
                    data = data.replace(/\n/g, '<br>');
                    data = data.replace(/ /g, '&nbsp;');
                    data = data.replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
                  }
                  // console.log('----data---', format, data, event.clipboardData?.getData(format), editor._tiptapEditor.view.pasteHTML)
                  editor._tiptapEditor.view.pasteHTML(data);
                }

                return true;
              },
            },
          },
        }),
      ];
    },
  });
