import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { fetchServices } from './api/client'
import Header from './components/Header'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import BookingPage from './pages/BookingPage'
import OwnerAppointmentsPage from './pages/OwnerAppointmentsPage'
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
            <HomePage
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
        <Route path="/owner" element={<OwnerAppointmentsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Footer />
    </div>
  )
}

export default App
