import { cn } from '@/lib/utils';
import { PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';

import type { IStep } from '@chainlit/react-client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Translator } from 'components/i18n';

interface Props {
  step: IStep;
  isRunning?: boolean;
}

export default function Step({
  step,
  children,
  isRunning
}: PropsWithChildren<Props>) {
  const using = useMemo(() => {
    return isRunning && step.start && !step.end && !step.isError;
  }, [step, isRunning]);

  const isComplete = useMemo(() => {
    return step.end !== undefined;
  }, [step.end]);

  // Initialize accordion state - only auto-expand if defaultOpen=true
  // This ensures consistency with the conditional auto-collapse behavior
  const [accordionValue, setAccordionValue] = useState<string | undefined>(
    () => {
      return step.defaultOpen ? step.id : undefined;
    }
  );

  // Track previous running state to detect completion transitions using useRef
  // This avoids the dependency cycle that was preventing auto-collapse from working
  const wasUsingPreviously = useRef(using);

  // Auto-collapse when step completes and auto-expand when step starts running
  // Only apply this behavior to steps with defaultOpen=true
  useEffect(() => {
    let collapseTimeout: NodeJS.Timeout;

    // Only apply auto-expand/collapse behavior for steps with defaultOpen=true
    if (step.defaultOpen) {
      // Detect step completion: was running previously but now complete and not running
      if (wasUsingPreviously.current && !using && isComplete) {
        // Step just completed - auto-collapse it with a delay
        collapseTimeout = setTimeout(() => {
          setAccordionValue(undefined);
        }, 1500); // 1.5 second delay - feel free to adjust this
      }
      // Auto-expand when step starts running (if not already expanded)
      else if (using && !wasUsingPreviously.current) {
        // Step just started running - expand it immediately
        setAccordionValue(step.id);
      }
    }

    // Update previous running state
    wasUsingPreviously.current = using;

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (collapseTimeout) {
        clearTimeout(collapseTimeout);
      }
    };
  }, [using, isComplete, step.id, step.defaultOpen]);

  const hasContent = step.input || step.output || step.steps?.length;
  const isError = step.isError;
  const stepName = step.name;

  // If there's no content, just render the status without accordion
  if (!hasContent) {
    return (
      <div className="flex flex-col flex-grow w-0">
        <p
          className={cn(
            'flex items-center gap-1 font-medium',
            isError && 'text-red-500',
            !using && 'text-muted-foreground',
            using && 'loading-shimmer'
          )}
          id={`step-${stepName}`}
        >
          {using ? (
            <>
              <Translator path="chat.messages.status.using" /> {stepName}
            </>
          ) : (
            <>
              <Translator path="chat.messages.status.used" /> {stepName}
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow w-0">
      <Accordion
        type="single"
        collapsible
        value={accordionValue}
        onValueChange={setAccordionValue}
        className="w-full"
      >
        <AccordionItem value={step.id} className="border-none">
          <AccordionTrigger
            className={cn(
              'flex items-center gap-1 justify-start transition-none p-0 hover:no-underline',
              isError && 'text-red-500',
              !using && 'text-muted-foreground hover:text-foreground',
              using && 'loading-shimmer'
            )}
            id={`step-${stepName}`}
          >
            {using ? (
              <>
                <Translator path="chat.messages.status.using" /> {stepName}
              </>
            ) : (
              <>
                <Translator path="chat.messages.status.used" /> {stepName}
              </>
            )}
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex-grow mt-4 ml-1 pl-4 border-l-2 border-primary">
              {children}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
