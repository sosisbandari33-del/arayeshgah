const ALERT_CLASSES = {
  error: 'error-alert',
  success: 'success-banner',
  'box-error': 'slot-error-box',
}

function Alert({ variant = 'error', className = '', children }) {
  const baseClass = ALERT_CLASSES[variant] || ALERT_CLASSES.error
  const combinedClass = className ? `${baseClass} ${className}` : baseClass
  return <div className={combinedClass}>{children}</div>
}

export default Alert
