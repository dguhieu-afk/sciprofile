import { Packer } from 'docx'
import { supabase } from './supabase'
import { buildCvDoc } from './cvDoc'
import { sortEducation } from './academicLogic'

const ascii = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9]+/g, '_')

export async function downloadCV(id) {
  const [r, pr, edu, exp, lg, pj, pa, og] = await Promise.all([
    supabase.from('researchers').select('*').eq('id', id).single(),
    supabase.from('researcher_private').select('*').eq('researcher_id', id).maybeSingle(),
    supabase.from('researcher_education').select('*').eq('researcher_id', id),
    supabase.from('researcher_experience').select('*').eq('researcher_id', id).order('start_year', { ascending: false }),
    supabase.from('researcher_languages').select('*').eq('researcher_id', id).order('id'),
    supabase.from('researcher_projects').select('*').eq('researcher_id', id).order('start_year', { ascending: false }),
    supabase.from('publication_authors').select('publications(id,title,doi,publication_year,journal,status)').eq('researcher_id', id),
    supabase.from('organizations').select('id,name,parent_id'),
  ])
  for (const result of [r, pr, edu, exp, lg, pj, pa, og]) if (result.error) throw result.error

  const map = new Map((og.data || []).map(o => [o.id, o]))
  const names = []
  let cur = map.get(r.data.organization_id)
  while (cur && names.length < 5) { names.push(cur.name); cur = map.get(cur.parent_id) }

  // Bao gồm công trình gắn tác giả VÀ công trình do chính tài khoản tạo.
  // Trạng thái được ghi rõ trong CV, không gọi bài chờ duyệt là đã công bố.
  let owned = []
  if (r.data.user_id) {
    const own = await supabase.from('publications')
      .select('id,title,doi,publication_year,journal,status,created_by')
      .eq('created_by', r.data.user_id)
    if (own.error) throw own.error
    owned = own.data || []
  }
  const authored = (pa.data || []).map(x => x.publications).filter(Boolean)
  const keyOf = item => item.id || `${item.title || ''}-${item.publication_year || ''}`
  const unique = new Map()
  for (const item of [...authored, ...owned]) unique.set(keyOf(item), item)
  const pubs = [...unique.values()]
    .sort((a, b) => Number(b.publication_year || 0) - Number(a.publication_year || 0))

  const doc = buildCvDoc({
    r: r.data, p: pr.data || {},
    orgChain: names.join(', '), rootOrg: names[names.length - 1] || '',
    edu: sortEducation(edu.data || []), exp: exp.data || [], langs: lg.data || [],
    projects: pj.data || [], pubs,
  })

  const blob = await Packer.toBlob(doc)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `Ly_lich_khoa_hoc_${ascii(r.data.full_name)}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}