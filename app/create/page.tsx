import { redirect } from "next/navigation";
import { routeFor } from "@/server/session";
import CreateWizard from "./CreateWizard";
import OriginReveal from "./OriginReveal";

export const dynamic = "force-dynamic";

export default async function Page() {
  const route = await routeFor();
  if (route === "welcome") redirect("/");
  // Once a character exists, this page only ever shows the persisted origin — it can't be re-rolled.
  return route === "play" ? <OriginReveal /> : <CreateWizard />;
}
