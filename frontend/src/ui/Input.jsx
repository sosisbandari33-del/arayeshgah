import { useRef } from 'react'

function openNativePicker(inputEl) {
  if (!inputEl || inputEl.disabled || inputEl.readOnly) return
  inputEl.focus()
  if (typeof inputEl.showPicker === 'function') {
    try {
      inputEl.showPicker()
    } catch (err) {
      console.debug('باز کردن انتخابگر بومی مرورگر رد شد:', err.message)
    }
  }
}

export function Input({
  id,
  label,
  hint,
  error,
  className = '',
  wrapperClassName = 'form-group',
  onClick,
  ...props
}) {
  const inputRef = useRef(null)
  const isPickerInput = props.type === 'date' || props.type === 'time'
  const inputClass = [className, error ? 'input-error' : ''].filter(Boolean).join(' ')

  return (
    <div className={wrapperClassName}>
      {label && <label htmlFor={id}>{label}</label>}

      {isPickerInput ? (
        <div className="picker-input-shell">
          <input
            ref={inputRef}
            id={id}
            className={inputClass || undefined}
            aria-invalid={error ? 'true' : undefined}
            onClick={(e) => {
              openNativePicker(e.currentTarget)
              if (onClick) onClick(e)
            }}
            {...props}
          />
          <button
            type="button"
            className="picker-trigger-btn"
            disabled={props.disabled}
            aria-label={props.type === 'time' ? 'باز کردن انتخابگر ساعت' : 'باز کردن تقویم'}
            onClick={() => openNativePicker(inputRef.current)}
          >
            {props.type === 'time' ? '🕒' : '📅 تقویم'}
          </button>
        </div>
      ) : (
        <input
          ref={inputRef}
          id={id}
          className={inputClass || undefined}
          aria-invalid={error ? 'true' : undefined}
          onClick={onClick}
          {...props}
        />
      )}

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {!error && hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

export function Select({
  id,
  label,
  hint,
  error,
  className = '',
  children,
  wrapperClassName = 'form-group',
  ...props
}) {
  const selectClass = [className, error ? 'input-error' : ''].filter(Boolean).join(' ')

  return (
    <div className={wrapperClassName}>
      {label && <label htmlFor={id}>{label}</label>}
      <select
        id={id}
        className={selectClass || undefined}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {!error && hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

export default Input
