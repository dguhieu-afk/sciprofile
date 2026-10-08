import { Packer } from 'docx'
import { supabase } from './supabase'
import { buildCvDoc } from './cvDoc'

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
    supabase.from('publication_authors').select('publications(title,publication_year,journal,status)').eq('researcher_id', id),
    supabase.from('organizations').select('id,name,parent_id'),
  ])
  if (r.error) throw r.error

  const map = new Map((og.data || []).map(o => [o.id, o]))
  const names = []
  let cur = map.get(r.data.organization_id)
  while (cur && names.length < 5) { names.push(cur.name); cur = map.get(cur.parent_id) }

  const pubs = (pa.data || []).map(x => x.publications)
    .filter(p => p && p.status === 'APPROVED')
    .sort((a, b) => (b.publication_year || 0) - (a.publication_year || 0))

  const doc = buildCvDoc({
    r: r.data, p: pr.data || {},
    orgChain: names.join(', '), rootOrg: names[names.length - 1] || '',
    edu: edu.data || [], exp: exp.data || [], langs: lg.data || [],
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