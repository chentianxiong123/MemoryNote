import { AppShell } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";

export default function MemoryGraphPage() {
  return (
    <AppShell>
      <SectionCard title="知识工作台" eyebrow="知识图谱可视化">
        <div className="empty-state" style={{ minHeight: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div style={{ fontSize: "3rem" }}>🕸️</div>
          <p style={{ fontSize: "1.1rem", color: "var(--text-soft)", margin: 0 }}>
            知识图谱尚未生成
          </p>
          <p style={{ fontSize: "0.9rem", color: "var(--text-soft)", margin: 0, textAlign: "center", maxWidth: 320 }}>
            与 AI 对话后,系统会自动从对话中提取实体、关系和事件,构建你的知识图谱。
          </p>
        </div>
      </SectionCard>
    </AppShell>
  );
}
