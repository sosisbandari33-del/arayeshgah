const VARIANT_CLASSES = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  danger: 'btn btn-danger',
  submit: 'btn btn-submit',
  'primary-pill': 'btn btn-primary-pill',
  book: 'book-btn',
  nav: 'btn-nav',
  'cancel-action': 'btn-cancel-action',
  retry: 'retry-btn',
  'retry-small': 'retry-btn-small',
  'back-link': 'back-link',
}

function Button({ variant = 'primary', type = 'button', className = '', children, ...props }) {
  const baseClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary
  const combinedClass = className ? `${baseClass} ${className}` : baseClass

  return (
    <button type={type} className={combinedClass} {...props}>
      {children}
    </button>
  )
}

export default Button
