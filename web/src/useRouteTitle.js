import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const TITLES = [
  ['/research/', 'Chi tiết nghiên cứu'], ['/research', 'Kho nghiên cứu'],
  ['/researchers/', 'Hồ sơ nhà nghiên cứu'], ['/researchers', 'Nhà nghiên cứu'],
  ['/network', 'Mạng lưới cộng tác'], ['/stats', 'Thống kê'],
  ['/profile/edit', 'Chỉnh sửa hồ sơ'],
  ['/dashboard/new', 'Thêm công trình'], ['/dashboard/edit', 'Sửa công trình'],
  ['/dashboard', 'Công trình của tôi'], ['/favorites', 'Yêu thích'],
  ['/admin/review', 'Duyệt chi tiết'], ['/admin/reports', 'Báo cáo vi phạm'], ['/admin', 'Quản trị'],
]

export function useRouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const hit = TITLES.find(([p]) => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/'))
    document.title = hit ? `${hit[1]} · UTEProfile` : 'UTEProfile – Nền tảng lý lịch khoa học'
  }, [pathname])
}