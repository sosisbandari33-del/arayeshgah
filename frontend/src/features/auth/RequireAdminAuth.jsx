import { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Button, Card } from '../../ui'
import { fetchCurrentAdmin } from './authApi'
import {
  AUTH_CHANGE_EVENT,
  clearAdminSession,
  getAdminToken,
  getStoredAdminPhone,
} from './authStorage'

function RequireAdminAuth({ children }) {
  const location = useLocation()
  const [token, setToken] = useState(() => getAdminToken())
  const [adminPhone, setAdminPhone] = useState(() => getStoredAdminPhone())
  const [verifying, setVerifying] = useState(() => Boolean(getAdminToken()))
  const [verifyError, setVerifyError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const syncAuth = () => {
      const nextToken = getAdminToken()
      setToken(nextToken)
      setAdminPhone(getStoredAdminPhone())
      if (!nextToken) {
        setVerifying(false)
        setVerifyError(null)
      }
    }
    window.addEventListener(AUTH_CHANGE_EVENT, syncAuth)
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, syncAuth)
  }, [])

  useEffect(() => {
    if (!token) return

    let active = true
    const controller = new AbortController()

    fetchCurrentAdmin(controller.signal)
      .then((data) => {
        if (!active) return
        if (data?.admin?.phone) {
          setAdminPhone(data.admin.phone)
        }
        setVerifyError(null)
        setVerifying(false)
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return
        if (err.status === 401) {
          clearAdminSession()
          return
        }
        setVerifyError(err.message)
        setVerifying(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [token, retryKey])

  if (!token) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  }

  if (verifying) {
    return (
      <Card className="status-box loading">
        <p>در حال بررسی دسترسی مدیریت...</p>
      </Card>
    )
  }

  if (verifyError) {
    return (
      <Card className="status-box error">
        <p>❌ {verifyError}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
          <Button
            variant="retry"
            onClick={() => {
              setVerifying(true)
              setVerifyError(null)
              setRetryKey((prev) => prev + 1)
            }}
          >
            تلاش مجدد
          </Button>
          <Button variant="secondary" onClick={clearAdminSession}>
            خروج از حساب
          </Button>
        </div>
      </Card>
    )
  }

  return typeof children === 'function' ? children({ adminPhone }) : children
}

export default RequireAdminAuth
