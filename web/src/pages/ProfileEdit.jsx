import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Eye, Lock } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { liveCap, titleCase } from '../utils'

const yearRange = (a, b) => (a ? `${a} – ${b || 'nay'}` : '')

function ItemSection({ title, hint, table, rid, fields, orderBy, render }) {
  const blank = Object.fromEntries(fields.map(f => [f.key, '']))
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState(blank)
  const [err, setErr] = useState('')

  async function load() {
    const { data } = await supabase.from(table).select('*')
      .eq('researcher_id', rid).order(orderBy, { ascending: false })
    setItems(data || [])
  }
  useEffect(() => { load() }, [rid]) // eslint-disable-line

  async function add(e) {
    e.preventDefault()
    const first = fields[0]
    if (!String(draft[first.key]).trim()) { setErr(`Vui lòng nhập "${first.label}".`); return }
    const row = { researcher_id: rid }
    fields.forEach(f => {
      const v = draft[f.key]
      row[f.key] = f.type === 'number' ? (v === '' ? null : parseInt(v, 10)) : (String(v).trim() || null)
    })
    const { error } = await supabase.from(table).insert(row)
    if (error) { setErr(error.message); return }
    setErr(''); setDraft(blank); load()
  }

  async function remove(id) {
    if (!confirm('Xóa mục này?')) return
    await supabase.from(table).delete().eq('id', id)
    load()
  }

  return (
    <section className="form-card">
      <h2>{title}</h2>
      {hint && <p className="hint">{hint}</p>}

      <div className="item-list">
        {items.length === 0 && <div className="item-empty">Chưa có mục nào.</div>}
        {items.map(i => {
          const r = render(i)
          return (
            <div className="item" key={i.id}>
              <div>
                <b>{r.main}</b>
                {r.sub && <div className="item-sub">{r.sub}</div>}
                {r.desc && <div className="item-desc">{r.desc}</div>}
              </div>
              <button className="icon-btn" onClick={() => remove(i.id)} title="Xóa"><Trash2 size={16} /></button>
            </div>
          )
        })}
      </div>

      <form className="add-form" onSubmit={add}>
        <div className="form-grid">
          {fields.map(f => (
            <label key={f.key} className={f.wide ? 'wide' : ''}>{f.label}
              {f.type === 'select' ? (
                <select value={draft[f.key]} onChange={e => setDraft({ ...draft, [f.key]: e.target.value })}>
                  <option value="">-- Chọn --</option>
                  {f.options.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea rows={2} value={draft[f.key]} placeholder={f.placeholder}
                  onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} />
              ) : (
                <input type={f.type || 'text'} value={draft[f.key]} placeholder={f.placeholder}
                  onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} />
              )}
            </label>
          ))}
        </div>
        {err && <div className="auth-error">{err}</div>}
        <button className="btn btn-ghost" type="submit"><Plus size={16} /> Thêm mục</button>
      </form>
    </section>
  )
}

