import { type Dispatch, type SetStateAction } from "react";

interface Label {
  id: string;
  name: string;
  color: string;
}

interface LogsFiltersProps {
  availableSources?: { name: string; slug: string }[];
  selectedSource?: string;
  selectedStatus?: string;
  selectedLabel?: string;
  labels: Label[];
  onSourceChange: Dispatch<SetStateAction<string | undefined>>;
  onStatusChange: Dispatch<SetStateAction<string | undefined>>;
  onLabelChange: Dispatch<SetStateAction<string | undefined>>;
}

export function LogsFilters({
  availableSources,
  selectedSource,
  selectedStatus,
  selectedLabel,
  labels,
  onSourceChange,
  onStatusChange,
  onLabelChange,
}: LogsFiltersProps) {
  return (
    <div className="flex gap-4 p-4">
      {availableSources && availableSources.length > 0 && (
        <select
          value={selectedSource ?? ""}
          onChange={(e) => onSourceChange(e.target.value || undefined)}
          className="border rounded px-2 py-1"
        >
          <option value="">All Sources</option>
          {availableSources.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <select
        value={selectedStatus ?? ""}
        onChange={(e) => onStatusChange(e.target.value || undefined)}
        className="border rounded px-2 py-1"
      >
        <option value="">All Status</option>
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
      </select>
      {labels && labels.length > 0 && (
        <select
          value={selectedLabel ?? ""}
          onChange={(e) => onLabelChange(e.target.value || undefined)}
          className="border rounded px-2 py-1"
        >
          <option value="">All Labels</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
