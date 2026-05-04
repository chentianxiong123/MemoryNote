import { redirect, type MetaFunction } from "@remix-run/node";
import { type LoaderFunctionArgs } from "@remix-run/server-runtime";

import { requireUser } from "~/services/session.server";
import { onboardingPath } from "~/utils/pathBuilder";

export const meta: MetaFunction = () => {
  return [
    { title: "MemoryNote" },
    { name: "description", content: "Welcome to MemoryNote" },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request);

  if (!user.onboardingComplete) {
    return redirect(onboardingPath());
  } else {
    return redirect("/home/conversation");
  }
};

export default function Index() {
  return <p>Loading</p>;
}
