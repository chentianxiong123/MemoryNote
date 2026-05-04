import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { type Label } from "@prisma/client";

interface LabelDropdownProps {
  value?: string | string[];
  onChange?: (value: string) => void;
  labels?: Label[];
}

export default function LabelDropdown({ value, onChange, labels = [] }: LabelDropdownProps) {
  const selectedValue = Array.isArray(value) ? value[0] : value;

  return (
    <Select value={selectedValue} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select label" />
      </SelectTrigger>
      <SelectContent>
        {labels.length > 0 ? (
          labels.map((label) => (
            <SelectItem key={label.id} value={label.id}>
              {label.name}
            </SelectItem>
          ))
        ) : (
          <>
            <SelectItem value="important">Important</SelectItem>
            <SelectItem value="work">Work</SelectItem>
            <SelectItem value="personal">Personal</SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
