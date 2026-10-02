export const LEVEL_DEF = [
  {
    "num": 1,
    "topic": "CRUD",
    "low": null,
    "medium": null,
    "high": null
  },
  {
    "num": null,
    "topic": "1.1 List/Search",
    "low": "- มีเงื่อนไขค้นหาไม่เกิน 5 ฟิลด์\n- มี 1 ตารางข้อมูล",
    "medium": "- มีเงื่อนไขค้นหาไม่เกิน 10 ฟิลด์\n- มี 1 ตารางข้อมูล",
    "high": "- มีเงื่อนไขค้นหามากกว่า 10 ฟิลด์\n- มี 1 ตารางข้อมูลหรือมากกว่า\n- มีฟังก์ชั่นก์ Export Excel"
  },
  {
    "num": null,
    "topic": "1.2 Add",
    "low": "- ไม่เกิน 5 ฟิลด์\n- บันทึกข้อมูล 1 Table",
    "medium": "- ไม่เกิน 10 ฟิลด์\n- บันทึกข้อมูล 1 Table",
    "high": "- มากกว่า 10 ฟิลด์\n- บันทึกข้อมูลมากกว่า 1 Table\n- มีฟังก์ชั่นที่ซับซ้อน เช่น Popup Search, Workflow เป็นต้น"
  },
  {
    "num": null,
    "topic": "1.3 Edit",
    "low": "- ไม่เกิน 5 ฟิลด์\n- บันทึกข้อมูล 1 Table",
    "medium": "- ไม่เกิน 10 ฟิลด์\n- บันทึกข้อมูล 1 Table",
    "high": "- มากกว่า 10 ฟิลด์\n- บันทึกข้อมูลมากกว่า 1 Table\n- มีฟังก์ชั่นที่ซับซ้อน เช่น Popup Search, Workflow เป็นต้น"
  },
  {
    "num": 2,
    "topic": "Dashboard",
    "low": "- 1 Chart",
    "medium": "- ไม่เกิน 2 Chart\n- มี Drill Down 1 Level",
    "high": "- ไม่เกิน 4 Chart\n- มี Drill Down ไม่เกิน 2 Level"
  },
  {
    "num": 3,
    "topic": "Report",
    "low": "- มีเงื่อนไขค้นหาไม่เกิน 5 ฟิลด์\n- มี 1 ตารางข้อมูล",
    "medium": "- มีเงื่อนไขค้นหาไม่เกิน 10 ฟิลด์\n- มี 1 ตารางข้อมูล\n- มีฟังก์ชั่นก์ Export Excel (Simple)",
    "high": "- มีเงื่อนไขค้นหามากกว่า 10 ฟิลด์\n- มี 1 ตารางข้อมูลหรือมากกว่า\n- มีฟังก์ชั่นก์ Export Excel (Complex)\n- มีฟังก์ชั่นก์ Export Pdf"
  },
  {
    "num": 4,
    "topic": "Job/Schedule",
    "low": "- เพื่อใช้ภายในระบบเอง \nเช่น อัพเดทสถานะ เป็นต้น",
    "medium": "- มี Interface กับระบบภายนอก \nเช่น ดึงข้อมูลจาก SAP Master เป็นต้น",
    "high": "- มี Interface กับระบบภายนอก \nที่มีกระบวนการซับซ้อน เช่น FTP, E-mail \nหรือปริมาณข้อมูลจำนวนมาก  (ข้อมูลเกิน 100,000 รายการ) เป็นต้น"
  },
  {
    "num": 5,
    "topic": "Interface ",
    "low": null,
    "medium": null,
    "high": null
  },
  {
    "num": null,
    "topic": "5.1 SAP PI (Restful API)",
    "low": "- Oneway มีแค่ขาส่ง \nหรือขารับเพียงอย่างใดอย่างหนึ่ง\n- ไม่เกิน 10 ฟิลด์",
    "medium": "- 2way มีทั้งขาส่งและขารับ\n- ไม่เกิน 20 ฟิลด์",
    "high": "- 2way มีทั้งขาส่งและขารับ\n- มากกว่า 20 ฟิลด์"
  },
  {
    "num": null,
    "topic": "5.2 SAP Master",
    "low": "- ไม่เกิน 2 Table",
    "medium": "- ไม่เกิน 4 Table",
    "high": "- มากกว่า 4 Table"
  },
  {
    "num": null,
    "topic": "5.3 SAP RFC",
    "low": "- Oneway มีแค่ขาส่ง \nหรือขารับเพียงอย่างใดอย่างหนึ่ง\n- ไม่เกิน 10 ฟิลด์",
    "medium": "- 2way มีทั้งขาส่งและขารับ\n- ไม่เกิน 20 ฟิลด์",
    "high": "- 2way มีทั้งขาส่งและขารับ\n- มากกว่า 20 ฟิลด์"
  },
  {
    "num": 10,
    "topic": "Requirement & Design",
    "low": null,
    "medium": null,
    "high": null
  },
  {
    "num": null,
    "topic": "10.1 Get Requirement",
    "low": "จำนวน Issue ไม่เกิน 5 ข้อ",
    "medium": "- จำนวน Issue ระหว่าง 5-20 ข้อ และการแก้ไขไม่ซับซ้อน\n- หรือโปรเจคใหม่ ขนาดไม่เกิน 10 Form ",
    "high": "- จำนวน issue มากกว่า 20 ข้อ หรือมีความซับซ้อน\n- หรือโปรเจคใหม่ ขนาดมากกว่า 10 Form "
  },
  {
    "num": null,
    "topic": "10.2 Create Business Blueprint",
    "low": "จำนวน Issue ไม่เกิน 5 ข้อ",
    "medium": "- จำนวน Issue ระหว่าง 5-20 ข้อ และการแก้ไขไม่ซับซ้อน\n- หรือโปรเจคใหม่ ขนาดไม่เกิน 10 Form ",
    "high": "- จำนวน issue มากกว่า 20 ข้อ หรือมีความซับซ้อน\n- หรือโปรเจคใหม่ ขนาดมากกว่า 10 Form "
  },
  {
    "num": null,
    "topic": "10.3 Design Mockup",
    "low": "มีการปรับเพิ่มแก้ไขโปรแกรมไม่เกิน 5 จุด และไม่ซับซ้อน",
    "medium": "- มีการปรับเพิ่มแก้ไขโปรแกรมระหว่าง 5-20 จุด และการแก้ไขไม่ซับซ้อน\n- หรือโปรเจคใหม่ ขนาดไม่เกิน 10 Form ",
    "high": "- มีการปรับเพิ่มแก้ไขโปรแกรมมากกว่า 20 จุด หรือมีความซับซ้อน\n- หรือโปรเจคใหม่ ขนาดมากกว่า 10 Form "
  },
  {
    "num": null,
    "topic": "10.4 Create Design Specification (Technical Spec)",
    "low": "มีการปรับเพิ่มแก้ไขโปรแกรมไม่เกิน 5 จุด และไม่ซับซ้อน",
    "medium": "- มีการปรับเพิ่มแก้ไขโปรแกรมระหว่าง 5-20 จุด และการแก้ไขไม่ซับซ้อน\n- หรือโปรเจคใหม่ ขนาดไม่เกิน 10 Form ",
    "high": "- มีการปรับเพิ่มแก้ไขโปรแกรมมากกว่า 20 จุด หรือมีความซับซ้อน\n- หรือโปรเจคใหม่ ขนาดมากกว่า 10 Form "
  },
  {
    "num": 11,
    "topic": "Testing",
    "low": null,
    "medium": null,
    "high": null
  },
  {
    "num": null,
    "topic": "11.1 Create Test Scenario & Test Script",
    "low": "- จำนวน Scenario ไม่เกิน 2 Scenario \n- 1 Scenario ไม่เกิน 3 Test case",
    "medium": "- จำนวน Scenario ไม่เกิน 5 Scenario \n- 1 Scenario ไม่เกิน 5 Test case",
    "high": "- จำนวน Scenario มาก 5 Scenario \n- 1 Scenario มากกว่า 5 Test case"
  },
  {
    "num": null,
    "topic": "11.2 Prepare Training Material / User Manual",
    "low": "- จำนวน User Manual ไม่เกิน 2 User Role",
    "medium": "- จำนวน User Manual ไม่เกิน 5 User Role",
    "high": "- จำนวน User Manual มากกว่า 5 User Role"
  },
  {
    "num": null,
    "topic": "11.3 System Integration Test (SIT)",
    "low": "จำนวนการ SIT ไม่เกิน 2 ครั้ง",
    "medium": "จำนวนการ SIT ไม่เกิน 4 ครั้ง",
    "high": "จำนวนการ SIT ไม่เกิน 6 ครั้ง"
  },
  {
    "num": null,
    "topic": "11.4 User Acceptance Test (UAT)",
    "low": "จำนวนการ UAT ไม่เกิน 2 ครั้ง",
    "medium": "จำนวนการ UAT ไม่เกิน 4 ครั้ง",
    "high": "จำนวนการ UAT ไม่เกิน 6 ครั้ง"
  }
] as const

