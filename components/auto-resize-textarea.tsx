"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type CSSProperties,
  type TextareaHTMLAttributes,
} from "react";

export interface AutoResizeTextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** The smallest visible height while the field is empty. */
  minRows?: number;
  /** After this many rows the field scrolls internally. */
  maxRows?: number;
}

/**
 * A controlled textarea that follows its content until a readable maximum.
 * Measuring the actual computed line-height keeps it aligned with the app's
 * typography in both light and dark themes.
 */
const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  function AutoResizeTextarea(
    {
      className = "",
      minRows = 3,
      maxRows = 15,
      onChange,
      value,
      defaultValue,
      style,
      ...props
    },
    forwardedRef,
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement);

    const resize = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const computed = window.getComputedStyle(textarea);
      const fontSize = Number.parseFloat(computed.fontSize) || 16;
      const lineHeight = Number.parseFloat(computed.lineHeight) || fontSize * 1.5;
      const verticalPadding =
        (Number.parseFloat(computed.paddingTop) || 0) +
        (Number.parseFloat(computed.paddingBottom) || 0);
      const borders =
        (Number.parseFloat(computed.borderTopWidth) || 0) +
        (Number.parseFloat(computed.borderBottomWidth) || 0);
      const minHeight = lineHeight * minRows + verticalPadding + borders;
      const maxHeight = lineHeight * maxRows + verticalPadding + borders;

      textarea.style.height = "auto";
      const contentHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`;
      textarea.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
    }, [maxRows, minRows]);

    useLayoutEffect(() => {
      resize();
    }, [resize, value, defaultValue]);

    function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
      onChange?.(event);
      resize();
    }

    return (
      <textarea
        {...props}
        ref={textareaRef}
        value={value}
        defaultValue={defaultValue}
        rows={minRows}
        onChange={handleChange}
        style={style as CSSProperties | undefined}
        className={`resize-none ${className}`}
      />
    );
  },
);

export default AutoResizeTextarea;
