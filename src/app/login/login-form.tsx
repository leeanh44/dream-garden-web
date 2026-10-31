'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type Mode = 'signin' | 'signup'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Email hoặc mật khẩu không đúng.',
  'Email not confirmed': 'Email chưa được xác nhận. Kiểm tra hộp thư của bạn.',
  'User already registered': 'Email này đã được đăng ký.',
}

const toVietnameseAuthError = (message: string) =>
  AUTH_ERROR_MESSAGES[message] ??
  (message.toLowerCase().includes('password')
    ? 'Mật khẩu cần tối thiểu 6 ký tự.'
    : message)

export function LoginForm({ next, initialError }: { next?: string; initialError: string | null }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [info, setInfo] = useState<string | null>(null)

  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setInfo(null)

    const supabase = getSupabaseBrowserClient()

    if (mode === 'signin') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError(toVietnameseAuthError(signInError.message))
        setIsSubmitting(false)
        return
      }
      router.replace(safeNext)
      router.refresh()
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      },
    })
    setIsSubmitting(false)

    if (signUpError) {
      setError(toVietnameseAuthError(signUpError.message))
      return
    }

    if (data.session) {
      router.replace(safeNext)
      router.refresh()
      return
    }

    setInfo('Đã gửi email xác nhận. Mở link trong email để kích hoạt tài khoản.')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card space-y-4 p-6 shadow-leaf-lg"
    >
      <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-container-low p-1 text-sm font-semibold">
        {(['signin', 'signup'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value)
              setError(null)
              setInfo(null)
            }}
            className={`min-h-10 rounded-full transition-colors ${
              mode === value ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {value === 'signin' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="field-label">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="field-input"
          placeholder="ban@example.com"
        />
      </label>

      <label className="block">
        <span className="field-label">Mật khẩu</span>
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="field-input"
          placeholder="Tối thiểu 6 ký tự"
        />
      </label>

      {error ? (
        <p className="rounded-2xl bg-error-container px-4 py-3 text-sm text-on-error-container">{error}</p>
      ) : null}
      {info ? (
        <p className="rounded-2xl bg-secondary-container px-4 py-3 text-sm text-on-secondary-container">
          {info}
        </p>
      ) : null}

      <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
        {isSubmitting ? 'Đang xử lý…' : mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}
      </button>
    </form>
  )
}
