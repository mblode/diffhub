"use client";

import { ChevronDownIcon } from "blode-icons-react";
import { useCallback } from "react";
import type { SyntheticEvent } from "react";

import type { Faq as FaqItem } from "@/lib/faq";
import { answerSegments } from "@/lib/faq";

/**
 * Local mirror of `@blode/faq`, same props. The FAQPage JSON-LD comes from
 * `zoneGraph({ faqs })` in `lib/schema.ts`, fed the same array this renders,
 * so the markup cannot say anything the page does not.
 *
 * `<details>`, not a JS accordion, because the landing page needs
 * `faq_opened` and the answers still have to be in the server HTML. A
 * closed `<details>` keeps its body in the document (Google indexes it and
 * find-in-page opens it), where an accordion that unmounts or sets `hidden`
 * would not. The question is an `<h3>` inside `<summary>`, which the content
 * model allows, so the questions stay in the document outline.
 *
 * `components/shared/faq-section.tsx` is still the plain, always-open version
 * for the guides, which have no event to fire.
 */
interface FaqProps {
  items: readonly FaqItem[];
  onOpen?: (question: string) => void;
}

export const Faq = ({ items, onOpen }: FaqProps): React.JSX.Element => {
  const handleToggle = useCallback(
    (event: SyntheticEvent<HTMLDetailsElement>) => {
      const details = event.currentTarget;
      if (details.open) {
        onOpen?.(details.dataset.question ?? "");
      }
    },
    [onOpen],
  );

  return (
    <div className="divide-y divide-foreground/10 border-foreground/10 border-y">
      {items.map((item) => (
        <details
          className="group"
          data-question={item.question}
          key={item.question}
          onToggle={handleToggle}
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-6 py-6 outline-none focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-4 [&::-webkit-details-marker]:hidden">
            <h3 className="font-medium text-lg tracking-tight sm:text-xl">{item.question}</h3>
            <ChevronDownIcon
              aria-hidden="true"
              className="mt-1.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <p className="max-w-[64ch] pb-7 text-pretty text-muted-foreground">
            {answerSegments(item.answer).map((segment) =>
              segment.code ? (
                <code className="font-mono text-sm" key={segment.id}>
                  {segment.text}
                </code>
              ) : (
                <span key={segment.id}>{segment.text}</span>
              ),
            )}
          </p>
        </details>
      ))}
    </div>
  );
};