export const WORK_TYPE_LEVELS = [
  {
    "type": "Dashboard",
    "unit": "per dashboard",
    "low": "1–2 Charts, Filter ≤3 รายการ, Data Source 1 แหล่ง, ไม่มี Drill-down",
    "medium": "3–5 Charts, Filter 4–8 รายการ, Data Source ≤2 แหล่ง, Drill-down 1 ระดับ, Export Excel",
    "high": ">5 Charts, หลาย Data Source, Drill-down ≥2 ระดับ, KPI ซับซ้อน, Export Excel/PDF หรือ Real-time"
  },
  {
    "type": "Report",
    "unit": "per report",
    "low": "Filter ≤5 รายการ, 1 ตาราง, Query ตรงไปตรงมา, Export พื้นฐาน",
    "medium": "Filter 6–10 รายการ, 2–3 ตาราง, Group/Subtotal, Export Excel/PDF",
    "high": "Filter >10 รายการ, Join หลายตาราง, Cross-tab, หลายรูปแบบเอกสาร หรือข้อมูลปริมาณมาก"
  },
  {
    "type": "Job/Schedule",
    "unit": "per job",
    "low": "ทำงานภายในระบบ, Trigger ง่าย, ข้อมูล ≤10,000 รายการ, ไม่มี Retry",
    "medium": "มี Schedule, เชื่อมต่อ 1–2 ระบบ, ข้อมูล 10,000–100,000 รายการ, มี Log/Retry",
    "high": "เชื่อมต่อ >2 ระบบ, FTP/Email/Batch, ข้อมูล >100,000 รายการ, มี Dependency, Reprocess และ Monitoring"
  },
  {
    "type": "Interface",
    "unit": "per interface",
    "low": "One-way, 1 Endpoint/File, ≤10 Fields, Mapping ตรงไปตรงมา",
    "medium": "Two-way หรือ 11–20 Fields, มี Validation, Authentication และ Retry เบื้องต้น",
    "high": ">20 Fields, Transformation ซับซ้อน, หลาย Endpoint, Async/Batch, Reconciliation หรือ Security/SLA สูง"
  }
] as const

export const LEVEL_DECISION_RULE = "ใช้ระดับสูงสุดของปัจจัยหลักเป็น Final Level เช่น Interface ที่มี Data Transformation ระดับ High ให้ถือเป็น High แม้จำนวน Field จะอยู่ระดับ Medium"
