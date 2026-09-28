import type {
  ChatIntent,
  ChatTurn,
  PostChatResult,
  PostPart,
} from "@/lib/ai/types";

const PARTS: readonly PostPart[] = ["title", "body", "image"];

/** UI copy uses a plain hyphen - AI likes en and em dashes. */
function plainDashes(text: string): string {
  return text.replace(/s*[–—]s*/g, " - ");
}

const MAX_CREATE = 3;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[„”"'’.,:;!?()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The post the customer named by its full title - whole words, case
 * insensitive ("dla posta test" names "Test", not "test 123"). Checks the
 * message, then earlier customer messages (an answer to "który post?").
 * With several matches the longest title wins; null when nothing matches.
 */
export function matchPostByTitle<T extends { id: string; title: string }>(
  message: string,
  history: ChatTurn[],
  posts: T[],
): T | null {
  const sources = [
    message,
    ...history
      .filter((turn) => turn.role === "user")
      .map((turn) => turn.text)
      .reverse(),
  ];
  for (const source of sources) {
    const haystack = ` ${normalize(source)} `;
    const hits = posts.filter((post) => {
      const title = normalize(post.title);
      return title && haystack.includes(` ${title} `);
    });
    if (hits.length) {
      return hits.sort((a, b) => b.title.length - a.title.length)[0];
    }
  }
  return null;
}

/**
 * Validates the router's raw answer: an edit must point at one of the offered
 * posts (never trust an id the model made up), a post named by its exact
 * title beats the model's guess, counts are clamped.
 */
export function resolveChatIntent(
  raw: unknown,
  message: string,
  posts: Array<{ id: string; title: string }>,
  history: ChatTurn[] = [],
): ChatIntent {
  const value = (raw ?? {}) as Record<string, unknown>;
  const text = (key: string) =>
    typeof value[key] === "string" ? (value[key] as string).trim() : "";

  if (value.kind === "edit") {
    const chosen = posts.find((item) => item.id === text("postId"));
    // Keep the model's post when the customer named it; otherwise a post named
    // by its full title wins ("zmień tytuł posta Opony na Test" stays on Opony).
    const post =
      chosen && matchPostByTitle(message, history, [chosen])
        ? chosen
        : (matchPostByTitle(message, history, posts) ?? chosen);
    if (post) {
      return {
        kind: "edit",
        postId: post.id,
        instruction: text("instruction") || message,
      };
    }
    return {
      kind: "clarify",
      question:
        "Którego posta dotyczy zmiana? Kliknij przy nim „Edytuj przez czat” albo podaj kilka słów z tytułu.",
    };
  }

  if (value.kind === "reply" && text("text")) {
    return { kind: "reply", text: plainDashes(text("text")) };
  }

  if (value.kind === "clarify") {
    return {
      kind: "clarify",
      question: text("question") || "Doprecyzuj, proszę, o co chodzi.",
    };
  }

  const count = Number(value.count);
  return {
    kind: "create",
    count: Number.isFinite(count)
      ? Math.min(MAX_CREATE, Math.max(1, Math.round(count)))
      : 1,
    request: text("request") || message,
  };
}

/** Validates the post-chat answer; an empty change falls back to the message. */
export function resolvePostChat(raw: unknown, message: string): PostChatResult {
  const value = (raw ?? {}) as Record<string, unknown>;
  const text = (key: string) =>
    typeof value[key] === "string" ? (value[key] as string).trim() : "";
  if (value.kind === "change") {
    const parts = Array.isArray(value.parts)
      ? PARTS.filter((part) => (value.parts as unknown[]).includes(part))
      : [];
    return {
      kind: "change",
      instruction: text("instruction") || message,
      // Unknown scope: allow everything, the per-part guards still apply.
      parts: parts.length ? parts : [...PARTS],
    };
  }
  return {
    kind: "reply",
    text:
      plainDashes(text("text")) ||
      "Nie jestem pewien, o co chodzi - napisz, proszę, dokładniej.",
  };
}
