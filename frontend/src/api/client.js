const DEFAULT_NETWORK_ERROR =
  'برقراری ارتباط با سرور ممکن نیست. لطفاً مطمئن شوید سرور بک‌اند در حال اجراست.'

function extractServerError(data, fallback) {
  if (typeof data?.detail === 'string') {
    return data.detail
  }
  if (Array.isArray(data?.detail)) {
    return data.detail.map((item) => item.msg || JSON.stringify(item)).join(' - ')
  }
  if (typeof data?.detail === 'object' && data.detail !== null) {
    return data.detail.msg || JSON.stringify(data.detail)
  }
  return fallback
}

/**
 * لایه‌ی مرکزی ارسال درخواست به API بک‌اند (مسیر یکپارچه‌ی /api)
 * آماده‌ی افزودن هدر احراز هویت (Authorization) در سطح ۲
 */
export async function requestJson(
  path,
  {
    method = 'GET',
    body,
    signal,
    timeoutMs = 0,
    fallbackError = 'خطایی در ارتباط با سرور رخ داد.',
    networkError = DEFAULT_NETWORK_ERROR,
  } = {}
) {
  const controller = new AbortController()
  let timedOut = false

  const handleExternalAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      signal.addEventListener('abort', handleExternalAbort, { once: true })
    }
  }

  const timeoutId = timeoutMs
    ? setTimeout(() => {
        timedOut = true
        controller.abort()
      }, timeoutMs)
    : null

  const headers = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  try {
    const res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    let data = {}
    try {
      data = await res.json()
    } catch {
      data = {}
    }

    if (!res.ok) {
      const serverErr = new Error(extractServerError(data, fallbackError))
      serverErr.isServerResponse = true
      serverErr.status = res.status
      if (data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
        serverErr.fieldErrors = data.errors
      }
      throw serverErr
    }

    return data
  } catch (err) {
    if (err.name === 'AbortError' && !timedOut && signal?.aborted) {
      throw err
    }
    if (err.isServerResponse) {
      throw err
    }
    throw new Error(networkError)
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    if (signal) signal.removeEventListener('abort', handleExternalAbort)
  }
}
