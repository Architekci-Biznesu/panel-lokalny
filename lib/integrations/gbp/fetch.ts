/**
 * Every request to Google (GBP APIs and OAuth) goes through here, so one log
 * line per call shows how often the panel really asks Google. Query strings
 * are left out of the log - they can hold tokens and codes.
 */
export async function gbpFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === "string" ? new URL(input) : input;
  const method = init?.method ?? "GET";
  const host = url.hostname.split(".")[0];
  const started = Date.now();
  const response = await fetch(url, { ...init, cache: "no-store" });
  console.info(
    `[gbp] ${method} ${host}${url.pathname} ${response.status} ${Date.now() - started}ms`,
  );
  return response;
}
