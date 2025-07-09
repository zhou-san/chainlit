import { cn } from '@/lib/utils';
import { ChevronUp, Minus } from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';

import { useChatData } from '@chainlit/react-client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

import { ITaskList, Task } from './Task';

interface HeaderProps {
  status: string;
  onToggleCollapse: () => void;
}

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const Header = ({ status, onToggleCollapse }: HeaderProps) => {
  return (
    <CardHeader className="flex flex-row items-center justify-between">
      <div className="font-semibold">Tasks</div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{status || '?'}</Badge>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleCollapse}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Collapse tasks</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </CardHeader>
  );
};

interface CollapsedTaskListProps {
  status: string;
  onToggleCollapse: () => void;
  isMobile?: boolean;
}

const CollapsedTaskList = ({ onToggleCollapse }: CollapsedTaskListProps) => {
  // Just a simple floating icon - no borders, no background, minimal
  return (
    <div className="fixed bottom-4 right-4 z-10">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Expand tasks</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

interface TaskListProps {
  isMobile: boolean;
  isCopilot?: boolean;
}

const TaskList = ({ isMobile, isCopilot }: TaskListProps) => {
  const { tasklists } = useChatData();
  const tasklist = tasklists[tasklists.length - 1];

  // State for collapse functionality (no persistence)
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { error, data, isLoading } = useSWR<ITaskList>(tasklist?.url, fetcher, {
    keepPreviousData: true
  });

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  if (!tasklist?.url) return null;

  if (isLoading && !data) {
    return null;
  }

  if (error) {
    return null;
  }

  const content = data as ITaskList;
  if (!content) return null;

  const tasks = content.tasks;

  // Show collapsed view when collapsed
  if (isCollapsed) {
    return (
      <CollapsedTaskList
        status={content.status}
        onToggleCollapse={handleToggleCollapse}
        isMobile={isMobile}
      />
    );
  }

  if (isMobile) {
    // Get the first running or ready task, or the latest task
    let highlightedTaskIndex = tasks.length - 1;
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].status === 'running' || tasks[i].status === 'ready') {
        highlightedTaskIndex = i;
        break;
      }
    }
    const highlightedTask = tasks?.[highlightedTaskIndex];

    return (
      <aside
        className={cn('w-full tasklist-mobile', !isCopilot && 'md:hidden')}
      >
        <Card>
          <Header
            status={content.status}
            onToggleCollapse={handleToggleCollapse}
          />
          {highlightedTask && (
            <CardContent>
              <Task index={highlightedTaskIndex + 1} task={highlightedTask} />
            </CardContent>
          )}
        </Card>
      </aside>
    );
  }

  return (
    <aside className="hidden tasklist max-w-96 flex-grow md:block overflow-y-auto mr-4 mb-4">
      <Card className="overflow-y-auto h-full">
        <Header
          status={content?.status}
          onToggleCollapse={handleToggleCollapse}
        />
        <CardContent className="flex flex-col gap-2">
          {tasks?.map((task, index) => (
            <Task key={index} index={index + 1} task={task} />
          ))}
        </CardContent>
      </Card>
    </aside>
  );
};

export { TaskList };
