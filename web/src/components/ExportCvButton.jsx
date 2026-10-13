import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { useUI } from '../ui'

export default function ExportCvButton({ researcherId, className = 'btn btn-primary' }) {
  const { toast } = useUI()
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    try {
      const { downloadCV } = await import('../exportCV')
      await downloadCV(researcherId)
      toast('Đã tạo file CV.', 'success')
    } catch (e) {
      toast('Không xuất được CV: ' + e.message, 'error')
    }
    setBusy(false)
  }
  return (
    <button type="button" className={className} onClick={go} disabled={busy}>
      <FileDown size={16} /> {busy ? 'Đang tạo file...' : 'Xuất CV (Word)'}
    </button>
  )
}