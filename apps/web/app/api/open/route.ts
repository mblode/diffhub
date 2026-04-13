import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { NextResponse } from "next/server";

const exec = promisify(execCallback);

type AppKey = "finder" | "zed" | "vscode" | "xcode" | "ghostty" | "terminal";

const buildCommand = (app: AppKey, filePath: string, line?: number): string => {
  switch (app) {
    case "finder": {
      return `open -R "${filePath}"`;
    }
    case "zed": {
      return line ? `zed "${filePath}:${line}"` : `zed "${filePath}"`;
    }
    case "vscode": {
      return line ? `code --goto "${filePath}:${line}"` : `code "${filePath}"`;
    }
    case "xcode": {
      return `xed "${filePath}"`;
    }
    case "ghostty": {
      return `open -a Ghostty`;
    }
    case "terminal": {
      return `open -a Terminal "${path.dirname(filePath)}"`;
    }
    default: {
      throw new Error(`Unknown app: ${app}`);
    }
  }
};

export const POST = async (request: Request) => {
  const {
    path: filePath,
    app,
    line,
  } = (await request.json()) as {
    path: string;
    app: AppKey;
    line?: number;
  };

  if (!filePath || !app) {
    return NextResponse.json({ error: "path and app required" }, { status: 400 });
  }

  let cmd: string;
  try {
    cmd = buildCommand(app, filePath, line);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }

  try {
    await exec(cmd);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
};
