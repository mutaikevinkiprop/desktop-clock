/**
 * Small, reusable, accessible settings controls.
 *
 * These keep every section consistent and avoid duplicated markup.
 */

import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Toggle switch
// ---------------------------------------------------------------------------

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  id?: string;
}

export function Toggle({ checked, onChange, label, id }: ToggleProps) {
  return (
    <button
      type="button"
      id={id}
      className="ui-toggle"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface RowProps {
  title: string;
  description?: string;
  children: ReactNode;
  htmlFor?: string;
}

export function Row({ title, description, children, htmlFor }: RowProps) {
  return (
    <div className="settings-row">
      <div className="settings-row__label">
        <strong id={htmlFor ? `${htmlFor}-label` : undefined}>{title}</strong>
        {description && <span>{description}</span>}
      </div>
      <div className="settings-row__control">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-section" aria-label={title}>
      <h2 className="settings-section__title">{title}</h2>
      {children}
    </section>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return <div className="settings-panel">{children}</div>;
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div className="ui-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slider with value readout
// ---------------------------------------------------------------------------

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  label: string;
  id?: string;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  label,
  id,
}: SliderProps) {
  return (
    <div className="ui-slider-row">
      <input
        id={id}
        className="ui-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="ui-slider-value">{format ? format(value) : value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colour input (swatch + hex text field, kept in sync)
// ---------------------------------------------------------------------------

interface ColorInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

export function ColorInput({ value, onChange, label }: ColorInputProps) {
  return (
    <div className="ui-color">
      <input
        type="color"
        value={value.length >= 7 ? value.slice(0, 7) : "#000000"}
        aria-label={`${label} picker`}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        className="ui-input"
        type="text"
        value={value}
        spellCheck={false}
        aria-label={`${label} hex value`}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radio group
// ---------------------------------------------------------------------------

interface RadioGroupProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  name: string;
}

export function RadioGroup<T extends string>({
  value,
  options,
  onChange,
  name,
}: RadioGroupProps<T>) {
  return (
    <div className="ui-radio-group" role="radiogroup">
      {options.map((option) => (
        <label className="ui-radio" key={option.value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}