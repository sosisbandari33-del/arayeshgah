export function Input({ id, label, hint, wrapperClassName = 'form-group', ...props }) {
  return (
    <div className={wrapperClassName}>
      {label && <label htmlFor={id}>{label}</label>}
      <input id={id} {...props} />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

export function Select({ id, label, hint, children, wrapperClassName = 'form-group', ...props }) {
  return (
    <div className={wrapperClassName}>
      {label && <label htmlFor={id}>{label}</label>}
      <select id={id} {...props}>
        {children}
      </select>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

export default Input
