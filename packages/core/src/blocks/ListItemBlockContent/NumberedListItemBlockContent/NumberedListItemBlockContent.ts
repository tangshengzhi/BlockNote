import { InputRule } from "@tiptap/core";
import {
  PropSchema,
  createBlockSpecFromStronglyTypedTiptapNode,
  createStronglyTypedTiptapNode,
} from "../../../schema";
import { createDefaultBlockDOMOutputSpec } from "../../defaultBlockHelpers";
import { defaultProps } from "../../defaultProps";
import { handleEnter } from "../ListItemKeyboardShortcuts";
import { NumberedListIndexingPlugin } from "./NumberedListIndexingPlugin";
import { getCurrentBlockContentType } from "../../../api/getCurrentBlockContentType";

export const numberedListItemPropSchema = {
  ...defaultProps,
  index: {
    default: "1",
    values: Array(100).map((_, i) => `${i + 1}`) as string[],
  },
  level: {
    default: "1",
    values: Array(100).map((_, i) => `${i + 1}`) as string[],
  },
} satisfies PropSchema;

function generateIndexChar(index: number, level: number) {
  if (level % 3 === 1) {
    return index.toString();
  } else if (level % 3 === 2) {
    const base = "a".charCodeAt(0) - 1; // 'a' 的 ASCII 值减 1
    let suffix = "";
    while (index > 0) {
      let remainder = index % 26;
      if (remainder === 0) {
        remainder = 26;
      }
      suffix = String.fromCharCode(base + remainder) + suffix;
      index = Math.floor((index - remainder) / 26);
    }
    return suffix;
  } else if (level % 3 === 0) {
    return convertToRoman(index);
  } else {
    return index.toString();
  }
}

function convertToRoman(num: number) {
  const romanNumerals = [
    { value: 1000, symbol: "M" },
    { value: 900, symbol: "CM" },
    { value: 500, symbol: "D" },
    { value: 400, symbol: "CD" },
    { value: 100, symbol: "C" },
    { value: 90, symbol: "XC" },
    { value: 50, symbol: "L" },
    { value: 40, symbol: "XL" },
    { value: 10, symbol: "X" },
    { value: 9, symbol: "IX" },
    { value: 5, symbol: "V" },
    { value: 4, symbol: "IV" },
    { value: 1, symbol: "I" },
  ];

  let result = "";
  for (let i = 0; i < romanNumerals.length; i++) {
    while (num >= romanNumerals[i].value) {
      result += romanNumerals[i].symbol;
      num -= romanNumerals[i].value;
    }
  }
  return result;
}
const NumberedListItemBlockContent = createStronglyTypedTiptapNode({
  name: "numberedListItem",
  content: "inline*",
  group: "blockContent",
  addAttributes() {
    return {
      index: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-index"),
        renderHTML: (attributes) => {
          return {
            "data-index": attributes.index,
          };
        },
      },
      level: {
        default: "1",
        parseHTML: (element) => element.getAttribute("data-level"),
        renderHTML: (attributes) => {
          return {
            "data-level": attributes.level,
          };
        },
      },
    };
  },

  addInputRules() {
    return [
      // Creates an ordered list when starting with "1.".
      new InputRule({
        find: new RegExp(`^1\\.\\s$`),
        handler: ({ state, chain, range }) => {
          if (getCurrentBlockContentType(this.editor) !== "inline*") {
            return;
          }

          chain()
            .BNUpdateBlock(state.selection.from, {
              type: "numberedListItem",
              props: {},
            })
            // Removes the "1." characters used to set the list.
            .deleteRange({ from: range.from, to: range.to });
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => handleEnter(this.editor),
      "Mod-Shift-7": () => {
        if (getCurrentBlockContentType(this.editor) !== "inline*") {
          return true;
        }

        return this.editor.commands.BNUpdateBlock(
          this.editor.state.selection.anchor,
          {
            type: "numberedListItem",
            props: {},
          }
        );
      },
    };
  },

  addProseMirrorPlugins() {
    return [NumberedListIndexingPlugin()];
  },

  parseHTML() {
    return [
      {
        tag: "div[data-content-type=" + this.name + "]", // TODO: remove if we can't come up with test case that needs this
      },
      // Case for regular HTML list structure.
      // (e.g.: when pasting from other apps)
      {
        tag: "li",
        getAttrs: (element) => {
          if (typeof element === "string") {
            return false;
          }

          const parent = element.parentElement;

          if (parent === null) {
            return false;
          }

          if (
            parent.tagName === "OL" ||
            (parent.tagName === "DIV" && parent.parentElement!.tagName === "OL")
          ) {
            return {};
          }

          return false;
        },
        node: "numberedListItem",
      },
      // Case for BlockNote list structure.
      // (e.g.: when pasting from blocknote)
      {
        tag: "p",
        getAttrs: (element) => {
          if (typeof element === "string") {
            return false;
          }

          const parent = element.parentElement;

          if (parent === null) {
            return false;
          }

          if (parent.getAttribute("data-content-type") === "numberedListItem") {
            return {};
          }

          return false;
        },
        priority: 300,
        node: "numberedListItem",
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const index = Number.parseInt(node.attrs.index || "1");
    const level = Number.parseInt(node.attrs.level || "1");

    return createDefaultBlockDOMOutputSpec(
      this.name,
      // We use a <p> tag, because for <li> tags we'd need an <ol> element to
      // put them in to be semantically correct, which we can't have due to the
      // schema.
      "p",
      {
        ...(this.options.domAttributes?.blockContent || {}),
        ...HTMLAttributes,
        "data-content-type": this.name,
        "data-num-char": generateIndexChar(index, level),
      },
      this.options.domAttributes?.inlineContent || {}
    );
  },
});

export const NumberedListItem = createBlockSpecFromStronglyTypedTiptapNode(
  NumberedListItemBlockContent,
  numberedListItemPropSchema
);
