export function Input({
  id,
  label,
  hint,
  error,
  className = '',
  wrapperClassName = 'form-group',
  ...props
}) {
  const inputClass = [className, error ? 'input-error' : ''].filter(Boolean).join(' ')

  return (
    <div className={wrapperClassName}>
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        className={inputClass || undefined}
        aria-invalid={error ? 'true' : undefined}
        {...props}
      />
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
