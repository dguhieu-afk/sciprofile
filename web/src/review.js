import { supabase } from './supabase'
import { fetchByDoi } from './doiLookup'

// Duyệt công trình; nếu có DOI thì admin xác nhận số trích dẫn từ Crossref
export async function approvePub(p, userId) {
  const upd = { status: 'APPROVED', admin_note: null }
  if (p.doi) {
    try { upd.citation_count = (await fetchByDoi(p.doi)).citation_count } catch { /* bỏ qua nếu Crossref lỗi */ }
  }
  const { error } = await supabase.from('publications').update(upd).eq('id', p.id)
  if (error) throw error
  await supabase.from('audit_logs').insert({
    user_id: userId, action: 'APPROVE', entity_type: 'PUBLICATION', entity_id: String(p.id),
    old_value: { status: 'PENDING' }, new_value: { status: 'APPROVED', citation_count: upd.citation_count ?? null },
  })
  return upd.citation_count ?? null
}