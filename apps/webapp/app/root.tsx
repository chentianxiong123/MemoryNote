import { withSentry } from "@sentry/remix";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import type {
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import {
  type UseDataFunctionReturn,
  typedjson,
  useTypedLoaderData,
} from "remix-typedjson";

import styles from "./tailwind.css?url";

import { appEnvTitleTag } from "./utils";
import {
  commitSession,
  getSession,
  type ToastMessage,
} from "./models/message.server";
import { env } from "./env.server";
import { getUser, getWorkspaceId } from "./services/session.server";
import { getUserWorkspaces, getWorkspaceById } from "./models/workspace.server";
import {
  AppContainer,
  MainCenteredContainer,
} from "./components/layout/app-layout";
import { RouteErrorDisplay } from "./components/ErrorDisplay";
import { themeSessionResolver } from "./services/sessionStorage.server";
import {
  PreventFlashOnWrongTheme,
  Theme,
  ThemeProvider,
  useTheme,
} from "remix-themes";
import clsx from "clsx";
import { Toaster } from "./components/ui/toaster";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const session = await getSession(request.headers.get("cookie"));
  const toastMessage = session.get("toastMessage") as ToastMessage;
  const { getTheme } = await themeSessionResolver(request);

  const sentryDsn = env.SENTRY_DSN;
  const user = await getUser(request);

  // Only fetch workspace data if user is authenticated
  let workspaceId: string | undefined;
  let workspaces: Awaited<ReturnType<typeof getUserWorkspaces>> = [];
  let currentWorkspace = null;

  if (user) {
    workspaceId = await getWorkspaceId(request, user.id, user.workspaceId ?? undefined);
    workspaces = await getUserWorkspaces(user.id);
    currentWorkspace = workspaceId ? await getWorkspaceById(workspaceId) : null;
  }

  return typedjson(
    {
      user: user,
      workspaces,
      currentWorkspace,
      toastMessage,
      theme: getTheme(),
      appEnv: env.APP_ENV,
      appOrigin: env.APP_ORIGIN,
      sentryDsn,
    },
    { headers: { "Set-Cookie": await commitSession(session) } },
  );
};

export const meta: MetaFunction = ({ data }) => {
  const typedData = data as UseDataFunctionReturn<typeof loader>;

  return [
    { title: `CORE${typedData && appEnvTitleTag(typedData.appEnv)}` },
    {
      name: "viewport",
      content:
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, interactive-widget=resizes-content",
    },
    {
      name: "robots",
      content:
        typeof window === "undefined" ||
        window.location.hostname !== "core.mysigma.ai"
          ? "noindex, nofollow"
          : "index, follow",
    },
  ];
};

export function ErrorBoundary() {
  return (
    <ThemeProvider specifiedTheme={null} themeAction="/action/set-theme">
      <html lang="en" className="h-full">
        <head>
          <meta charSet="utf-8" />

          <Meta />
          <Links />
        </head>
        <body className="bg-background-2 h-full overflow-hidden">
          <AppContainer>
            <MainCenteredContainer>
              <RouteErrorDisplay />
            </MainCenteredContainer>
          </AppContainer>
          <Scripts />
        </body>
      </html>
    </ThemeProvider>
  );
}

function App() {
  const { sentryDsn } = useTypedLoaderData<typeof loader>();
  const [theme] = useTheme();

  return (
    <>
      <html lang="en" className={clsx(theme, "h-full")}>
        <head>
          <Meta />
          <Links />
          <PreventFlashOnWrongTheme ssrTheme={Boolean(theme)} />
        </head>
        <body className="bg-background-2 h-[100vh] h-full w-[100vw] overflow-hidden font-sans">
          <script
            dangerouslySetInnerHTML={{
              __html: `window.sentryDsn = ${JSON.stringify(sentryDsn ?? "")}`,
            }}
          />
          <Outlet />
          <Toaster />
          <ScrollRestoration />

          <Scripts />
        </body>
      </html>
    </>
  );
}

// Wrap your app with ThemeProvider.
// `specifiedTheme` is the stored theme in the session storage.
// `themeAction` is the action name that's used to change the theme in the session storage.
function AppWithProviders() {
  const { theme } = useTypedLoaderData<typeof loader>();

  return (
    <ThemeProvider
      specifiedTheme={theme ?? Theme.LIGHT}
      disableTransitionOnThemeChange={true}
      themeAction="/action/set-theme"
    >
      <App />
    </ThemeProvider>
  );
}

export default withSentry(AppWithProviders);
