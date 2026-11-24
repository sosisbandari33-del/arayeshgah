import { Link, useLocation } from 'react-router-dom'

function Header({ onEnsureServices }) {
  const { pathname } = useLocation()

  return (
    <header className="header">
      <div className="header-top">
        <Link to="/" className="logo-section">
          <span className="logo-badge">✂️</span>
          <div>
            <h1 className="salon-name">پیرایش کلاسیک</h1>
            <p className="salon-tagline">ارائه بهترین و باکیفیت‌ترین خدمات پیرایش و اصلاح آقایان</p>
          </div>
        </Link>

        <nav className="header-nav" aria-label="ناوبری اصلی">
          {pathname !== '/' && (
            <Link to="/" className="btn btn-header-secondary">
              🏠 صفحه اصلی
            </Link>
          )}

          {pathname !== '/booking' && (
            <Link
              to="/booking"
              className="btn btn-header-action"
              onClick={onEnsureServices}
            >
              📅 نوبت بگیر
            </Link>
          )}

          {pathname !== '/owner' && (
            <Link to="/owner" className="btn btn-header-outline">
              📋 پنل نوبت‌ها (مدیریت)
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Header
