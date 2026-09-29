import { notFound } from 'next/navigation'

import { saveRoleRate } from '@/lib/actions/matrix'
import { requireUser } from '@/lib/dal'
import { listRoles } from '@/lib/queries'
import { STANDARD } from '@/lib/standard'

import { MatrixTabs } from '../matrix-tabs'

export const metadata = { title: 'บทบาท & อัตรา/MD | Standard Matrix' }

export default async function RolesPage() {
  const user = await requireUser()
  if (user.role !== 'admin') notFound()

  const roles = await listRoles()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">บทบาท, อัตรา และขอบเขตการประเมิน</h1>
        <p className="mt-1 text-sm text-muted">
          ค่าทั้งหมดมาจากชีต “ตารางบทบาท” ใน {STANDARD.source} — แก้ที่นี่ได้
          แต่จะถูกตั้งกลับตามไฟล์เมื่อ seed ใหม่ ถ้าต้องการแก้ถาวรให้แก้ในไฟล์
          Excel แล้วรัน <code className="font-mono text-xs">npm run matrix:extract</code>
        </p>
        <ul className="mt-3 space-y-1 rounded-md bg-brand-soft/50 px-3 py-2 text-sm">
          <li>
            <span className="font-medium">ขอบเขต item</span> — MD มาจากเมทริกซ์
            รายบรรทัดที่ key (bottom-up) เป็นค่าเริ่มต้นของทุกบทบาท
          </li>
          <li>
            <span className="font-medium">ขอบเขต phase</span> — MD คิดเป็นสัดส่วน
            ของ Developer ต่อ phase (top-down) ตามวิธีของไฟล์ PTT-PSM Platform
            เหมาะกับบทบาทที่ทำงานระดับโมดูลไม่ใช่รายบรรทัด
          </li>
        </ul>
      </div>

      <MatrixTabs active="roles" isAdmin />

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-soft/60 text-xs">
              <th className="border-b border-line px-3 py-2 text-left font-semibold">
                บทบาท
              </th>
              <th className="w-24 border-b border-line px-3 py-2 text-left font-semibold">
                รหัส
              </th>
              <th className="w-20 border-b border-line px-3 py-2 text-center font-semibold">
                ระดับ
              </th>
              <th className="w-36 border-b border-line px-3 py-2 text-center font-semibold">
                อัตรา / MD (บาท)
              </th>
              <th className="w-32 border-b border-line px-3 py-2 text-center font-semibold">
                ขอบเขต
              </th>
              <th className="w-32 border-b border-line px-3 py-2 text-center font-semibold">
                สัดส่วนของ Dev
              </th>
              <th className="w-32 border-b border-line px-3 py-2 text-center font-semibold">
                คูณตาม stack
              </th>
              <th className="w-24 border-b border-line px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} className="border-b border-line/70 last:border-0">
                <td className="px-3 py-2 font-medium">{role.name}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted">
                  {role.code}
                </td>
                <td className="px-3 py-2 text-center text-xs">
                  <span
                    className={`chip ${
                      role.seniority === 'senior'
                        ? 'bg-brand-soft text-brand'
                        : 'bg-background text-muted'
                    }`}
                  >
                    {role.seniority === 'senior' ? 'Senior' : 'Junior'}
                  </span>
                </td>
                <td colSpan={5} className="px-3 py-2">
                  <form
                    action={saveRoleRate}
                    className="flex items-center justify-end gap-2"
                  >
                    <input type="hidden" name="id" value={role.id} />
                    <input
                      name="ratePerMd"
                      type="number"
                      step="100"
                      min="0"
                      defaultValue={role.ratePerMd}
                      aria-label={`อัตรา/MD ของ ${role.name}`}
                      className="field w-32 text-right tabular-nums"
                    />
                    <select
                      name="scope"
                      defaultValue={role.scope}
                      aria-label={`ขอบเขตการประเมินของ ${role.name}`}
                      className="field w-28"
                    >
                      <option value="item">item</option>
                      <option value="phase">phase</option>
                    </select>
                    <input
                      name="ratioOfDev"
                      type="number"
                      step="0.025"
                      min="0"
                      max="5"
                      placeholder="—"
                      defaultValue={role.ratioOfDev ?? ''}
                      aria-label={`สัดส่วนของ Dev ของ ${role.name}`}
                      className="field w-28 text-center tabular-nums"
                    />
                    <label className="flex w-32 items-center justify-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        name="stackMultiplied"
                        defaultChecked={role.stackMultiplied}
                        className="size-4 rounded border-line"
                      />
                      คูณตาม stack
                    </label>
                    <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
                      บันทึก
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
