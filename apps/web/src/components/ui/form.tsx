'use client';

import * as LabelPrimitive from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { cn } from '@/lib/utils';
import { Label } from './label';

export const Form = FormProvider;

interface FormFieldContextValue {
  name: FieldPath<FieldValues>;
}

const FormFieldContext = createContext<FormFieldContextValue | null>(null);

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>): ReactNode {
  return (
    <FormFieldContext.Provider value={{ name: props.name as FieldPath<FieldValues> }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

interface FormItemContextValue {
  id: string;
}

const FormItemContext = createContext<FormItemContextValue | null>(null);

export const FormItem = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const id = useId();
    return (
      <FormItemContext.Provider value={{ id }}>
        <div ref={ref} className={cn('grid gap-2', className)} {...props} />
      </FormItemContext.Provider>
    );
  },
);
FormItem.displayName = 'FormItem';

function useFormField() {
  const fieldContext = useContext(FormFieldContext);
  const itemContext = useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  if (!fieldContext) throw new Error('useFormField must be used within FormField');
  if (!itemContext) throw new Error('useFormField must be used within FormItem');

  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

export const FormLabel = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId, formMessageId } = useFormField();
  return (
    <Label
      ref={ref}
      htmlFor={formItemId}
      aria-describedby={error ? formMessageId : undefined}
      aria-invalid={Boolean(error)}
      className={cn(error && 'text-destructive', className)}
      {...props}
    />
  );
});
FormLabel.displayName = 'FormLabel';

export const FormControl = forwardRef<ElementRef<typeof Slot>, ComponentPropsWithoutRef<typeof Slot>>(
  (props, ref) => {
    const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
    return (
      <Slot
        ref={ref}
        id={formItemId}
        aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
        aria-invalid={Boolean(error)}
        {...props}
      />
    );
  },
);
FormControl.displayName = 'FormControl';

export const FormDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const { formDescriptionId } = useFormField();
    return <p ref={ref} id={formDescriptionId} className={cn('text-sm text-muted-foreground', className)} {...props} />;
  },
);
FormDescription.displayName = 'FormDescription';

export const FormMessage = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => {
    const { error, formMessageId } = useFormField();
    const message = error ? String(error.message ?? '') : children;
    if (!message) return null;
    return (
      <p ref={ref} id={formMessageId} className={cn('text-sm font-medium text-destructive', className)} {...props}>
        {message}
      </p>
    );
  },
);
FormMessage.displayName = 'FormMessage';
