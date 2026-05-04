import { RiGithubFill, RiMailFill, RiLinkedinFill } from "@remixicon/react";
import { Code, Globe, LayoutGrid, RefreshCw } from "lucide-react";
import { BacklogLine } from "./icons/backlog";
import { TodoLine } from "./icons/todo";
import { InProgressLine } from "./icons/in-progress";
import { BlockedLine } from "./icons/blocked";
import { DoneFill } from "./icons/done";
import { TaskStatus } from "@core/database";
import { Task } from "./icons/task";
import { InReviewLine } from "./icons/in-review-line";

export const ICON_MAPPING = {
  slack: LayoutGrid,
  email: RiMailFill,
  github: RiGithubFill,
  linkedin: RiLinkedinFill,
  gmail: RiMailFill,
  "google-calendar": Globe,
  "google-sheets": LayoutGrid,
  "google-docs": LayoutGrid,
  linear: LayoutGrid,
  cursor: Code,
  claude: Code,
  "claude-code": Code,
  cline: Code,
  codex: Code,
  chatgpt: Code,
  gemini: Code,
  windsurf: Code,
  vscode: Code,
  obsidian: LayoutGrid,
  figma: LayoutGrid,
  core: Code,
  persona: Code,
  zed: Code,
  kilo: Code,
  cal_com: LayoutGrid,
  notion: LayoutGrid,
  zoho: LayoutGrid,
  hubspot: LayoutGrid,
  discord: LayoutGrid,
  todoist: LayoutGrid,
  ghost: LayoutGrid,
  fireflies: LayoutGrid,
  whatsapp: LayoutGrid,
  metabase: LayoutGrid,
  resend: LayoutGrid,
  ynab: LayoutGrid,
  jira: LayoutGrid,
  confluence: LayoutGrid,
  mixpanel: LayoutGrid,
  stripe: LayoutGrid,
  cli: Code,
  "core-extension": Code,
  task: Task,
  spotify: LayoutGrid,
  integration: LayoutGrid,
};

export type IconType = keyof typeof ICON_MAPPING;

export function getIcon(icon: IconType) {
  return ICON_MAPPING[icon] || ICON_MAPPING["integration"];
}

export const getIconForAuthorise = (
  name: string,
  size = 40,
  image?: string,
) => {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className="rounded"
        style={{ height: size, width: size }}
      />
    );
  }

  const lowerName = name.toLowerCase();
  const IconComponent = ICON_MAPPING[lowerName as IconType] || LayoutGrid;

  return <IconComponent size={size} />;
};

export const TaskStatusIcons: Record<TaskStatus, React.ElementType> = {
  Todo: TodoLine,
  Waiting: BlockedLine,
  Ready: TodoLine,
  Working: InProgressLine,
  Review: InReviewLine,
  Done: DoneFill,
  Recurring: RefreshCw,
};
