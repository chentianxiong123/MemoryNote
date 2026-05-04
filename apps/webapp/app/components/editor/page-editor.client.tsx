import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import TaskList from "@tiptap/extension-task-list";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { all, createLowlight } from "lowlight";
import { mergeAttributes } from "@tiptap/core";
import { cx } from "class-variance-authority";

import { ScratchpadTaskItem } from "~/components/editor/extensions/scratchpad-task-item";
import { buildMentionExtension } from "~/components/editor/extensions/mention-extension";
import { buildSlashCommand } from "~/components/editor/extensions/slash-command";
import { TaskPickerExtension } from "~/components/editor/extensions/task-picker-extension";
import { ChecklistInputRule } from "~/components/editor/extensions/checklist-input-rule";
import { SelectionBubble } from "~/components/editor/selection-bubble";
import { ConversationParagraph } from "~/components/editor/extensions/conversation-paragraph-extension";
import { ConversationPopover } from "~/components/editor/conversation-popover";
import { useButlerComments } from "~/components/editor/hooks/use-butler-comments";
import {
  WidgetNode,
  WidgetContext,
} from "~/components/editor/extensions/widget-node-extension";

const lowlight = createLowlight(all);

function buildExtensions(
  pageId: string,
  isToday: boolean,
  butlerName: string,
  ydoc: Y.Doc,
  parentTaskId?: string,
  widgetOptions: unknown[] = [],
) {
  const heading = Heading.extend({
    renderHTML({ node, HTMLAttributes }) {
      const level: 1 | 2 | 3 = node.attrs.level;
      const levelMap: Record<number, string> = {
        1: "text-2xl",
        2: "text-xl",
        3: "text-lg",
      };
      return [
        `h${level}`,
        mergeAttributes(HTMLAttributes, {
          class: `h${level}-style ${levelMap[level] ?? "text-base"} mt-4 font-medium`,
        }),
        0,
      ];
    },
  }).configure({ levels: [1, 2, 3] });

  return [
    StarterKit.configure({
      heading: false,
      bulletList: {
        HTMLAttributes: {
          class: cx("list-disc list-outside pl-4 leading-1 my-1"),
        },
      },
      orderedList: {
        HTMLAttributes: {
          class: cx("list-decimal list-outside pl-4 leading-1 my-1"),
        },
      },
      listItem: { HTMLAttributes: { class: cx("mt-1.5") } },
      blockquote: {
        HTMLAttributes: { class: cx("border-l-4 border-border pl-2") },
      },
      paragraph: false,
      codeBlock: false,
      code: {
        HTMLAttributes: {
          class: cx(
            "rounded bg-grayAlpha-50 text-muted-foreground border border-border px-1.5 py-0 font-mono",
          ),
          spellcheck: "false",
        },
      },
      horizontalRule: false,
      dropcursor: { color: "#DBEAFE", width: 4 },
      gapcursor: false,
      link: {
        HTMLAttributes: { class: "text-primary cursor-pointer" },
        openOnClick: false,
      },
    }),
    heading,
    TaskList.configure({
      HTMLAttributes: { class: cx("list-none pl-0 my-1") },
    }),
    ScratchpadTaskItem,
    CodeBlockLowlight.configure({ lowlight }),
    Placeholder.configure({
      placeholder: "Write notes...",
      includeChildren: true,
    }),
    ConversationParagraph,
    ChecklistInputRule,
    buildMentionExtension(butlerName),
    buildSlashCommand({ items: widgetOptions }),
    TaskPickerExtension,
    WidgetNode,
  ];
}

function EditorInner({
  pageId,
  isToday,
  butlerName,
  minHeight,
  parentTaskId,
  ydoc,
}: {
  pageId: string;
  isToday: boolean;
  butlerName: string;
  collabToken: string;
  minHeight: string;
  parentTaskId?: string;
  ydoc: Y.Doc;
}) {
  const [activeConversation, setActiveConversation] = useState<{
    conversationId: string;
    rect: DOMRect;
    resolved: boolean;
  } | null>(null);

  const widgetCtx = null;

  const extensions = useMemo(
    () =>
      buildExtensions(
        pageId,
        isToday,
        butlerName,
        ydoc,
        parentTaskId,
        [],
      ),
    [pageId, isToday, butlerName, ydoc, parentTaskId],
  );

  const editorProps = useMemo(
    () => ({
      attributes: {
        class: "prose prose-sm focus:outline-none max-w-full py-1",
        style: `min-height: ${minHeight}`,
      },
      handleClick(view: unknown, pos: number) {
        // Simplified - no conversation handling
        setActiveConversation(null);
        return false;
      },
    }),
    [minHeight],
  );

  const editor = useEditor({
    extensions,
    editorProps,
  });

  const { resolveComment } = useButlerComments({ documentId: pageId });

  const handleResolvedChange = React.useCallback(
    (conversationId: string, resolved: boolean) => {
      resolveComment(conversationId, resolved);
      setActiveConversation((current) =>
        current?.conversationId === conversationId
          ? { ...current, resolved }
          : current,
      );
    },
    [resolveComment],
  );

  return (
    <>
      <SelectionBubble editor={editor} parentTaskId={parentTaskId} />
      <EditorContent editor={editor} className="w-full" />
      <ConversationPopover
        conversationId={activeConversation?.conversationId ?? null}
        anchorRect={activeConversation?.rect ?? null}
        resolved={activeConversation?.resolved ?? false}
        butlerName={butlerName}
        onResolvedChange={handleResolvedChange}
        onClose={() => setActiveConversation(null)}
      />
    </>
  );
}

export interface PageEditorProps {
  pageId: string;
  collabToken: string;
  butlerName: string;
  isToday?: boolean;
  parentTaskId?: string;
  minHeight?: string;
}

export function PageEditor({
  pageId,
  collabToken,
  butlerName,
  isToday = false,
  parentTaskId,
  minHeight = "400px",
}: PageEditorProps) {
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    let destroyed = false;
    const idb = new IndexeddbPersistence(pageId, doc);
    const onSynced = () => {
      if (!destroyed) setYdoc(doc);
    };
    idb.on("synced", onSynced);
    const fallback = setTimeout(() => {
      if (!destroyed) setYdoc(doc);
    }, 300);

    return () => {
      destroyed = true;
      clearTimeout(fallback);
      idb.off("synced", onSynced);
      doc.destroy();
      setYdoc(null);
    };
  }, [pageId]);

  if (!ydoc) return <div style={{ minHeight }} />;

  return (
    <EditorInner
      pageId={pageId}
      isToday={isToday}
      butlerName={butlerName}
      collabToken={collabToken}
      minHeight={minHeight}
      parentTaskId={parentTaskId}
      ydoc={ydoc}
    />
  );
}

export function DayEditor({
  pageId,
  collabToken,
  butlerName,
  isToday,
}: {
  pageId: string;
  collabToken: string;
  butlerName: string;
  isToday: boolean;
}) {
  return (
    <PageEditor
      pageId={pageId}
      collabToken={collabToken}
      butlerName={butlerName}
      isToday={isToday}
    />
  );
}
