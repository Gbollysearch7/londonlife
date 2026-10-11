import ResetForm from "./ResetForm";

export const dynamic = "force-dynamic";

// The token is in the address; never pass it on to other sites as a referrer.
export const metadata = { title: "Choose a new password · London Life", robots: { index: false }, referrer: "no-referrer" as const };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await searchParams;
  return <ResetForm token={typeof token === "string" ? token : ""} />;
}
