import { useSetRecoilState } from 'recoil';
import { BookOpen } from 'lucide-react';

import { useConfig } from '@chainlit/react-client';

import { Translator } from '@/components/i18n';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

import { contextSettingsOpenState } from '@/state/project';

interface ContextButtonProps {
  disabled?: boolean;
}

export const ContextButton = ({ disabled = false }: ContextButtonProps) => {
  const { config } = useConfig();
  const setContextSettingsOpen = useSetRecoilState(contextSettingsOpenState);

  const isContextEnabled = !!config?.features.context?.enabled;

  if (!isContextEnabled) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block">
            <Button
              id={disabled ? 'context-button-loading' : 'context-button'}
              variant="ghost"
              size="icon"
              className="hover:bg-muted rounded-full"
              disabled={disabled}
              onClick={() => setContextSettingsOpen(true)}
            >
              <BookOpen className="h-6 w-6" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            <Translator path="chat.input.actions.manageContexts" />
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ContextButton;