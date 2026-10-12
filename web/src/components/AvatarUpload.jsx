import { useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'
import Avatar from './Avatar'

const OK = ['image/jpeg', 'image/png', 'image/webp']

async function toSquare(file, size = 400) {
  const bmp = await createImageBitmap(file)
  const s = Math.min(bmp.width, bmp.height)
  const c = document.createElement('canvas')
  c.width = c.height = size
  c.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size)
  return new Promise(res => c.toBlob(res, 'image/jpeg', 0.85))
}

const pathOf = url => {
  const m = '/avatars/'
  const i = url ? url.indexOf(m) : -1
  return i >= 0 ? decodeURIComponent(url.slice(i + m.length).split('?')[0]) : null
}

export default function AvatarUpload({ researcher, userId, onDone }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function pick(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!OK.includes(file.type)) { setErr('Chỉ nhận ảnh JPG, PNG hoặc WebP.'); return }
    if (file.size > 10 * 1024 * 1024) { setErr('Ảnh quá lớn (tối đa 10MB).'); return }
    setBusy(true); setErr('')
    try {
      const blob = await toSquare(file)
      const path = `${userId}/${Date.now()}.jpg`
      const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' })
      if (up.error) throw up.error
      const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      const { error } = await supabase.from('researchers').update({ avatar_url: url }).eq('id', researcher.id)
      if (error) throw error
      const old = pathOf(researcher.avatar_url)
      if (old) await supabase.storage.from('avatars').remove([old])
      await onDone()
    } catch (e2) {
      setErr('Không tải được ảnh: ' + (e2.message || e2))
    }
    setBusy(false)
  }

  async function remove() {
    if (!confirm('Gỡ ảnh đại diện?')) return
    setBusy(true)
    const old = pathOf(researcher.avatar_url)
    await supabase.from('researchers').update({ avatar_url: null }).eq('id', researcher.id)
    if (old) await supabase.storage.from('avatars').remove([old])
    await onDone()
    setBusy(false)
  }

  return (
    <div className="avatar-up">
      <Avatar name={researcher.full_name} url={researcher.avatar_url} size="xl" />
      <div>
        <div className="actions">
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            <Camera size={16} /> {busy ? 'Đang tải...' : researcher.avatar_url ? 'Đổi ảnh' : 'Tải ảnh đại diện'}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} disabled={busy} style={{ display: 'none' }} />
          </label>
          {researcher.avatar_url && (
            <button type="button" className="btn btn-ghost" onClick={remove} disabled={busy}><Trash2 size={16} /> Gỡ ảnh</button>
          )}
        </div>
        <p className="hint" style={{ marginTop: 8 }}>Ảnh JPG, PNG hoặc WebP. Hệ thống tự cắt vuông ở giữa ảnh.</p>
        {err && <div className="auth-error" style={{ marginTop: 8 }}>{err}</div>}
      </div>
    </div>
  )
}