import { cn } from '@/lib/utils';
import { PropsWithChildren, useMemo, useState, useEffect } from 'react';

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

  // Initialize accordion state - open by default if step.defaultOpen is true or if step is running
  const [accordionValue, setAccordionValue] = useState<string | undefined>(() => {
    return step.defaultOpen || using ? step.id : undefined;
  });

  // Track previous running state to detect completion transitions
  const [wasUsingPreviously, setWasUsingPreviously] = useState(using);

  // Auto-collapse when step completes and auto-expand when step starts running
  useEffect(() => {
    // Detect step completion: was running previously but now complete and not running
    if (wasUsingPreviously && !using && isComplete) {
      // Step just completed - auto-collapse it
      setAccordionValue(undefined);
    } 
    // Auto-expand when step starts running (if not already expanded)
    else if (using && !wasUsingPreviously) {
      // Step just started running - expand it
      setAccordionValue(step.id);
    }

    // Update previous running state
    setWasUsingPreviously(using);
  }, [using, isComplete, wasUsingPreviously, step.id]);

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
