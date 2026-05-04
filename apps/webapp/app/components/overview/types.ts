export interface OverviewItem {
  id: string;
  title: string;
  type: "document" | "conversation" | "note";
  createdAt: Date;
  updatedAt: Date;
}

export interface OverviewFilter {
  type?: "document" | "conversation" | "note";
  search?: string;
}

export interface WidgetOption {
  type: string;
  label: string;
  data?: Record<string, unknown>;
}

export type { default as DocumentEditorViewClient } from "../logs/views/document-editor-view.client";
