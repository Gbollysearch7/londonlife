import { redirect } from "next/navigation";
import { routeFor } from "@/server/session";
import Game from "@/ui/Game";

export const dynamic = "force-dynamic";

export default async function Page() {
  const route = await routeFor();
  if (route === "welcome") redirect("/");
  if (route === "create") redirect("/create");
  return <Game />;
}
