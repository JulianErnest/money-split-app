export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    // Handle hatian://join/CODE deep links
    if (path.includes("/join/")) {
      const url = new URL(path, "hatian://");
      if (url.pathname.startsWith("/join/")) {
        return url.pathname; // returns /join/CODE
      }
    }
    return path;
  } catch {
    return path;
  }
}
