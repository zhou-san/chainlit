import { atom } from 'recoil';

export const chatSettingsOpenState = atom<boolean>({
  key: 'chatSettingsOpen',
  default: false
});

export const contextSettingsOpenState = atom<boolean>({
  key: 'contextSettingsOpen',
  default: false
});
