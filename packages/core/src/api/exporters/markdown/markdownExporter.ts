import { Schema } from "prosemirror-model";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { Block } from "../../../blocks/defaultBlocks";
import type { BlockNoteEditor } from "../../../editor/BlockNoteEditor";
import { BlockSchema, InlineContentSchema, StyleSchema } from "../../../schema";
import { createExternalHTMLExporter } from "../html/externalHTMLExporter";
import { removeUnderlines } from "./removeUnderlinesRehypePlugin";
import {  Parent as HASTParent } from "hast";
// import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';

export function cleanHTMLToMarkdown(cleanHTMLString: string) {
  const markdownString = unified()
    .use(rehypeParse, { fragment: true })
    .use(removeUnderlines)
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(remarkStringify)
    .processSync(cleanHTMLString);

  return markdownString.value as string;
}
export function cleanHTMLToCopyText(cleanHTMLString: string) {
  const markdownString = unified()
    .use(rehypeParse, { fragment: true })
    .use(removeUnderlines)
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(() => (tree: HASTParent) => {
      visit(tree, (node: any) => {
        if (node.type === 'table') {
          let cellNum = 0;
          let validCellChildren: any[] = [];
          node.children.forEach((tableRow: any) => {
            tableRow.children.forEach((tableCell: any) => {
              const cellIsValid = !!tableCell.children.length
              if (cellIsValid) {
                validCellChildren = tableCell.children
                cellNum++;
              }
            })
          }) 
          if (cellNum <= 1) {
            node.type = 'paragraph'
            node.children = validCellChildren;
          }
        }
        // 去除heading中携带的#
        if (['heading'].includes(node.type)) {
          node.type = 'paragraph'
        }
        
      });
    })
    .use(remarkStringify)
    .processSync(cleanHTMLString);

  return markdownString.value as string;
}

// export function cleanHTMLToCopyText(cleanHTMLString: string) {
//   let text = '';
//   unified()
//     .use(rehypeParse, {  emitParseErrors: true, duplicateAttribute: false })
//     .use(removeUnderlines)
//     .use(rehypeStringify)
//     .use(() => (tree: HASTParent) => {
//       // 递归访问节点并提取文本
//       visit(tree, (node: any) => {
//         if (node.type === 'text') {
//           text += node.value;
//         } else if(['th', 'td'].includes(node.tagName)) {
//           text += ' '
//         } else if (node.tagName === 'br') {
//           text += '\n';
//         } else if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr'].includes(node.tagName)) {
//           text += '\n';
//         }
//       });
//       // 移除多余空白字符
//       text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
//     })
//     .processSync(cleanHTMLString);
//   return text.trim();
// }


export function blocksToMarkdown<
  BSchema extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema
>(
  blocks: Block<BSchema, I, S>[],
  schema: Schema,
  editor: BlockNoteEditor<BSchema, I, S>
): string {
  const exporter = createExternalHTMLExporter(schema, editor);
  const externalHTML = exporter.exportBlocks(blocks);

  return cleanHTMLToMarkdown(externalHTML);
}
