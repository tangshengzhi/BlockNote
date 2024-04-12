import { Schema } from "prosemirror-model";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype, { defaultHandlers } from "remark-rehype";
import { unified } from "unified";
import { Block } from "../../../blocks/defaultBlocks";
import { BlockSchema, InlineContentSchema, StyleSchema } from "../../../schema";
import { HTMLToBlocks } from "../html/parseHTML";

// modified version of https://github.com/syntax-tree/mdast-util-to-hast/blob/main/lib/handlers/code.js
// that outputs a data-language attribute instead of a CSS class (e.g.: language-typescript)
function code(state: any, node: any) {
  const value = node.value ? node.value + "\n" : "";
  /** @type {Properties} */
  const properties: any = {};

  if (node.lang) {
    // changed line
    properties["data-language"] = node.lang;
  }

  // Create `<code>`.
  /** @type {Element} */
  let result: any = {
    type: "element",
    tagName: "code",
    properties,
    children: [{ type: "text", value }],
  };

  if (node.meta) {
    result.data = { meta: node.meta };
  }

  state.patch(node, result);
  result = state.applyData(node, result);

  // Create `<pre>`.
  result = {
    type: "element",
    tagName: "pre",
    properties: {},
    children: [result],
  };
  state.patch(node, result);
  return result;
}

function decryptLink(encryptedLink: string): string {
  const KEY = 42; // 解密密钥，必须与加密密钥相同
  let decryptedLink = "";
  for (let i = 0; i < encryptedLink.length; i++)
    decryptedLink += String.fromCharCode(encryptedLink.charCodeAt(i) ^ KEY);

  return decryptedLink;
}
export function decryptLinks(text: string) {
  const regex = /\{\{\{(\d+)-(.+?)\}\}\}/g;
  return text.replaceAll(regex, (match, citationNumber, encryptedLink) => {
    const decryptedLink = decryptLink(encryptedLink); // 解密链接
    return `{{{${citationNumber}-${decryptedLink}}}}`;
  });
}
export function transformCitation(text: string) {
  const decryptText = decryptLinks(text);
  return decryptText?.replaceAll(
    /\{\{\{(\d+)-(.+?)\}\}\}/g,
    (match, citationNumber, encryptedLink) => {
      return `<span data-type='inlineTips' data-tip-link='${encryptedLink}' data-tip-id='${citationNumber}'>${citationNumber}</span>`;
    }
  );
}


export function markdownToBlocks<
  BSchema extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema
>(
  markdown: string,
  blockSchema: BSchema,
  icSchema: I,
  styleSchema: S,
  pmSchema: Schema
): Promise<Block<BSchema, I, S>[]> {
  const htmlString = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, {
      handlers: {
        ...(defaultHandlers as any),
        code,
      },
    })
    .use(rehypeStringify)
    .processSync(markdown);

  return HTMLToBlocks(
    // htmlString.value as string,
    transformCitation(htmlString.value as string),
    blockSchema,
    icSchema,
    styleSchema,
    pmSchema
  );
}
