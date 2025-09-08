'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export default function SupabasePing() {
  const [status, setStatus] = useState<'pending' | 'ok' | 'error'>('pending')
  const [message, setMessage] = useState<string>('probando…')

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setStatus('error')
        setMessage(error.message)
      } else {
        setStatus('ok')
        setMessage('conectado ✅')
      }
    })
  }, [])

  return (
    <p>
      Supabase: {status === 'pending' ? 'probando…' : status === 'ok' ? message : `error ❌: ${message}`}
    </p>
  )
}