export default function ProfileEdit() {
  const { user, researcher, ready, reload } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState(null)
  const [orgs, setOrgs] = useState([])
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (ready && !user) navigate('/login')
  }, [ready, user, navigate])

  useEffect(() => {
    if (!researcher) return
    supabase.from('researcher_private').select('*').eq('researcher_id', researcher.id).maybeSingle()
      .then(({ data: pr }) => setF({
        full_name: researcher.full_name || '',
        gender: researcher.gender || '',
        birth_date: pr?.birth_date || '',
        phone: pr?.phone || '',
        nationality: researcher.nationality || '',
        academic_title: researcher.academic_title || '',
        academic_degree: researcher.academic_degree || '',
        organization_id: researcher.organization_id || '',
        contact_email: researcher.contact_email || '',
        orcid: researcher.orcid || '',
        google_scholar_url: researcher.google_scholar_url || '',
        website: researcher.website || '',
        research_interests: researcher.research_interests || '',
        languages: researcher.languages || '',
        bio: researcher.bio || '',
      }))
  }, [researcher])

  useEffect(() => {
    supabase.from('organizations').select('id,name').order('id').then(({ data }) => setOrgs(data || []))
  }, [])

  if (!f || !researcher) return <main className="container page"><div className="empty">Đang tải...</div></main>

  const set = k => e => setF({ ...f, [k]: e.target.value })
  const today = new Date().toISOString().slice(0, 10)

  async function save(e) {
    e.preventDefault()
    setMsg('')
    const name = titleCase(f.full_name)
    if (name.length < 2) { setMsg('Họ tên không được để trống.'); return }

    let birthYear = null
    if (f.birth_date) {
      const d = new Date(f.birth_date)
      const age = new Date().getFullYear() - d.getFullYear()
      if (isNaN(d) || d > new Date() || age < 16 || d.getFullYear() < 1930) {
        setMsg('Ngày sinh không hợp lệ.'); return
      }
      birthYear = d.getFullYear()
    }
    const phone = f.phone.replace(/[\s.\-]/g, '')
    if (phone && !/^(0|\+84)\d{9,10}$/.test(phone)) {
      setMsg('Số điện thoại không hợp lệ (ví dụ 0912345678).'); return
    }

    setSaving(true)
    const t = v => (String(v).trim() || null)
    const { error } = await supabase.from('researchers').update({
      full_name: name,
      gender: t(f.gender), birth_year: birthYear, nationality: t(f.nationality),
      academic_title: t(f.academic_title), academic_degree: t(f.academic_degree),
      organization_id: f.organization_id === '' ? null : Number(f.organization_id),
      contact_email: t(f.contact_email), orcid: t(f.orcid),
      google_scholar_url: t(f.google_scholar_url), website: t(f.website),
      research_interests: t(f.research_interests), languages: t(f.languages),
      bio: t(f.bio), updated_at: new Date().toISOString(),
    }).eq('id', researcher.id)
    if (error) { setSaving(false); setMsg('Lỗi: ' + error.message); return }

    const priv = await supabase.from('researcher_private').upsert({
      researcher_id: researcher.id, phone: phone || null, birth_date: f.birth_date || null,
    }, { onConflict: 'researcher_id' })
    setSaving(false)
    if (priv.error) { setMsg('Lỗi: ' + priv.error.message); return }

    await reload()
    setMsg('Đã lưu thông tin.')
  }

  return (
    <main className="container page">
      <div className="page-head row-between">
        <div>
          <h1>Hồ sơ khoa học của tôi</h1>
          <p>Thông tin dưới đây sẽ hiển thị công khai trên lý lịch khoa học của bạn (trừ mục có biểu tượng khóa).</p>
        </div>
        <Link to={`/researchers/${researcher.id}`} className="btn btn-primary"><Eye size={16} /> Xem hồ sơ công khai</Link>
      </div>

      <form className="form-card" onSubmit={save}>
        <h2>Thông tin cá nhân</h2>
        <div className="form-grid">
          <label className="wide">Họ và tên *
            <input value={f.full_name} onChange={e => setF({ ...f, full_name: liveCap(e.target.value) })}
              placeholder="Nguyễn Văn A" />
          </label>
          <label>Giới tính
            <select value={f.gender} onChange={set('gender')}>
              <option value="">-- Chọn --</option>
              <option>Nam</option><option>Nữ</option><option>Khác</option>
            </select>
          </label>
          <label><span className="lock"><Lock size={12} /> Ngày sinh</span>
            <input type="date" value={f.birth_date} max={today} onChange={set('birth_date')} />
          </label>
          <label><span className="lock"><Lock size={12} /> Số điện thoại</span>
            <input type="tel" value={f.phone} onChange={set('phone')} placeholder="0912 345 678" />
          </label>
          <label>Quốc tịch
            <input value={f.nationality} onChange={set('nationality')} />
          </label>
          <label className="wide">Email liên hệ (công khai)
            <input type="email" value={f.contact_email} onChange={set('contact_email')} />
          </label>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          <Lock size={12} /> Ngày sinh và số điện thoại chỉ bạn và quản trị viên xem được. Hồ sơ công khai chỉ hiện năm sinh.
        </p>

        <h2>Đơn vị và học hàm, học vị</h2>
        <div className="form-grid">
          <label>Đơn vị công tác
            <select value={f.organization_id} onChange={set('organization_id')}>
              <option value="">-- Chọn --</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label>Chức danh
            <select value={f.academic_title} onChange={set('academic_title')}>
              <option value="">-- Chọn --</option>
              {['Trợ giảng', 'Giảng viên', 'Giảng viên chính', 'Nghiên cứu viên', 'Phó giáo sư', 'Giáo sư'].map(x => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label>Học vị cao nhất
            <select value={f.academic_degree} onChange={set('academic_degree')}>
              <option value="">-- Chọn --</option>
              {['Cử nhân', 'Kỹ sư', 'Thạc sĩ', 'Tiến sĩ', 'Tiến sĩ khoa học'].map(x => <option key={x}>{x}</option>)}
            </select>
          </label>
        </div>

        <h2>Định danh khoa học và liên kết</h2>
        <div className="form-grid">
          <label>ORCID
            <input value={f.orcid} onChange={set('orcid')} placeholder="0000-0000-0000-0000" />
          </label>
          <label>Google Scholar
            <input value={f.google_scholar_url} onChange={set('google_scholar_url')} placeholder="https://scholar.google.com/..." />
          </label>
          <label className="wide">Website cá nhân
            <input value={f.website} onChange={set('website')} placeholder="https://..." />
          </label>
        </div>

        <h2>Giới thiệu</h2>
        <div className="form-grid">
          <label className="wide">Lĩnh vực quan tâm (cách nhau bằng dấu phẩy)
            <input value={f.research_interests} onChange={set('research_interests')} placeholder="Trí tuệ nhân tạo, Học máy, Giáo dục số" />
          </label>
          <label className="wide">Ngoại ngữ
            <input value={f.languages} onChange={set('languages')} placeholder="Tiếng Anh (IELTS 7.0), Tiếng Nhật (N3)" />
          </label>
          <label className="wide">Tiểu sử tóm tắt
            <textarea rows={4} value={f.bio} onChange={set('bio')} placeholder="Vài dòng giới thiệu về hướng nghiên cứu và thành tựu của bạn..." />
          </label>
        </div>

        {msg && <div className={msg.startsWith('Đã') ? 'ok-msg' : 'auth-error'}>{msg}</div>}
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
      </form>

      <ItemSection
        title="Quá trình đào tạo" hint="Thêm lần lượt các bậc học của bạn."
        table="researcher_education" rid={researcher.id} orderBy="start_year"
        fields={[
          { key: 'degree', label: 'Bậc đào tạo *', type: 'select', options: ['Cử nhân', 'Kỹ sư', 'Thạc sĩ', 'Tiến sĩ', 'Thực tập sau tiến sĩ', 'Khác'] },
          { key: 'major', label: 'Chuyên ngành', placeholder: 'Khoa học máy tính' },
          { key: 'institution', label: 'Cơ sở đào tạo', placeholder: 'Đại học Bách khoa', wide: true },
          { key: 'start_year', label: 'Từ năm', type: 'number', placeholder: '2008' },
          { key: 'end_year', label: 'Đến năm', type: 'number', placeholder: '2012' },
        ]}
        render={i => ({
          main: `${i.degree}${i.major ? ' – ' + i.major : ''}`,
          sub: [i.institution, yearRange(i.start_year, i.end_year)].filter(Boolean).join(' • '),
        })}
      />

      <ItemSection
        title="Quá trình công tác" hint="Để trống 'Đến năm' nếu bạn vẫn đang làm việc ở đó."
        table="researcher_experience" rid={researcher.id} orderBy="start_year"
        fields={[
          { key: 'position', label: 'Vị trí *', placeholder: 'Giảng viên' },
          { key: 'organization', label: 'Đơn vị', placeholder: 'Khoa CNTT, Đại học ...' },
          { key: 'start_year', label: 'Từ năm', type: 'number' },
          { key: 'end_year', label: 'Đến năm', type: 'number' },
          { key: 'description', label: 'Mô tả công việc', type: 'textarea', wide: true },
        ]}
        render={i => ({
          main: `${i.position}${i.organization ? ' – ' + i.organization : ''}`,
          sub: yearRange(i.start_year, i.end_year),
          desc: i.description,
        })}
      />

      <ItemSection
        title="Khen thưởng và giải thưởng"
        table="researcher_awards" rid={researcher.id} orderBy="year"
        fields={[
          { key: 'title', label: 'Tên khen thưởng *', placeholder: 'Giải nhất sinh viên nghiên cứu khoa học', wide: true },
          { key: 'issuer', label: 'Đơn vị trao tặng' },
          { key: 'year', label: 'Năm', type: 'number' },
        ]}
        render={i => ({ main: i.title, sub: [i.issuer, i.year].filter(Boolean).join(' • ') })}
      />
    </main>
  )
}