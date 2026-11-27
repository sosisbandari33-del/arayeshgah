function EmptyState({ icon = '📋', title, description, action = null }) {
  return (
    <div className="ui-empty-state">
      <span className="ui-empty-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="ui-empty-title">{title}</p>
      {description && <p className="ui-empty-desc">{description}</p>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  )
}

export default EmptyState
