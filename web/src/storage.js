import { supabase } from './supabase'

// Mở tài liệu: link ngoài thì mở thẳng, file trong kho thì tạo link tạm thời (1 giờ)
export async function openFile(value) {
  if (!value) return
  if (/^https?:\/\//i.test(value)) { window.open(value, '_blank', 'noopener'); return }
  const w = window.open('', '_blank')
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(value, 3600)
  if (error || !data) {
    if (w) w.close()
    throw new Error('Không mở được tài liệu (có thể bạn chưa có quyền xem).')
  }
  if (w) w.location.href = data.signedUrl
  else window.location.href = data.signedUrl
}