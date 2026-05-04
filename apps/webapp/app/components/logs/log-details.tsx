interface Label {
  id: string;
  name: string;
  color: string;
}

interface Document {
  id: string;
  title?: string;
  content?: string;
  createdAt: string | Date;
  status?: string;
  source?: string;
  labelIds?: string[];
  [key: string]: unknown;
}

interface LogDetailsProps {
  document: Document;
  labels: Label[];
}

export function LogDetails({ document, labels }: LogDetailsProps) {
  const getLabelNames = (labelIds?: string[]) => {
    if (!labelIds || !labels) return [];
    return labelIds
      .map((id) => labels.find((l) => l.id === id))
      .filter(Boolean);
  };

  const docLabels = getLabelNames(document.labelIds);

  return (
    <div className="p-4 h-full overflow-auto">
      <h2 className="text-xl font-bold mb-4">{document.title || "Untitled Document"}</h2>
      
      {docLabels.length > 0 && (
        <div className="flex gap-2 mb-4">
          {docLabels.map((label) => (
            <span
              key={label!.id}
              className="text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: label!.color + "20", color: label!.color }}
            >
              {label!.name}
            </span>
          ))}
        </div>
      )}

      <div className="text-sm text-muted-foreground mb-4">
        Source: {document.source || "Unknown"} | Status: {document.status || "N/A"}
      </div>

      <div className="prose prose-sm max-w-none">
        {document.content || "No content available."}
      </div>
    </div>
  );
}
