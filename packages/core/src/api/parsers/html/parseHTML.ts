import { DOMParser, Schema } from "prosemirror-model";
import { BlockSchema, InlineContentSchema, StyleSchema } from "../../../schema";

import { Block } from "../../../blocks/defaultBlocks";
import { nodeToBlock } from "../../nodeConversions/nodeConversions";
import { nestedListsToBlockNoteStructure } from "./util/nestedLists";

function setItemLevel(dom: HTMLElement, currentLevel: number) {
  if (dom.tagName === "OL" || dom.tagName === "UL") {
    currentLevel++;
  }

  if (dom.tagName === "LI") {
    dom.dataset["level"] = `${currentLevel}`;
  }

  dom.childNodes.forEach((child) => {
    if (child instanceof HTMLElement) {
      setItemLevel(child, currentLevel);
    }
  });
}


export async function HTMLToBlocks<
  BSchema extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema
>(
  html: string,
  blockSchema: BSchema,
  icSchema: I,
  styleSchema: S,
  pmSchema: Schema
): Promise<Block<BSchema, I, S>[]> {
  const htmlNode = nestedListsToBlockNoteStructure(html);
  const parser = DOMParser.fromSchema(pmSchema);

  htmlNode.querySelectorAll("ol").forEach((ol) => {
    ol.querySelectorAll("&>li").forEach((li, index) => {
      (li as HTMLLIElement).dataset["index"] = `${index + 1}`;
    });
    ol.removeAttribute("start")
  });
  setItemLevel(htmlNode, 0);
  // Other approach might be to use
  // const doc = pmSchema.nodes["doc"].createAndFill()!;
  // and context: doc.resolve(3),

  const parentNode = parser.parse(htmlNode, {
    topNode: pmSchema.nodes["blockGroup"].create(),
  });

  const blocks: Block<BSchema, I, S>[] = [];

  for (let i = 0; i < parentNode.childCount; i++) {
    blocks.push(
      nodeToBlock(parentNode.child(i), blockSchema, icSchema, styleSchema)
    );
  }

  return blocks;
}
