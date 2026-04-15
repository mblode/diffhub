import { NextResponse } from "next/server";
import { getFileAtRef } from "@/lib/git";
import { InvalidRepoFilePathError } from "@/lib/git-paths";

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
    if (error instanceof InvalidRepoFilePathError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
};
