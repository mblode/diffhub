/**
 * The backtick convention for FAQ answers, and the only place it is defined.
 *
 * An answer has to reach two consumers in two shapes: `components/shared/faq-
 * section.tsx` renders it as JSX with real `<code>` elements, and `lib/schema.
 * ts` puts it in `acceptedAnswer.text`, which schema.org types as plain text.
 *
 * The obvious fix is two fields, an `answer` string and a `body` JSX node. That
 * is the drift this file exists to prevent: Google treats an `acceptedAnswer`
 * that does not match the visible answer as a markup error, and two fields is
 * an invitation to edit one of them. So there is one authored string, written
 * with backticks, and two readers of it.
 *
 * No imports. Both a Server Component page and the `"use client"` landing page
 * pull this in transitively, so it has to stay safe in either graph.
 */

export interface Faq {
  /** Markdown-style backticks for inline code. Nothing else is interpreted. */
  answer: string;
  /**
   * Plain text, no backticks. This one is not parsed: it renders as a heading
   * and schema.org types `Question.name` as text, so a backtick here comes out
   * as a literal backtick in both. Say "three dots", not `main...HEAD`.
   */
  question: string;
}

export interface AnswerSegment {
  code: boolean;
  /** Stable within one answer, so the JSX never keys on an array index. */
  id: string;
  text: string;
}

/**
 * `acceptedAnswer.text` is plain text. Backticks are presentation, so they come
 * out rather than shipping as literal characters in the markup.
 */
export const plainAnswer = (answer: string): string => answer.replaceAll("`", "");

/**
 * Odd segments sat between backticks, so they are code. An unclosed backtick
 * leaves a trailing odd segment, which renders as code rather than throwing:
 * a typo should look wrong, not blank the page.
 */
export const answerSegments = (answer: string): AnswerSegment[] =>
  answer
    .split("`")
    .map((text, index) => ({
      code: index % 2 === 1,
      id: `${index}:${text}`,
      text,
    }))
    .filter((segment) => segment.text.length > 0);
