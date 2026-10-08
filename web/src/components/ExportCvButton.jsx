import { useState } from 'react'
import { FileDown } from 'lucide-react'

export default function ExportCvButton({ researcherId, className = 'btn btn-primary' }) {
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    try {
      const { downloadCV } = await import('../exportCV')
      await downloadCV(researcherId)
    } catch (e) {
      alert('Không xuất được CV: ' + e.message)
    }
    setBusy(false)
  }
  return (
    <button type="button" className={className} onClick={go} disabled={busy}>
      <FileDown size={16} /> {busy ? 'Đang tạo file...' : 'Xuất CV (Word)'}
    </button>
  )
}