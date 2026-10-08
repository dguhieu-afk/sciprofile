import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Eye, Lock } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { liveCap, titleCase, capFirst } from '../utils'
import ExportCvButton from '../components/ExportCvButton'

const yearRange = (a, b) => (a ? `${a} – ${b || 'nay'}` : '')
const num = v => (v === '' || v == null ? null : parseInt(v, 10))
const cleanPhone = s => String(s || '').replace(/[\s.\-]/g, '')
const phoneOk = s => !s || /^(0|\+84)\d{9,10}$/.test(s)

function ItemSection({ title, hint, table, rid, fields, orderBy, asc, render }) {
  const blank = Object.fromEntries(fields.map(f => [f.key, '']))
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState(blank)
  const [err, setErr] = useState('')

  async function load() {
    const { data } = await supabase.from(table).select('*')
      .eq('researcher_id', rid).order(orderBy, { ascending: !!asc })
    setItems(data || [])
  }
  useEffect(() => { load() }, [rid]) // eslint-disable-line

  async function add(e) {
    e.preventDefault()
    const first = fields[0]
    if (!String(draft[first.key]).trim()) { setErr(`Vui lòng nhập "${first.label.replace(' *', '')}".`); return }
    const row = { researcher_id: rid }
    fields.forEach(f => {
      const v = draft[f.key]
      row[f.key] = f.type === 'number' ? num(v) : (String(v).trim() || null)
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
                  onChange={e => setDraft({ ...draft, [f.key]: capFirst(e.target.value) })} />
              ) : (
                <input type={f.type || 'text'} value={draft[f.key]} placeholder={f.placeholder}
                  onChange={e => setDraft({ ...draft, [f.key]: f.type === 'number' ? e.target.value : liveCap(e.target.value) })} />
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

  useEffect(() => { if (ready && !user) navigate('/login') }, [ready, user, navigate])

  useEffect(() => {
    if (!researcher) return
    supabase.from('researcher_private').select('*').eq('researcher_id', researcher.id).maybeSingle()
      .then(({ data: pr }) => setF({
        full_name: researcher.full_name || '',
        gender: researcher.gender || '',
        birth_date: pr?.birth_date || '',
        birth_place: pr?.birth_place || '',
        hometown: pr?.hometown || '',
        ethnicity: pr?.ethnicity || '',
        nationality: researcher.nationality || '',
        address: pr?.address || '',
        phone: pr?.phone || '',
        phone_office: pr?.phone_office || '',
        phone_home: pr?.phone_home || '',
        fax: pr?.fax || '',
        contact_email: researcher.contact_email || '',
        position: researcher.position || '',
        academic_title: researcher.academic_title || '',
        title_year: researcher.title_year || '',
        academic_degree: researcher.academic_degree || '',
        degree_year: researcher.degree_year || '',
        degree_country: researcher.degree_country || '',
        organization_id: researcher.organization_id || '',
        orcid: researcher.orcid || '',
        google_scholar_url: researcher.google_scholar_url || '',
        website: researcher.website || '',
        research_interests: researcher.research_interests || '',
        bio: researcher.bio || '',
      }))
  }, [researcher])

  useEffect(() => {
    supabase.from('organizations').select('id,name').order('id').then(({ data }) => setOrgs(data || []))
  }, [])

  if (!f || !researcher) return <main className="container page"><div className="empty">Đang tải...</div></main>

  const set = k => e => setF({ ...f, [k]: e.target.value })
    const setCap = k => e => setF({ ...f, [k]: liveCap(e.target.value) })
  const setFirst = k => e => setF({ ...f, [k]: capFirst(e.target.value) })
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
    const phone = cleanPhone(f.phone), phoneO = cleanPhone(f.phone_office), phoneH = cleanPhone(f.phone_home)
    if (!phoneOk(phone) || !phoneOk(phoneO) || !phoneOk(phoneH)) {
      setMsg('Số điện thoại không hợp lệ (ví dụ 0912345678).'); return
    }

    setSaving(true)
    const t = v => (String(v).trim() || null)
    const { error } = await supabase.from('researchers').update({
      full_name: name,
      gender: t(f.gender), birth_year: birthYear, nationality: t(f.nationality),
      position: t(f.position),
      academic_title: t(f.academic_title), title_year: num(f.title_year),
      academic_degree: t(f.academic_degree), degree_year: num(f.degree_year), degree_country: t(f.degree_country),
      organization_id: f.organization_id === '' ? null : Number(f.organization_id),
      contact_email: t(f.contact_email), orcid: t(f.orcid),
      google_scholar_url: t(f.google_scholar_url), website: t(f.website),
      research_interests: t(f.research_interests),
      bio: t(f.bio), updated_at: new Date().toISOString(),
    }).eq('id', researcher.id)
    if (error) { setSaving(false); setMsg('Lỗi: ' + error.message); return }

    const priv = await supabase.from('researcher_private').upsert({
      researcher_id: researcher.id,
      birth_date: f.birth_date || null, birth_place: t(f.birth_place),
      hometown: t(f.hometown), ethnicity: t(f.ethnicity), address: t(f.address),
      phone: phone || null, phone_office: phoneO || null, phone_home: phoneH || null, fax: t(f.fax),
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
          <p>Điền đầy đủ để xuất lý lịch khoa học (Phụ lục III). Mục có biểu tượng khóa chỉ bạn và quản trị viên xem được.</p>
        </div>
        <div className="actions">
          <ExportCvButton researcherId={researcher.id} />
          <Link to={`/researchers/${researcher.id}`} className="btn btn-ghost"><Eye size={16} /> Hồ sơ công khai</Link>
        </div>
      </div>

      <form className="form-card" onSubmit={save}>
        <h2>I. Lý lịch sơ lược</h2>
        <div className="form-grid">
          <label className="wide">Họ và tên *
            <input value={f.full_name} onChange={e => setF({ ...f, full_name: liveCap(e.target.value) })} placeholder="Nguyễn Văn A" />
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
          <label><span className="lock"><Lock size={12} /> Nơi sinh</span>
            <input value={f.birth_place} onChange={setCap('birth_place')} placeholder="TP. Hồ Chí Minh" />
          </label>
          <label><span className="lock"><Lock size={12} /> Quê quán</span>
            <input value={f.hometown} onChange={setCap('hometown')} />
          </label>
          <label><span className="lock"><Lock size={12} /> Dân tộc</span>
            <input value={f.ethnicity} onChange={setCap('ethnicity')} placeholder="Kinh" />
          </label>
          <label>Quốc tịch
            <input value={f.nationality} onChange={setCap('nationality')} />
          </label>
          <label className="wide"><span className="lock"><Lock size={12} /> Chỗ ở riêng hoặc địa chỉ liên lạc</span>
            <input value={f.address} onChange={setCap('address')} />
          </label>
          <label><span className="lock"><Lock size={12} /> Điện thoại cơ quan (CQ)</span>
            <input type="tel" value={f.phone_office} onChange={set('phone_office')} />
          </label>
          <label><span className="lock"><Lock size={12} /> Điện thoại nhà riêng (NR)</span>
            <input type="tel" value={f.phone_home} onChange={set('phone_home')} />
          </label>
          <label><span className="lock"><Lock size={12} /> Điện thoại di động (DĐ)</span>
            <input type="tel" value={f.phone} onChange={set('phone')} placeholder="0912 345 678" />
          </label>
          <label><span className="lock"><Lock size={12} /> Fax</span>
            <input value={f.fax} onChange={set('fax')} />
          </label>
          <label>Email liên hệ (công khai)
            <input type="email" value={f.contact_email} onChange={set('contact_email')} />
          </label>
        </div>

        <h2>Đơn vị, chức vụ, học hàm, học vị</h2>
        <div className="form-grid">
          <label>Đơn vị công tác
            <select value={f.organization_id} onChange={set('organization_id')}>
              <option value="">-- Chọn --</option>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="wide">Chức vụ (hiện tại hoặc trước khi nghỉ hưu)
            <input value={f.position} onChange={setCap('position')} placeholder="Trưởng bộ môn" />
          </label>
          <label>Chức danh khoa học cao nhất
            <select value={f.academic_title} onChange={set('academic_title')}>
              <option value="">-- Chọn --</option>
              {['Trợ giảng', 'Giảng viên', 'Giảng viên chính', 'Nghiên cứu viên', 'Phó giáo sư', 'Giáo sư'].map(x => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label>Năm bổ nhiệm
            <input type="number" value={f.title_year} onChange={set('title_year')} />
          </label>
          <span />
          <label>Học vị cao nhất
            <select value={f.academic_degree} onChange={set('academic_degree')}>
              <option value="">-- Chọn --</option>
              {['Cử nhân', 'Kỹ sư', 'Thạc sĩ', 'Tiến sĩ', 'Tiến sĩ khoa học'].map(x => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label>Năm nhận học vị
            <input type="number" value={f.degree_year} onChange={set('degree_year')} />
          </label>
          <label>Nước nhận học vị
            <input value={f.degree_country} onChange={setCap('degree_country')} placeholder="Việt Nam" />
          </label>
        </div>

        <h2>Định danh khoa học và giới thiệu</h2>
        <div className="form-grid">
          <label>ORCID
            <input value={f.orcid} onChange={set('orcid')} placeholder="0000-0000-0000-0000" />
          </label>
          <label>Google Scholar
            <input value={f.google_scholar_url} onChange={set('google_scholar_url')} placeholder="https://scholar.google.com/..." />
          </label>
          <label>Website cá nhân
            <input value={f.website} onChange={set('website')} placeholder="https://..." />
          </label>
          <label className="wide">Lĩnh vực quan tâm (cách nhau bằng dấu phẩy)
            <input value={f.research_interests} onChange={set('research_interests')} placeholder="Trí tuệ nhân tạo, Học máy, Giáo dục số" />
          </label>
          <label className="wide">Tiểu sử tóm tắt
            <textarea rows={4} value={f.bio} onChange={setFirst('bio')} placeholder="Vài dòng giới thiệu về hướng nghiên cứu và thành tựu của bạn..." />
          </label>
        </div>

        {msg && <div className={msg.startsWith('Đã') ? 'ok-msg' : 'auth-error'}>{msg}</div>}
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
      </form>

      <ItemSection
        title="II. Quá trình đào tạo"
        hint="Đại học: chọn Cử nhân/Kỹ sư (nhập bằng thứ hai nếu có). Sau đại học: chọn Thạc sĩ, Tiến sĩ và nhập tên luận văn/luận án."
        table="researcher_education" rid={researcher.id} orderBy="end_year"
        fields={[
          { key: 'degree', label: 'Bậc đào tạo *', type: 'select', options: ['Cử nhân', 'Kỹ sư', 'Thạc sĩ', 'Tiến sĩ', 'Thực tập sau tiến sĩ', 'Khác'] },
          { key: 'training_system', label: 'Hệ đào tạo', type: 'select', options: ['Chính quy', 'Vừa làm vừa học', 'Từ xa', 'Liên thông', 'Khác'] },
          { key: 'major', label: 'Ngành / chuyên ngành', placeholder: 'Khoa học máy tính' },
          { key: 'institution', label: 'Nơi đào tạo', placeholder: 'Đại học Bách khoa', wide: true },
          { key: 'country', label: 'Nước đào tạo', placeholder: 'Việt Nam' },
          { key: 'start_year', label: 'Từ năm', type: 'number' },
          { key: 'end_year', label: 'Năm tốt nghiệp / cấp bằng', type: 'number' },
          { key: 'thesis_title', label: 'Tên luận văn / luận án (nếu có)', wide: true },
        ]}
        render={i => ({
          main: `${i.degree}${i.major ? ' – ' + i.major : ''}`,
          sub: [i.institution, i.country, yearRange(i.start_year, i.end_year)].filter(Boolean).join(' • '),
          desc: i.thesis_title ? `Luận văn/luận án: ${i.thesis_title}` : '',
        })}
      />

      <ItemSection
        title="Ngoại ngữ" table="researcher_languages" rid={researcher.id} orderBy="id" asc
        fields={[
          { key: 'language', label: 'Ngoại ngữ *', placeholder: 'Tiếng Anh' },
          { key: 'level', label: 'Mức độ sử dụng', placeholder: 'Tốt (IELTS 7.0)' },
        ]}
        render={i => ({ main: i.language, sub: i.level ? `Mức độ sử dụng: ${i.level}` : '' })}
      />

      <ItemSection
        title="III. Quá trình công tác chuyên môn" hint="Để trống 'Đến năm' nếu bạn vẫn đang làm việc ở đó."
        table="researcher_experience" rid={researcher.id} orderBy="start_year"
        fields={[
          { key: 'position', label: 'Công việc đảm nhiệm *', placeholder: 'Giảng viên' },
          { key: 'organization', label: 'Đơn vị công tác', placeholder: 'Khoa CNTT, Đại học ...' },
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
        title="IV. Đề tài nghiên cứu khoa học đã và đang tham gia"
        table="researcher_projects" rid={researcher.id} orderBy="start_year"
        fields={[
          { key: 'title', label: 'Tên đề tài *', wide: true },
          { key: 'start_year', label: 'Năm bắt đầu', type: 'number' },
          { key: 'end_year', label: 'Năm hoàn thành', type: 'number' },
          { key: 'level', label: 'Đề tài cấp', type: 'select', options: ['Nhà nước', 'Bộ', 'Ngành', 'Tỉnh/Thành phố', 'Trường', 'Cơ sở', 'Khác'] },
          { key: 'role', label: 'Trách nhiệm tham gia', type: 'select', options: ['Chủ nhiệm', 'Phó chủ nhiệm', 'Thư ký', 'Thành viên chính', 'Thành viên'] },
        ]}
        render={i => ({
          main: i.title,
          sub: [yearRange(i.start_year, i.end_year), i.level && `Cấp ${i.level}`, i.role].filter(Boolean).join(' • '),
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

      <p className="hint" style={{ marginTop: 18 }}>
        Công trình công bố trong CV được lấy tự động từ các bài <b>đã được duyệt</b> của bạn.
      </p>
    </main>
  )
}