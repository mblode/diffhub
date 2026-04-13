import { NextResponse } from "next/server";
import { getFileAtRef } from "@/lib/git";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") ?? "";
  const ref = searchParams.get("ref") ?? "";
  if (!path || !ref) {
    return NextResponse.json({ error: "Missing path or ref" }, { status: 400 });
  }
  try {
    const content = await getFileAtRef(path, ref);
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
};
