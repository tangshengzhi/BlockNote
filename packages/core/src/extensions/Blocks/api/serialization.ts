import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { DOMSerializer, Schema } from "prosemirror-model";

const customBlockSerializer = (schema: Schema) => {
  const defaultSerializer = DOMSerializer.fromSchema(schema);

  return new DOMSerializer(
    {
      ...defaultSerializer.nodes,
      // TODO: If a serializer is defined in the config for a custom block, it
      //  should be added here. We still need to figure out how the serializer
      //  should be defined in the custom blocks API though, and implement that,
      //  before we can do this.
    },
    defaultSerializer.marks
  );
};
export const CustomBlockSerializerExtension = Extension.create({
  name: "customBlockSerializer",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("customBlockSerializer"),
        props: {
          clipboardSerializer: customBlockSerializer(this.editor.schema),
        },
      }),
    ];
  },
});
