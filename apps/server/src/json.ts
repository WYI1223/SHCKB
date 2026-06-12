/**
 * JSON.parse for stored columns (content / publishedDoc / background).
 *
 * A corrupt row must degrade locally, never crash the whole request —
 * list routes and rerenderAllPublished iterate every page, so one bad
 * row would otherwise take down the entire response (mvp7 review E1).
 */
export function safeParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
