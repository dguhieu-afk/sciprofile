import { useEffect, useState } from 'react'
import { FileText, Upload, ExternalLink, Trash2 } from 'lucide-react'
import { supabase } from '../supabase'

const BUCKET = 'researcher-cvs'
const MAX_BYTES = 10 * 1024 * 1024
const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

// CV đính kèm thuộc tài khoản hiện tại. Tên ghi trên CV không thay đổi danh tính chủ tài khoản.
export default function CvAttachmentUpload({ researcherId, userId }) {
  const [stored, setStored] = useState(null)
  const [cvName, setCvName] = useState('')
  const [draftName, setDraftName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let live = true
    if (!researcherId) return
    supabase.from('researcher_private')
      .select('uploaded_cv_path, uploaded_cv_name')
      .eq('researcher_id', researcherId).maybeSingle()
      .then(({ data, error: err }) => {
        if (!live) return
        if (err) { setError('Không đọc được CV đính kèm: ' + err.message); return }
        setStored(data?.uploaded_cv_path || null)
        setCvName(data?.uploaded_cv_name || '')
        setDraftName(data?.uploaded_cv_name || '')
      })
    return () => { live = false }
  }, [researcherId])

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !userId || !researcherId) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!MIME[ext] || file.type !== MIME[ext]) {
      setError('Chỉ chấp nhận CV định dạng PDF hoặc DOCX.'); return
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      setError('CV phải có dung lượng từ 1 byte đến 10 MB.'); return
    }
    if (!draftName.trim() || draftName.trim().length < 2) {
      setError('Vui lòng nhập họ tên đúng như trên CV trước khi tải lên.'); return
    }
    setBusy(true); setError(''); setNotice('')
    const filename = `${userId}/${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filename, file, {
      contentType: MIME[ext], upsert: false,
    })
    if (uploadError) { setError('Không tải lên được CV: ' + uploadError.message); setBusy(false); return }
    const { error: dataError } = await supabase.from('researcher_private').upsert({
      researcher_id: researcherId,
      uploaded_cv_path: filename,
      uploaded_cv_name: draftName.trim(),
    }, { onConflict: 'researcher_id' })
    if (dataError) {
      await supabase.storage.from(BUCKET).remove([filename])
      setError('Không lưu được thông tin CV: ' + dataError.message)
      setBusy(false)
      return
    }
    if (stored && stored !== filename) await supabase.storage.from(BUCKET).remove([stored])
    setStored(filename)
    setCvName(draftName.trim())
    setNotice('Đã tải CV lên hồ sơ của tài khoản đang đăng nhập.')
    setBusy(false)
  }

  async function view() {
    if (!stored) return
    setError('')
    const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(stored, 60)
    if (err || !data?.signedUrl) { setError('Không mở được CV: ' + (err?.message || 'Không có quyền')); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function remove() {
    if (!stored || !window.confirm('Bạn muốn gỡ CV đã tải lên?')) return
    setBusy(true); setError(''); setNotice('')
    const { error: err } = await supabase.from('researcher_private').update({
      uploaded_cv_path: null, uploaded_cv_name: null,
    }).eq('researcher_id', researcherId)
    if (err) { setError('Không gỡ được CV: ' + err.message); setBusy(false); return }
    await supabase.storage.from(BUCKET).remove([stored])
    setStored(null); setCvName(''); setDraftName('')
    setNotice('Đã gỡ CV đính kèm.')
    setBusy(false)
  }

  return (
    <section className="cv-upload-panel" style={{ margin: '14px 0 24px', padding: 18, border: '1px solid #d8e2f0', borderRadius: 14, background: '#f7faff' }}>
      <h3 style={{ margin: '0 0 6px', display: 'flex', gap: 8, alignItems: 'center', fontSize: 17 }}><FileText size={18}/> CV đính kèm (PDF/Word)</h3>
      <p style={{ margin: '4px 0 14px', color: '#52637c', fontSize: 13 }}>
        Tải CV riêng để lưu cùng hồ sơ. Tên ghi trong tài liệu có thể khác tên chủ tài khoản, nhưng không tự thay đổi thông tin xác thực hoặc tên hồ sơ của tài khoản.
      </p>
      <label style={{ display: 'block', maxWidth: 460, marginBottom: 12 }}>
        Họ và tên ghi trên CV
        <input value={draftName} onChange={e => setDraftName(e.target.value)} maxLength={150}
          placeholder="Nhập đúng họ tên trên tài liệu" style={{ width: '100%', marginTop: 6 }} disabled={busy}/>
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        <label className="btn btn-primary" style={{ cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Upload size={16}/> {busy ? 'Đang xử lý...' : stored ? 'Thay CV mới' : 'Tải CV lên'}
          <input aria-label="Chọn CV PDF hoặc DOCX" type="file" accept=".pdf,.docx" disabled={busy}
            onChange={upload} style={{ display: 'none' }}/>
        </label>
        {stored && <>
          <button type="button" className="btn btn-ghost" onClick={view} disabled={busy}><ExternalLink size={16}/> Xem CV</button>
          <button type="button" className="btn btn-ghost" onClick={remove} disabled={busy}><Trash2 size={16}/> Gỡ CV</button>
        </>}
      </div>
      {stored && <p style={{ margin: '9px 0 0', fontSize: 13 }}>Tên trên CV đính kèm: <strong>{cvName}</strong></p>}
      {notice && <p role="status" style={{ color: '#17764c', margin: '8px 0 0' }}>{notice}</p>}
      {error && <p role="alert" style={{ color: '#bd2b26', margin: '8px 0 0' }}>{error}</p>}
    </section>
  )
}
