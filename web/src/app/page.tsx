"use client";

import BusinessView from "./business/BusinessView";

// 知识库图谱主页（抄 cognee knowledge-graph → BusinessPage）
export default function Home() {
  return (
    <main style={{ height: "100vh" }}>
      <BusinessView cogniInstance={{ id: "memorynote", name: "MemoryNote", apiBase: "" }} />
    </main>
  );
}
