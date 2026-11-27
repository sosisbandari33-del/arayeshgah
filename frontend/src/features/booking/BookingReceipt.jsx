import { Button, Card } from '../../ui'
import { formatPrice, toPersianDigits } from '../../utils/persian'

function BookingReceipt({ appointment, onNewBooking, onGoHome }) {
  const timeLabel = appointment.end_time
    ? `${toPersianDigits(appointment.start_time)} تا ${toPersianDigits(appointment.end_time)}`
    : toPersianDigits(appointment.start_time)

  return (
    <div className="booking-container">
      <Card className="success-card">
        <div className="success-icon">✅</div>
        <h2>نوبت شما با موفقیت ثبت شد!</h2>
        <p className="success-subtitle">اطلاعات نوبت شما در سیستم ذخیره گردید.</p>

        <div className="receipt-box">
          <div className="receipt-item">
            <span className="receipt-label">شماره پیگیری:</span>
            <span className="receipt-value">#{toPersianDigits(appointment.id)}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">نام مشتری:</span>
            <span className="receipt-value">{appointment.customer_name}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">شماره تماس:</span>
            <span className="receipt-value">{toPersianDigits(appointment.customer_phone)}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">خدمات انتخابی:</span>
            <span className="receipt-value receipt-services-text">{appointment.service_name}</span>
          </div>
          {appointment.total_duration > 0 && (
            <div className="receipt-item">
              <span className="receipt-label">مجموع مدت:</span>
              <span className="receipt-value">{toPersianDigits(appointment.total_duration)} دقیقه</span>
            </div>
          )}
          {appointment.total_price > 0 && (
            <div className="receipt-item">
              <span className="receipt-label">مجموع هزینه:</span>
              <span className="receipt-value">{formatPrice(appointment.total_price)} تومان</span>
            </div>
          )}
          <div className="receipt-item">
            <span className="receipt-label">تاریخ نوبت:</span>
            <span className="receipt-value">{toPersianDigits(appointment.date)}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">ساعت نوبت:</span>
            <span className="receipt-value time-badge">{timeLabel}</span>
          </div>
          <div className="receipt-item">
            <span className="receipt-label">وضعیت:</span>
            <span className="status-pill">{appointment.status}</span>
          </div>
        </div>

        <div className="success-actions">
          <Button variant="secondary" onClick={onNewBooking}>
            ثبت نوبت دیگر
          </Button>
          <Button variant="primary" onClick={onGoHome}>
            بازگشت به صفحه اصلی
          </Button>
        </div>
      </Card>
    </div>
  )
}

export default BookingReceipt
