import {
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/server-runtime";
import { requireUser, requireWorkpace } from "~/services/session.server";

import { Outlet, useLoaderData } from "@remix-run/react";
import { typedjson } from "remix-typedjson";
import { clearRedirectTo, commitSession } from "~/services/redirectTo.server";

import { AppSidebar } from "~/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";
import { ResizablePanelGroup, ResizablePanel } from "~/components/ui/resizable";

import { json, redirect } from "@remix-run/node";
import { getConversationSources } from "~/services/conversation.server";
import { CollabSocketProvider } from "~/components/editor/collab-socket-context";
import React from "react";
import { getAvailableModels } from "~/services/llm-provider.server";
import { type LLMModel } from "~/components/conversation";
import { useTauri } from "~/hooks/use-tauri";
import { DesktopTabsProvider } from "~/components/desktop/tabs-context";
import { DesktopTabBar } from "~/components/desktop/tab-bar";

export async function action({ request }: ActionFunctionArgs) {
  const { workspaceId } = await requireUser(request);

  if (!workspaceId) {
    return json({ error: "No workspace" }, { status: 400 });
  }

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;

  if (!name || !slug) {
    return json({ error: "name and slug are required" }, { status: 400 });
  }

  return json({ ok: true });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request);
  const workspace = await requireWorkpace(request);

  if (!workspace) {
    return { conversationSources: [] };
  }

  const conversationSources = await getConversationSources(
    workspace.id,
    user.id,
  );

  const allModels = await getAvailableModels();

  const models = allModels
    .filter(
      (m) => m.capabilities.length === 0 || m.capabilities.includes("chat"),
    )
    .map((m) => ({
      id: `${m.provider.type}/${m.modelId}`,
      modelId: m.modelId,
      label: m.label,
      provider: m.provider.type,
      isDefault: m.isDefault,
    }));

  return typedjson(
    {
      user,
      workspace,
      conversationSources,
      models,
    },
    {
      headers: {
        "Set-Cookie": await commitSession(await clearRedirectTo(request)),
      },
    },
  );
};

function HomeInner({
  conversationSources,
  workspace,
  meta,
  agentName,
  accentColor,
  models,
}: {
  conversationSources: any;
  workspace: any;
  meta: Record<string, unknown>;
  agentName: string;
  accentColor: string;
  models: LLMModel[];
}) {
  const { isDesktop } = useTauri();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 52)",
          "--header-height": "calc(var(--spacing) * 12)",
          background: "var(--background)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        conversationSources={conversationSources}
        agentName={agentName}
        accentColor={accentColor}
      />
      <SidebarInset className="h-[calc(100vh_-_16px)] border-none bg-transparent pr-0 !shadow-none outline-none">
        {isDesktop && (
          <div className="flex w-full flex-col overflow-hidden">
            <DesktopTabBar />
          </div>
        )}
        <ResizablePanelGroup
          orientation="horizontal"
          className="bg-background-2 shadow-1 border-border h-page-xs !rounded-xl"
        >
          <ResizablePanel defaultSize="100%" minSize="50%">
            <div className="flex h-full flex-col">
              <div className="flex h-full flex-col gap-2 @container/main">
                <div className="flex h-full flex-col">
                  <Outlet />
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function Home() {
  const { conversationSources, workspace, models } =
    useLoaderData<typeof loader>() as any;
  const meta = (workspace?.metadata ?? {}) as Record<string, unknown>;
  const accentColor = (meta.accentColor as string) || "#c87844";
  const agentName = (workspace?.name as string) ?? "butler";

  return (
    <CollabSocketProvider>
      <DesktopTabsProvider>
        <HomeInner
          conversationSources={conversationSources}
          workspace={workspace}
          meta={meta}
          agentName={agentName}
          accentColor={accentColor}
          models={models}
        />
      </DesktopTabsProvider>
    </CollabSocketProvider>
  );
}
