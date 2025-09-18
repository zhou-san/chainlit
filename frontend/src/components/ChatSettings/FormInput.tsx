import { IInput } from 'types/Input';

import { CheckboxInput, CheckboxInputProps } from './CheckboxInput';
import { FileUploadInput, FileUploadInputProps } from './FileUploadInput';
import { MultiSelectInput, MultiSelectInputProps } from './MultiSelectInput';
import { RadioButtonGroup, RadioButtonGroupProps } from './RadioButtonGroup';
import { SecureTagsInput } from './SecureTagsInput';
import type { SecureTagsInputProps } from './SecureTagsInput';
import { SelectInput, SelectInputProps } from './SelectInput';
import { SliderInput, SliderInputProps } from './SliderInput';
import { SwitchInput, SwitchInputProps } from './SwitchInput';
import { TagsInput, TagsInputProps } from './TagsInput';
import { TextInput, TextInputProps } from './TextInput';

type TFormInputValue = string | number | boolean | string[] | undefined;

interface IFormInput<T, V extends TFormInputValue> extends IInput {
  type: T;
  value?: V;
  initial?: V;
  setField?(field: string, value: V, shouldValidate?: boolean): void;
}

type TFormInput =
  | (Omit<SwitchInputProps, 'checked'> & IFormInput<'switch', boolean>)
  | (Omit<SliderInputProps, 'value'> & IFormInput<'slider', number>)
  | (Omit<TagsInputProps, 'value'> & IFormInput<'tags', string[]>)
  | (Omit<SecureTagsInputProps, 'value'> & IFormInput<'secure_tags', string[]>)
  | (Omit<SelectInputProps, 'value'> & IFormInput<'select', string>)
  | (Omit<SelectInputProps, 'value'> & IFormInput<'context_select', string>)
  | (Omit<TextInputProps, 'value'> & IFormInput<'textinput', string>)
  | (Omit<TextInputProps, 'value'> & IFormInput<'context_textarea', string>)
  | (Omit<TextInputProps, 'value'> & IFormInput<'numberinput', number>)
  | (Omit<MultiSelectInputProps, 'value'> & IFormInput<'multiselect', string[]>)
  | (Omit<CheckboxInputProps, 'checked'> & IFormInput<'checkbox', boolean>)
  | (Omit<RadioButtonGroupProps, 'value'> & IFormInput<'radio', string>)
  | (Omit<FileUploadInputProps, 'value'> & IFormInput<'fileupload', string[]>)
  | (Omit<FileUploadInputProps, 'value'> & IFormInput<'context_file_manager', string[]>);

const FormInput = ({ element }: { element: TFormInput }): JSX.Element => {
  switch (element?.type) {
    case 'select':
      return <SelectInput {...element} value={element.value ?? ''} />;
    case 'context_select':
      return <SelectInput {...element} value={element.value ?? ''} />;
    case 'slider':
      return <SliderInput {...element} value={element.value ?? 0} />;
    case 'tags':
      return <TagsInput {...element} value={element.value ?? []} />;
    case 'secure_tags':
      return <SecureTagsInput {...element} value={element.value ?? []} />;
    case 'switch':
      return <SwitchInput {...element} checked={!!element.value} />;
    case 'textinput':
      return <TextInput {...element} value={element.value ?? ''} />;
    case 'context_textarea':
      return <TextInput {...element} value={element.value ?? ''} multiline={true} />;
    case 'numberinput':
      return (
        <TextInput
          {...element}
          type="number"
          value={element.value?.toString() ?? '0'}
        />
      );
    case 'multiselect':
      return <MultiSelectInput {...element} value={element.value ?? []} />;
    case 'checkbox':
      return <CheckboxInput {...element} checked={!!element.value} />;
    case 'radio':
      return <RadioButtonGroup {...element} value={element.value ?? ''} />;
    case 'fileupload':
      return <FileUploadInput {...element} value={element.value ?? []} />;
    case 'context_file_manager':
      return <FileUploadInput {...element} value={element.value ?? []} />;
    default:
      // If the element type is not recognized, we indicate an unimplemented type.
      // This code path should not normally occur and serves as a fallback.
      element satisfies never;
      return <></>;
  }
};

export { FormInput };
export type { IFormInput, TFormInput, TFormInputValue };
