import { Extension } from "@tiptap/core";

export const SlashCommand = Extension.create({
  name: "slashCommand",
});

export function buildSlashCommand(options?: { items?: unknown[] }) {
  return SlashCommand;
}
