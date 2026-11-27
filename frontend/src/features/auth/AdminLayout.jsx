import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { clearAdminSession, getStoredAdminPhone } from './authStorage'
import './auth.css'

function AdminLayout() {
  const navigate = useNavigate()
  const adminPhone = getStoredAdminPhone()

  const handleLogout = () => {
    clearAdminSession()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <div className="admin-topbar-right">
          <span className="admin-panel-badge">🔐 پنل مدیریت</span>
          <nav className="admin-tabs" aria-label="بخش‌های پنل مدیریت">
            <NavLink
              to="/admin/appointments"
              className={({ isActive }) => `admin-tab-link ${isActive ? 'active' : ''}`.trim()}
            >
              📋 مدیریت نوبت‌ها
            </NavLink>
          </nav>
        </div>

        <div className="admin-topbar-left">
          {adminPhone && <span className="admin-user-pill">👤 {adminPhone}</span>}
          <button type="button" className="btn-logout" onClick={handleLogout}>
            خروج از حساب
          </button>
        </div>
      </div>

      <Outlet />
    </div>
  )
}

export default AdminLayout
