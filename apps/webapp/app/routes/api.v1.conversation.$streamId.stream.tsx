import { type LoaderFunctionArgs } from "~/lib/remix-compat";

export async function loader({ request, params }: LoaderFunctionArgs) {
  return new Response(null, { status: 204 });
}
