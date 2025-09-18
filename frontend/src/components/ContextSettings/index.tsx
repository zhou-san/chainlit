import mapValues from 'lodash/mapValues';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRecoilState, useSetRecoilState } from 'recoil';

import {
  useChatData,
  useChatInteract
} from '@chainlit/react-client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Translator } from 'components/i18n';

import { contextSettingsOpenState } from 'state/project';

import { FormInput, TFormInputValue } from '../ChatSettings/FormInput';

export default function ContextSettingsModal() {
  const { contextSettingsValue, contextSettingsInputs, contextSettingsDefaultValue } =
    useChatData();

  const { updateContextSettings } = useChatInteract();

  const [contextSettingsOpen, setContextSettingsOpen] = useRecoilState(
    contextSettingsOpenState
  );

  const { handleSubmit, setValue, reset, watch } = useForm({
    defaultValues: contextSettingsValue
  });

  // Reset form when default values change
  useEffect(() => {
    reset(contextSettingsValue);
  }, [contextSettingsValue, reset]);

  const handleClose = (open: boolean) => {
    if (!open) {
      reset(contextSettingsValue);
      setContextSettingsOpen(false);
    }
  };

  const handleConfirm = handleSubmit((data) => {
    const processedValues = mapValues(data, (x: TFormInputValue) =>
      x !== '' ? x : null
    );
    updateContextSettings(processedValues);
    setContextSettingsOpen(false);
  });

  const handleReset = () => {
    reset(contextSettingsDefaultValue);
  };

  // Legacy setField compatibility layer
  const handleChange = () => {};

  const setFieldValue = (field: string, value: any) => {
    setValue(field, value);
  };

  const values = watch();

  return (
    <Dialog open={contextSettingsOpen} onOpenChange={handleClose}>
      <DialogContent
        id="context-settings"
        className="min-w-[20vw] max-h-[85vh] flex flex-col gap-6 p-6"
      >
        <DialogHeader>
          <DialogTitle>
            <Translator path="chat.contexts.title" />
          </DialogTitle>
          <DialogDescription className="sr-only">
            <Translator path="chat.contexts.customize" />
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col flex-grow overflow-y-auto gap-6 p-1">
          {contextSettingsInputs.map((input: any) => (
            <FormInput
              key={input.id}
              element={{
                ...input,
                value: values[input.id],
                onChange: handleChange,
                setField: setFieldValue
              }}
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            <Translator path="common.actions.reset" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => handleClose(false)}>
            <Translator path="common.actions.cancel" />
          </Button>
          <Button onClick={handleConfirm} id="confirm" autoFocus>
            <Translator path="common.actions.confirm" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}