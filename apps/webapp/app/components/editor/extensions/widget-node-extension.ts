import { Extension, Node } from "@tiptap/core";

export interface WidgetOptions {
  type?: string;
  data?: Record<string, unknown>;
}

export const WidgetNode = Node.create({
  name: "widgetNode",
});

export const WidgetContext = Extension.create({
  name: "widgetContext",
});

export const WidgetNodeExtension = Extension.create({
  name: "widgetNode",
});
