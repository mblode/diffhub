import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const truncateFilePath = (path: string, maxSegments = 4) => {
  const segments = path.split("/");
  if (segments.length <= maxSegments) {
    return path;
  }
  const filename = segments.at(-1) ?? "";
  const parent = segments.at(-2) ?? "";
  return `${segments[0]}/…/${parent}/${filename}`;
};
