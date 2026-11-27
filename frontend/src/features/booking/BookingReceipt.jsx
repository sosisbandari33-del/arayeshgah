import { Link } from 'react-router-dom'
import { Button, Card } from '../../ui'
import { formatPrice, toPersianDigits } from '../../utils/persian'

function BookingReceipt({ appointment, onNewBooking, onGoHome }) {
  const timeLabel = appointment.end_time
    ? `${toPersianDigits(appointment.start_time)} تا ${toPersianDigits(appointment.end_time)}`
    : toPersianDigits(appointment.start_time)

  const trackingUrl = appointment.tracking_code
    ? `/tracking?phone=${encodeURIComponent(appointment.customer_phone)}&code=${encodeURIComponent(appointment.tracking_code)}`
    : '/tracking'

  return (
    <div className="booking-container">
      <Card className="success-card">
        <div className="success-icon">✅</div>
        <h2>نوبت شما با موفقیت ثبت شد!</h2>
        <p className="success-subtitle">
          کد پیگیری ۶ رقمی زیر را برای مشاهده یا لغو نوبت نزد خود نگه دارید.
        </p>

        {appointment.tracking_code && (
          <div className="tracking-code-highlight" aria-label="کد پیگیری ۶ رقمی">
            <span className="tracking-code-caption">کد پیگیری ۶ رقمی شما</span>
            <strong className="tracking-code-digits">
              {toPersianDigits(appointment.tracking_code)}
            </strong>
          </div>
        )}

        <div className="receipt-box">
          <div className="receipt-item">
            <span className="receipt-label">خدمت‌های انتخابی:</span>
            <span
              className="receipt-value receipt-services-text text-clamp-2"
              title={appointment.service_name}
            >
              {appointment.service_name}
            </span>
          </div>
          {appointment.total_duration > 0 && (
            <div className="receipt-item">
              <span className="receipt-label">مدت کل:</span>
              <span className="receipt-value">{toPersianDigits(appointment.total_duration)} دقیقه</span>
            </div>
          )}
          {appointment.total_price > 0 && (
            <div className="receipt-item">
              <span className="receipt-label">هزینه‌ی کل:</span>
              <span className="receipt-value">{formatPrice(appointment.total_price)} تومان</span>
            </div>
          )}
          <div className="receipt-item">
            <span className="receipt-label">روز نوبت:</span>
            <span className="receipt-value">{toPersianDigits(appointment.date)}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">ساعت نوبت:</span>
            <span className="receipt-value time-badge">{timeLabel}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">نام و موبایل:</span>
            <span className="receipt-value">
              {appointment.customer_name} ({toPersianDigits(appointment.customer_phone)})
            </span>
          </div>
        </div>

        <div className="success-actions">
          <Link to={trackingUrl} className="btn btn-primary">
            🔍 پیگیری یا لغو نوبت
          </Link>
          <Button variant="secondary" onClick={onNewBooking}>
            ثبت نوبت دیگر
          </Button>
          <Button variant="secondary" onClick={onGoHome}>
            صفحه اصلی
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default BookingReceipt
