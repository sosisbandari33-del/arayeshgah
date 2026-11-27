import { Button, Modal } from '../../ui'

function CancelAppointmentModal({ appointment, loading, error, onClose, onConfirm }) {
  return (
    <Modal
      isOpen={Boolean(appointment)}
      title="⚠️ تأیید لغو نوبت"
      error={error}
      actions={
        <>
          <Button variant="secondary" disabled={loading} onClick={onClose}>
            انصراف
          </Button>
          <Button variant="danger" disabled={loading} onClick={onConfirm}>
            {loading ? 'در حال لغو...' : 'بله، نوبت لغو شود'}
          </Button>
        </>
      }
    >
      {appointment && (
        <>
          <p>آیا از لغو نوبت زیر اطمینان دارید؟</p>
          <div className="confirm-details">
            <p><strong>مشتری:</strong> {appointment.customer_name}</p>
            <p>
              <strong>ساعت:</strong> {appointment.start_time}
              {appointment.end_time ? ` تا ${appointment.end_time}` : ''}
            </p>
            <p><strong>خدمت:</strong> {appointment.service_name}</p>
            <p><strong>تاریخ:</strong> {appointment.date}</p>
          </div>
          <p className="r4-notice">
            ℹ️ طبق قانون سیستم، رکورد نوبت حذف نخواهد شد و به وضعیت «لغو شده» تغییر یافته و ساعت آن مجدداً برای مشتریان دیگر آزاد خواهد گردید.
          </p>
        </>
      )}
    </Modal>
  )
}

export default CancelAppointmentModal
