interface LogOptionsProps {
  logId?: string;
  id?: string;
}

export function LogOptions({ logId, id }: LogOptionsProps) {
  const resolvedLogId = logId ?? id ?? "";

  return (
    <div className="flex gap-2">
      <button
        className="text-sm text-muted-foreground hover:text-foreground"
        onClick={() => {
          navigator.clipboard.writeText(resolvedLogId);
        }}
      >
        Copy ID
      </button>
      <button
        className="text-sm text-destructive hover:text-destructive/80"
        onClick={() => {
          if (confirm("Are you sure you want to delete this document?")) {
            fetch(`/api/v1/documents/${resolvedLogId}`, { method: "DELETE" });
          }
        }}
      >
        Delete
      </button>
    </div>
  );
}
