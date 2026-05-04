interface Document {
  id?: string;
  title?: string | null;
  content?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface DocumentEditorViewProps {
  documentId?: string;
  document?: Document;
  editor?: unknown;
  editable?: boolean;
}

export default function DocumentEditorView({ documentId, document, editor, editable }: DocumentEditorViewProps) {
  return (
    <div className="document-editor-view">
      {document?.title && (
        <h2 className="text-lg font-semibold mb-2">{document.title}</h2>
      )}
      {document?.content && (
        <div className="prose prose-sm max-w-none">
          {document.content}
        </div>
      )}
    </div>
  );
}
