import DOMPurify from "dompurify";
import { marked } from "marked";

marked.use({
  breaks: true,
  gfm: true
});

export function renderMarkdownContent(markdown: string): string {
  const html = marked.parse(markdown || "") as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["h1", "h2", "h3", "h4", "h5", "h6", "p", "strong", "em", "ul", "ol", "li", "a", "code", "pre", "blockquote", "br", "hr"],
    ALLOWED_ATTR: ["href", "title", "target", "rel"]
  });
}
