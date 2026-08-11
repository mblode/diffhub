import type { Faq } from "@/lib/faq";
import { answerSegments } from "@/lib/faq";
import { cn } from "@/lib/utils";

/**
 * Question headings and answers, from the same array `zoneGraph({ faqs })`
 * reads. That shared array is the point of this component: Google treats an
 * `acceptedAnswer` that is not visible on the page as a markup error, and two
 * hand-written copies of an answer drift the first time one is edited. Pass the
 * same const to both or the markup is a lie.
 *
 * Plain `<h3>` and `<p>`, not `<details>` and not an accordion. A closed
 * `<details>` does not render its body, so rendered-text extraction (the path
 * most answer engines take) returns nothing for it, and `<summary>` is not a
 * heading so the questions never enter the document outline. An accordion is
 * worse still: it either sets `hidden` or unmounts the panel, and it would have
 * to be a client component on two pages that forbid those. The only cost of
 * plain markup is vertical space.
 *
 * The page owns the `<section>`, its container width and its `<h2>`. This
 * renders the pairs and nothing else, because those three differ per page and
 * the pairs do not.
 *
 * Must stay a plain component: no `"use client"`, no `async`, no `node:*` or
 * `server-only` imports. The client landing page bundles it.
 */

interface FaqSectionProps {
  answerClassName: string;
  className?: string;
  faqs: readonly Faq[];
  itemClassName?: string;
  questionClassName: string;
}

export const FaqSection = ({
  answerClassName,
  className,
  faqs,
  itemClassName,
  questionClassName,
}: FaqSectionProps): React.JSX.Element => (
  <div className={className}>
    {faqs.map((faq) => (
      <div className={cn(itemClassName)} key={faq.question}>
        <h3 className={questionClassName}>{faq.question}</h3>
        <p className={answerClassName}>
          {answerSegments(faq.answer).map((segment) =>
            segment.code ? (
              <code className="font-mono text-sm" key={segment.id}>
                {segment.text}
              </code>
            ) : (
              <span key={segment.id}>{segment.text}</span>
            ),
          )}
        </p>
      </div>
    ))}
  </div>
);
