import Alert from './Alert'

function Modal({ isOpen, title, error, actions, children }) {
  if (!isOpen) return null

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <h4>{title}</h4>
        </div>
        <div className="modal-body">
          {error && (
            <Alert variant="error">
              <span>⚠️ {error}</span>
            </Alert>
          )}
          {children}
        </div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  )
}

export default Modal
