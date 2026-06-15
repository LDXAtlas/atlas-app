import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getHuddle } from "@/app/actions/huddles";
import { HuddleDetailView } from "../_components/huddle-detail";

export default async function HuddleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  const res = await getHuddle(id);
  if (!res.success || !res.data) {
    notFound();
  }

  return <HuddleDetailView initial={res.data} />;
}
