import { useState } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import { supabase } from '../supabase'

const MAX = 20 * 1024 * 1024
const OK = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export default function FileUpload({ value, onChange, userId }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function pick(e) {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!OK.includes(file.type)) { setErr('Chỉ nhận file PDF hoặc Word (.doc, .docx).'); return }
    if (file.size > MAX) { setErr('File quá lớn, tối đa 20MB.'); return }
    setBusy(true); setErr('')
    const ext = file.name.split('.').pop().toLowerCase()
    const base = file.name.replace(/\.[^.]+$/, '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 60)
    const path = `${userId}/${Date.now()}-${base}.${ext}`
    const { error } = await supabase.storage.from('documents').upload(path, file, { contentType: file.type })
    setBusy(false)
    if (error) { setErr('Tải lên thất bại: ' + error.message); return }
    onChange(supabase.storage.from('documents').getPublicUrl(path).data.publicUrl)
  }

  async function remove() {
    const marker = '/documents/'
    const i = value.indexOf(marker)
    if (i >= 0) await supabase.storage.from('documents').remove([decodeURIComponent(value.slice(i + marker.length))])
    onChange('')
  }

  const fileName = value ? decodeURIComponent(value.split('/').pop()) : ''

  return (
    <div>
      <div className="upload-label">Tài liệu đính kèm (PDF hoặc Word, tối đa 20MB)</div>
      {value ? (
        <div className="upload-done">
          <FileText size={18} />
          <a href={value} target="_blank" rel="noreferrer">{fileName}</a>
          <button type="button" className="icon-btn" onClick={remove} title="Gỡ file"><X size={16} /></button>
        </div>
      ) : (
        <label className="upload-drop">
          <input type="file" accept=".pdf,.doc,.docx" onChange={pick} disabled={busy || !userId}
            style={{ display: 'none' }} />
          <Upload size={22} />
          <b>{busy ? 'Đang tải lên...' : 'Bấm để chọn file từ máy tính'}</b>
          <span>Hoặc dán đường dẫn bên dưới nếu tài liệu đã có trên mạng</span>
        </label>
      )}
      {!value && (
        <input className="upload-link" placeholder="https://... (Google Drive, ResearchGate...)"
          onBlur={e => e.target.value.trim() && onChange(e.target.value.trim())} />
      )}
      {err && <div className="auth-error" style={{ marginTop: 10 }}>{err}</div>}
    </div>
  )
}