import { Fragment, type ReactNode } from "react";

// Just enough Markdown for chat replies: paragraphs, bullet/numbered lists, **bold**, `code`,
// [links](https://…) and bare URLs. Only http(s) links are made clickable.

const INLINE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [, label, href, bold, code, url] = m;
    if (href) {
      out.push(<a key={key++} href={href} target="_blank" rel="noreferrer">{label}</a>);
    } else if (bold) {
      out.push(<strong key={key++}>{bold}</strong>);
    } else if (code) {
      out.push(<code key={key++}>{code}</code>);
    } else if (url) {
      out.push(<a key={key++} href={url} target="_blank" rel="noreferrer">{url}</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;

type Run = { list: boolean; lines: string[] };

export function Markdown({ text }: { text: string }) {
  // Paragraphs are separated by blank lines; inside one, consecutive list lines form a list
  const runs: Run[] = [];
  for (const block of text.trim().split(/\n\s*\n/)) {
    let current: Run | null = null;
    for (const line of block.split("\n")) {
      if (!line.trim()) continue;
      const list = LIST_ITEM.test(line);
      if (!current || current.list !== list) {
        current = { list, lines: [] };
        runs.push(current);
      }
      current.lines.push(line.replace(LIST_ITEM, "").replace(/^#+\s*/, ""));
    }
  }

  return (
    <>
      {runs.map((run, i) =>
        run.list ? (
          <ul key={i}>
            {run.lines.map((l, j) => (
              <li key={j}>{inline(l)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {run.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </>
  );
}
