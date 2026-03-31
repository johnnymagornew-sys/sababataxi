'use client'

import { useState, useCallback } from 'react'
import { AsYouType, isValidPhoneNumber } from 'libphonenumber-js'

interface Props {
  value: string
  onChange: (value: string, isValid: boolean) => void
}

function validate(val: string): boolean {
  if (!val) return false
  try {
    const isIntl = val.startsWith('+') || val.startsWith('00')
    return isIntl ? isValidPhoneNumber(val) : isValidPhoneNumber(val, 'IL')
  } catch {
    return false
  }
}

function format(raw: string): string {
  const isIntl = raw.startsWith('+') || raw.startsWith('00')
  const fmt = new AsYouType(isIntl ? undefined : 'IL')
  return fmt.input(raw)
}

export default function PhoneInput({ value, onChange }: Props) {
  const [touched, setTouched] = useState(false)

  const handleChange = useCallback((raw: string) => {
    const formatted = format(raw)
    onChange(formatted, validate(formatted))
  }, [onChange])

  const isValid = validate(value)
  const isIntl = value.startsWith('+') || value.startsWith('00')
  // Show error only after user has typed enough to tell
  const showError = touched && value.length >= 7 && !isValid
  const showOk = isValid

  let errorMsg = ''
  if (showError) {
    if (isIntl) {
      errorMsg = 'מספר בינלאומי לא תקין'
    } else if (!value.startsWith('0')) {
      errorMsg = 'מספר ישראלי חייב להתחיל ב-0 (לבינלאומי: הוסף + בהתחלה)'
    } else if (value.replace(/\D/g, '').length < 9) {
      errorMsg = 'מספר קצר מדי'
    } else if (value.replace(/\D/g, '').length > 10) {
      errorMsg = 'מספר ארוך מדי'
    } else {
      errorMsg = 'פורמט לא תקין — ישראלי: 05X-XXXXXXX'
    }
  }

  const borderColor = showOk
    ? 'var(--green)'
    : showError
    ? 'var(--red)'
    : undefined

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          type="tel"
          inputMode="tel"
          value={value}
          onChange={e => handleChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="050-0000000"
          dir="ltr"
          style={{
            textAlign: 'right',
            borderColor,
            boxShadow: showOk
              ? '0 0 0 3px rgba(39,174,96,0.15)'
              : showError
              ? '0 0 0 3px rgba(231,76,60,0.15)'
              : undefined,
            paddingLeft: 36,
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />
        {/* Status icon on the left (visual start in RTL) */}
        {showOk && (
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--green)', fontSize: 16, pointerEvents: 'none',
          }}>✓</span>
        )}
        {showError && (
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--red)', fontSize: 16, pointerEvents: 'none',
          }}>✗</span>
        )}
      </div>

      {/* Hint below input */}
      {showError ? (
        <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 5 }}>{errorMsg}</div>
      ) : !isIntl && !isValid && touched ? null : !isIntl && value.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>
          ישראל: 05X-XXXXXXX &nbsp;|&nbsp; חו&quot;ל: התחל עם +
        </div>
      ) : null}
    </div>
  )
}
