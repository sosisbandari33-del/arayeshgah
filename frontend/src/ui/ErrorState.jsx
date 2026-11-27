import Alert from './Alert'
import Button from './Button'

function ErrorState({
  message = 'برقراری ارتباط با سرور ممکن نیست. لطفاً اتصال خود را بررسی کنید.',
  onRetry,
  retryLabel = 'دوباره تلاش کن',
}) {
  return (
    <Alert variant="error" className="ui-error-state">
      <div className="ui-error-state-body">
        <p className="ui-error-state-text">⚠️ {message}</p>
        {onRetry && (
          <Button type="button" variant="retry" onClick={onRetry}>
            🔄 {retryLabel}
          </Button>
        )}
      </div>
    </Alert>
  )
}

export default ErrorState
