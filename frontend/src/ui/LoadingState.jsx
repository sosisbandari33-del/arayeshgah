function LoadingState({
  variant = 'box',
  count = 3,
  label = 'در حال بارگذاری اطلاعات...',
}) {
  const items = Array.from({ length: count }, (_, idx) => idx)

  return (
    <div className="ui-loading-wrap" role="status" aria-live="polite">
      <p className="ui-loading-label">{label}</p>

      {variant === 'cards' && (
        <div className="ui-skeleton-cards">
          {items.map((i) => (
            <div key={i} className="ui-skeleton-card">
              <div className="ui-skeleton-line title" />
              <div className="ui-skeleton-line short" />
              <div className="ui-skeleton-line medium" />
              <div className="ui-skeleton-btn" />
            </div>
          ))}
        </div>
      )}

      {variant === 'slots' && (
        <div className="ui-skeleton-slots">
          {items.map((i) => (
            <div key={i} className="ui-skeleton-slot" />
          ))}
        </div>
      )}

      {variant === 'table' && (
        <div className="ui-skeleton-table">
          {items.map((i) => (
            <div key={i} className="ui-skeleton-row" />
          ))}
        </div>
      )}

      {variant === 'box' && (
        <div className="ui-skeleton-box">
          <div className="ui-skeleton-line title" />
          <div className="ui-skeleton-line medium" />
        </div>
      )}
    </div>
  )
}

export default LoadingState
