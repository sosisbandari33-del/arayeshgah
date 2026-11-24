import { useState, useEffect } from 'react'
import BookingPage from './BookingPage'
import OwnerAppointmentsPage from './OwnerAppointmentsPage'
import './App.css'

const getViewFromPath = (pathname) => {
  if (pathname === '/booking') return 'booking'
  if (pathname === '/owner') return 'owner'
  return 'home'
}

const getPathFromView = (view) => {
  if (view === 'booking') return '/booking'
  if (view === 'owner') return '/owner'
  return '/'
}

function App() {
  const [currentView, setCurrentView] = useState(() => getViewFromPath(window.location.pathname))
  const [selectedServiceId, setSelectedServiceId] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [servicesRefreshKey, setServicesRefreshKey] = useState(0)

  // همگام‌سازی دکمه‌های Back و Forward مرورگر با صفحه فعلی
  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(getViewFromPath(window.location.pathname))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // دریافت لیست خدمات از سرور با پاک‌سازی ایمن درخواست
  useEffect(() => {
    let active = true
    const controller = new AbortController()

    fetch('/api/services', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          throw new Error('خطا در دریافت لیست خدمات از سرور')
        }
        return res.json()
      })
      .then((data) => {
        if (!active) return
        setServices(Array.isArray(data) ? data : [])
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return
        let msg = err.message
        if (!msg || msg.includes('Failed to fetch') || msg.includes('NetworkError') || err.name === 'TypeError') {
          msg = 'سرور در دسترس نیست'
        }
        setError(msg)
        setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [servicesRefreshKey])

  const handleRetryServices = () => {
    setLoading(true)
    setError(null)
    setServicesRefreshKey((prev) => prev + 1)
  }

  const navigateTo = (view, serviceId = null) => {
    if (view === 'booking') {
      setSelectedServiceId(serviceId)
      if (services.length === 0 && !loading) {
        handleRetryServices()
      }
    }
    setCurrentView(view)
    const targetPath = getPathFromView(view)
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ view }, '', targetPath)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-container">
      {/* هدر سایت و ناوبری */}
      <header className="header">
        <div className="header-top">
          <div className="logo-section">
            <span className="logo-badge">✂️</span>
            <div>
              <h1 className="salon-name">پیرایش کلاسیک</h1>
              <p className="salon-tagline">ارائه بهترین و باکیفیت‌ترین خدمات پیرایش و اصلاح آقایان</p>
            </div>
          </div>

          <div className="header-nav">
            {currentView !== 'home' && (
              <button
                className="btn btn-header-secondary"
                onClick={() => navigateTo('home')}
              >
                🏠 صفحه اصلی
              </button>
            )}

            {currentView !== 'booking' && (
              <button
                className="btn btn-header-action"
                onClick={() => navigateTo('booking', null)}
              >
                📅 نوبت بگیر
              </button>
            )}

            {currentView !== 'owner' && (
              <button
                className="btn btn-header-outline"
                onClick={() => navigateTo('owner')}
              >
                📋 پنل نوبت‌ها (مدیریت)
              </button>
            )}
          </div>
        </div>
      </header>

      {/* محتوای صفحات */}
      {currentView === 'booking' && (
        <BookingPage
          services={services}
          servicesLoading={loading}
          servicesError={error}
          onRetryServices={handleRetryServices}
          preSelectedServiceId={selectedServiceId}
          onBack={() => navigateTo('home')}
        />
      )}

      {currentView === 'owner' && (
        <OwnerAppointmentsPage
          onBack={() => navigateTo('home')}
        />
      )}

      {currentView === 'home' && (
        <main className="main-content">
          <div className="section-header">
            <div>
              <h2>لیست خدمات و تعرفه‌ها</h2>
              <p className="section-subtitle">خدمت مورد نظر خود را انتخاب کرده و سریع نوبت بگیرید.</p>
            </div>
            <div className="header-actions">
              <span className="badge">ساعت کاری: ۱۰:۰۰ الی ۲۰:۰۰</span>
              <button
                className="btn btn-primary-pill"
                onClick={() => navigateTo('booking', null)}
              >
                رزرو وقت حضوری
              </button>
            </div>
          </div>

          {loading && (
            <div className="status-box loading">
              <p>در حال بارگذاری لیست خدمات...</p>
            </div>
          )}

          {error && (
            <div className="status-box error">
              <p>❌ برقراری ارتباط با سرور ممکن نیست ({error})</p>
              <p className="hint">لطفاً مطمئن شوید بک‌اند روی پورت ۸۰۰۰ فعال است.</p>
              <button className="retry-btn" onClick={handleRetryServices}>تلاش مجدد</button>
            </div>
          )}

          {!loading && !error && (
            <div className="services-grid">
              {services.map((service) => (
                <div key={service.id} className="service-card">
                  <div className="service-header">
                    <h3 className="service-title">{service.name}</h3>
                  </div>

                  <div className="service-details">
                    <div className="detail-item">
                      <span className="label">مدت زمان:</span>
                      <span className="value">⏱ {service.duration} دقیقه</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">قیمت:</span>
                      <span className="price-value">
                        {Number(service.price).toLocaleString('fa-IR')} <small>تومان</small>
                      </span>
                    </div>
                  </div>

                  <button
                    className="book-btn"
                    onClick={() => navigateTo('booking', service.id)}
                  >
                    رزرو نوبت این خدمت
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* فوتر */}
      <footer className="footer">
        <p>سیستم نوبت‌دهی پیرایش کلاسیک &copy; تمامی حقوق محفوظ است.</p>
      </footer>
    </div>
  )
}

export default App
