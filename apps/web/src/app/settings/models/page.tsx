import { prisma } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { SectionCard } from "@/components/SectionCard";

export const dynamic = "force-dynamic";

async function getModelData() {
  const [providers, models] = await Promise.all([
    prisma.lLMProvider.findMany({ orderBy: { name: "asc" } }),
    prisma.lLMModel.findMany({
      include: { provider: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { providers, models };
}

export default async function SettingsModelsPage() {
  const { providers, models } = await getModelData();

  return (
    <AppShell>
      <SectionCard title="模型设置" eyebrow="工作区模型路由、API Key">
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            提供商
          </h4>
          {providers.length === 0 ? (
            <p className="empty-state">暂无提供商配置</p>
          ) : (
            <div className="data-table">
              <div className="data-table__row data-table__row--head">
                <span>类型</span>
                <span>名称</span>
                <span>URL</span>
                <span>状态</span>
              </div>
              {providers.map((p) => (
                <div key={p.id} className="data-table__row">
                  <span style={{ fontWeight: 500 }}>{p.type}</span>
                  <span>{p.name}</span>
                  <span style={{ color: "var(--text-soft)" }}>{JSON.stringify(p.config) || "{}"}</span>
                  <span>{p.isActive ? <span style={{ color: "#16a34a" }}>✓ 激活</span> : "停用"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            模型列表
          </h4>
          {models.length === 0 ? (
            <p className="empty-state">暂无模型配置</p>
          ) : (
            <div className="data-table">
              <div className="data-table__row data-table__row--head">
                <span>模型 ID</span>
                <span>显示名称</span>
                <span>提供商</span>
                <span>能力</span>
              </div>
              {models.slice(0, 10).map((m) => (
                <div key={m.id} className="data-table__row">
                  <span style={{ fontWeight: 500 }}>{m.modelId}</span>
                  <span>{m.label}</span>
                  <span style={{ color: "var(--text-soft)" }}>{m.provider?.name || "—"}</span>
                  <span style={{ color: "var(--text-soft)" }}>{m.capabilities?.join(", ") || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </AppShell>
  );
}
