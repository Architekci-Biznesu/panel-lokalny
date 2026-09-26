import * as cheerio from "cheerio";

export type ScrapeResult = {
  ok: boolean;
  warning?: string;
  title: string | null;
  description: string | null;
  text: string;
  headings: string[];
  url: string;
};

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export async function scrapeWebsite(rawUrl: string): Promise<ScrapeResult> {
  const url = normalizeUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "PanelLokalnyBot/1.0 (+https://panellokalny.pl; onboarding-scrape)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return {
        ok: false,
        warning: `Strona zwróciła status ${response.status}. Możesz przejść dalej i uzupełnić brief ręcznie.`,
        title: null,
        description: null,
        text: "",
        headings: [],
        url,
      };
    }

    const html = await response.text();
    if (!html.trim()) {
      return {
        ok: false,
        warning:
          "Strona zwróciła pustą treść. Możesz przejść dalej i uzupełnić brief ręcznie.",
        title: null,
        description: null,
        text: "",
        headings: [],
        url,
      };
    }

    const $ = cheerio.load(html);
    $("script, style, noscript, svg, iframe").remove();

    const title =
      $("meta[property='og:title']").attr("content")?.trim() ||
      $("title").first().text().trim() ||
      $("h1").first().text().trim() ||
      null;

    const description =
      $("meta[name='description']").attr("content")?.trim() ||
      $("meta[property='og:description']").attr("content")?.trim() ||
      null;

    const headings = $("h1, h2, h3")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean)
      .slice(0, 40);

    const bodyText = $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 15000);

    if (!bodyText && !description && headings.length === 0) {
      return {
        ok: false,
        warning:
          "Nie udało się wyciągnąć treści ze strony. Możesz przejść dalej i uzupełnić brief ręcznie.",
        title,
        description,
        text: "",
        headings,
        url,
      };
    }

    const text = [
      title ? `Tytuł: ${title}` : null,
      description ? `Opis: ${description}` : null,
      headings.length ? `Nagłówki: ${headings.join(" | ")}` : null,
      bodyText ? `Treść: ${bodyText}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      ok: true,
      title,
      description,
      text,
      headings,
      url,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Przekroczono limit czasu pobierania strony."
        : "Nie udało się pobrać strony (niedostępna, SSL lub sieć).";
    return {
      ok: false,
      warning: `${message} Możesz przejść dalej i uzupełnić brief ręcznie.`,
      title: null,
      description: null,
      text: "",
      headings: [],
      url,
    };
  } finally {
    clearTimeout(timeout);
  }
}
