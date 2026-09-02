"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { captureConversion } from "@/lib/conversion-events";

// Accepts a full GitHub PR URL or an owner/repo#123 / owner/repo/pull/123 shorthand.
const parsePrPath = (raw: string): string | null => {
  const value = raw.trim();
  if (value === "") {
    return null;
  }
  const patterns = [
    /github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/i,
    /^([\w.-]+)\/([\w.-]+)\/pull\/(\d+)$/i,
    /^([\w.-]+)\/([\w.-]+)#(\d+)$/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      return `/${match[1]}/${match[2]}/pull/${match[3]}`;
    }
  }
  return null;
};

export const DemoLauncher = (): React.JSX.Element => {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = useCallback(
    (event: React.FormEvent): void => {
      event.preventDefault();
      const path = parsePrPath(value);
      if (path === null) {
        setError(true);
        return;
      }
      setError(false);
      captureConversion({ href: path, label: "Open PR" });
      router.push(path);
    },
    [value, router],
  );

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setValue(event.target.value);
    setError(false);
  }, []);

  return (
    <form
      className="mx-auto flex w-full max-w-md flex-col items-center gap-2"
      onSubmit={handleSubmit}
    >
      <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <input
          aria-label="GitHub pull request URL"
          className="min-w-0 flex-1 rounded-full bg-background px-4 py-3 text-base text-foreground shadow-input outline-1 -outline-offset-1 outline-foreground/10 placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-link"
          name="pull-request-url"
          onChange={handleChange}
          placeholder="Paste a GitHub PR URL"
          value={value}
        />
        <Button className="w-full sm:w-auto" size="lg" type="submit" variant="outline">
          Open PR
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {error ? (
          <span className="text-destructive">Enter a GitHub pull request URL.</span>
        ) : (
          <>
            Try{" "}
            <Link className="text-link hover:underline" href="/oven-sh/bun/pull/16000">
              oven-sh/bun#16000
            </Link>
          </>
        )}
      </p>
    </form>
  );
};
