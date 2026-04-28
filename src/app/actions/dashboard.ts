"use server";

export async function saveDashboardLayout(layout: unknown) {
  console.log("[saveDashboardLayout] Layout received:", JSON.stringify(layout));
  return { success: true };
}
