import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import { fetchServices } from './features/services/servicesApi'
import ServicesPage from './features/services/ServicesPage'
import AdminServicesPage from './features/services/AdminServicesPage'
import AdminSchedulePage from './features/schedule/AdminSchedulePage'
import BookingPage from './features/booking/BookingPage'
import TrackingPage from './features/tracking/TrackingPage'
import AppointmentsPage from './features/appointments/AppointmentsPage'
import AdminLoginPage from './features/auth/AdminLoginPage'
import AdminLayout from './features/auth/AdminLayout'
import RequireAdminAuth from './features/auth/RequireAdminAuth'
import './styles/tokens.css'
import './styles/layout.css'

function App() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [servicesRefreshKey, setServicesRefreshKey] = useState(0)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    fetchServices(controller.signal)
      .then((data) => {
        if (!active) return
        setServices(Array.isArray(data) ? data : [])
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return
        setError(err.message)
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

  const handleEnsureServices = () => {
    if (services.length === 0 && !loading) {
      handleRetryServices()
    }
  }

  return (
    <div className="app-container">
      <Header onEnsureServices={handleEnsureServices} />

      <Routes>
        <Route
          path="/"
          element={
            <ServicesPage
              services={services}
              loading={loading}
              error={error}
              onRetryServices={handleRetryServices}
            />
          }
        />
        <Route
          path="/booking"
          element={
            <BookingPage
              services={services}
              servicesLoading={loading}
              servicesError={error}
              onRetryServices={handleRetryServices}
            />
          }
        />
        <Route path="/tracking" element={<TrackingPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdminAuth>
              <AdminLayout />
            </RequireAdminAuth>
          }
        >
          <Route index element={<Navigate to="appointments" replace />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route
            path="services"
            element={<AdminServicesPage onServicesChanged={handleRetryServices} />}
          />
          <Route path="schedule" element={<AdminSchedulePage />} />
        </Route>
        <Route path="/owner" element={<Navigate to="/admin/appointments" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </div>
  )
}

export default App
