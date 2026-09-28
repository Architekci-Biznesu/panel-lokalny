import {
  parseChatText,
  type ChatLine,
} from "@/features/publikacje/chat-format";

function Line({ line }: { line: ChatLine }) {
  return line.map((span, i) =>
    span.bold ? <strong key={i}>{span.text}</strong> : span.text,
  );
}

/** AI reply in the chat: paragraphs, lists and bold (see chat-format.ts). */
export function ChatText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {parseChatText(text).map((block, i) => {
        if (block.kind === "ul") {
          return (
            <ul key={i}>
              {block.items.map((item, j) => (
                <li key={j}>
                  <Line line={item} />
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === "ol") {
          return (
            <ol key={i} start={block.start}>
              {block.items.map((item, j) => (
                <li key={j}>
                  <Line line={item} />
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                <Line line={line} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
