import { connect } from '../src/lib/db/connect'
import {
  projects,
  projectPhases,
  projectItems,
  projectItemMandays,
  projectRoles,
  projectModifiers,
  projectActivityQty,
  activities,
  roles,
  matrixCells,
  techStacks,
  stackModifiers,
  COMPLEXITIES,
  ONCE_PER_PROJECT_UNIT,
} from '../src/lib/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { round2, effectiveMultiplier } from '../src/lib/estimate'

const db = connect()

async function main() {
  console.log('--- Starting New PASS Import into Manday Estimation System ---')

  // 1. Get Admin / Owner User
  const admin = db.query.users ? await db.query.users.findFirst({ where: (u, { eq }) => eq(u.role, 'admin') }) : null
  const allUsers = db.select().from(require('../src/lib/db/schema').users).all()
  const ownerId = allUsers[0]?.id ?? 1

  // 2. Tech Stack: ReactJS / AngularJS (ทีมคุ้นเคย) id=1 or ASP.NET id=2
  // PASS uses Angular Frontend + .NET / Web API + Responsive Web
  const [techStack] = db.select().from(techStacks).where(eq(techStacks.id, 1)).all()
  const [responsiveMod] = db.select().from(stackModifiers).where(eq(stackModifiers.name, 'Responsive Web (เพิ่มจาก Desktop)')).all()

  // 3. Create Project
  // Delete existing project named 'New PASS' if any to make it repeatable
  const existingProject = db.select().from(projects).where(eq(projects.name, 'โครงการ New PASS')).all()
  for (const p of existingProject) {
    db.delete(projects).where(eq(projects.id, p.id)).run()
    console.log(`Deleted existing project id ${p.id}`)
  }

  const [project] = db.insert(projects).values({
    name: 'โครงการ New PASS',
    code: 'SR0000601-PASS',
    durationDays: 180, // ~6 months (Timeline 4-6 months)
    techStackId: techStack?.id ?? 1,
    questionnaireId: 1, // ทุกหัวข้อ
    status: 'draft',
    bufferPercent: 10, // 10% contingency
    wizardStep: 5,
    ownerId: ownerId,
  }).returning().all()

  const projectId = project.id
  console.log(`Created Project: "${project.name}" (ID: ${projectId})`)

  // Add Project Modifier (Responsive Web)
  if (responsiveMod) {
    db.insert(projectModifiers).values({
      projectId,
      modifierId: responsiveMod.id,
    }).run()
  }

  // Multiplier for dev roles: stack(1.0) * responsive(1.15) = 1.15
  const devMultiplier = responsiveMod ? responsiveMod.multiplier : 1.0

  // 4. Setup Project Roles & Rates
  const allRoles = db.select().from(roles).all()
  for (const role of allRoles) {
    db.insert(projectRoles).values({
      projectId,
      roleId: role.id,
      included: true,
      ratePerMd: role.ratePerMd,
      sortOrder: role.sortOrder,
    }).run()
  }

  // Map activities by code
  const allActivities = db.select().from(activities).all()
  const activityMap = new Map(allActivities.map(a => [a.code, a]))

  // Helper for matrix cells lookup
  const allCells = db.select().from(matrixCells).all()
  const cellMap = new Map<string, number>()
  for (const c of allCells) {
    cellMap.set(`${c.activityId}:${c.roleId}:${c.complexity}`, c.manday)
  }

  // Helper function to create phase and items
  let phaseSort = 10
  let itemSort = 10

  async function createItem({
    phaseId,
    activityCode,
    detail,
    complexity,
    qty,
    deliverables = null,
  }: {
    phaseId: number
    activityCode: string
    detail: string
    complexity: 'L' | 'M' | 'H'
    qty: number
    deliverables?: string | null
  }) {
    const act = activityMap.get(activityCode)
    if (!act) {
      console.warn(`Activity code ${activityCode} not found!`)
      return
    }

    const actualQty = act.countUnit === ONCE_PER_PROJECT_UNIT ? 1 : qty

    // Insert into project_activity_qty (Questionnaire answers log)
    db.insert(projectActivityQty).values({
      projectId,
      activityId: act.id,
      complexity,
      qty: actualQty,
      detail,
    }).onConflictDoUpdate({
      target: [projectActivityQty.projectId, projectActivityQty.activityId, projectActivityQty.complexity],
      set: { qty: sql`${projectActivityQty.qty} + ${actualQty}` }
    }).run()

    // Insert project item
    itemSort += 10
    const [item] = db.insert(projectItems).values({
      projectId,
      phaseId,
      activityId: act.id,
      detail,
      complexity,
      qty: actualQty,
      deliverables,
      sortOrder: itemSort,
    }).returning().all()

    // Calculate & insert mandays for all roles
    for (const role of allRoles) {
      const base = cellMap.get(`${act.id}:${role.id}:${complexity}`) ?? 0
      const multiplier = role.stackMultiplied ? devMultiplier : 1.0
      const md = round2(base * actualQty * multiplier)

      db.insert(projectItemMandays).values({
        itemId: item.id,
        roleId: role.id,
        manday: md,
        overridden: false,
      }).run()
    }
  }

  // Define Project Scope & Phases from PASS Requirement & Standard Matrix
  // Phase 1: Project Initiation & Requirements Gathering
  const [phase1] = db.insert(projectPhases).values({
    projectId,
    name: '1. Project Initiation & Requirements Gathering',
    sortOrder: (phaseSort += 10),
  }).returning().all()

  await createItem({
    phaseId: phase1.id,
    activityCode: '18.1',
    detail: 'Kick-off โครงการ & แผนงานโครงการ (Project Plan, Scope & Team Alignment)',
    complexity: 'M',
    qty: 1,
    deliverables: 'Project Charter, Master Schedule',
  })
  await createItem({
    phaseId: phase1.id,
    activityCode: '10.1',
    detail: 'ประชุมสำรวจความต้องการและวิเคราะห์ Business Requirement (Aviation Sales: Into-Plane, Out-Out, Bulk Drum, AVGAS, Batch)',
    complexity: 'H',
    qty: 5, // 5 core functional modules
    deliverables: 'Business Requirement Document (BRD)',
  })
  await createItem({
    phaseId: phase1.id,
    activityCode: '10.2',
    detail: 'จัดทำ Business Blueprint และ To-Be Business Flow (As-Is / To-Be Process)',
    complexity: 'H',
    qty: 5,
    deliverables: 'Business Blueprint (BBP)',
  })
  await createItem({
    phaseId: phase1.id,
    activityCode: '10.4',
    detail: 'จัดทำ Design Specification และ System Requirement Specification (SRS)',
    complexity: 'H',
    qty: 1,
    deliverables: 'SRS & FSD Document',
  })
  await createItem({
    phaseId: phase1.id,
    activityCode: '18.4',
    detail: 'กระบวนการสถาปัตยกรรมองค์กร (Enterprise Architecture / Security Alignment ตามเกณฑ์ OR)',
    complexity: 'M',
    qty: 1,
  })

  // Phase 2: System Architecture, UX/UI & Environment Preparation
  const [phase2] = db.insert(projectPhases).values({
    projectId,
    name: '2. System Architecture, UX/UI & Infrastructure Setup',
    sortOrder: (phaseSort += 10),
  }).returning().all()

  await createItem({
    phaseId: phase2.id,
    activityCode: '9',
    detail: 'กำหนดและวางโครงสร้าง Project Architecture (Clean Architecture / Angular + API Controller)',
    complexity: 'H',
    qty: 1,
    deliverables: 'Project Base Skeleton',
  })
  await createItem({
    phaseId: phase2.id,
    activityCode: '10.3',
    detail: 'ออกแบบ Mockup และ UX/UI Design สำหรับระบบงานขายและตรวจสอบ (Web + Mobile Responsive)',
    complexity: 'M',
    qty: 15, // Screen templates
    deliverables: 'Figma Mockups & Design System',
  })
  await createItem({
    phaseId: phase2.id,
    activityCode: '8',
    detail: 'จัดเตรียม Server และสภาพแวดล้อมระบบ (Dev, Test/SIT, UAT Environment ตาม OR Security)',
    complexity: 'M',
    qty: 3, // 3 environments
  })
  await createItem({
    phaseId: phase2.id,
    activityCode: '17.1',
    detail: 'ติดตั้งและตั้งค่า CI/CD Pipeline (Automated Build & Deployment to OR Infra)',
    complexity: 'M',
    qty: 2, // Frontend & Backend pipelines
  })
  await createItem({
    phaseId: phase2.id,
    activityCode: '17.3',
    detail: 'ประสานงาน Firewall & Network Request (OR Internal, SAP, WSO2, BAFS, Thappline)',
    complexity: 'M',
    qty: 5,
  })

  // Phase 3: Core Transaction & Aviation Sales Development
  const [phase3] = db.insert(projectPhases).values({
    projectId,
    name: '3. Core Transactions & Aviation Sales Modules',
    sortOrder: (phaseSort += 10),
  }).returning().all()

  await createItem({
    phaseId: phase3.id,
    activityCode: '1.2',
    detail: 'หน้าจอจัดการ DR (Delivery Receipt): First List, Second List, DR Template, Import DR Excel/Text from BAFS',
    complexity: 'H',
    qty: 4, // 4 complex screens
    deliverables: 'DR Management System',
  })
  await createItem({
    phaseId: phase3.id,
    activityCode: '1.1',
    detail: 'หน้าจอจัดการการขายแบบ Bulk Drum (ปตท. ขายลูกค้าราชการ/เอกชน), บรรจุถัง 200L AVGAS untax, และการขายแบบ Batch',
    complexity: 'H',
    qty: 6, // 6 transaction screens
  })
  await createItem({
    phaseId: phase3.id,
    activityCode: '1.4',
    detail: 'Workflow การอนุมัติ (Multi-step Approval Flow: Formula Price, Out-Out Margin, Batch Order Approval)',
    complexity: 'H',
    qty: 3, // 3 distinct approval workflows
    deliverables: 'Configurable Approval Engine',
  })
  await createItem({
    phaseId: phase3.id,
    activityCode: '1.5',
    detail: 'ระบบแจ้งเตือนอัตโนมัติ (Email Alert แจ้ง สอ., แจ้งเตือนสายการบิน, แจ้งผลการอนุมัติ, แจ้ง Thappline)',
    complexity: 'M',
    qty: 6, // 6 event notifications
  })
  await createItem({
    phaseId: phase3.id,
    activityCode: '13.1',
    detail: 'ระบบแนบไฟล์และมัลติมีเดีย (รองรับรูปภาพตรวจสภาพ, เอกสาร DR, ใบลดหนี้/หนังสือนำส่ง)',
    complexity: 'M',
    qty: 3,
  })

  // Phase 4: Master Data & Out-Out Operations
  const [phase4] = db.insert(projectPhases).values({
    projectId,
    name: '4. Master Data, Out-Out Operations & AI Integration',
    sortOrder: (phaseSort += 10),
  }).returning().all()

  await createItem({
    phaseId: phase4.id,
    activityCode: '14.3',
    detail: 'Master Data Management (Plant, Airport, AircraftType, Customer, Material/Product, Cargo Airline, Care Of, L86 Parameter, Contract)',
    complexity: 'M',
    qty: 12, // 12 master data entities
    deliverables: 'Master Data Screens & APIs',
  })
  await createItem({
    phaseId: phase4.id,
    activityCode: '1.1',
    detail: 'ระบบจัดการ Out-Out Operation (H018): ตรวจสอบ Margin, บันทึก Margin ฝั่งซื้อ/ขาย, Price Advice',
    complexity: 'H',
    qty: 4,
  })
  await createItem({
    phaseId: phase4.id,
    activityCode: '5.1',
    detail: 'AI OCR / Document Extraction API Integration สำหรับถอดรหัสเอกสาร Out-Out (PoC Model Integration)',
    complexity: 'H',
    qty: 1,
    deliverables: 'AI OCR Connector Service',
  })
  await createItem({
    phaseId: phase4.id,
    activityCode: '4',
    detail: 'Background Job & Schedule (Auto-sync Master data, ดึง DR อัตโนมัติ, แจ้งเตือนเอกสารหมดอายุ)',
    complexity: 'M',
    qty: 4, // 4 automated cron jobs
  })

  // Phase 5: System Integration & Security Compliance
  const [phase5] = db.insert(projectPhases).values({
    projectId,
    name: '5. System Interface & Security Compliance',
    sortOrder: (phaseSort += 10),
  }).returning().all()

  await createItem({
    phaseId: phase5.id,
    activityCode: '5.3',
    detail: 'SAP Integration (RFC/BAPI): สร้างเอกสาร SO, DO, GI, Billing และรับค่าสถานะ Return จาก SAP',
    complexity: 'H',
    qty: 4, // 4 key SAP interfaces (SO, DO, GI, Billing)
    deliverables: 'SAP BAPI Connectors & Logging',
  })
  await createItem({
    phaseId: phase5.id,
    activityCode: '5.1',
    detail: 'External Interfaces: เชื่อมต่อรับข้อมูล Transfer note จาก Thappline และ e-DR จาก BAFS',
    complexity: 'H',
    qty: 2,
  })
  await createItem({
    phaseId: phase5.id,
    activityCode: '12.1',
    detail: 'Authentication & SSO (Azure AD / OR Single Sign-On / LDAP)',
    complexity: 'M',
    qty: 1,
  })
  await createItem({
    phaseId: phase5.id,
    activityCode: '5.2',
    detail: 'PIS System Sync ผ่าน WSO2 (ดึงโครงสร้างองค์กรและสายการอนุมัติ)',
    complexity: 'M',
    qty: 1,
  })
  await createItem({
    phaseId: phase5.id,
    activityCode: '12.2',
    detail: 'Role & Permission Management (แยกสิทธิ์ ขย, พต, สอ, Approver, Customer, Admin)',
    complexity: 'H',
    qty: 1,
  })
  await createItem({
    phaseId: phase5.id,
    activityCode: '12.3',
    detail: 'Audit Log & History Tracking (บันทึกทุกกิจกรรม Login, สร้าง, แก้ไข, Post SAP, อนุมัติ ตาม PDPA & Compliance)',
    complexity: 'H',
    qty: 1,
  })
  await createItem({
    phaseId: phase5.id,
    activityCode: '7',
    detail: 'Remediation & Fix Security Scan (Source Code Scan, Web Scan, VA Scan ตามมาตรฐาน OR Security)',
    complexity: 'H',
    qty: 1,
    deliverables: 'Security Scan Clearance Report',
  })

  // Phase 6: Reports & Executive Dashboard
  const [phase6] = db.insert(projectPhases).values({
    projectId,
    name: '6. Reports, Export Engine & Dashboard',
    sortOrder: (phaseSort += 10),
  }).returning().all()

  await createItem({
    phaseId: phase6.id,
    activityCode: '2',
    detail: 'Executive Sales & Operation Dashboard (สรุปยอดเติมน้ำมันแต่ละสนามบิน, สรุป Margin, ภาพรวมสถานะ DR)',
    complexity: 'H',
    qty: 2,
    deliverables: 'Interactive Dashboard',
  })
  await createItem({
    phaseId: phase6.id,
    activityCode: '3',
    detail: 'Official Aviation Reports (Uplift Report, Daily Report by DR, Airport Concession Fee, Sales District Monthly, DMK/BKK Outbound Report, Statement & หนังสือนำส่งศุลกากร)',
    complexity: 'H',
    qty: 10, // 10 major custom aviation reports
  })
  await createItem({
    phaseId: phase6.id,
    activityCode: '1.6',
    detail: 'Export Engine (Excel, Word, PDF พร้อมแนบภาพประกอบ และส่งอีเมลรอบบิลอัตโนมัติ)',
    complexity: 'H',
    qty: 3, // Excel, Word, PDF formats
  })

  // Phase 7: Data Migration & Testing
  const [phase7] = db.insert(projectPhases).values({
    projectId,
    name: '7. Data Migration, Testing & Quality Assurance',
    sortOrder: (phaseSort += 10),
  }).returning().all()

  await createItem({
    phaseId: phase7.id,
    activityCode: '6',
    detail: 'Data Cleansing, Data Migration & Verification (โอนย้าย Master Data และ Historical Transaction ย้อนหลัง)',
    complexity: 'H',
    qty: 8, // 8 data tables/entities
  })
  await createItem({
    phaseId: phase7.id,
    activityCode: '11.1',
    detail: 'จัดทำ Test Scenarios, Test Cases และ Test Scripts (ครอบคลุม Happy/Unhappy Path & Edge Cases)',
    complexity: 'H',
    qty: 5, // 5 core functional modules
    deliverables: 'Complete Test Scenarios Matrix',
  })
  await createItem({
    phaseId: phase7.id,
    activityCode: '11.3',
    detail: 'System Integration Test (SIT) ร่วมกับ SAP, Thappline, BAFS, AD, WSO2',
    complexity: 'H',
    qty: 5,
    deliverables: 'SIT Sign-off Document',
  })
  await createItem({
    phaseId: phase7.id,
    activityCode: '11.4',
    detail: 'สนับสนุน User Acceptance Test (UAT) และ Parallel Run Testing (เทียบยอดบัญชี Reconciliation กับระบบเดิม 100%)',
    complexity: 'H',
    qty: 5,
    deliverables: 'UAT Sign-off Document',
  })

  // Phase 8: Training, Cutover & Go-Live
  const [phase8] = db.insert(projectPhases).values({
    projectId,
    name: '8. Training, Cutover, Go-Live & Post Support',
    sortOrder: (phaseSort += 10),
  }).returning().all()

  await createItem({
    phaseId: phase8.id,
    activityCode: '15.1',
    detail: 'จัดทำ User Manual, Admin Technical Guide และจัดฝึกอบรม User Training (ขย., สอ., พต., ปตท.) & Admin Training',
    complexity: 'H',
    qty: 1,
    deliverables: 'User Manual & Training Slide',
  })
  await createItem({
    phaseId: phase8.id,
    activityCode: '17.4',
    detail: 'จัดเตรียม Production Environment Setup และ Deploy ระบบพร้อมตั้งค่าความปลอดภัย',
    complexity: 'H',
    qty: 1,
  })
  await createItem({
    phaseId: phase8.id,
    activityCode: '17.5',
    detail: 'Cutover Execution, Go-Live Runbook & Post-Go-Live Support (ระยะสนับสนุน 1 เดือนตาม SLA)',
    complexity: 'H',
    qty: 1,
    deliverables: 'Go-Live Sign-off & SLA Support Handover',
  })
  await createItem({
    phaseId: phase8.id,
    activityCode: '18.2',
    detail: 'การประชุมติดตามผลและรายงานความก้าวหน้าโครงการ (Bi-Weekly Progress Meetings ตลอดโครงการ)',
    complexity: 'M',
    qty: 12, // 12 bi-weekly sessions for 6 months
  })

  console.log('--- Successfully Imported New PASS Project with all Phases and Standard Mandays ---')
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
