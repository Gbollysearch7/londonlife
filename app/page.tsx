import { redirect } from "next/navigation";
import { routeFor } from "@/server/session";
import Welcome from "./Welcome";

export const dynamic = "force-dynamic";

export default async function Page() {
  const route = await routeFor();
  if (route === "play") redirect("/play");
  if (route === "create") redirect("/create");
  return <Welcome />;
}
