import { useRecoilValue } from 'recoil';

import {
  actionState,
  askUserState,
  callFnState,
  chatSettingsDefaultValueSelector,
  chatSettingsInputsState,
  chatSettingsValueState,
  contextSettingsDefaultValueSelector,
  contextSettingsInputsState,
  contextSettingsValueState,
  elementState,
  loadingState,
  sessionState,
  tasklistState
} from './state';

export interface IToken {
  id: number | string;
  token: string;
  isSequence: boolean;
  isInput: boolean;
}

const useChatData = () => {
  const loading = useRecoilValue(loadingState);
  const elements = useRecoilValue(elementState);
  const tasklists = useRecoilValue(tasklistState);
  const actions = useRecoilValue(actionState);
  const session = useRecoilValue(sessionState);
  const askUser = useRecoilValue(askUserState);
  const callFn = useRecoilValue(callFnState);
  const chatSettingsInputs = useRecoilValue(chatSettingsInputsState);
  const chatSettingsValue = useRecoilValue(chatSettingsValueState);
  const chatSettingsDefaultValue = useRecoilValue(
    chatSettingsDefaultValueSelector
  );
  const contextSettingsInputs = useRecoilValue(contextSettingsInputsState);
  const contextSettingsValue = useRecoilValue(contextSettingsValueState);
  const contextSettingsDefaultValue = useRecoilValue(
    contextSettingsDefaultValueSelector
  );

  const connected = session?.socket.connected && !session?.error;
  const disabled =
    !connected ||
    loading ||
    askUser?.spec.type === 'file' ||
    askUser?.spec.type === 'action' ||
    askUser?.spec.type === 'element';

  return {
    actions,
    askUser,
    callFn,
    chatSettingsDefaultValue,
    chatSettingsInputs,
    chatSettingsValue,
    contextSettingsDefaultValue,
    contextSettingsInputs,
    contextSettingsValue,
    connected,
    disabled,
    elements,
    error: session?.error,
    loading,
    tasklists
  };
};

export { useChatData };
