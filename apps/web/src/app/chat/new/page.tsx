import { ChatPanel } from "@/components/ChatPanel";
import { AppShell } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";

export default function NewChatPage() {
  return (
    <AppShell>
      <SectionCard title="新对话" eyebrow="AI 对话">
        <div className="composer" style={{ height: "calc(100vh - 200px)" }}>
          <ChatPanel />
        </div>
      </SectionCard>
    </AppShell>
  );
}
