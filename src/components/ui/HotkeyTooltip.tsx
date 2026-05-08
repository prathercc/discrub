import { type ReactElement, useMemo } from 'react';
import { Tooltip, type TooltipProps } from '@mui/material';
import { useAppSelector } from '@/app/hooks';
import { selectHotkeyBinding, selectHotkeysEnabled } from '@features/hotkeys/hotkeysSlice';
import { formatBindingForDisplay } from '@features/hotkeys/keyMatcher';
import type { HotkeyActionId } from '@features/hotkeys/types';

interface HotkeyTooltipProps extends Omit<TooltipProps, 'title'> {
  /**
   * The hotkey action this tooltip describes. The wrapper reads the
   * live binding for this ID from state — when the user rebinds in
   * Settings, every tooltip referencing the action picks up the new
   * key on the next render with no extra plumbing.
   */
  actionId: HotkeyActionId;
  /**
   * Human label for the action. Shown as-is when hotkeys are
   * disabled or no binding is set; gets the formatted shortcut
   * appended (e.g. "Filters (/)") when one is available.
   */
  label: string;
}

/**
 * MUI Tooltip wrapper that automatically appends the live hotkey
 * binding (#144). Components pass an action ID + a plain label; the
 * wrapper reads the binding from Redux, formats it per platform
 * (⌘ on Mac, Ctrl+ elsewhere), and renders the composite string.
 *
 * When the master toggle is off, the suffix is suppressed entirely —
 * showing "Filters (/)" while `/` does nothing would be confusing.
 *
 * Usage mirrors `<Tooltip>`: wrap the child element, pass any other
 * Tooltip prop (placement, arrow, enterDelay, etc.) as you would
 * normally. The `title` prop is owned by this component.
 */
export const HotkeyTooltip = ({
  actionId,
  label,
  children,
  ...tooltipProps
}: HotkeyTooltipProps): ReactElement => {
  const enabled = useAppSelector(selectHotkeysEnabled);
  const binding = useAppSelector(selectHotkeyBinding(actionId));

  const titleText = useMemo(() => {
    if (!enabled || !binding) return label;
    return `${label} (${formatBindingForDisplay(binding)})`;
  }, [enabled, binding, label]);

  // Render title as a JSX node, NOT a plain string. When MUI Tooltip
  // receives a string title and detects an "aria-labelable" child, it
  // forcibly sets `aria-label` on the child to that string — which
  // overrides the button's visible-text-derived accessible name AND
  // pollutes screen-reader output with the literal "(T)" suffix.
  // Wrapping in <span> kicks MUI into the `aria-describedby` path
  // instead, which announces the button's text first and the tooltip
  // (with hotkey hint) as a description. Visible tooltip is unchanged.
  const title = <span>{titleText}</span>;

  return (
    <Tooltip title={title} {...tooltipProps}>
      {children}
    </Tooltip>
  );
};

export default HotkeyTooltip;
