import React from 'react';
import {
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
  type TextInputProps,
} from 'react-native';
import { TextField } from '@lab-topo/ui';
import { useKeyboardForm } from './KeyboardFormShell';

type Props = TextInputProps & {
  label?: string;
  helperText?: string;
  error?: string;
};

/** TextField que, dentro de KeyboardFormShell, se desplaza por encima del teclado. */
export function FormTextField({ onFocus, ...rest }: Props) {
  const form = useKeyboardForm();

  const handleFocus = (event: NativeSyntheticEvent<TextInputFocusEventData>) => {
    onFocus?.(event);
    form?.onFieldFocus(event);
  };

  return <TextField {...rest} onFocus={handleFocus} />;
}
