import { useRef, useCallback } from "react";

interface Label {
  id: string;
  name: string;
  color: string;
}

interface DocumentItem {
  id: string;
  title?: string;
  content?: string;
  createdAt: string | Date;
  status?: string;
  source?: string;
  labelIds?: string[];
}

interface VirtualLogsListProps {
  documents: DocumentItem[];
  hasMore: boolean;
  loadMore: () => void;
  isLoading: boolean;
  height: number;
  labels: Label[];
}

export function VirtualLogsList({
  documents,
  hasMore,
  loadMore,
  isLoading,
  height,
  labels,
}: VirtualLogsListProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [isLoading, hasMore, loadMore],
  );

  const getLabelNames = (labelIds?: string[]) => {
    if (!labelIds || !labels) return [];
    return labelIds
      .map((id) => labels.find((l) => l.id === id))
      .filter(Boolean)
      .map((l) => l!.name);
  };

  return (
    <div className="overflow-auto" style={{ height }}>
      {documents.map((doc, index) => (
        <div
          key={doc.id}
          ref={index === documents.length - 1 ? lastElementRef : undefined}
          className="border-b p-4 hover:bg-muted/50"
        >
          <div className="font-medium">{doc.title || "Untitled"}</div>
          <div className="text-sm text-muted-foreground truncate">
            {doc.content?.slice(0, 100)}
          </div>
          <div className="flex gap-2 mt-2">
            {getLabelNames(doc.labelIds).map((name) => (
              <span key={name} className="text-xs bg-primary/10 px-2 py-0.5 rounded">
                {name}
              </span>
            ))}
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="p-4 text-center text-muted-foreground">Loading...</div>
      )}
    </div>
  );
}
