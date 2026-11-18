import assert from 'node:assert/strict';
import test from 'node:test';
import { PLC_SECTION_THEME, SECTIONS } from '../data/sections';
import {
  addPlcActivityRecord,
  addPlcCommunityToList,
  addPlcIdentityListItem,
  addPlcMeetingRecord,
  addPlcMember,
  addPlcNeedItem,
  addPlcPlanActionItem,
  assignPlcLeaderInMembers,
  attachPlcEvidenceToRecord,
  buildInitialMeetingAttendanceFromMembers,
  buildPlcRecordQrPayload,
  computePlcExecutionOverview,
  computePlcFormsCompletionStatus,
  computePlcMeetingsOverview,
  computePlcSchoolAggregateSummary,
  createNewPlcCommunityRecord,
  deletePlcActivityRecord,
  deletePlcCommunityFromList,
  deletePlcIdentityListItem,
  deletePlcMeetingRecord,
  deletePlcMember,
  deletePlcNeedItem,
  deletePlcPlanActionItem,
  filterAndSortPlcActivities,
  filterAndSortPlcCommunities,
  filterAndSortPlcMeetings,
  filterAndSortPlcNeeds,
  generatePlcEntityId,
  generatePlcRecordQrMatrix,
  generatePlcRecordQrSvgDataUrl,
  getPlcActionNeedIds,
  getPlcCommunityLeader,
  getPlcNeedSourceDisplayLabel,
  getPlcRecordEvidences,
  loadPlcCommunitiesFromStorage,
  parsePlcRecordQrPayload,
  PLC_FORMS_CATALOG,
  PLC_MAX_EVIDENCES_PER_RECORD,
  PLC_STORAGE_KEY,
  PlcCommunityRecord,
  removePlcEvidenceFromRecord,
  reorderPlcIdentityListItem,
  replacePlcEvidenceOnRecord,
  resolvePlcActivityRecordLinks,
  resolvePlcMeetingAttendance,
  resolvePlcMeetingRecommendationLinks,
  resolvePlcPlanActionLinks,
  savePlcCommunitiesToStorage,
  setPlcMemberAsLeader,
  updatePlcActivityRecord,
  updatePlcCommunityInList,
  updatePlcIdentityListItem,
  updatePlcMeetingRecord,
  updatePlcMember,
  updatePlcNeedItem,
  updatePlcPlanActionItem,
  verifyPlcRecordQrMatrix,
  computePlcExecutionEvaluationSummary,
  addPlcExecutionEvaluationItem,
  updatePlcExecutionEvaluationItem,
  deletePlcExecutionEvaluationItem,
  resolvePlcExecutionEvaluationLinks,
  validatePlcKpiIndicatorInput,
  computePlcKpiAchievement,
  addPlcKpiIndicator,
  updatePlcKpiIndicator,
  deletePlcKpiIndicator,
  resolvePlcKpiIndicatorLinks,
  validatePlcImpactMeasurementInput,
  addPlcImpactMeasurement,
  updatePlcImpactMeasurement,
  deletePlcImpactMeasurement,
  syncCommunityImpactEvidenceLinks,
  resolvePlcImpactMeasurementLinks,
  validatePlcEvidenceRepositoryInput,
  addPlcEvidenceToRepository,
  updatePlcEvidenceInRepository,
  linkPlcEvidenceToTarget,
  unlinkPlcEvidenceFromTarget,
  resolvePlcEvidenceLinks,
  deletePlcEvidenceFromRepository,
  filterAndSortPlcEvidenceRepository,
  computePlcFinalReportCompleteness,
  classifyPlcImpactMeasurementRecord,
  buildPlcFinalReport,
  updatePlcFinalReportNotes,
  regeneratePlcFinalReport,
  buildPlcSchoolWideReportDataPayload,
} from './plcEngine';
import {
  buildPlcFinalReportPdfPagesModel,
  generatePlcFinalReportPdfArtifact,
  PLC_REPORT_DESIGN_SYSTEM,
  resolveEvidenceActionUri,
  selectKeyEvidencesForExecutiveReport,
  wrapArabicCellText,
} from './plcFinalReportPdfGenerator';
import {
  buildPlcDetailedReportPdfPagesModel,
  generatePlcDetailedReportPdfArtifact,
} from './plcDetailedReportPdfGenerator';
import { DEFAULT_SCHOOL_SETTINGS } from '../data/defaultSettings';
import {
  getPlcDemoPreviewCommunity,
  getPlcDemoPreviewSchoolSettings,
  isPlcDemoPreviewId,
  PLC_DEMO_COMMUNITY_ID,
  PLC_DEMO_FORM_HINTS,
  PLC_DEMO_SCHOOL_NAME,
  PLC_DEMO_STAGE_LABEL,
  PLC_DEMO_TARGET_AUDIENCE,
} from './plcDemoCommunity';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, val: string) => {
      map.set(key, val);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

test('الدفعة الأولى - ١: عدم وضع بيانات تجريبية افتراضية والتأكد من الكتالوج المعتمد للنماذج التسعة', () => {
  const storage = createMemoryStorage();
  const initialList = loadPlcCommunitiesFromStorage(storage);
  assert.deepEqual(initialList, []);
  assert.equal(PLC_FORMS_CATALOG.length, 9);
  assert.deepEqual(
    PLC_FORMS_CATALOG.map((f) => f.formNumber),
    [1, 2, 3, 4, 5, 6, 7, 8, 9]
  );
});

test('الدفعة الأولى - ٢: إنشاء مجتمعين مستقلين والتحقق من الفصل التام بين سجلاتهما وحفظهما واسترجاعهما', () => {
  const storage = createMemoryStorage();

  const community1 = createNewPlcCommunityRecord(
    {
      name: 'مجتمع معلمي الرياضيات للتعلم النشط',
      specialty: 'الرياضيات',
      semester: 'first',
      venue: 'قاعة مصادر التعلم',
      foundationDate: '2026-09-01',
      status: 'active',
      leader: {
        name: 'أ. محمد بن سعد القحطاني',
        specialty: 'الرياضيات',
        jobRole: 'معلم متقدم',
        email: 'm.qahtani@school.edu.sa',
        phone: '0501112233',
      },
    },
    { academicYear: '١٤٤٧هـ' }
  );

  const community2 = createNewPlcCommunityRecord(
    {
      name: 'مجتمع معلمي العلوم للبحث والاستقصاء',
      specialty: 'العلوم الطبيعية',
      academicYear: '١٤٤٨هـ',
      semester: 'second',
      status: 'paused',
      leader: {
        name: 'أ. خالد بن فهد العتيبي',
        specialty: 'الفيزياء',
        jobRole: 'معلم خبير',
      },
    },
    { academicYear: '١٤٤٧هـ' }
  );

  assert.notEqual(community1.id, community2.id);
  assert.equal(
    community1.academicYear,
    '١٤٤٧هـ',
    'يُستمد العام الدراسي تلقائياً من إعدادات المدرسة عند عدم تحديده يدوياً'
  );
  assert.equal(
    community2.academicYear,
    '١٤٤٨هـ',
    'يقبل العام الدراسي التعديل لكل مجتمع باستقلالية'
  );

  let list: PlcCommunityRecord[] = [];
  list = addPlcCommunityToList(list, community1);
  list = addPlcCommunityToList(list, community2);
  assert.equal(list.length, 2);

  // تعديل المجتمع الأول وإضافة عضو واحتياج له
  list = updatePlcCommunityInList(list, community1.id, (current) => ({
    ...current,
    name: 'مجتمع معلمي الرياضيات المطور',
    members: [
      ...current.members,
      {
        id: 'mbr_extra_1',
        name: 'أ. عبدالرحمن الشهري',
        specialty: 'الرياضيات',
        jobRole: 'معلم ممارس',
        roles: ['coordinator', 'rapporteur'],
      },
    ],
  }));

  const updatedC1 = list.find((c) => c.id === community1.id)!;
  const untouchedC2 = list.find((c) => c.id === community2.id)!;

  // التحقق من عدم تأثر المجتمع الثاني بتعديلات المجتمع الأول
  assert.equal(updatedC1.name, 'مجتمع معلمي الرياضيات المطور');
  assert.equal(updatedC1.members.length, 2);
  assert.equal(untouchedC2.name, 'مجتمع معلمي العلوم للبحث والاستقصاء');
  assert.equal(untouchedC2.members.length, 1);
  assert.equal(
    getPlcCommunityLeader(untouchedC2)?.name,
    'أ. خالد بن فهد العتيبي'
  );

  // حفظ في التخزين الدائم واسترجاع القائمة
  const savedOk = savePlcCommunitiesToStorage(list, storage);
  assert.equal(savedOk, true);
  assert.ok(storage.getItem(PLC_STORAGE_KEY));

  const reloaded = loadPlcCommunitiesFromStorage(storage);
  assert.equal(reloaded.length, 2);
  assert.equal(
    reloaded.find((c) => c.id === community1.id)?.members.length,
    2
  );
  assert.equal(
    reloaded.find((c) => c.id === community2.id)?.members.length,
    1
  );
});

test('الدفعة الأولى - ٣: تسجيل رئيس المجتمع ضمن جدول الأعضاء نفسه واستخراج بياناته تلقائياً دون تكرار السجل، ودعم تعدد المسؤوليات', () => {
  let members = assignPlcLeaderInMembers([], {
    name: 'أ. سلطان المالكي',
    specialty: 'اللغة العربية',
    jobRole: 'معلم أول',
    additionalRoles: ['coordinator'],
  });

  assert.equal(members.length, 1);
  assert.deepEqual(members[0].roles, ['leader', 'coordinator']);

  // إضافة عضو ثانٍ ثم تعيينه رئيساً للمجتمع بدلاً من الأول دون حذف العضو الأول أو تكرار السجل
  members.push({
    id: 'mbr_2',
    name: 'أ. نايف الدوسري',
    specialty: 'اللغة العربية',
    jobRole: 'معلم متقدم',
    roles: ['member', 'followup'],
  });

  members = assignPlcLeaderInMembers(members, {
    memberId: 'mbr_2',
    name: 'أ. نايف الدوسري',
    specialty: 'اللغة العربية',
    jobRole: 'معلم متقدم',
  });

  assert.equal(
    members.length,
    2,
    'لا يجوز إنشاء سجل مكرر عند تغيير رئيس المجتمع'
  );
  const leader = getPlcCommunityLeader({ members });
  assert.equal(leader?.id, 'mbr_2');
  assert.equal(leader?.name, 'أ. نايف الدوسري');
  assert.ok(leader?.roles.includes('leader'));
  assert.ok(
    leader?.roles.includes('followup'),
    'يحتفظ العضو بمسؤولياته الإضافية مع رئاسة المجتمع'
  );

  // التأكد من سحب دور رئيس المجتمع من الرئيس السابق مع بقائه عضواً ومنسقاً
  const previousLeader = members.find((m) => m.name === 'أ. سلطان المالكي')!;
  assert.ok(!previousLeader.roles.includes('leader'));
  assert.ok(previousLeader.roles.includes('coordinator'));
});

test('الدفعة الأولى - ٤: البحث والفرز والتصفية وحذف مجتمع وحساب الملخص المدرسي الإجمالي بنزاهة', () => {
  const c1 = createNewPlcCommunityRecord({
    name: 'مجتمع الفيزياء التطبيقية',
    specialty: 'الفيزياء',
    academicYear: '١٤٤٧هـ',
    semester: 'first',
    status: 'active',
    leader: { name: 'أ. ماجد الحربي' },
  });
  const c2 = createNewPlcCommunityRecord({
    name: 'مجتمع الحاسب الآلي والبرمجة',
    specialty: 'التقنية الرقمية',
    academicYear: '١٤٤٧هـ',
    semester: 'second',
    status: 'completed',
    leader: { name: 'أ. طارق الغامدي' },
  });

  const list = [c1, c2];

  // البحث باسم رئيس المجتمع أو التخصص
  const bySearch = filterAndSortPlcCommunities(list, {
    searchQuery: 'طارق',
  });
  assert.equal(bySearch.length, 1);
  assert.equal(bySearch[0].id, c2.id);

  // التصفية حسب الحالة
  const activeOnly = filterAndSortPlcCommunities(list, {
    statusFilter: 'active',
  });
  assert.equal(activeOnly.length, 1);
  assert.equal(activeOnly[0].id, c1.id);

  // حساب حالة اكتمال النماذج التسعة للمجتمع الأول
  const completion = computePlcFormsCompletionStatus(c1);
  assert.equal(completion.forms[1].state, 'completed');
  assert.equal(completion.forms[2].state, 'empty');
  assert.equal(completion.completedFormsCount, 1);

  // حساب الملخص المدرسي الإجمالي والتأكد من عدم اختلاق نسبة تنفيذ خطة عند عدم وجود إجراءات
  const schoolSummary = computePlcSchoolAggregateSummary(list, [c1.id, c2.id]);
  assert.equal(schoolSummary.selectedCommunitiesCount, 2);
  assert.equal(schoolSummary.activeCount, 1);
  assert.equal(schoolSummary.completedCount, 1);
  assert.equal(schoolSummary.totalMembersCount, 2);
  assert.equal(
    schoolSummary.planExecutionPercentage,
    null,
    'لا يجوز اختلاق نسبة إنجاز للخطة إذا لم تُسجل إجراءات بعد'
  );

  // حذف المجتمع الأول والتحقق من بقاء المجتمع الثاني سليماً
  const afterDelete = deletePlcCommunityFromList(list, c1.id);
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, c2.id);
});

// ============================================================================
// اختبارات الدفعة الثانية الشاملة (النماذج ١ و ٢ و ٣ و ٤)
// ============================================================================

test('الدفعة الثانية - ١: النموذج الأول (إضافة عدة أعضاء، اختيار رئيس المجتمع من بينهم دون تكرار، وتعديل وحذف الأعضاء)', () => {
  let community = createNewPlcCommunityRecord(
    {
      name: 'مجتمع اللغة العربية للقراءة الناقدة',
      specialty: 'اللغة العربية',
    },
    { academicYear: '١٤٤٧هـ' }
  );

  // إضافة ٣ أعضاء بأدوار مختلفة (أكثر من مسؤولية لعضو واحد)
  community.members = addPlcMember(community.members, {
    name: 'أ. فهد الزهراني',
    specialty: 'اللغة العربية',
    jobRole: 'معلم متقدم',
    roles: ['member', 'coordinator'],
  });
  community.members = addPlcMember(community.members, {
    name: 'أ. ياسر القحطاني',
    specialty: 'اللغة العربية',
    jobRole: 'معلم خبير',
    roles: ['member', 'rapporteur'],
  });
  community.members = addPlcMember(community.members, {
    name: 'أ. بندر الشمري',
    specialty: 'اللغة العربية',
    jobRole: 'معلم ممارس',
    roles: ['followup'],
  });

  assert.equal(community.members.length, 3);
  assert.equal(getPlcCommunityLeader(community), null);

  // اختيار العضو الثاني ليكون رئيس المجتمع من جدول الأعضاء
  const secondMemberId = community.members[1].id;
  community.members = setPlcMemberAsLeader(community.members, secondMemberId);

  assert.equal(
    community.members.length,
    3,
    'لا يجوز تكرار سجل العضو عند تعيينه رئيساً للمجتمع'
  );
  const leader = getPlcCommunityLeader(community);
  assert.equal(leader?.id, secondMemberId);
  assert.equal(leader?.name, 'أ. ياسر القحطاني');
  assert.ok(leader?.roles.includes('leader'));
  assert.ok(
    leader?.roles.includes('rapporteur'),
    'يحتفظ الرئيس بمسؤوليته الأخرى كمقرر'
  );

  // تعديل بيانات العضو الثالث
  const thirdMemberId = community.members[2].id;
  community.members = updatePlcMember(community.members, thirdMemberId, {
    name: 'أ. بندر بن خلف الشمري',
    notes: 'مسؤول متابعة الخطط العلاجية',
  });
  assert.equal(community.members[2].name, 'أ. بندر بن خلف الشمري');
  assert.equal(community.members[2].notes, 'مسؤول متابعة الخطط العلاجية');

  // حذف العضو الأول
  const firstMemberId = community.members[0].id;
  community.members = deletePlcMember(community.members, firstMemberId);
  assert.equal(community.members.length, 2);
  assert.equal(getPlcCommunityLeader(community)?.id, secondMemberId);
});

test('الدفعة الثانية - ٢: النموذج الثاني (إدخال الرؤية والرسالة والأهداف والقيم والمبادئ المهنية بشكل مستقل تماماً مع إعادة الترتيب والتعديل والحذف)', () => {
  const community = createNewPlcCommunityRecord({
    name: 'مجتمع العلوم للمختبرات الافتراضية',
    specialty: 'العلوم',
  });

  community.identity.vision = 'الريادة في توظيف التجارب العملية والافتراضية.';
  community.identity.mission =
    'تمكين معلمي العلوم من بناء مهارات الاستقصاء العلمي.';

  // إضافة أهداف
  community.identity.goals = addPlcIdentityListItem(
    community.identity.goals,
    'الهدف الأول: تفعيل التجارب الاستقصائية',
    'goal'
  );
  community.identity.goals = addPlcIdentityListItem(
    community.identity.goals,
    'الهدف الثاني: رفع نتائج الطلاب في المهارات العملية',
    'goal'
  );
  assert.equal(community.identity.goals.length, 2);

  // إعادة ترتيب الهدف الثاني ليصبح في الأعلى
  const secondGoalId = community.identity.goals[1].id;
  community.identity.goals = reorderPlcIdentityListItem(
    community.identity.goals,
    secondGoalId,
    'up'
  );
  assert.equal(community.identity.goals[0].id, secondGoalId);
  assert.equal(community.identity.goals[0].order, 1);
  assert.equal(community.identity.goals[1].order, 2);

  // إضافة قيم ومبادئ مهنية والتحقق من استقلالهما التام وعدم دمجهما
  community.identity.values = addPlcIdentityListItem(
    community.identity.values,
    'التعاون المهني',
    'val'
  );
  community.identity.principles = addPlcIdentityListItem(
    community.identity.principles,
    'التركيز على تعلم الطلاب القائم على الدليل',
    'prn'
  );
  assert.equal(community.identity.values.length, 1);
  assert.equal(community.identity.principles.length, 1);
  assert.notEqual(
    community.identity.values[0].text,
    community.identity.principles[0].text
  );

  // تعديل وحذف عنصر في القيم
  const valId = community.identity.values[0].id;
  community.identity.values = updatePlcIdentityListItem(
    community.identity.values,
    valId,
    'التشاركية والإتقان'
  );
  assert.equal(community.identity.values[0].text, 'التشاركية والإتقان');

  community.identity.values = deletePlcIdentityListItem(
    community.identity.values,
    valId
  );
  assert.equal(community.identity.values.length, 0);
  assert.equal(
    community.identity.principles.length,
    1,
    'حذف قيمة لا يؤثر على قائمة المبادئ المهنية المستقلة'
  );
});

test('الدفعة الثانية - ٣: النموذج الثالث (إضافة احتياجات بمستويات أولوية ومصادر مختلفة، وترتيبها حسب الأولوية، وتصفيتها وتعديلها وحذفها)', () => {
  let needs = addPlcNeedItem([], {
    description: 'احتياج منخفض الأولوية لتنظيم المكتبة الصفية',
    source: 'survey',
    justification: 'نتائج استبانة المعلمين',
    priority: 'low',
    proposedAction: 'تحديث مصادر القراءة الإثرائية',
  });

  needs = addPlcNeedItem(needs, {
    description: 'احتياج مرتفع الأولوية لمعالجة ضعف الفهم القرائي',
    source: 'student_results',
    justification: 'انخفاض نتائج الاختبار التشخيصي',
    priority: 'high',
    proposedAction: 'برنامج علاجي مكثف وورش تقويم تكويني',
  });

  needs = addPlcNeedItem(needs, {
    description: 'احتياج متوسط الأولوية في إدارة وقت الحصة',
    source: 'other',
    customSource: 'تقارير الزيارات الإشرافية',
    justification: 'توصيات الملاحظة الإشرافية',
    priority: 'medium',
    proposedAction: 'تبادل زيارات صفية بين الأقران',
  });

  // التحقق من الترتيب التلقائي حسب الأولوية: مرتفع ثم متوسط ثم منخفض
  assert.equal(needs.length, 3);
  assert.equal(needs[0].priority, 'high');
  assert.equal(needs[1].priority, 'medium');
  assert.equal(needs[2].priority, 'low');

  // التحقق من عرض المصدر المخصص عند اختيار "أخرى"
  assert.equal(
    getPlcNeedSourceDisplayLabel(needs[1]),
    'أخرى (تقارير الزيارات الإشرافية)'
  );

  // البحث والتصفية حسب الأولوية
  const highOnly = filterAndSortPlcNeeds(needs, { priorityFilter: 'high' });
  assert.equal(highOnly.length, 1);
  assert.ok(highOnly[0].description.includes('الفهم القرائي'));

  // تعديل الاحتياج المنخفض ليصبح مرتفع الأولوية مع الحفاظ على معرفه الثابت
  const lowNeedId = needs[2].id;
  needs = updatePlcNeedItem(needs, lowNeedId, {
    priority: 'high',
    description: 'احتياج مرتفع محدث لتفعيل القراءة الموجهة',
  });
  const updatedNeed = needs.find((n) => n.id === lowNeedId)!;
  assert.equal(updatedNeed.priority, 'high');
  assert.equal(updatedNeed.description, 'احتياج مرتفع محدث لتفعيل القراءة الموجهة');

  // حذف احتياج
  needs = deletePlcNeedItem(needs, needs[2].id);
  assert.equal(needs.length, 2);
});

test('الدفعة الثانية - ٤: النموذج الرابع (الخطة التشغيلية، ربط الإجراء بالهدف وباحتياج واحد أو أكثر وبالمسؤول بمعرفاتها الثابتة، وتحديث حالة التنفيذ ونسبة الإنجاز الفعلية)', () => {
  const storage = createMemoryStorage();

  let community1 = createNewPlcCommunityRecord(
    {
      name: 'مجتمع الرياضيات التخصصي',
      specialty: 'الرياضيات',
      leader: { name: 'أ. سعد العتيبي', specialty: 'الرياضيات' },
    },
    { academicYear: '١٤٤٧هـ' }
  );

  // إضافة هدف في النموذج الثاني
  community1.identity.goals = addPlcIdentityListItem(
    community1.identity.goals,
    'رفع مستوى إتقان مهارات حل المسائل اللفظية',
    'goal'
  );
  const goalId = community1.identity.goals[0].id;

  // إضافة احتياجين في النموذج الثالث
  community1.needs = addPlcNeedItem(community1.needs, {
    description: 'ضعف تحليل المعطيات في المسائل الرياضية المركبة',
    source: 'student_results',
    justification: 'نتائج اختبارات الفترة الأولى',
    priority: 'high',
    proposedAction: 'ورشة استراتيجيات حل المسألة',
    linkedGoalIds: [goalId],
  });
  community1.needs = addPlcNeedItem(community1.needs, {
    description: 'الحاجة لتنويع أوراق العمل التفاعلية',
    source: 'classroom_observation',
    justification: 'ملاحظات الزيارات الصفية',
    priority: 'medium',
    proposedAction: 'تصميم بنك أوراق عمل تدرجية',
    linkedGoalIds: [goalId],
  });

  const need1Id = community1.needs[0].id;
  const need2Id = community1.needs[1].id;
  const leaderMemberId = community1.members[0].id;

  // إنشاء إجراء في الخطة التشغيلية مرتبط بالهدف وبالاحتياجين معاً وبالمسؤول
  community1.operationalPlan = addPlcPlanActionItem(community1.operationalPlan, {
    goalId,
    needIds: [need1Id, need2Id],
    title: 'تنفيذ ورشة عمل تطبيقية وإعداد حقيبة أوراق عمل تدرجية لحل المسألة',
    responsibleMemberId: leaderMemberId,
    responsibleName: community1.members[0].name,
    startDate: '2026-10-01',
    endDate: '2026-10-15',
    resources: 'قاعة التدريب + نماذج اختبارات',
    indicatorText: 'إنجاز الحقيبة وتطبيقها في ٤ فصول دراسية',
    status: 'not_started',
  });

  assert.equal(community1.operationalPlan.length, 1);
  const action = community1.operationalPlan[0];
  assert.deepEqual(getPlcActionNeedIds(action), [need1Id, need2Id]);
  assert.equal(
    action.completionPercentage,
    null,
    'لا تُفترض نسبة إنجاز وهمية عند إنشاء الإجراء'
  );

  // التحقق من استرجاع العلاقات عبر المعرفات الثابتة وعند تعديل نص الاحتياج أو الهدف
  community1.needs = updatePlcNeedItem(community1.needs, need1Id, {
    description: 'ضعف تحليل المعطيات في المسائل الرياضية المركبة (محدث)',
  });

  const resolved = resolvePlcPlanActionLinks(
    community1.operationalPlan[0],
    community1
  );
  assert.equal(resolved.goalText, 'رفع مستوى إتقان مهارات حل المسائل اللفظية');
  assert.equal(resolved.linkedNeeds.length, 2);
  assert.equal(
    resolved.linkedNeeds[0].need.description,
    'ضعف تحليل المعطيات في المسائل الرياضية المركبة (محدث)',
    'ينعكس تعديل وصف الاحتياج تلقائياً في الخطة التشغيلية بفضل الربط بالمعرف الثابت'
  );
  assert.equal(resolved.linkedNeeds[0].priorityLabel, 'مرتفع');
  assert.equal(resolved.responsibleDisplayName, 'أ. سعد العتيبي');

  // تحديث حالة التنفيذ ونسبة الإنجاز الفعلية
  community1.operationalPlan = updatePlcPlanActionItem(
    community1.operationalPlan,
    action.id,
    {
      status: 'completed',
      completionPercentage: 100,
    }
  );
  assert.equal(community1.operationalPlan[0].status, 'completed');
  assert.equal(community1.operationalPlan[0].completionPercentage, 100);

  // إنشاء مجتمع ثانٍ والتحقق من الحفظ الدائم وعزل البيانات التام بين المجتمعين في النماذج الأربعة
  const community2 = createNewPlcCommunityRecord({
    name: 'مجتمع اللغة الإنجليزية',
    specialty: 'اللغة الإنجليزية',
  });

  const saved = savePlcCommunitiesToStorage([community1, community2], storage);
  assert.equal(saved, true);

  const reloaded = loadPlcCommunitiesFromStorage(storage);
  assert.equal(reloaded.length, 2);
  const reloadedC1 = reloaded.find((c) => c.id === community1.id)!;
  const reloadedC2 = reloaded.find((c) => c.id === community2.id)!;

  assert.equal(reloadedC1.identity.goals.length, 1);
  assert.equal(reloadedC1.needs.length, 2);
  assert.equal(reloadedC1.operationalPlan.length, 1);
  assert.equal(reloadedC1.operationalPlan[0].completionPercentage, 100);

  assert.equal(reloadedC2.identity.goals.length, 0);
  assert.equal(reloadedC2.needs.length, 0);
  assert.equal(reloadedC2.operationalPlan.length, 0);

  // حذف الإجراء والتحقق من نظافة القائمة
  reloadedC1.operationalPlan = deletePlcPlanActionItem(
    reloadedC1.operationalPlan,
    action.id
  );
  assert.equal(reloadedC1.operationalPlan.length, 0);
});

test('الدفعة الثانية - ٥: مراجعة التحقق الشاملة (انعكاس تعديل وحذف العناصر المرتبطة بـ IDs دون بيانات مكسورة، واستقلال مجتمعين كاملين في النماذج الأربعة)', () => {
  const storage = createMemoryStorage();

  // إنشاء مجتمعين مستقلين وإدخال بيانات كاملة في النماذج الأربعة لكلا المجتمعين
  let c1 = createNewPlcCommunityRecord(
    {
      name: 'مجتمع الرياضيات الأول',
      specialty: 'الرياضيات',
      leader: { name: 'أ. فيصل الحربي', specialty: 'الرياضيات' },
    },
    { academicYear: '١٤٤٧هـ' }
  );
  c1.identity.goals = addPlcIdentityListItem(
    c1.identity.goals,
    'هدف المجتمع الأول الأصلي',
    'goal'
  );
  c1.needs = addPlcNeedItem(c1.needs, {
    description: 'احتياج المجتمع الأول الأصلي',
    source: 'student_results',
    justification: 'مبرر ١',
    priority: 'high',
    proposedAction: 'إجراء مقترح ١',
  });
  c1.operationalPlan = addPlcPlanActionItem(c1.operationalPlan, {
    goalId: c1.identity.goals[0].id,
    needIds: [c1.needs[0].id],
    title: 'إجراء الخطة للمجتمع الأول',
    responsibleMemberId: c1.members[0].id,
    responsibleName: c1.members[0].name,
    startDate: '2026-10-01',
    endDate: '2026-10-20',
    resources: 'موارد ١',
    indicatorText: 'مؤشر ١',
    status: 'in_progress',
  });

  const c2 = createNewPlcCommunityRecord(
    {
      name: 'مجتمع الفيزياء الثاني',
      specialty: 'الفيزياء',
      leader: { name: 'أ. عادل الغامدي', specialty: 'الفيزياء' },
    },
    { academicYear: '١٤٤٧هـ' }
  );
  c2.identity.goals = addPlcIdentityListItem(
    c2.identity.goals,
    'هدف المجتمع الثاني المستقل',
    'goal'
  );
  c2.needs = addPlcNeedItem(c2.needs, {
    description: 'احتياج المجتمع الثاني المستقل',
    source: 'classroom_observation',
    justification: 'مبرر ٢',
    priority: 'medium',
    proposedAction: 'إجراء مقترح ٢',
  });
  c2.operationalPlan = addPlcPlanActionItem(c2.operationalPlan, {
    goalId: c2.identity.goals[0].id,
    needIds: [c2.needs[0].id],
    title: 'إجراء الخطة للمجتمع الثاني',
    responsibleMemberId: c2.members[0].id,
    responsibleName: c2.members[0].name,
    startDate: '2026-11-01',
    endDate: '2026-11-15',
    resources: 'موارد ٢',
    indicatorText: 'مؤشر ٢',
    status: 'not_started',
  });

  let list = [c1, c2];

  // ١. التحقق من أن نسبة الإنجاز لا تُنشأ بقيمة افتراضية وهمية حتى مع حالة "قيد التنفيذ" أو "منفذ"
  assert.equal(list[0].operationalPlan[0].completionPercentage, null);
  assert.equal(list[1].operationalPlan[0].completionPercentage, null);

  // ٢. تعديل اسم العضو المسؤول ونص الهدف ووصف الاحتياج في المجتمع الأول والتحقق من انعكاسها التلقائي في الخطة التشغيلية
  list = updatePlcCommunityInList(list, c1.id, (curr) => {
    const updatedMembers = updatePlcMember(curr.members, curr.members[0].id, {
      name: 'أ. فيصل بن عبدالعزيز الحربي (معدل)',
    });
    const updatedGoals = updatePlcIdentityListItem(
      curr.identity.goals,
      curr.identity.goals[0].id,
      'هدف المجتمع الأول بعد التعديل'
    );
    const updatedNeeds = updatePlcNeedItem(curr.needs, curr.needs[0].id, {
      description: 'احتياج المجتمع الأول بعد التعديل',
      priority: 'medium',
    });
    return {
      ...curr,
      members: updatedMembers,
      identity: { ...curr.identity, goals: updatedGoals },
      needs: updatedNeeds,
    };
  });

  const c1AfterEdit = list.find((item) => item.id === c1.id)!;
  const c2Untouched = list.find((item) => item.id === c2.id)!;

  const resolvedAfterEdit = resolvePlcPlanActionLinks(
    c1AfterEdit.operationalPlan[0],
    c1AfterEdit
  );
  assert.equal(
    resolvedAfterEdit.responsibleDisplayName,
    'أ. فيصل بن عبدالعزيز الحربي (معدل)'
  );
  assert.equal(resolvedAfterEdit.goalText, 'هدف المجتمع الأول بعد التعديل');
  assert.equal(
    resolvedAfterEdit.linkedNeeds[0].need.description,
    'احتياج المجتمع الأول بعد التعديل'
  );
  assert.equal(resolvedAfterEdit.linkedNeeds[0].priorityLabel, 'متوسط');

  // ٣. التحقق من عدم تأثر المجتمع الثاني بأي شكل
  const resolvedC2 = resolvePlcPlanActionLinks(
    c2Untouched.operationalPlan[0],
    c2Untouched
  );
  assert.equal(resolvedC2.responsibleDisplayName, 'أ. عادل الغامدي');
  assert.equal(resolvedC2.goalText, 'هدف المجتمع الثاني المستقل');
  assert.equal(
    resolvedC2.linkedNeeds[0].need.description,
    'احتياج المجتمع الثاني المستقل'
  );

  // ٤. حذف العضو والهدف والاحتياج المرتبطين في المجتمع الأول والتحقق من عدم ظهور نصوص مكسورة أو بيانات قديمة مختلقة
  list = updatePlcCommunityInList(list, c1.id, (curr) => ({
    ...curr,
    members: deletePlcMember(curr.members, curr.members[0].id),
    identity: {
      ...curr.identity,
      goals: deletePlcIdentityListItem(
        curr.identity.goals,
        curr.identity.goals[0].id
      ),
    },
    needs: deletePlcNeedItem(curr.needs, curr.needs[0].id),
  }));

  const c1AfterDeletes = list.find((item) => item.id === c1.id)!;
  const resolvedAfterDeletes = resolvePlcPlanActionLinks(
    c1AfterDeletes.operationalPlan[0],
    c1AfterDeletes
  );
  assert.equal(resolvedAfterDeletes.goal, null);
  assert.equal(resolvedAfterDeletes.goalText, 'غير مرتبط بهدف محدد');
  assert.equal(resolvedAfterDeletes.linkedNeeds.length, 0);
  assert.equal(resolvedAfterDeletes.responsibleMember, null);
  assert.equal(
    resolvedAfterDeletes.responsibleDisplayName,
    'غير محدد',
    'عند حذف العضو المرتبط بـ ID لا يجوز إظهار اسمه القديم المحذوف أو اختلاق بيانات بديلة'
  );

  // حفظ واسترجاع للتأكد من سلامة البيانات بعد الحذف
  savePlcCommunitiesToStorage(list, storage);
  const reloaded = loadPlcCommunitiesFromStorage(storage);
  assert.equal(reloaded.length, 2);
  assert.equal(reloaded[1].members[0].name, 'أ. عادل الغامدي');
});

// ============================================================================
// اختبارات الدفعة الثالثة: الاجتماعات ومحاضرها، البرامج والأنشطة والزيارات والشراكات،
// الشواهد الاختيارية (بحد أقصى 4)، ورموز QR المستقلة
// ============================================================================

test('الدفعة الثالثة - ١ (الاجتماعات ١-٧): إنشاء الاجتماعات، جلب الأعضاء للحضور والغياب، متابعة التوصيات، ربطها بإجراءات الخطة التشغيلية، وحذف الإجراء أو الاجتماع بأمان', () => {
  const community = createNewPlcCommunityRecord(
    {
      name: 'مجتمع اللغة العربية',
      specialty: 'اللغة العربية',
      venue: 'قاعة التطوير المهني',
      leader: {
        name: 'أ. عبدالرحمن السبيعي',
        specialty: 'اللغة العربية',
        jobRole: 'معلم متقدم',
      },
    },
    { academicYear: '١٤٤٧هـ' }
  );

  // إضافة عضو ثانٍ في النموذج الأول
  community.members = addPlcMember(community.members, {
    name: 'أ. نايف القحطاني',
    specialty: 'اللغة العربية',
    jobRole: 'معلم',
    roles: ['member'],
  });
  assert.equal(community.members.length, 2);
  const leaderMember = community.members[0];
  const secondMember = community.members[1];

  // إضافة هدف واحتياج وإجراء في الخطة التشغيلية لاختبار الربط مع توصيات الاجتماع
  community.identity.goals = addPlcIdentityListItem(
    community.identity.goals,
    'تطوير مهارات الفهم القرائي النقدي لدى الطلاب',
    'goal'
  );
  community.needs = addPlcNeedItem(community.needs, {
    description: 'الحاجة إلى استراتيجيات تدريس النص القرائي المتعمق',
    source: 'student_results',
    justification: 'نتائج التقويم القبلي',
    priority: 'high',
    proposedAction: 'ورشة تطبيقية',
  });
  community.operationalPlan = addPlcPlanActionItem(community.operationalPlan, {
    goalId: community.identity.goals[0].id,
    needIds: [community.needs[0].id],
    title: 'إعداد حقيبة أنشطة الفهم القرائي الأسبوعية',
    responsibleMemberId: secondMember.id,
    responsibleName: secondMember.name,
    startDate: '2026-10-05',
    endDate: '2026-10-25',
    resources: 'نماذج نصوص قرائية',
    indicatorText: 'إنجاز 4 نماذج تطبيقية',
    status: 'in_progress',
  });
  const planAction = community.operationalPlan[0];

  // ٢. جلب الأعضاء من النموذج الأول لتسجيل الحضور والغياب دون تكرار إدخالهم
  const initialAttendance = buildInitialMeetingAttendanceFromMembers(
    community.members
  );
  assert.equal(initialAttendance.length, 2);
  assert.equal(initialAttendance[0].memberId, leaderMember.id);
  assert.equal(initialAttendance[0].present, true);
  assert.equal(initialAttendance[1].memberId, secondMember.id);
  assert.equal(initialAttendance[1].present, true);

  // تعديل حضور العضو الثاني إلى غائب مع سبب
  initialAttendance[1].present = false;
  initialAttendance[1].absenceNote = 'مهمة إشرافية خارجية';

  // ١ و ٣. إنشاء اجتماع جديد وربطه بالمجتمع الصحيح مع توصية مرتبطة بإجراء ومسؤول وحالة متابعة
  const recId = generatePlcEntityId('rec');
  community.meetings = addPlcMeetingRecord(
    community.meetings,
    {
      meetingNumber: 1,
      date: '2026-10-06',
      meetingType: 'اجتماع دوري لمناقشة خطة الفهم القرائي',
      venue: community.venue,
      attendance: initialAttendance,
      agenda: ['استعراض نتائج التقويم القبلي', 'توزيع إعداد النماذج'],
      discussionSummary: 'تم الاتفاق على إعداد نماذج تدريجية',
      recommendations: [
        {
          id: recId,
          text: 'إنجاز المسودة الأولى من حقيبة أنشطة الفهم القرائي',
          responsibleMemberId: secondMember.id,
          responsibleName: secondMember.name,
          targetDate: '2026-10-15',
          followupStatus: 'not_started',
          followupNotes: 'يُعرض في الاجتماع القادم',
          linkedActionId: planAction.id,
        },
      ],
    },
    community.members,
    community.venue
  );

  assert.equal(community.meetings.length, 1);
  const meeting1 = community.meetings[0];
  assert.equal(meeting1.meetingNumber, 1);
  assert.ok(meeting1.qrCodeToken?.startsWith('qrmtg_'));

  // التحقق من جلب أسماء الأعضاء في الحضور والغياب وتأثرها بتعديل الاسم في النموذج الأول
  let resolvedAttendance = resolvePlcMeetingAttendance(meeting1, community);
  assert.equal(
    resolvedAttendance.filter((a) => a.present).length,
    1
  );
  assert.equal(
    resolvedAttendance.filter((a) => !a.present).length,
    1
  );
  assert.equal(resolvedAttendance[0].displayName, 'أ. عبدالرحمن السبيعي');
  assert.equal(resolvedAttendance[1].displayName, 'أ. نايف القحطاني');
  assert.equal(resolvedAttendance[1].absenceNote, 'مهمة إشرافية خارجية');

  // تعديل اسم العضو في النموذج الأول والتحقق من انعكاسه في الاجتماع والتوصية تلقائياً
  community.members = updatePlcMember(community.members, secondMember.id, {
    name: 'أ. نايف بن محمد القحطاني',
  });
  resolvedAttendance = resolvePlcMeetingAttendance(meeting1, community);
  assert.equal(
    resolvedAttendance[1].displayName,
    'أ. نايف بن محمد القحطاني',
    'ينعكس تعديل اسم العضو في النموذج الأول تلقائياً في سجل حضور الاجتماع'
  );

  let resolvedRec = resolvePlcMeetingRecommendationLinks(
    meeting1.recommendations[0],
    community
  );
  assert.equal(
    resolvedRec.responsibleDisplayName,
    'أ. نايف بن محمد القحطاني',
    'ينعكس تعديل اسم العضو في التوصية تلقائياً'
  );
  assert.equal(
    resolvedRec.linkedActionDisplayTitle,
    'إعداد حقيبة أنشطة الفهم القرائي الأسبوعية'
  );

  // ٤. تعديل حالة التوصية من «لم يبدأ» إلى «قيد التنفيذ» ثم «تم التنفيذ»
  community.meetings = updatePlcMeetingRecord(community.meetings, meeting1.id, {
    recommendations: meeting1.recommendations.map((r) =>
      r.id === recId ? { ...r, followupStatus: 'in_progress' } : r
    ),
  });
  assert.equal(
    community.meetings[0].recommendations[0].followupStatus,
    'in_progress'
  );

  community.meetings = updatePlcMeetingRecord(community.meetings, meeting1.id, {
    recommendations: community.meetings[0].recommendations.map((r) =>
      r.id === recId ? { ...r, followupStatus: 'completed' } : r
    ),
  });
  assert.equal(
    community.meetings[0].recommendations[0].followupStatus,
    'completed'
  );

  // ٥. تعديل عنوان الإجراء في الخطة التشغيلية والتأكد من تحديث العرض في التوصية المرتبطة
  community.operationalPlan = updatePlcPlanActionItem(
    community.operationalPlan,
    planAction.id,
    { title: 'إعداد حقيبة الفهم القرائي المطورة (النسخة المعتمدة)' }
  );
  resolvedRec = resolvePlcMeetingRecommendationLinks(
    community.meetings[0].recommendations[0],
    community
  );
  assert.equal(
    resolvedRec.linkedActionDisplayTitle,
    'إعداد حقيبة الفهم القرائي المطورة (النسخة المعتمدة)'
  );

  // ٦. حذف الإجراء من الخطة التشغيلية والتأكد أن الاجتماع والتوصية يظلان صالحين دون خطأ
  community.operationalPlan = deletePlcPlanActionItem(
    community.operationalPlan,
    planAction.id
  );
  resolvedRec = resolvePlcMeetingRecommendationLinks(
    community.meetings[0].recommendations[0],
    community
  );
  assert.equal(resolvedRec.linkedAction, null);
  assert.equal(resolvedRec.isLinkedActionDeleted, true);
  assert.equal(resolvedRec.linkedActionDisplayTitle, 'إجراء محذوف أو غير محدد');
  assert.equal(community.meetings.length, 1);

  // ٧. إضافة اجتماع ثانٍ ثم حذف اجتماع واحد والتأكد من عدم حذف الاجتماعات الأخرى أو بيانات المجتمع
  community.meetings = addPlcMeetingRecord(
    community.meetings,
    {
      meetingNumber: 2,
      date: '2026-10-20',
      meetingType: 'اجتماع مراجعة تطبيق الحقيبة القرائية',
    },
    community.members
  );
  assert.equal(community.meetings.length, 2);

  const overviewBeforeDelete = computePlcMeetingsOverview(community);
  assert.equal(overviewBeforeDelete.totalMeetingsCount, 2);
  assert.equal(overviewBeforeDelete.completedRecommendationsCount, 1);

  // التحقق من البحث والترتيب للاجتماعات
  const searchedMeetings = filterAndSortPlcMeetings(
    community.meetings,
    community,
    { searchQuery: 'مراجعة تطبيق' }
  );
  assert.equal(searchedMeetings.length, 1);
  assert.equal(searchedMeetings[0].meetingNumber, 2);

  community.meetings = deletePlcMeetingRecord(community.meetings, meeting1.id);
  assert.equal(community.meetings.length, 1);
  assert.equal(community.meetings[0].meetingNumber, 2);
  assert.equal(community.members.length, 2);
  assert.equal(community.identity.goals.length, 1);
});

test('الدفعة الثالثة - ٢ (سجلات التنفيذ ٨-١٤): إنشاء برنامج ونشاط وزيارة متبادلة وشراكة مجتمعية، ربطها بالهدف والاحتياج والإجراء، والتمييز الصارم بين المخطط له والمنفذ', () => {
  const community = createNewPlcCommunityRecord({
    name: 'مجتمع العلوم الطبيعية',
    specialty: 'العلوم',
    leader: { name: 'أ. ماجد الشهري', specialty: 'العلوم' },
  });

  // إعداد هدف واحتياج وإجراء للربط العلائقي
  community.identity.goals = addPlcIdentityListItem(
    community.identity.goals,
    'تفعيل التجارب الاستقصائية في المختبر المدرسي',
    'goal'
  );
  community.needs = addPlcNeedItem(community.needs, {
    description: 'تطوير مهارات تصميم التجارب البديلة الآمنة',
    source: 'classroom_observation',
    justification: 'ملاحظات الزيارات الصفية',
    priority: 'high',
    proposedAction: 'برنامج تطبيقي وزيارات تبادلية',
  });
  community.operationalPlan = addPlcPlanActionItem(community.operationalPlan, {
    goalId: community.identity.goals[0].id,
    needIds: [community.needs[0].id],
    title: 'تنفيذ سلسلة ورش المختبر الاستقصائي',
    responsibleMemberId: community.members[0].id,
    responsibleName: community.members[0].name,
    startDate: '2026-10-10',
    endDate: '2026-11-10',
    resources: 'أدوات المختبر',
    indicatorText: 'تنفيذ 4 تجارب معيارية',
    status: 'in_progress',
  });

  const goalId = community.identity.goals[0].id;
  const needId = community.needs[0].id;
  const actionId = community.operationalPlan[0].id;
  const leaderId = community.members[0].id;

  // ٨. إنشاء برنامج جديد (منفذ)
  community.activities = addPlcActivityRecord(community.activities, {
    title: 'برنامج تأهيل معلمي العلوم في الاستقصاء المعملي',
    type: 'program',
    needId,
    goalId,
    actionId,
    objectiveText: 'تمكين المعلمين من تصميم أوراق عمل استقصائية',
    targetAudience: 'معلمو العلوم بالمرحلة المتوسطة',
    executionDateOrPeriod: '2026-10-12',
    responsibleMemberIds: [leaderId],
    actualExecutionDescription:
      'تم عقد 3 جلسات تدريبية تطبيقية داخل المختبر',
    results: 'إنتاج 6 نماذج تجارب استقصائية جاهزة للتطبيق',
    status: 'completed',
  });

  // ٩. إنشاء نشاط جديد (مخطط له — لم ينفذ بعد)
  community.activities = addPlcActivityRecord(community.activities, {
    title: 'نشاط معرض التجارب العلمية المصغرة',
    type: 'activity',
    needId,
    goalId,
    actionId,
    objectiveText: 'عرض تجارب الطلاب الاستقصائية',
    targetAudience: 'طلاب الصف الثالث المتوسط',
    executionDateOrPeriod: '2026-11-25',
    responsibleMemberIds: [leaderId],
    actualExecutionDescription: '',
    results: '',
    status: 'planned',
  });

  // ١٠. إنشاء زيارة متبادلة مع حقولها الخاصة
  community.activities = addPlcActivityRecord(community.activities, {
    title: 'زيارة تبادلية لحصة استقصاء موجه في مختبر الفيزياء',
    type: 'mutual_visit',
    needId,
    goalId,
    actionId,
    objectiveText: 'ملاحظة تطبيق التساؤل السقراطي أثناء التجربة',
    targetAudience: 'أعضاء مجتمع العلوم',
    executionDateOrPeriod: '2026-10-18',
    responsibleMemberIds: [leaderId],
    actualExecutionDescription:
      'حضور الحصة الثالثة ومناقشة بطاقة الملاحظة بعدها',
    results: 'تعميم نموذج التمهيد الاستقصائي على بقية الفصول',
    status: 'completed',
    hostOrVisitingEntity: 'الصف الثاني المتوسط (ب) - مختبر العلوم',
    participantsText: '٤ معلمين من تخصص العلوم',
    keyObservations: 'تفاعل مرتفع للطلاب عند تقسيم الأدوار داخل المجموعات',
    lessonsLearned: 'تخصيص ٥ دقائق إضافية لتدوين الفرضيات قبل التجربة',
  });

  // ١١. إنشاء شراكة مجتمعية مع حقولها الخاصة
  community.activities = addPlcActivityRecord(community.activities, {
    title: 'شراكة مع مركز العلوم والتقنية لإثراء المختبر المدرسي',
    type: 'community_partnership',
    needId,
    goalId,
    actionId,
    objectiveText: 'توفير حقائب تجارب إثرائية واستضافة مختصين',
    targetAudience: 'معلمو وطلاب نادي العلوم',
    executionDateOrPeriod: '2026-10-22',
    responsibleMemberIds: [leaderId],
    actualExecutionDescription:
      'توقيع مذكرة تعاون وتنفيذ اللقاء الإثرائي الأول',
    results: 'تزويد المختبر بـ ٣ حقائب استقصائية رقمية',
    status: 'completed',
    partnerEntity: 'مركز العلوم والتقنية بالمنطقة',
    partnershipType: 'شراكة علمية وإثرائية مع جهة متخصصة',
  });

  assert.equal(community.activities.length, 4);

  // ١٢. التحقق من الربط العلائقي بالهدف والاحتياج والإجراء دون تكرار الإدخال
  const resolvedVisit = resolvePlcActivityRecordLinks(
    community.activities[2],
    community
  );
  assert.equal(
    resolvedVisit.linkedGoalDisplay,
    'تفعيل التجارب الاستقصائية في المختبر المدرسي'
  );
  assert.ok(
    resolvedVisit.linkedNeedDisplay.includes(
      'تطوير مهارات تصميم التجارب البديلة الآمنة'
    )
  );
  assert.equal(
    resolvedVisit.linkedActionDisplay,
    'تنفيذ سلسلة ورش المختبر الاستقصائي'
  );
  assert.equal(resolvedVisit.responsibleDisplayText, 'أ. ماجد الشهري');
  assert.equal(resolvedVisit.isExecuted, true);
  assert.equal(resolvedVisit.isPlannedOnly, false);
  assert.equal(
    community.activities[2].hostOrVisitingEntity,
    'الصف الثاني المتوسط (ب) - مختبر العلوم'
  );
  assert.equal(
    community.activities[3].partnerEntity,
    'مركز العلوم والتقنية بالمنطقة'
  );

  // ١٣. التمييز الصارم بين «مخطط له» و«منفذ» وعدم تحويل المخطط له تلقائياً إلى منفذ
  const execOverview = computePlcExecutionOverview(community);
  assert.equal(execOverview.totalRecordsCount, 4);
  assert.equal(execOverview.programsCount, 1);
  assert.equal(execOverview.activitiesCount, 1);
  assert.equal(execOverview.mutualVisitsCount, 1);
  assert.equal(execOverview.partnershipsCount, 1);
  assert.equal(execOverview.completedCount, 3);
  assert.equal(execOverview.plannedCount, 1);

  const plannedOnly = filterAndSortPlcActivities(
    community.activities,
    community,
    {
      statusFilter: 'planned',
    }
  );
  assert.equal(plannedOnly.length, 1);
  assert.equal(plannedOnly[0].title, 'نشاط معرض التجارب العلمية المصغرة');
  assert.equal(plannedOnly[0].status, 'planned');

  const resolvedPlanned = resolvePlcActivityRecordLinks(
    plannedOnly[0],
    community
  );
  assert.equal(resolvedPlanned.isPlannedOnly, true);
  assert.equal(resolvedPlanned.isExecuted, false);

  // التحقق من حالة اكتمال النموذج السادس: لو كانت كل السجلات "مخطط لها" فقط تصبح الحالة in_progress وليست completed
  const communityPlannedOnly = createNewPlcCommunityRecord({
    name: 'مجتمع تجريبي للمخطط فقط',
    specialty: 'عام',
  });
  communityPlannedOnly.activities = addPlcActivityRecord(
    communityPlannedOnly.activities,
    {
      title: 'برنامج مخطط له فقط',
      type: 'program',
      targetAudience: 'المعلمون',
      executionDateOrPeriod: '2026-12-01',
      status: 'planned',
    }
  );
  const plannedCompletion =
    computePlcFormsCompletionStatus(communityPlannedOnly);
  assert.equal(
    plannedCompletion.forms[6].state,
    'in_progress',
    'السجل المخطط له لا يُحتسب دليلاً على اكتمال التنفيذ الفعلي'
  );

  // ١٤. تعديل وحذف سجل تنفيذ مستقل دون التأثير على بقية السجلات
  const activityToDeleteId = community.activities[1].id;
  community.activities = updatePlcActivityRecord(
    community.activities,
    community.activities[0].id,
    { title: 'برنامج تأهيل معلمي العلوم في الاستقصاء المعملي (محدث)' }
  );
  assert.equal(
    community.activities[0].title,
    'برنامج تأهيل معلمي العلوم في الاستقصاء المعملي (محدث)'
  );

  community.activities = deletePlcActivityRecord(
    community.activities,
    activityToDeleteId
  );
  assert.equal(community.activities.length, 3);
  assert.ok(community.activities.every((a) => a.id !== activityToDeleteId));
});

test('الدفعة الثالثة - ٣ (الشواهد الاختيارية ١٥-١٩): حفظ السجل بدون شاهد، إرفاق حتى 4 شواهد، منع الشاهد الخامس، استبدال وحذف الشاهد دون حذف السجل، وعدم تكرار الشاهد عند ربطه بأكثر من موضع', () => {
  let community = createNewPlcCommunityRecord({
    name: 'مجتمع الدراسات الإسلامية',
    specialty: 'الدراسات الإسلامية',
  });

  // ١٥. حفظ سجل اجتماع وسجل تنفيذ بدون أي شاهد
  community.meetings = addPlcMeetingRecord(community.meetings, {
    meetingNumber: 1,
    date: '2026-10-08',
    meetingType: 'اجتماع تخطيط برامج التلاوة والتجويد',
  });
  community.activities = addPlcActivityRecord(community.activities, {
    title: 'برنامج تصحيح التلاوة التطبيقي',
    type: 'program',
    targetAudience: 'طلاب الحلقة',
    executionDateOrPeriod: '2026-10-15',
    status: 'completed',
  });

  const meetingId = community.meetings[0].id;
  const activityId = community.activities[0].id;

  assert.equal(
    getPlcRecordEvidences(community, community.meetings[0].evidenceIds).length,
    0,
    'يُحفظ الاجتماع بنجاح بدون أي شاهد'
  );
  assert.equal(
    getPlcRecordEvidences(community, community.activities[0].evidenceIds)
      .length,
    0,
    'يُحفظ البرنامج بنجاح بدون أي شاهد'
  );

  // ١٦. رفع شاهد واحد حتى 4 شواهد للسجل الواحد
  for (let i = 1; i <= PLC_MAX_EVIDENCES_PER_RECORD; i++) {
    const res = attachPlcEvidenceToRecord(community, 'activity', activityId, {
      title: `شاهد البرنامج رقم ${i}`,
      fileName: `evidence-${i}.png`,
      mimeType: 'image/png',
      fileDataUrl: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=#${i}`,
    });
    assert.equal(res.ok, true);
    assert.equal(res.error, undefined);
    community = res.community;
  }

  const attachedList = getPlcRecordEvidences(
    community,
    community.activities[0].evidenceIds
  );
  assert.equal(attachedList.length, 4);
  assert.equal(attachedList[0].fileName, 'evidence-1.png');
  assert.equal(attachedList[0].mimeType, 'image/png');

  // ١٧. منع رفع الشاهد الخامس مع رسالة واضحة
  const fifthAttempt = attachPlcEvidenceToRecord(
    community,
    'activity',
    activityId,
    {
      title: 'الشاهد الخامس الزائد',
      fileName: 'evidence-5.pdf',
      mimeType: 'application/pdf',
      fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQK',
    }
  );
  assert.equal(fifthAttempt.ok, false);
  assert.ok(
    fifthAttempt.error?.includes('4') || fifthAttempt.error?.includes('٤'),
    'يجب رفض الشاهد الخامس برسالة واضحة تحدد الحد الأقصى (4 شواهد)'
  );
  assert.equal(
    getPlcRecordEvidences(
      fifthAttempt.community,
      fifthAttempt.community.activities[0].evidenceIds
    ).length,
    4
  );

  // ١٨. استبدال شاهد أو حذفه دون حذف السجل نفسه
  const firstEvidenceId = attachedList[0].id;
  const replaceRes = replacePlcEvidenceOnRecord(
    community,
    'activity',
    activityId,
    firstEvidenceId,
    {
      title: 'شاهد البرنامج رقم 1 (المستبدل)',
      fileName: 'replaced-evidence-1.pdf',
      mimeType: 'application/pdf',
      fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQK#replaced',
    }
  );
  assert.equal(replaceRes.ok, true);
  community = replaceRes.community;

  const afterReplace = getPlcRecordEvidences(
    community,
    community.activities[0].evidenceIds
  );
  assert.equal(afterReplace.length, 4);
  assert.equal(afterReplace[0].title, 'شاهد البرنامج رقم 1 (المستبدل)');
  assert.equal(afterReplace[0].fileName, 'replaced-evidence-1.pdf');
  assert.equal(afterReplace[0].mimeType, 'application/pdf');

  // حذف شاهد واحد والتأكد من بقاء السجل وباقي الشواهد الثلاثة
  const secondEvidenceId = afterReplace[1].id;
  community = removePlcEvidenceFromRecord(
    community,
    'activity',
    activityId,
    secondEvidenceId
  );
  const afterRemove = getPlcRecordEvidences(
    community,
    community.activities[0].evidenceIds
  );
  assert.equal(afterRemove.length, 3);
  assert.equal(
    community.activities.length,
    1,
    'حذف الشاهد لا يحذف سجل البرنامج'
  );

  // ١٩. عدم تكرار الشاهد في المستودع العام للمجتمع عند ربطه بأكثر من موضع داخل نفس المجتمع
  const sharedEvidence = afterRemove[0];
  const repoCountBefore = community.evidenceRepository.length;

  const linkToMeetingRes = attachPlcEvidenceToRecord(
    community,
    'meeting',
    meetingId,
    {
      existingEvidenceId: sharedEvidence.id,
      title: sharedEvidence.title,
      fileName: sharedEvidence.fileName || 'replaced-evidence-1.pdf',
      mimeType: sharedEvidence.mimeType || 'application/pdf',
      fileDataUrl: sharedEvidence.fileDataUrl,
    }
  );
  assert.equal(linkToMeetingRes.ok, true);
  community = linkToMeetingRes.community;

  assert.equal(
    community.evidenceRepository.length,
    repoCountBefore,
    'ربط شاهد موجود باجتماع داخل نفس المجتمع لا يكرر تخزينه في مستودع الشواهد'
  );
  const meetingEvidences = getPlcRecordEvidences(
    community,
    community.meetings[0].evidenceIds
  );
  assert.equal(meetingEvidences.length, 1);
  assert.equal(meetingEvidences[0].id, sharedEvidence.id);
});

test('الدفعة الثالثة - ٤ (رموز QR المستقلة ٢٠-٢٣): توليد رمز QR لكل اجتماع ولكل سجل تنفيذ، ثباته بعد إعادة التحميل، اختلافه بين السجلات، وخلوه من البيانات الحساسة', () => {
  const storage = createMemoryStorage();
  const community = createNewPlcCommunityRecord({
    name: 'مجتمع الحاسب الآلي',
    specialty: 'التقنية الرقمية',
    leader: {
      name: 'أ. تركي الدوسري',
      specialty: 'حاسب آلي',
      email: 'turki@school.edu.sa',
      phone: '0501234567',
    },
  });

  community.meetings = addPlcMeetingRecord(community.meetings, {
    meetingNumber: 1,
    date: '2026-10-10',
    meetingType: 'تطوير مشاريع البرمجة بلغة بايثون',
    discussionSummary: 'ملاحظات خاصة بالاجتماع لا تدخل في QR',
  });

  community.activities = addPlcActivityRecord(community.activities, {
    title: 'برنامج معسكر البرمجة المدرسي',
    type: 'program',
    targetAudience: 'طلاب المرحلة الثانوية',
    executionDateOrPeriod: '2026-10-14',
    status: 'completed',
    actualExecutionDescription: 'تفاصيل مطولة عن التنفيذ لا تدخل في QR',
  });
  community.activities = addPlcActivityRecord(community.activities, {
    title: 'زيارة متبادلة لمعمل الروبوت',
    type: 'mutual_visit',
    targetAudience: 'معلمو التقنية الرقمية',
    executionDateOrPeriod: '2026-10-19',
    status: 'completed',
  });

  const meeting = community.meetings[0];
  const program = community.activities[0];
  const visit = community.activities[1];

  // ٢٠. توليد رمز QR لكل اجتماع ولكل سجل تنفيذ
  const meetingPayload = buildPlcRecordQrPayload(
    community.id,
    'meeting',
    meeting.id,
    meeting.qrCodeToken
  );
  const programPayload = buildPlcRecordQrPayload(
    community.id,
    'activity',
    program.id,
    program.qrCodeToken
  );
  const visitPayload = buildPlcRecordQrPayload(
    community.id,
    'activity',
    visit.id,
    visit.qrCodeToken
  );

  const meetingMatrix = generatePlcRecordQrMatrix(
    community.id,
    'meeting',
    meeting.id,
    meeting.qrCodeToken
  );
  const meetingSvg = generatePlcRecordQrSvgDataUrl(
    community.id,
    'meeting',
    meeting.id,
    meeting.qrCodeToken
  );

  assert.ok(meetingMatrix.length >= 21);
  assert.ok(meetingSvg.startsWith('data:image/svg+xml;utf8,'));
  const verifiedPayload = verifyPlcRecordQrMatrix(meetingMatrix);
  assert.ok(
    verifiedPayload,
    'مصفوفة QR قابلة للقراءة والتحقق عبر محرك QR المشترك'
  );
  assert.equal(verifiedPayload.communityId, community.id);
  assert.equal(verifiedPayload.recordId, meeting.id);

  // ٢٢. اختلاف الرمز بين السجلات المختلفة
  assert.notEqual(meetingPayload, programPayload);
  assert.notEqual(programPayload, visitPayload);
  assert.notEqual(meeting.qrCodeToken, program.qrCodeToken);

  // ٢٣. خلو محتوى QR من البيانات الحساسة أو نصوص الشواهد الخام أو أرقام الهواتف أو البريد
  assert.equal(meetingPayload.includes('turki@school.edu.sa'), false);
  assert.equal(meetingPayload.includes('0501234567'), false);
  assert.equal(meetingPayload.includes('ملاحظات خاصة'), false);
  assert.equal(programPayload.includes('تفاصيل مطولة'), false);

  const parsed = parsePlcRecordQrPayload(meetingPayload);
  assert.ok(parsed);
  assert.equal(parsed.communityId, community.id);
  assert.equal(parsed.recordKind, 'meeting');
  assert.equal(parsed.recordId, meeting.id);
  assert.equal(parsed.token, meeting.qrCodeToken);

  // ٢١. ثبات الرمز لنفس السجل بعد الحفظ وإعادة التحميل
  savePlcCommunitiesToStorage([community], storage);
  const reloaded = loadPlcCommunitiesFromStorage(storage)[0];
  const reloadedMeeting = reloaded.meetings[0];
  const reloadedProgram = reloaded.activities[0];

  assert.equal(reloadedMeeting.qrCodeToken, meeting.qrCodeToken);
  assert.equal(reloadedProgram.qrCodeToken, program.qrCodeToken);
  assert.equal(
    buildPlcRecordQrPayload(
      reloaded.id,
      'meeting',
      reloadedMeeting.id,
      reloadedMeeting.qrCodeToken
    ),
    meetingPayload
  );
});

test('الدفعة الثالثة - ٥ (العزل بين المجتمعات ٢٤-٢٦): استقلال تام للاجتماعات وسجلات التنفيذ والشواهد ورموز QR بين المجتمع الأول والمجتمع الثاني', () => {
  const storage = createMemoryStorage();

  // ٢٤. إنشاء اجتماعات وأنشطة وشواهد في المجتمع الأول
  let c1 = createNewPlcCommunityRecord({
    name: 'مجتمع الصفوف الأولية',
    specialty: 'الصفوف الأولية',
  });
  c1.meetings = addPlcMeetingRecord(c1.meetings, {
    meetingNumber: 1,
    date: '2026-10-05',
    meetingType: 'تأسيس القراءة المبكرة',
  });
  c1.activities = addPlcActivityRecord(c1.activities, {
    title: 'برنامج الانطلاقة القرائية - مجتمع ١',
    type: 'program',
    targetAudience: 'طلاب الصف الأول الابتدائي',
    executionDateOrPeriod: '2026-10-11',
    status: 'completed',
  });
  const c1AttachRes = attachPlcEvidenceToRecord(
    c1,
    'activity',
    c1.activities[0].id,
    {
      title: 'شاهد خاص بالمجتمع الأول',
      fileName: 'c1-photo.png',
      mimeType: 'image/png',
      fileDataUrl: 'data:image/png;base64,C1DATA',
    }
  );
  c1 = c1AttachRes.community;

  // ٢٥. إنشاء اجتماعات وأنشطة مختلفة في المجتمع الثاني
  let c2 = createNewPlcCommunityRecord({
    name: 'مجتمع التربية البدنية',
    specialty: 'التربية البدنية',
  });
  c2.meetings = addPlcMeetingRecord(c2.meetings, {
    meetingNumber: 1,
    date: '2026-10-09',
    meetingType: 'تنظيم الدوري المدرسي واللياقة',
  });
  c2.activities = addPlcActivityRecord(c2.activities, {
    title: 'شراكة مجتمعية مع النادي الرياضي - مجتمع ٢',
    type: 'community_partnership',
    targetAudience: 'منتخب المدرسة الرياضي',
    executionDateOrPeriod: '2026-10-17',
    status: 'completed',
    partnerEntity: 'النادي الرياضي بالمحافظة',
    partnershipType: 'استضافة ملاعب وتدريب',
  });
  const c2AttachRes = attachPlcEvidenceToRecord(
    c2,
    'activity',
    c2.activities[0].id,
    {
      title: 'شاهد خاص بالمجتمع الثاني',
      fileName: 'c2-agreement.pdf',
      mimeType: 'application/pdf',
      fileDataUrl: 'data:application/pdf;base64,C2DATA',
    }
  );
  c2 = c2AttachRes.community;

  // ٢٦. التأكد من عدم اختلاط الاجتماعات أو الأنشطة أو الشواهد أو رموز QR بين المجتمعين
  savePlcCommunitiesToStorage([c1, c2], storage);
  const loaded = loadPlcCommunitiesFromStorage(storage);
  assert.equal(loaded.length, 2);

  const loadedC1 = loaded.find((c) => c.id === c1.id)!;
  const loadedC2 = loaded.find((c) => c.id === c2.id)!;

  assert.equal(loadedC1.meetings.length, 1);
  assert.equal(loadedC2.meetings.length, 1);
  assert.notEqual(loadedC1.meetings[0].id, loadedC2.meetings[0].id);
  assert.equal(loadedC1.meetings[0].meetingType, 'تأسيس القراءة المبكرة');
  assert.equal(loadedC2.meetings[0].meetingType, 'تنظيم الدوري المدرسي واللياقة');

  assert.equal(loadedC1.activities.length, 1);
  assert.equal(loadedC2.activities.length, 1);
  assert.equal(loadedC1.activities[0].type, 'program');
  assert.equal(loadedC2.activities[0].type, 'community_partnership');

  assert.equal(loadedC1.evidenceRepository.length, 1);
  assert.equal(loadedC2.evidenceRepository.length, 1);
  assert.equal(loadedC1.evidenceRepository[0].fileName, 'c1-photo.png');
  assert.equal(loadedC2.evidenceRepository[0].fileName, 'c2-agreement.pdf');

  const c1Qr = buildPlcRecordQrPayload(
    loadedC1.id,
    'activity',
    loadedC1.activities[0].id,
    loadedC1.activities[0].qrCodeToken
  );
  const c2Qr = buildPlcRecordQrPayload(
    loadedC2.id,
    'activity',
    loadedC2.activities[0].id,
    loadedC2.activities[0].qrCodeToken
  );
  assert.notEqual(c1Qr, c2Qr);
  assert.ok(c1Qr.includes(loadedC1.id));
  assert.ok(!c1Qr.includes(loadedC2.id));
  assert.ok(c2Qr.includes(loadedC2.id));
  assert.ok(!c2Qr.includes(loadedC1.id));
});

// ============================================================================
// اختبارات الدفعة الرابعة (Batch 4): التقويم ومؤشرات الأداء وقياس الأثر ومستودع الشواهد
// تغطي البنود الإلزامية من ١ إلى ٣٨ بالكامل
// ============================================================================

test('الدفعة الرابعة - ١: قسم 7.1 تقويم التنفيذ المشتق تلقائياً وعدم عرض صفر وهمي عند غياب البيانات', () => {
  let c = createNewPlcCommunityRecord({
    name: 'مجتمع تقويم التنفيذ',
    specialty: 'العلوم',
  });

  // عند غياب الإجراءات والأنشطة لا توجد نسبة إنجاز مفترضة (null وليس 0)
  const emptyEval = computePlcExecutionEvaluationSummary(c);
  assert.equal(emptyEval.plannedActionsTotalCount, 0);
  assert.equal(emptyEval.actualPlanCompletionPercentage, null);
  assert.equal(
    emptyEval.actualPlanCompletionDisplay,
    'لا توجد بيانات كافية للحساب'
  );
  assert.equal(emptyEval.hasSufficientData, false);

  // إضافة إجراءات بخطة المجتمع وأنشطة متنوعة
  c.operationalPlan = addPlcPlanActionItem(c.operationalPlan, {
    goalId: 'goal_1',
    title: 'إجراء ١ مكتمل',
    responsibleName: 'أ. خالد',
    startDate: '2026-10-01',
    endDate: '2026-10-10',
    resources: 'حقيبة تدريبية',
    indicatorText: 'تنفيذ الورشة',
    status: 'completed',
    completionPercentage: 100,
  });
  c.operationalPlan = addPlcPlanActionItem(c.operationalPlan, {
    goalId: 'goal_1',
    title: 'إجراء ٢ قيد التنفيذ',
    responsibleName: 'أ. خالد',
    startDate: '2026-10-11',
    endDate: '2026-10-20',
    resources: 'أوراق عمل',
    indicatorText: 'تطبيق الأوراق',
    status: 'in_progress',
    completionPercentage: 50,
  });
  c.operationalPlan = addPlcPlanActionItem(c.operationalPlan, {
    goalId: 'goal_1',
    title: 'إجراء ٣ متعثر',
    responsibleName: 'أ. خالد',
    startDate: '2026-10-21',
    endDate: '2026-10-30',
    resources: 'معمل',
    indicatorText: 'تجهيز المعمل',
    status: 'stalled',
  });
  c.operationalPlan = addPlcPlanActionItem(c.operationalPlan, {
    goalId: 'goal_1',
    title: 'إجراء ٤ ملغى',
    responsibleName: 'أ. خالد',
    startDate: '2026-11-01',
    endDate: '2026-11-05',
    resources: 'قاعة',
    indicatorText: 'لقاء إضافي',
    status: 'cancelled',
  });

  c.activities = addPlcActivityRecord(c.activities, {
    title: 'برنامج تدريبي منفذ',
    type: 'program',
    targetAudience: 'المعلمون',
    executionDateOrPeriod: '2026-10-05',
    status: 'completed',
  });
  c.activities = addPlcActivityRecord(c.activities, {
    title: 'زيارة تبادلية مخططة',
    type: 'mutual_visit',
    targetAudience: 'معلمو العلوم',
    executionDateOrPeriod: '2026-10-12',
    status: 'planned',
  });
  c.activities = addPlcActivityRecord(c.activities, {
    title: 'شراكة مجتمعية ملغاة',
    type: 'community_partnership',
    targetAudience: 'أولياء الأمور',
    executionDateOrPeriod: '2026-10-18',
    status: 'cancelled',
  });

  const populatedEval = computePlcExecutionEvaluationSummary(c);
  assert.equal(populatedEval.plannedActionsTotalCount, 4);
  assert.equal(populatedEval.executedActionsCount, 1);
  assert.equal(populatedEval.inProgressActionsCount, 1);
  assert.equal(populatedEval.stalledActionsCount, 1);
  assert.equal(populatedEval.cancelledActionsCount, 1);
  assert.equal(populatedEval.hasSufficientData, true);
  // الإجراءات النشطة غير الملغاة = ٣ إجراءات (١٠٠ + ٥٠ + ٠ = ١٥٠ / ٣ = ٥٠٪)
  assert.equal(populatedEval.actualPlanCompletionPercentage, 50);
  assert.equal(populatedEval.byRecordType.program.total, 1);
  assert.equal(populatedEval.byRecordType.program.executed, 1);
  assert.equal(populatedEval.byRecordType.mutual_visit.planned, 1);
  assert.equal(populatedEval.byRecordType.mutual_visit.executed, 0);
  assert.equal(populatedEval.byRecordType.community_partnership.cancelled, 1);

  // اختبار إضافة وتعديل وحذف ملاحظة تقويم تنفيذ نوعية مرتبطة بالمعرف الثابت
  const actId = c.operationalPlan[0].id;
  c.evaluation.executionEvaluations = addPlcExecutionEvaluationItem(
    c.evaluation.executionEvaluations,
    {
      actionOrActivityId: actId,
      targetKind: 'plan_action',
      executionLevel: 'منفذ وفق الخطة',
      strengths: 'تفاعل المعلمين',
      improvements: 'تخصيص حصة إضافية',
      notes: 'توثيق كامل',
    }
  );
  assert.equal(c.evaluation.executionEvaluations.length, 1);
  const evalId = c.evaluation.executionEvaluations[0].id;
  const resolvedEval = resolvePlcExecutionEvaluationLinks(
    c.evaluation.executionEvaluations[0],
    c
  );
  assert.equal(resolvedEval.targetDisplayTitle, 'إجراء ١ مكتمل');

  c.evaluation.executionEvaluations = updatePlcExecutionEvaluationItem(
    c.evaluation.executionEvaluations,
    evalId,
    { strengths: 'تفاعل جميع المعلمين وتوثيق النتائج' }
  );
  assert.equal(c.evaluation.executionEvaluations[0].id, evalId);
  assert.equal(
    c.evaluation.executionEvaluations[0].strengths,
    'تفاعل جميع المعلمين وتوثيق النتائج'
  );

  c.evaluation.executionEvaluations = deletePlcExecutionEvaluationItem(
    c.evaluation.executionEvaluations,
    evalId
  );
  assert.equal(c.evaluation.executionEvaluations.length, 0);
});

test('الدفعة الرابعة - ٢: مؤشرات الأداء (البنود ١ - ١٠: إنشاء، تعديل، حذف، ربط بهدف وإجراء ونشاط، حساب نسبة الإنجاز، عدم الحساب عند النقص، اختلاف الحساب حسب اتجاه المؤشر، وثبات الـID)', () => {
  let c = createNewPlcCommunityRecord({
    name: 'مجتمع مؤشرات الأداء',
    specialty: 'الرياضيات',
  });

  // تجهيز هدف واحتياج وإجراء ونشاط للربط بالمعرفات الثابتة
  c.identity.goals = addPlcIdentityListItem(
    c.identity.goals,
    'رفع نسبة إتقان المهارات الأساسية في الجبر',
    'goal'
  );
  const goalId = c.identity.goals[0].id;

  c.needs = addPlcNeedItem(c.needs, {
    description: 'الحاجة لتحسين نتائج الجبر',
    source: 'student_results',
    justification: 'نتائج التشخيص',
    priority: 'high',
    proposedAction: 'حصص علاجية',
    linkedGoalIds: [goalId],
  });
  const needId = c.needs[0].id;

  c.operationalPlan = addPlcPlanActionItem(c.operationalPlan, {
    goalId,
    needIds: [needId],
    title: 'تطبيق برنامج الجبر التفاعلي',
    responsibleName: 'أ. محمد',
    startDate: '2026-10-01',
    endDate: '2026-10-15',
    resources: 'أدوات هندسية',
    indicatorText: 'تنفيذ البرنامج',
    status: 'completed',
  });
  const actionId = c.operationalPlan[0].id;

  c.activities = addPlcActivityRecord(c.activities, {
    title: 'ورشة تطبيقات الجبر',
    type: 'activity',
    needId,
    goalId,
    actionId,
    targetAudience: 'معلمو الرياضيات',
    executionDateOrPeriod: '2026-10-10',
    status: 'completed',
  });
  const activityId = c.activities[0].id;

  // التحقق من Validation المؤشر قبل الإنشاء (منع اسم فارغ ومنع نسب غير منطقية أو وحدات متعارضة)
  const invalidValidation = validatePlcKpiIndicatorInput({
    name: '',
  });
  assert.equal(invalidValidation.valid, false);

  const invalidPercentValidation = validatePlcKpiIndicatorInput({
    name: 'مؤشر نسبة خاطئة',
    unit: 'نسبة مئوية',
    achievedValue: 130,
  });
  assert.equal(invalidPercentValidation.valid, false);

  // ١. إنشاء مؤشر أداء + ٤. ربط بهدف + ٥. ربط بإجراء + ٦. ربط بنشاط
  c.evaluation.kpiIndicators = addPlcKpiIndicator(c.evaluation.kpiIndicators, {
    name: 'متوسط إتقان طلاب الصف الثالث في الجبر',
    description: 'يقيس تطور متوسط درجات الطلاب',
    linkedGoalId: goalId,
    linkedNeedId: needId,
    linkedActionId: actionId,
    linkedActivityId: activityId,
    baselineValue: 60,
    targetValue: 80,
    achievedValue: 75,
    unit: 'نسبة مئوية',
    indicatorType: 'higher_is_better',
    dataSource: 'سجل الدرجات الفصلي',
    measurementPeriod: 'الفصل الأول',
    measurementDate: '2026-11-01',
    notes: 'تقدم ملحوظ في الفصول المستهدفة',
  });

  assert.equal(c.evaluation.kpiIndicators.length, 1);
  const kpi = c.evaluation.kpiIndicators[0];
  const originalKpiId = kpi.id;
  assert.ok(originalKpiId.startsWith('kpi_'));

  // التحقق من الارتباطات الحية بالهدف والإجراء والنشاط
  const resolvedKpi = resolvePlcKpiIndicatorLinks(kpi, c);
  assert.ok(resolvedKpi.linkedGoal);
  assert.equal(
    resolvedKpi.linkedGoalDisplay,
    'رفع نسبة إتقان المهارات الأساسية في الجبر'
  );
  assert.ok(resolvedKpi.linkedNeed);
  assert.ok(resolvedKpi.linkedAction);
  assert.equal(resolvedKpi.linkedActionDisplay, 'تطبيق برنامج الجبر التفاعلي');
  assert.ok(resolvedKpi.linkedActivity);
  assert.ok(resolvedKpi.linkedActivityDisplay.includes('ورشة تطبيقات الجبر'));

  // ٧. حساب نسبة الإنجاز عند اكتمال البيانات (خط أساس 60، مستهدف 80، متحقق 75 => تقدم 15 من أصل 20 = 75%)
  assert.equal(resolvedKpi.achievement.isCalculated, true);
  assert.equal(resolvedKpi.achievement.percentage, 75);
  assert.equal(resolvedKpi.achievement.statusText, '75%');

  // ٢. تعديل مؤشر أداء + ١٠. الحفاظ على الـID الثابت
  c.evaluation.kpiIndicators = updatePlcKpiIndicator(
    c.evaluation.kpiIndicators,
    originalKpiId,
    {
      achievedValue: 80,
      calculationMethod: 'معادلة التحسن فوق خط الأساس المعتمدة',
    }
  );
  assert.equal(c.evaluation.kpiIndicators[0].id, originalKpiId);
  assert.equal(
    c.evaluation.kpiIndicators[0].calculationMethod,
    'معادلة التحسن فوق خط الأساس المعتمدة'
  );
  const updatedCalc = computePlcKpiAchievement(c.evaluation.kpiIndicators[0]);
  assert.equal(updatedCalc.isCalculated, true);
  assert.equal(updatedCalc.percentage, 100);

  // ٨. عدم حساب نسبة الإنجاز عند نقص البيانات (مثلاً المتحقق فارغ)
  const incompleteCalc = computePlcKpiAchievement({
    ...c.evaluation.kpiIndicators[0],
    baselineValue: 60,
    targetValue: 80,
    achievedValue: null,
    indicatorType: 'higher_is_better',
  });
  assert.equal(incompleteCalc.isCalculated, false);
  assert.equal(incompleteCalc.percentage, null);
  assert.equal(incompleteCalc.statusText, 'لم يتم احتساب نسبة الإنجاز آليًا');

  // ٩. اختلاف الحساب حسب نوع المؤشر (كلما زاد أفضل / كلما قل أفضل / هدف محدد / لا ينطبق)
  // أ) كلما زادت القيمة كان أفضل (بدون خط أساس: 40 من 50 = 80%)
  const higherCalc = computePlcKpiAchievement({
    ...c.evaluation.kpiIndicators[0],
    baselineValue: null,
    targetValue: 50,
    achievedValue: 40,
    indicatorType: 'higher_is_better',
  });
  assert.equal(higherCalc.isCalculated, true);
  assert.equal(higherCalc.percentage, 80);

  // ب) كلما قلت القيمة كان أفضل (خط أساس تأخر 20%، مستهدف 5%، متحقق 8% => انخفاض 12 من أصل 15 = 80%)
  const lowerCalc = computePlcKpiAchievement({
    ...c.evaluation.kpiIndicators[0],
    baselineValue: 20,
    targetValue: 5,
    achievedValue: 8,
    indicatorType: 'lower_is_better',
  });
  assert.equal(lowerCalc.isCalculated, true);
  assert.equal(lowerCalc.percentage, 80);

  // ج) الهدف قيمة محددة (مستهدف 10، متحقق 10 => 100%، ومتحقق 9 => 90%)
  const exactMatchCalc = computePlcKpiAchievement({
    ...c.evaluation.kpiIndicators[0],
    baselineValue: null,
    targetValue: 10,
    achievedValue: 10,
    indicatorType: 'exact_target',
  });
  assert.equal(exactMatchCalc.isCalculated, true);
  assert.equal(exactMatchCalc.percentage, 100);

  const exactNearCalc = computePlcKpiAchievement({
    ...c.evaluation.kpiIndicators[0],
    baselineValue: null,
    targetValue: 10,
    achievedValue: 9,
    indicatorType: 'exact_target',
  });
  assert.equal(exactNearCalc.isCalculated, true);
  assert.equal(exactNearCalc.percentage, 90);

  // د) لا ينطبق
  const notApplicableCalc = computePlcKpiAchievement({
    ...c.evaluation.kpiIndicators[0],
    baselineValue: 10,
    targetValue: 20,
    achievedValue: 20,
    indicatorType: 'not_applicable',
  });
  assert.equal(notApplicableCalc.isCalculated, false);
  assert.equal(notApplicableCalc.percentage, null);
  assert.equal(
    notApplicableCalc.statusText,
    'لم يتم احتساب نسبة الإنجاز آليًا'
  );

  // ٣. حذف مؤشر أداء دون حذف الأهداف أو الإجراءات أو الأنشطة المرتبطة
  c.evaluation.kpiIndicators = deletePlcKpiIndicator(
    c.evaluation.kpiIndicators,
    originalKpiId
  );
  assert.equal(c.evaluation.kpiIndicators.length, 0);
  assert.equal(c.identity.goals.length, 1);
  assert.equal(c.operationalPlan.length, 1);
  assert.equal(c.activities.length, 1);
});

test('الدفعة الرابعة - ٣: قياس الأثر (البنود ١١ - ٢٠: إنشاء، تعديل، حذف، ربط بهدف وإجراء ونشاط وشاهد، فصل تنفيذ النشاط عن تحقق الأثر، قرار التحسين، وثبات الـID)', () => {
  let c = createNewPlcCommunityRecord({
    name: 'مجتمع قياس الأثر',
    specialty: 'اللغة العربية',
  });

  c.identity.goals = addPlcIdentityListItem(
    c.identity.goals,
    'تجويد مهارات القراءة الناقدة لدى الطلاب',
    'goal'
  );
  const goalId = c.identity.goals[0].id;

  c.needs = addPlcNeedItem(c.needs, {
    description: 'ضعف استنتاج الأفكار الضمنية في النصوص',
    source: 'student_results',
    justification: 'تحليل نتائج التقويم القرائي',
    priority: 'high',
    proposedAction: 'تطبيق استراتيجية القراءة التفاعلية',
    linkedGoalIds: [goalId],
  });
  const needId = c.needs[0].id;

  c.operationalPlan = addPlcPlanActionItem(c.operationalPlan, {
    goalId,
    needIds: [needId],
    title: 'تنفيذ دروس تطبيقية في القراءة الناقدة',
    responsibleName: 'أ. عبدالرحمن',
    startDate: '2026-10-01',
    endDate: '2026-10-20',
    resources: 'نصوص قرائية',
    indicatorText: 'تنفيذ الدروس التطبيقية',
    status: 'completed',
  });
  const actionId = c.operationalPlan[0].id;

  // ١٨. التأكد أن تنفيذ النشاط وحده لا ينشئ سجل أثر تلقائيًا (تنفيذ النشاط ≠ تحقق الأثر)
  c.activities = addPlcActivityRecord(c.activities, {
    title: 'درس تطبيقي في القراءة الناقدة',
    type: 'activity',
    needId,
    goalId,
    actionId,
    targetAudience: 'معلمو اللغة العربية',
    executionDateOrPeriod: '2026-10-14',
    status: 'completed',
    actualExecutionDescription: 'تم تنفيذ الدرس بحضور ٦ معلمين',
    results: 'تفاعل الطلاب مع بطاقات التحليل',
  });
  const activityId = c.activities[0].id;
  assert.equal(
    c.evaluation.impactMeasurements.length,
    0,
    'تنفيذ النشاط وحده لا ينشئ سجل قياس أثر تلقائيًا'
  );

  // إضافة شاهد في المستودع لربطه بقياس الأثر
  const addEvRes = addPlcEvidenceToRepository(c, {
    title: 'تقرير مقارنة نتائج الطلاب قبل وبعد القراءة الناقدة',
    evidenceType: 'pdf',
    fileName: 'impact-report.pdf',
    mimeType: 'application/pdf',
    fileDataUrl: 'data:application/pdf;base64,IMP1',
  });
  c = addEvRes.community;
  const evidenceId = addEvRes.evidence!.id;

  // التحقق من Validation قياس الأثر (منع تسجيل أثر بدون ربط بهدف أو إجراء أو نشاط أو احتياج ما لم يُسمح بذلك)
  const invalidImp = validatePlcImpactMeasurementInput({
    beneficiaryCategory: 'الطلاب',
  });
  assert.equal(invalidImp.valid, false);

  // ١١. إنشاء سجل قياس أثر + ١٤. ربط بهدف + ١٥. ربط بإجراء + ١٦. ربط بنشاط + ١٧. ربط بشاهد + ١٩. تسجيل قرار التحسين
  c.evaluation.impactMeasurements = addPlcImpactMeasurement(
    c.evaluation.impactMeasurements,
    {
      linkedGoalId: goalId,
      linkedNeedId: needId,
      linkedActionId: actionId,
      linkedActivityId: activityId,
      beneficiaryCategory: 'طلاب الصف السادس',
      measurementMethod: 'pre_post_comparison',
      measurementTool: 'اختبار قبلي وبعدي موحد',
      measurementDate: '2026-11-15',
      baselineValue: 58,
      targetValue: 75,
      actualValue: 78,
      unit: 'نسبة مئوية',
      measurementResults: 'ارتفاع نسبة الإجابات الصحيحة من 58% إلى 78%',
      observedChangeDescription:
        'تحسن ملموس في قدرة الطلاب على استنتاج الفكرة الضمنية وتبرير الإجابة',
      supportingEvidenceIds: [evidenceId],
      improvementDecision: 'expand',
      improvementOpportunities: 'تعميم التجربة على الصفوف الرابع والخامس',
    }
  );
  c = syncCommunityImpactEvidenceLinks(c);

  assert.equal(c.evaluation.impactMeasurements.length, 1);
  const imp = c.evaluation.impactMeasurements[0];
  const originalImpId = imp.id;
  assert.ok(originalImpId.startsWith('imp_'));

  const resolvedImp = resolvePlcImpactMeasurementLinks(imp, c);
  assert.ok(resolvedImp.linkedGoal);
  assert.equal(
    resolvedImp.linkedGoalDisplay,
    'تجويد مهارات القراءة الناقدة لدى الطلاب'
  );
  assert.ok(resolvedImp.linkedAction);
  assert.equal(
    resolvedImp.linkedActionDisplay,
    'تنفيذ دروس تطبيقية في القراءة الناقدة'
  );
  assert.ok(resolvedImp.linkedActivity);
  assert.ok(
    resolvedImp.linkedActivityDisplay.includes('درس تطبيقي في القراءة الناقدة')
  );
  assert.equal(resolvedImp.supportingEvidences.length, 1);
  assert.equal(resolvedImp.supportingEvidences[0].id, evidenceId);
  assert.equal(resolvedImp.decisionDisplay, 'التوسع');

  // ١٢. تعديل سجل قياس أثر + ٢٠. الحفاظ على الـID الثابت
  c.evaluation.impactMeasurements = updatePlcImpactMeasurement(
    c.evaluation.impactMeasurements,
    originalImpId,
    {
      improvementDecision: 'continue',
      actualValue: 82,
    }
  );
  assert.equal(c.evaluation.impactMeasurements[0].id, originalImpId);
  assert.equal(
    c.evaluation.impactMeasurements[0].improvementDecision,
    'continue'
  );
  assert.equal(c.evaluation.impactMeasurements[0].actualValue, 82);

  // ١٣. حذف سجل قياس أثر دون حذف النشاط أو الشاهد
  c.evaluation.impactMeasurements = deletePlcImpactMeasurement(
    c.evaluation.impactMeasurements,
    originalImpId
  );
  c = syncCommunityImpactEvidenceLinks(c);
  assert.equal(c.evaluation.impactMeasurements.length, 0);
  assert.equal(c.activities.length, 1);
  assert.equal(c.evidenceRepository.length, 1);
});

test('الدفعة الرابعة - ٤: مستودع الشواهد الموحد (البنود ٢١ - ٣١: إضافة، تعديل، حذف غير مرتبط، تنبيه وحماية عند حذف شاهد مرتبط، ربط بعدة سجلات دون تكرار الملف، بحث، فلترة، عرض الارتباطات، واختيار شاهد موجود مع التوافق مع existingEvidenceId)', () => {
  let c = createNewPlcCommunityRecord({
    name: 'مجتمع الشواهد الموحد',
    specialty: 'الحاسب الآلي',
  });

  c.identity.goals = addPlcIdentityListItem(
    c.identity.goals,
    'تطوير مشاريع البرمجة المدرسية',
    'goal'
  );
  const goalId = c.identity.goals[0].id;

  c.meetings = addPlcMeetingRecord(c.meetings, {
    meetingNumber: 1,
    date: '2026-10-01',
    meetingType: 'اجتماع تخطيط مشاريع البرمجة',
  });
  const meetingId = c.meetings[0].id;

  c.activities = addPlcActivityRecord(c.activities, {
    title: 'مسابقة البرمجة الإبداعية',
    type: 'program',
    goalId,
    targetAudience: 'طلاب المرحلة الثانوية',
    executionDateOrPeriod: '2026-10-20',
    status: 'completed',
  });
  const activityId = c.activities[0].id;

  // ٢١. إضافة شاهد أول في المستودع مرتبط بالهدف والاجتماع معاً
  const addRes1 = addPlcEvidenceToRepository(c, {
    title: 'حقيبة مسابقة البرمجة',
    evidenceType: 'pdf',
    description: 'دليل تحكيم المشاريع البرمجية',
    evidenceDate: '2026-10-05',
    sourceOrEntity: 'فريق الحاسب',
    fileName: 'coding-guide.pdf',
    mimeType: 'application/pdf',
    fileDataUrl: 'data:application/pdf;base64,CODE1',
    initialLinks: [
      { targetType: 'goal', targetId: goalId },
      { targetType: 'meeting', targetId: meetingId },
    ],
  });
  assert.equal(addRes1.ok, true);
  c = addRes1.community;
  const ev1Id = addRes1.evidence!.id;

  // إضافة شاهد ثانٍ غير مرتبط بأي سجل
  const addRes2 = addPlcEvidenceToRepository(c, {
    title: 'صورة المعمل الرقمي',
    evidenceType: 'image',
    evidenceDate: '2026-10-12',
    fileName: 'lab.png',
    mimeType: 'image/png',
    fileDataUrl: 'data:image/png;base64,LAB2',
  });
  assert.equal(addRes2.ok, true);
  c = addRes2.community;
  const ev2Id = addRes2.evidence!.id;

  assert.equal(c.evidenceRepository.length, 2);

  // ٢٢. تعديل شاهد مع الحفاظ على معرفه الثابت
  const updEvRes = updatePlcEvidenceInRepository(c, ev1Id, {
    title: 'حقيبة مسابقة البرمجة الإبداعية (محدثة)',
    notes: 'نسخة معتمدة من اللجنة',
  });
  assert.equal(updEvRes.ok, true);
  c = updEvRes.community;
  assert.equal(c.evidenceRepository[0].id, ev1Id);
  assert.equal(
    c.evidenceRepository[0].title,
    'حقيبة مسابقة البرمجة الإبداعية (محدثة)'
  );

  // ٢٥. ربط الشاهد الأول بسجل إضافي (البرنامج) + ٣٠ و٣١. اختيار شاهد موجود من داخل سجل جديد عبر existingEvidenceId دون تكرار الملف (٢٦)
  const attachExisting = attachPlcEvidenceToRecord(c, 'activity', activityId, {
    existingEvidenceId: ev1Id,
    fileName: 'coding-guide.pdf',
    mimeType: 'application/pdf',
  });
  assert.equal(attachExisting.ok, true);
  c = attachExisting.community;

  // ٢٦. عدم تكرار الملف عند إعادة استخدام الشاهد
  assert.equal(
    c.evidenceRepository.length,
    2,
    'إعادة استخدام الشاهد لا تنشئ نسخة مكررة في المستودع'
  );
  assert.ok((c.meetings[0].evidenceIds ?? []).includes(ev1Id));
  assert.ok((c.activities[0].evidenceIds ?? []).includes(ev1Id));

  // ٢٩. عرض الارتباطات الحية للشاهد الأول (الهدف + الاجتماع + البرنامج)
  const resolvedLinks = resolvePlcEvidenceLinks(c.evidenceRepository[0], c);
  assert.equal(resolvedLinks.length, 3);
  const linkTargetTypes = resolvedLinks.map((l) => l.targetType);
  assert.ok(linkTargetTypes.includes('goal'));
  assert.ok(linkTargetTypes.includes('meeting'));
  assert.ok(linkTargetTypes.includes('program'));

  // ٢٧. البحث في الشواهد + ٢٨. الفلترة في الشواهد
  const searchCoding = filterAndSortPlcEvidenceRepository(
    c.evidenceRepository,
    c,
    { searchQuery: 'حقيبة مسابقة' }
  );
  assert.equal(searchCoding.length, 1);
  assert.equal(searchCoding[0].id, ev1Id);

  const filterImage = filterAndSortPlcEvidenceRepository(
    c.evidenceRepository,
    c,
    { evidenceTypeFilter: 'image' }
  );
  assert.equal(filterImage.length, 1);
  assert.equal(filterImage[0].id, ev2Id);

  const filterByProgramTarget = filterAndSortPlcEvidenceRepository(
    c.evidenceRepository,
    c,
    { linkedTargetTypeFilter: 'program' }
  );
  assert.equal(filterByProgramTarget.length, 1);
  assert.equal(filterByProgramTarget[0].id, ev1Id);

  // ٢٣. حذف شاهد غير مرتبط مباشرة دون طلب تأكيد إضافي
  const delUnlinked = deletePlcEvidenceFromRepository(c, ev2Id, {
    forceRemoveLinks: false,
  });
  assert.equal(delUnlinked.ok, true);
  assert.equal(delUnlinked.requiresConfirmation, false);
  c = delUnlinked.community;
  assert.equal(c.evidenceRepository.length, 1);

  // ٢٤. منع/تنبيه عند محاولة حذف شاهد مرتبط بسجلات أخرى قبل التأكيد
  const delLinkedWithoutConfirm = deletePlcEvidenceFromRepository(c, ev1Id, {
    forceRemoveLinks: false,
  });
  assert.equal(delLinkedWithoutConfirm.ok, false);
  assert.equal(delLinkedWithoutConfirm.requiresConfirmation, true);
  assert.equal(delLinkedWithoutConfirm.linkedRelationsCount, 3);
  assert.equal(
    delLinkedWithoutConfirm.warningMessage,
    'هذا الشاهد مرتبط بسجلات أخرى. هل تريد حذف الشاهد وإزالة ارتباطاته؟'
  );
  assert.equal(
    c.evidenceRepository.length,
    1,
    'لم يُحذف الشاهد المرتبط قبل تأكيد المستخدم'
  );

  // عند التأكيد يُحذف الشاهد وتُزال كافة ارتباطاته من الاجتماعات والأنشطة دون ترك روابط مكسورة
  const delLinkedConfirmed = deletePlcEvidenceFromRepository(c, ev1Id, {
    forceRemoveLinks: true,
  });
  assert.equal(delLinkedConfirmed.ok, true);
  c = delLinkedConfirmed.community;
  assert.equal(c.evidenceRepository.length, 0);
  assert.equal((c.meetings[0].evidenceIds ?? []).length, 0);
  assert.equal((c.activities[0].evidenceIds ?? []).length, 0);
});

test('الدفعة الرابعة - ٥: العزل التام بين المجتمعات (البنود ٣٢ - ٣٤: الشواهد ومؤشرات الأداء وقياس الأثر معزولة لكل مجتمع)', () => {
  let c1 = createNewPlcCommunityRecord({
    name: 'مجتمع الفيزياء (١)',
    specialty: 'الفيزياء',
  });
  const c2 = createNewPlcCommunityRecord({
    name: 'مجتمع الكيمياء (٢)',
    specialty: 'الكيمياء',
  });

  // ٣٢. إنشاء شاهد في مجتمع 1 والتأكد من عدم ظهوره في مجتمع 2
  const evRes = addPlcEvidenceToRepository(c1, {
    title: 'تقرير تجارب الفيزياء العملية',
    evidenceType: 'pdf',
    fileName: 'physics-lab.pdf',
    mimeType: 'application/pdf',
    fileDataUrl: 'data:application/pdf;base64,PHY1',
  });
  c1 = evRes.community;

  // ٣٣. إنشاء مؤشر أداء في مجتمع 1 والتأكد من عدم ظهوره في مجتمع 2
  c1.evaluation.kpiIndicators = addPlcKpiIndicator(
    c1.evaluation.kpiIndicators,
    {
      name: 'نسبة إتقان التجارب المعملية في الفيزياء',
      baselineValue: 50,
      targetValue: 85,
      achievedValue: 80,
      indicatorType: 'higher_is_better',
    }
  );

  // ٣٤. إنشاء قياس أثر في مجتمع 1 والتأكد من عدم ظهوره في مجتمع 2
  c1.evaluation.impactMeasurements = addPlcImpactMeasurement(
    c1.evaluation.impactMeasurements,
    {
      allowUnlinkedGeneralImpact: true,
      beneficiaryCategory: 'طلاب الفيزياء',
      measurementMethod: 'performance_analysis',
      measurementResults: 'تحسن مهارات القياس المعملي',
      observedChangeDescription: 'دقة استخدام أدوات القياس في المختبر',
      improvementDecision: 'continue',
    }
  );

  assert.equal(c1.evidenceRepository.length, 1);
  assert.equal(c2.evidenceRepository.length, 0);

  assert.equal(c1.evaluation.kpiIndicators.length, 1);
  assert.equal(c2.evaluation.kpiIndicators.length, 0);

  assert.equal(c1.evaluation.impactMeasurements.length, 1);
  assert.equal(c2.evaluation.impactMeasurements.length, 0);
});

test('الدفعة الرابعة - ٦: التكامل العلائقي عبر الـID الثابت (البنود ٣٥ - ٣٨: تعديل اسم هدف، تعديل اسم إجراء، حذف عضو، وعدم كسر الدفعات ١-٣)', () => {
  let c = createNewPlcCommunityRecord({
    name: 'مجتمع التكامل الشامل',
    specialty: 'العلوم',
    leader: { name: 'أ. خالد السبيعي', specialty: 'العلوم' },
  });

  // إضافة عضو ثانٍ
  c.members = addPlcMember(c.members, {
    name: 'أ. فهد الدوسري',
    specialty: 'العلوم',
    roles: ['coordinator'],
  });
  const memberToRemove = c.members.find((m) => m.name === 'أ. فهد الدوسري')!;

  // إضافة هدف وإجراء مرتبط بالعضو الثاني
  c.identity.goals = addPlcIdentityListItem(
    c.identity.goals,
    'الاسم القديم للهدف المهني',
    'goal'
  );
  const goalId = c.identity.goals[0].id;

  c.operationalPlan = addPlcPlanActionItem(c.operationalPlan, {
    goalId,
    title: 'الاسم القديم للإجراء التشغيلي',
    responsibleMemberId: memberToRemove.id,
    responsibleName: memberToRemove.name,
    startDate: '2026-10-01',
    endDate: '2026-10-15',
    resources: 'مختبر العلوم',
    indicatorText: 'تنفيذ التجارب',
    status: 'in_progress',
  });
  const actionId = c.operationalPlan[0].id;

  // ربط مؤشر أداء وقياس أثر بالهدف والإجراء
  c.evaluation.kpiIndicators = addPlcKpiIndicator(c.evaluation.kpiIndicators, {
    name: 'مؤشر مرتبط بالهدف والإجراء',
    linkedGoalId: goalId,
    linkedActionId: actionId,
    baselineValue: 40,
    targetValue: 80,
    achievedValue: 60,
  });

  c.evaluation.impactMeasurements = addPlcImpactMeasurement(
    c.evaluation.impactMeasurements,
    {
      linkedGoalId: goalId,
      linkedActionId: actionId,
      beneficiaryCategory: 'طلاب الصف الثاني المتوسط',
      measurementMethod: 'student_results_analysis',
      measurementResults: 'تحسن الدرجات بنسبة ٢٠٪',
      observedChangeDescription: 'زيادة المشاركة في الأنشطة الاستقصائية',
      improvementDecision: 'continue',
    }
  );

  // ٣٥. تعديل اسم هدف والتأكد من انعكاس الاسم الجديد في المؤشر وقياس الأثر
  c.identity.goals = updatePlcIdentityListItem(
    c.identity.goals,
    goalId,
    'الاسم الجديد المحدث للهدف المهني'
  );

  // ٣٦. تعديل اسم إجراء والتأكد من انعكاس الاسم الجديد في المؤشر وقياس الأثر
  c.operationalPlan = updatePlcPlanActionItem(c.operationalPlan, actionId, {
    title: 'الاسم الجديد المحدث للإجراء التشغيلي',
  });

  const resolvedKpi = resolvePlcKpiIndicatorLinks(
    c.evaluation.kpiIndicators[0],
    c
  );
  const resolvedImpact = resolvePlcImpactMeasurementLinks(
    c.evaluation.impactMeasurements[0],
    c
  );

  assert.equal(
    resolvedKpi.linkedGoalDisplay,
    'الاسم الجديد المحدث للهدف المهني'
  );
  assert.equal(
    resolvedKpi.linkedActionDisplay,
    'الاسم الجديد المحدث للإجراء التشغيلي'
  );
  assert.equal(
    resolvedImpact.linkedGoalDisplay,
    'الاسم الجديد المحدث للهدف المهني'
  );
  assert.equal(
    resolvedImpact.linkedActionDisplay,
    'الاسم الجديد المحدث للإجراء التشغيلي'
  );

  // ٣٧. حذف عضو والتأكد من عدم بقاء اسم قديم في الإجراء المرتبط به
  c.members = deletePlcMember(c.members, memberToRemove.id);
  const resolvedActionAfterMemberDelete = resolvePlcPlanActionLinks(
    c.operationalPlan[0],
    c
  );
  assert.equal(resolvedActionAfterMemberDelete.responsibleMember, null);
  assert.equal(
    resolvedActionAfterMemberDelete.responsibleDisplayName,
    'غير محدد',
    'عند حذف العضو المرتبط بـ ID لا يبقى اسمه القديم المنسوخ معلقاً'
  );

  // ٣٨. التأكد من حساب حالة اكتمال النماذج ١-٨ بشكل سليم دون كسر الدفعات السابقة
  const statusSummary = computePlcFormsCompletionStatus(c);
  assert.equal(statusSummary.forms[7].state, 'completed');
  assert.equal(statusSummary.forms[8].state, 'empty');
});

// ============================================================================
// اختبارات الدفعة الخامسة (Batch 5): النموذج التاسع — التقرير الختامي لمجتمع التعلّم المهني
// تغطي البنود الإلزامية من ١ إلى ٤٠ بالكامل
// ============================================================================

function buildComprehensiveCommunityForBatch5(): PlcCommunityRecord {
  let c = createNewPlcCommunityRecord({
    name: 'مجتمع تطوير تدريس الرياضيات',
    specialty: 'الرياضيات',
    academicYear: '1447هـ',
    semester: 'first',
    venue: 'قاعة التطوير المهني',
    foundationDate: '2026-09-01',
    status: 'active',
    leader: {
      name: 'أ. عبدالملك الحربي',
      specialty: 'الرياضيات',
      jobRole: 'معلم متقدم',
    },
  });

  c.members = addPlcMember(c.members, {
    name: 'أ. نايف القحطاني',
    specialty: 'الرياضيات',
    jobRole: 'معلم ممارس',
    roles: ['coordinator', 'member'],
  });
  c.members = addPlcMember(c.members, {
    name: 'أ. سامي الشهري',
    specialty: 'الرياضيات',
    jobRole: 'معلم ممارس',
    roles: ['rapporteur', 'member'],
  });

  // النموذج ٢: التعريف بالمجتمع والأهداف والقيم والمبادئ
  c.identity.vision = 'الريادة في تطبيق ممارسات التقويم التكويني في الرياضيات';
  c.identity.mission = 'تمكين معلمي الرياضيات من بناء أدوات تشخيصية وعلاجية فاعلة';
  c.identity.goals = addPlcIdentityListItem(
    c.identity.goals,
    'رفع مستوى إتقان الطلاب في مهارات الجبر والكسور',
    'goal'
  );
  c.identity.goals = addPlcIdentityListItem(
    c.identity.goals,
    'تفعيل الزيارات التشاركية بين معلمي القسم',
    'goal'
  );
  c.identity.values = addPlcIdentityListItem(
    c.identity.values,
    'التعاون المهني المستمر',
    'value'
  );
  c.identity.principles = addPlcIdentityListItem(
    c.identity.principles,
    'القرارات المبنية على شواهد تعلم الطلاب',
    'principle'
  );

  const goal1Id = c.identity.goals[0].id;
  const goal2Id = c.identity.goals[1].id;
  const member2Id = c.members[1].id;
  const member3Id = c.members[2].id;

  // النموذج ٣: الاحتياجات والأولويات
  c.needs = addPlcNeedItem(c.needs, {
    description: 'ضعف الطلاب في تبسيط الكسور الجبرية',
    source: 'student_results',
    justification: 'نتائج الاختبار التشخيصي الأول',
    priority: 'high',
    proposedAction: 'تصميم أوراق عمل علاجية متدرجة',
    linkedGoalIds: [goal1Id],
  });
  c.needs = addPlcNeedItem(c.needs, {
    description: 'الحاجة لتبادل الخبرات في إدارة النقاش الصفي',
    source: 'classroom_observation',
    justification: 'توصيات الزيارات الصفية',
    priority: 'medium',
    proposedAction: 'برنامج زيارات تبادلية منظمة',
    linkedGoalIds: [goal2Id],
  });
  c.needs = addPlcNeedItem(c.needs, {
    description: 'تحديث بنك الأسئلة الإثرائية',
    source: 'performance_analysis',
    justification: 'محضر القسم الأول',
    priority: 'low',
    proposedAction: 'مراجعة الأسئلة الفصلية',
    linkedGoalIds: [goal1Id],
  });

  const need1Id = c.needs[0].id;
  const need2Id = c.needs[1].id;
  const need3Id = c.needs[2].id;

  // النموذج ٤: الخطة التشغيلية
  c.operationalPlan = addPlcPlanActionItem(c.operationalPlan, {
    goalId: goal1Id,
    needIds: [need1Id],
    title: 'إعداد وتطبيق حقيبة الكسور العلاجية',
    responsibleMemberId: member2Id,
    responsibleName: c.members[1].name,
    startDate: '2026-09-10',
    endDate: '2026-10-10',
    resources: 'أوراق عمل تفاعلية',
    indicatorText: 'تطبيق الحقيبة في ٣ فصول',
    status: 'completed',
  });
  c.operationalPlan = addPlcPlanActionItem(c.operationalPlan, {
    goalId: goal2Id,
    needIds: [need2Id],
    title: 'تنفيذ جدول الزيارات التبادلية الشهرية',
    responsibleMemberId: member3Id,
    responsibleName: c.members[2].name,
    startDate: '2026-10-01',
    endDate: '2026-11-15',
    resources: 'استمارة ملاحظة صفية',
    indicatorText: 'تنفيذ ٤ زيارات متبادلة',
    status: 'in_progress',
    notes: 'جارٍ استكمال الزيارة الرابعة',
  });
  c.operationalPlan = addPlcPlanActionItem(c.operationalPlan, {
    goalId: goal1Id,
    needIds: [need3Id],
    title: 'أتمتة بنك الأسئلة الإثرائي',
    responsibleMemberId: member2Id,
    responsibleName: c.members[1].name,
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    resources: 'منصة الاختبارات',
    indicatorText: 'إدراج ٥٠ سؤالاً',
    status: 'stalled',
    notes: 'تأخر استلام النماذج المحكمة من اللجنة',
  });

  const action1Id = c.operationalPlan[0].id;
  const action2Id = c.operationalPlan[1].id;

  // النموذج ٥: الاجتماعات ومحاضرها
  c.meetings = addPlcMeetingRecord(c.meetings, {
    meetingNumber: 1,
    date: '2026-09-05',
    meetingType: 'اجتماع تأسيسي وتخطيطي',
    venue: 'قاعة الاجتماعات',
    agenda: ['تحليل نتائج التشخيص القبلي', 'اعتماد حقيبة الكسور'],
    discussionSummary: 'تمت مناقشة الفجوات المهارية وتوزيع المهام على الأعضاء.',
    attendance: [
      { memberId: c.members[0].id, present: true },
      { memberId: member2Id, present: true },
      { memberId: member3Id, present: false, absenceNote: 'مهمة تدريبية رسمية' },
    ],
    recommendations: [
      {
        id: 'rec_b5_1',
        text: 'تطبيق الاختبار القبلي الموحد قبل بدء البرنامج العلاجي',
        responsibleMemberId: member2Id,
        responsibleName: '',
        targetDate: '2026-09-12',
        followupStatus: 'completed',
        linkedActionId: action1Id,
      },
    ],
  });

  // النموذج ٦: البرامج والأنشطة والزيارات والشراكات
  c.activities = addPlcActivityRecord(c.activities, {
    title: 'البرنامج العلاجي المكثف في الكسور الجبرية',
    type: 'program',
    needId: need1Id,
    goalId: goal1Id,
    actionId: action1Id,
    targetAudience: 'طلاب الصف الثاني المتوسط',
    executionDateOrPeriod: 'سبتمبر - أكتوبر 2026',
    responsibleMemberIds: [member2Id],
    status: 'completed',
    actualExecutionDescription: 'تم تنفيذ ٨ حصص علاجية تطبيقية',
    results: 'انتظام ٤٥ طالباً في التدريبات العلاجية',
  });
  c.activities = addPlcActivityRecord(c.activities, {
    title: 'ورشة عمل بناء السلالم التقديرية',
    type: 'activity',
    needId: need1Id,
    goalId: goal1Id,
    actionId: action1Id,
    targetAudience: 'معلمو الرياضيات',
    executionDateOrPeriod: '2026-09-20',
    responsibleMemberIds: [c.members[0].id],
    status: 'completed',
    results: 'تصميم ٣ سلالم تقدير موحدة',
  });
  c.activities = addPlcActivityRecord(c.activities, {
    title: 'زيارة صفية تبادلية في استراتيجيات النقاش الرياضي',
    type: 'mutual_visit',
    needId: need2Id,
    goalId: goal2Id,
    actionId: action2Id,
    targetAudience: 'معلمو القسم',
    executionDateOrPeriod: '2026-10-18',
    responsibleMemberIds: [member3Id],
    status: 'in_progress',
    results: 'تنفيذ زيارتين وتوثيق الملاحظات',
  });
  c.activities = addPlcActivityRecord(c.activities, {
    title: 'شراكة مع أولياء الأمور لمتابعة الواجبات العلاجية',
    type: 'community_partnership',
    needId: need1Id,
    goalId: goal1Id,
    actionId: action1Id,
    targetAudience: 'أولياء أمور الطلاب المستهدفين',
    executionDateOrPeriod: 'أكتوبر 2026',
    responsibleMemberIds: [member2Id],
    status: 'planned',
    results: '',
  });

  const programActivityId = c.activities[0].id;

  // النموذج ٨: مستودع الشواهد الموحد
  const evRes1 = addPlcEvidenceToRepository(c, {
    title: 'تقرير نتائج الاختبار القبلي والبعدي للكسور',
    evidenceType: 'pdf',
    description: 'مقارنة درجات ٤٥ طالباً قبل وبعد الحقيبة العلاجية',
    evidenceDate: '2026-10-15',
    sourceOrEntity: 'لجنة الرياضيات',
    fileName: 'fractions-pre-post.pdf',
    mimeType: 'application/pdf',
    fileDataUrl: 'data:application/pdf;base64,FRACPDF1',
    initialLinks: [
      { targetType: 'goal', targetId: goal1Id },
      { targetType: 'program', targetId: programActivityId },
    ],
  });
  c = evRes1.community;
  const ev1Id = evRes1.evidence!.id;

  // النموذج ٧: مؤشرات الأداء وقياس الأثر
  c.evaluation.kpiIndicators = addPlcKpiIndicator(c.evaluation.kpiIndicators, {
    name: 'نسبة إتقان مهارة تبسيط الكسور الجبرية',
    linkedGoalId: goal1Id,
    linkedNeedId: need1Id,
    linkedActionId: action1Id,
    linkedActivityId: programActivityId,
    baselineValue: 50,
    targetValue: 80,
    achievedValue: 80,
    unit: 'نسبة مئوية',
    indicatorType: 'higher_is_better',
  });
  c.evaluation.kpiIndicators = addPlcKpiIndicator(c.evaluation.kpiIndicators, {
    name: 'عدد الزيارات الصفية التبادلية المنفذة',
    linkedGoalId: goal2Id,
    linkedNeedId: need2Id,
    linkedActionId: action2Id,
    baselineValue: 0,
    targetValue: 4,
    achievedValue: 2,
    unit: 'عدد',
    indicatorType: 'higher_is_better',
  });
  // مؤشر غير قابل للحساب آلياً (بدون قيمة فعلية)
  c.evaluation.kpiIndicators = addPlcKpiIndicator(c.evaluation.kpiIndicators, {
    name: 'مؤشر جودة الأسئلة الإثرائية',
    linkedGoalId: goal1Id,
    baselineValue: null,
    targetValue: null,
    achievedValue: null,
    unit: 'مستوى وصفي',
    indicatorType: 'not_applicable',
  });

  const kpi1Id = c.evaluation.kpiIndicators[0].id;
  c = linkPlcEvidenceToTarget(c, ev1Id, 'kpi', kpi1Id).community;

  c.evaluation.impactMeasurements = addPlcImpactMeasurement(
    c.evaluation.impactMeasurements,
    {
      linkedGoalId: goal1Id,
      linkedNeedId: need1Id,
      linkedActionId: action1Id,
      linkedActivityId: programActivityId,
      beneficiaryCategory: 'طلاب الصف الثاني المتوسط',
      measurementMethod: 'pre_post_comparison',
      measurementTool: 'اختبار تشخيصي قبلي وبعدي',
      measurementDate: '2026-10-14',
      baselineValue: 50,
      targetValue: 80,
      actualValue: 82,
      unit: 'نسبة مئوية',
      measurementResults: 'ارتفع متوسط الإتقان من 50% إلى 82%',
      observedChangeDescription:
        'تحسن قدرة الطلاب على تحليل البسط والمقام واختصار العوامل المشتركة بدقة',
      supportingEvidenceIds: [ev1Id],
      improvementDecision: 'expand',
      improvementOpportunities: 'تعميم الحقيبة العلاجية على الصف الثالث المتوسط',
    }
  );
  c = syncCommunityImpactEvidenceLinks(c);

  return c;
}

test('الدفعة الخامسة - بند ١ (التجميع): جمع بيانات المجتمع واشتقاق رئيس المجتمع من الأعضاء حصراً', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_1.name, 'مجتمع تطوير تدريس الرياضيات');
  assert.equal(report.section9_1.specialty, 'الرياضيات');
  assert.equal(report.section9_1.academicYear, '1447هـ');
  assert.equal(report.section9_1.leaderNameDisplay, 'أ. عبدالملك الحربي');
  assert.equal(report.section9_1.membersCount, 3);
});

test('الدفعة الخامسة - بند ٢ (التجميع): جمع الأهداف والتعريف بالمجتمع', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_2.goals.length, 2);
  assert.equal(report.section9_2.values.length, 1);
  assert.equal(report.section9_2.principles.length, 1);
  assert.ok(report.section9_2.visionDisplay.includes('التقويم التكويني'));
});

test('الدفعة الخامسة - بند ٣ (التجميع): جمع الاحتياجات والأولويات', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_3.totalNeedsCount, 3);
  assert.equal(report.section9_3.rows.length, 3);
});

test('الدفعة الخامسة - بند ٤ (التجميع): جمع الخطة التشغيلية', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_4.totalActionsCount, 3);
  assert.equal(report.section9_4.rows.length, 3);
});

test('الدفعة الخامسة - بند ٥ (التجميع): جمع الاجتماعات ومحاضرها والتوصيات', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_5.totalMeetingsCount, 1);
  assert.equal(report.section9_5.recommendationsRows.length, 1);
});

test('الدفعة الخامسة - بند ٦ (التجميع): جمع البرامج والأنشطة والزيارات والشراكات', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_6.totalRecordsCount, 4);
  assert.equal(report.section9_6.byType.program.total, 1);
  assert.equal(report.section9_6.byType.activity.total, 1);
  assert.equal(report.section9_6.byType.mutual_visit.total, 1);
  assert.equal(report.section9_6.byType.community_partnership.total, 1);
});

test('الدفعة الخامسة - بند ٧ (التجميع): جمع مؤشرات الأداء', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_7.kpiRows.length, 3);
});

test('الدفعة الخامسة - بند ٨ (التجميع): جمع سجلات قياس الأثر', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_8.totalImpactRecordsCount, 1);
  assert.equal(report.section9_8.rows.length, 1);
});

test('الدفعة الخامسة - بند ٩ (التجميع): جمع الشواهد من المستودع الموحد دون تكرار الملفات', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_9.totalEvidencesCount, 1);
  assert.equal(report.section9_9.rows.length, 1);
  assert.equal(report.section9_9.impactLinkedEvidencesCount, 1);
  assert.equal(report.section9_9.kpiLinkedEvidencesCount, 1);
});

test('الدفعة الخامسة - بند ١٠ (التحليل): حساب عدد الأعضاء', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_1.membersCount, 3);
  assert.equal(report.section9_1.members.length, 3);
});

test('الدفعة الخامسة - بند ١١ (التحليل): حساب الاحتياجات حسب الأولوية', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_3.priorityDistribution.high, 1);
  assert.equal(report.section9_3.priorityDistribution.medium, 1);
  assert.equal(report.section9_3.priorityDistribution.low, 1);
});

test('الدفعة الخامسة - بند ١٢ (التحليل): حساب حالات الخطة التشغيلية ونسبة الإنجاز', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_4.completedCount, 1);
  assert.equal(report.section9_4.inProgressCount, 1);
  assert.equal(report.section9_4.stalledCount, 1);
  assert.equal(report.section9_4.notStartedCount, 0);
  assert.equal(report.section9_4.cancelledCount, 0);
  assert.equal(report.section9_4.completionPercentage, 33.3);
});

test('الدفعة الخامسة - بند ١٣ (التحليل): حساب الاجتماعات والحضور والغياب التراكمي', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_5.totalMeetingsCount, 1);
  assert.equal(report.section9_5.totalPresentEntries, 2);
  assert.equal(report.section9_5.totalAbsentEntries, 1);
});

test('الدفعة الخامسة - بند ١٤ (التحليل): حساب البرامج والأنشطة والزيارات والشراكات حسب الحالة', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.section9_6.byType.program.executed, 1);
  assert.equal(report.section9_6.byType.activity.executed, 1);
  assert.equal(report.section9_6.byType.mutual_visit.inProgress, 1);
  assert.equal(report.section9_6.byType.community_partnership.planned, 1);
});

test('الدفعة الخامسة - بند ١٥ (التحليل): حساب المؤشرات القابلة للحساب فقط', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  const calcKpi1 = report.section9_7.kpiRows[0];
  assert.equal(calcKpi1.isCalculated, true);
  assert.equal(calcKpi1.achievementPercentage, 100);
  assert.equal(calcKpi1.achievementDisplay, '100%');

  const calcKpi2 = report.section9_7.kpiRows[1];
  assert.equal(calcKpi2.isCalculated, true);
  assert.equal(calcKpi2.achievementPercentage, 50);
});

test('الدفعة الخامسة - بند ١٦ (التحليل): عدم حساب المؤشرات غير القابلة للحساب وعدم وضع صفر بدلاً منها', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  const uncalcKpi3 = report.section9_7.kpiRows[2];
  assert.equal(uncalcKpi3.isCalculated, false);
  assert.equal(uncalcKpi3.achievementPercentage, null);
  assert.equal(
    uncalcKpi3.achievementDisplay,
    'لم يتم احتساب نسبة الإنجاز آليًا'
  );
});

test('الدفعة الخامسة - بند ١٧ (التحليل): عدم اعتبار تنفيذ النشاط وحده أثراً', () => {
  const commWithoutImpact = createNewPlcCommunityRecord({
    name: 'مجتمع منفذ للأنشطة بدون قياس أثر',
    specialty: 'اللغة الإنجليزية',
  });
  commWithoutImpact.activities = addPlcActivityRecord(
    commWithoutImpact.activities,
    {
      title: 'ورشة تدريس المفردات',
      type: 'activity',
      targetAudience: 'معلمو القسم',
      executionDateOrPeriod: '2026-10-10',
      status: 'completed',
      results: 'حضور ١٠ معلمين وتوزيع أوراق العمل',
    }
  );
  const reportWithoutImpact = buildPlcFinalReport(commWithoutImpact);
  assert.equal(
    reportWithoutImpact.section9_8.overallClassification,
    'no_impact_data'
  );
  assert.ok(
    reportWithoutImpact.section9_8.impactAnalysisParagraphs.some((p) =>
      p.includes('تنفيذ النشاط يُعد نتيجة تنفيذية ولا يُصنف أثرًا')
    )
  );
});

test('الدفعة الخامسة - بند ١٨ (التحليل): التمييز بين أثر مثبت ونتيجة موصوفة وعدم وجود بيانات أثر', () => {
  const fullComm = buildComprehensiveCommunityForBatch5();
  const fullReport = buildPlcFinalReport(fullComm);
  assert.equal(fullReport.section9_8.overallClassification, 'verified_impact');
  assert.equal(fullReport.section9_8.verifiedImpactsCount, 1);

  const commDescribed = createNewPlcCommunityRecord({
    name: 'مجتمع نتيجة موصوفة',
    specialty: 'التاريخ',
  });
  commDescribed.evaluation.impactMeasurements = addPlcImpactMeasurement(
    commDescribed.evaluation.impactMeasurements,
    {
      allowUnlinkedGeneralImpact: true,
      beneficiaryCategory: 'طلاب الصف الأول الثانوي',
      measurementMethod: 'observation_card',
      measurementResults: 'ملاحظة تفاعل الطلاب مع الخرائط الزمنية',
      observedChangeDescription: 'زيادة اهتمام الطلاب بتحليل الأحداث التاريخية',
      improvementDecision: 'continue',
    }
  );
  const reportDescribed = buildPlcFinalReport(commDescribed);
  assert.equal(
    reportDescribed.section9_8.overallClassification,
    'described_outcome'
  );
  assert.equal(reportDescribed.section9_8.describedOutcomesCount, 1);

  const emptyComm = createNewPlcCommunityRecord({
    name: 'مجتمع بدون أثر',
    specialty: 'العلوم',
  });
  const emptyReport = buildPlcFinalReport(emptyComm);
  assert.equal(emptyReport.section9_8.overallClassification, 'no_impact_data');
});

test('الدفعة الخامسة - بند ١٩ (التحليل): عدم توليد إنجازات أو تحديات غير مدعومة بالبيانات', () => {
  const emptyComm = createNewPlcCommunityRecord({
    name: 'مجتمع فارغ',
    specialty: 'التربية الفنية',
  });
  const emptyReport = buildPlcFinalReport(emptyComm);
  assert.equal(emptyReport.section9_10.items.length, 0);
  assert.ok(
    emptyReport.section9_11.items.every(
      (ch) => !ch.statement.includes('ضعف ميزانية')
    )
  );
});

test('الدفعة الخامسة - بند ٢٠ (الرسوم البيانية): إنشاء الرسم البياني عند توفر بيانات كافية', () => {
  const fullComm = buildComprehensiveCommunityForBatch5();
  const fullReport = buildPlcFinalReport(fullComm);
  assert.equal(
    fullReport.section9_13.operationalPlanStatusChart.hasSufficientData,
    true
  );
  assert.equal(
    fullReport.section9_13.kpiTargetVsActualChart.hasSufficientData,
    true
  );
  assert.equal(
    fullReport.section9_13.activitiesByStatusChart.hasSufficientData,
    true
  );
  assert.equal(
    fullReport.section9_13.needsByPriorityChart.hasSufficientData,
    true
  );
  assert.equal(
    fullReport.section9_13.impactMeasurementChart.hasSufficientData,
    true
  );
});

test('الدفعة الخامسة - بند ٢١ (الرسوم البيانية): عدم إنشاء رسم مضلل عند غياب البيانات', () => {
  const emptyComm = createNewPlcCommunityRecord({
    name: 'مجتمع بدون بيانات إحصائية',
    specialty: 'التربية البدنية',
  });
  const emptyReport = buildPlcFinalReport(emptyComm);
  for (const chart of emptyReport.section9_13.allCharts) {
    assert.equal(chart.hasSufficientData, false);
    assert.equal(chart.items.length, 0);
  }
});

test('الدفعة الخامسة - بند ٢٢ (الرسوم البيانية): عرض رسالة عدم توفر بيانات كافية للرسم', () => {
  const emptyComm = createNewPlcCommunityRecord({
    name: 'مجتمع بدون بيانات إحصائية',
    specialty: 'التربية البدنية',
  });
  const emptyReport = buildPlcFinalReport(emptyComm);
  for (const chart of emptyReport.section9_13.allCharts) {
    assert.equal(
      chart.emptyMessage,
      'لا توجد بيانات كافية لإنشاء الرسم البياني.'
    );
  }
});

test('الدفعة الخامسة - بند ٢٣ (العلاقات): عرض الهدف والاحتياج والإجراء والنشاط المرتبطة بشكل صحيح', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(
    report.section9_8.rows[0].goalDisplay,
    'رفع مستوى إتقان الطلاب في مهارات الجبر والكسور'
  );
  assert.equal(
    report.section9_8.rows[0].needDisplay,
    'ضعف الطلاب في تبسيط الكسور الجبرية'
  );
  assert.equal(
    report.section9_8.rows[0].actionDisplay,
    'إعداد وتطبيق حقيبة الكسور العلاجية'
  );
  assert.ok(
    report.section9_8.rows[0].activityDisplay.includes(
      'البرنامج العلاجي المكثف في الكسور الجبرية'
    )
  );
});

test('الدفعة الخامسة - بند ٢٤ (العلاقات): تحديث أسماء الأعضاء تلقائياً في التقرير عند تعديل العضو', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const leaderId = c.members[0].id;
  const member2Id = c.members[1].id;
  c.members = updatePlcMember(c.members, leaderId, {
    name: 'أ. عبدالملك الحربي (رئيس محدّث)',
  });
  c.members = updatePlcMember(c.members, member2Id, {
    name: 'أ. نايف القحطاني (اسم محدّث)',
  });

  const reportAfterMemberEdit = buildPlcFinalReport(c);
  assert.equal(
    reportAfterMemberEdit.section9_1.leaderNameDisplay,
    'أ. عبدالملك الحربي (رئيس محدّث)'
  );
  assert.equal(
    reportAfterMemberEdit.section9_4.rows[0].responsibleDisplay,
    'أ. نايف القحطاني (اسم محدّث)'
  );
  assert.equal(
    reportAfterMemberEdit.section9_5.recommendationsRows[0].responsibleDisplay,
    'أ. نايف القحطاني (اسم محدّث)'
  );
});

test('الدفعة الخامسة - بند ٢٥ (العلاقات): تحديث الهدف أو الإجراء أو النشاط تلقائياً في التقرير عند تعديل السجل الأصلي', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const goal1Id = c.identity.goals[0].id;
  const action1Id = c.operationalPlan[0].id;
  const act1Id = c.activities[0].id;

  c.identity.goals = updatePlcIdentityListItem(
    c.identity.goals,
    goal1Id,
    'هدف الجبر والكسور بعد التعديل'
  );
  c.operationalPlan = updatePlcPlanActionItem(c.operationalPlan, action1Id, {
    title: 'إجراء حقيبة الكسور بعد التعديل',
  });
  c.activities = updatePlcActivityRecord(c.activities, act1Id, {
    title: 'البرنامج العلاجي بعد التعديل',
  });

  const reportAfterEntityEdit = buildPlcFinalReport(c);
  assert.equal(
    reportAfterEntityEdit.section9_4.rows[0].goalDisplay,
    'هدف الجبر والكسور بعد التعديل'
  );
  assert.equal(
    reportAfterEntityEdit.section9_5.recommendationsRows[0].linkedActionDisplay,
    'إجراء حقيبة الكسور بعد التعديل'
  );
  assert.equal(
    reportAfterEntityEdit.section9_8.rows[0].goalDisplay,
    'هدف الجبر والكسور بعد التعديل'
  );
  assert.equal(
    reportAfterEntityEdit.section9_8.rows[0].actionDisplay,
    'إجراء حقيبة الكسور بعد التعديل'
  );
  assert.ok(
    reportAfterEntityEdit.section9_8.rows[0].activityDisplay.includes(
      'البرنامج العلاجي بعد التعديل'
    )
  );
});

test('الدفعة الخامسة - بند ٢٦ (العلاقات): تحديث الشواهد في التقرير عند تعديل مستودع الشواهد', () => {
  let c = buildComprehensiveCommunityForBatch5();
  const ev1Id = c.evidenceRepository[0].id;
  const updEv = updatePlcEvidenceInRepository(c, ev1Id, {
    title: 'تقرير الكسور المحدّث في المستودع',
  });
  c = updEv.community;
  const reportAfterEvEdit = buildPlcFinalReport(c);
  assert.equal(
    reportAfterEvEdit.section9_9.rows[0].title,
    'تقرير الكسور المحدّث في المستودع'
  );
  assert.equal(
    reportAfterEvEdit.section9_8.rows[0].supportingEvidencesTitles[0],
    'تقرير الكسور المحدّث في المستودع'
  );
});

test('الدفعة الخامسة - بند ٢٧ (العلاقات): معالجة السجلات المحذوفة دون كسر التقرير', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const action1Id = c.operationalPlan[0].id;
  const member2Id = c.members[1].id;
  c.operationalPlan = deletePlcPlanActionItem(c.operationalPlan, action1Id);
  c.members = deletePlcMember(c.members, member2Id);
  const reportAfterDeletions = buildPlcFinalReport(c);
  assert.equal(reportAfterDeletions.section9_4.rows.length, 2);
  assert.equal(
    reportAfterDeletions.section9_5.recommendationsRows[0].responsibleDisplay,
    'غير محدد'
  );
  assert.equal(
    reportAfterDeletions.section9_5.recommendationsRows[0].linkedActionDisplay,
    'إجراء محذوف أو غير محدد'
  );
});

test('الدفعة الخامسة - بند ٢٨ (الملاحظات الختامية): حفظ الملاحظات الختامية', () => {
  let c = buildComprehensiveCommunityForBatch5();
  c = updatePlcFinalReportNotes(c, {
    customExecutiveNotes: 'تم استكمال المراجعة المهنية لأعمال الفصل الأول.',
    customClosingNotes: 'يوصى بالاستمرار في الحقيبة العلاجية للفصل الثاني.',
  });
  const report = buildPlcFinalReport(c);
  assert.equal(
    report.section9_12.customExecutiveNotes,
    'تم استكمال المراجعة المهنية لأعمال الفصل الأول.'
  );
  assert.equal(
    report.section9_12.customClosingNotes,
    'يوصى بالاستمرار في الحقيبة العلاجية للفصل الثاني.'
  );
});

test('الدفعة الخامسة - بند ٢٩ (الملاحظات الختامية): تعديل الملاحظات الختامية', () => {
  let c = buildComprehensiveCommunityForBatch5();
  c = updatePlcFinalReportNotes(c, {
    customClosingNotes: 'ملاحظة أولى',
  });
  c = updatePlcFinalReportNotes(c, {
    customClosingNotes: 'يوصى بتوسيع الحقيبة العلاجية لتشمل جميع صفوف المرحلة المتوسطة.',
  });
  const report = buildPlcFinalReport(c);
  assert.equal(
    report.section9_12.customClosingNotes,
    'يوصى بتوسيع الحقيبة العلاجية لتشمل جميع صفوف المرحلة المتوسطة.'
  );
});

test('الدفعة الخامسة - بند ٣٠ (الملاحظات الختامية): بقاء الملاحظات الختامية عند إعادة توليد التقرير', () => {
  let c = buildComprehensiveCommunityForBatch5();
  c = updatePlcFinalReportNotes(c, {
    customExecutiveNotes: 'تم استكمال المراجعة المهنية لأعمال الفصل الأول.',
    customClosingNotes: 'يوصى بتوسيع الحقيبة العلاجية لتشمل جميع صفوف المرحلة المتوسطة.',
  });
  c.needs = addPlcNeedItem(c.needs, {
    description: 'احتياج جديد مضاف قبل إعادة توليد التقرير',
    source: 'classroom_observation',
    justification: 'ملاحظات صفية',
    priority: 'high',
    proposedAction: 'ورشة تدريبية',
  });
  const regenResult = regeneratePlcFinalReport(c, '2026-11-20T10:00:00.000Z');
  assert.equal(regenResult.report.section9_3.totalNeedsCount, 4);
  assert.equal(
    regenResult.report.section9_12.customExecutiveNotes,
    'تم استكمال المراجعة المهنية لأعمال الفصل الأول.'
  );
  assert.equal(
    regenResult.report.section9_12.customClosingNotes,
    'يوصى بتوسيع الحقيبة العلاجية لتشمل جميع صفوف المرحلة المتوسطة.'
  );
});

test('الدفعة الخامسة - بند ٣١ (PDF): توليد PDF فعلي غير فارغ بصيغة %PDF-1.4', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const artifact = generatePlcFinalReportPdfArtifact(c, DEFAULT_SCHOOL_SETTINGS);
  assert.ok(artifact.pdfBytes instanceof Uint8Array);
  assert.ok(artifact.pdfBytes.byteLength > 500);
  const headerStr = new TextDecoder().decode(artifact.pdfBytes.slice(0, 8));
  assert.ok(headerStr.startsWith('%PDF-1.4'));
  const tailStr = new TextDecoder().decode(
    artifact.pdfBytes.slice(Math.max(0, artifact.pdfBytes.length - 64))
  );
  assert.ok(tailStr.includes('%%EOF'));
});

test('الدفعة الخامسة - بند ٣٢ (PDF): احتواء PDF على جميع الأقسام الأساسية (9.1 إلى 9.13)', () => {
  const c = updatePlcFinalReportNotes(buildComprehensiveCommunityForBatch5(), {
    customClosingNotes: 'توصية ختامية معتمدة للتصدير في ملف PDF.',
  });
  const artifact = generatePlcFinalReportPdfArtifact(c, DEFAULT_SCHOOL_SETTINGS);
  const expectedSections = [
    '9.0',
    '9.1',
    '9.2',
    '9.3',
    '9.4',
    '9.5',
    '9.6',
    '9.7',
    '9.8',
    '9.9',
    '9.10',
    '9.13',
  ];
  for (const secCode of expectedSections) {
    assert.ok(artifact.pagesModel.sectionsIncluded.includes(secCode));
  }
  assert.ok(
    artifact.pagesModel.allTextTokens.some((t) =>
      t.includes('مجتمع تطوير تدريس الرياضيات')
    )
  );
});

test('الدفعة الخامسة - بند ٣٣ (PDF): عدم وجود صفحات فارغة وترقيم الصفحات بشكل سليم (الغلاف بدون رقم صفحة والفوتر الداخلي برقم الصفحة فقط)', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const artifact = generatePlcFinalReportPdfArtifact(c, DEFAULT_SCHOOL_SETTINGS);
  assert.ok(artifact.pageCount >= 1);
  assert.equal(artifact.pagesModel.pages.length, artifact.pageCount);
  for (let i = 0; i < artifact.pagesModel.pages.length; i++) {
    const p = artifact.pagesModel.pages[i];
    assert.ok(p.blocks.length > 0, `الصفحة ${p.pageNumber} ليست فارغة`);
    assert.equal(
      p.footerLabel,
      i === 0 ? '' : `${i + 1}`
    );
  }
});

test('الدفعة الخامسة - بند ٣٤ (PDF): عدم خروج الجداول والنصوص عن الحدود عبر التفاف الأسطر', () => {
  const veryLongArabicText =
    'هذا نص عربي طويل جداً لاختبار التفاف الكلمات والأسطر داخل خلايا الجداول في التقرير الختامي لمجتمع التعلم المهني بحيث لا يتجاوز حدود الخلية أو يخرج خارج إطار الصفحة المعتمدة إطلاقاً.';
  const wrappedLines = wrapArabicCellText(veryLongArabicText, 180, 11.5, null);
  assert.ok(wrappedLines.length >= 4);
  for (const line of wrappedLines) {
    assert.ok(line.length <= 20);
  }
});

test('الدفعة الخامسة - بند ٣٥ (العزل): تقرير المجتمع الأول لا يعرض بيانات المجتمع الثاني', () => {
  const c1 = buildComprehensiveCommunityForBatch5();
  const c2 = createNewPlcCommunityRecord({
    name: 'مجتمع اللغة العربية المستقل',
    specialty: 'اللغة العربية',
    academicYear: '1447هـ',
    leader: { name: 'أ. فيصل العتيبي', specialty: 'اللغة العربية' },
  });
  const report1 = buildPlcFinalReport(c1);
  const report2 = buildPlcFinalReport(c2);
  assert.equal(report1.communityId, c1.id);
  assert.equal(report2.communityId, c2.id);
  assert.equal(report1.section9_1.name, 'مجتمع تطوير تدريس الرياضيات');
  assert.equal(report2.section9_1.name, 'مجتمع اللغة العربية المستقل');
  assert.equal(report2.section9_3.totalNeedsCount, 0);
  assert.equal(report2.section9_4.totalActionsCount, 0);
});

test('الدفعة الخامسة - بند ٣٦ (العزل): شواهد المجتمع الأول لا تظهر في تقرير المجتمع الثاني', () => {
  const c1 = buildComprehensiveCommunityForBatch5();
  const c2 = createNewPlcCommunityRecord({
    name: 'مجتمع اللغة العربية المستقل',
    specialty: 'اللغة العربية',
  });
  const report1 = buildPlcFinalReport(c1);
  const report2 = buildPlcFinalReport(c2);
  assert.equal(report1.section9_9.totalEvidencesCount, 1);
  assert.equal(report2.section9_9.totalEvidencesCount, 0);
});

test('الدفعة الخامسة - بند ٣٧ (العزل): ملاحظات المجتمع الأول لا تظهر في تقرير المجتمع الثاني', () => {
  let c1 = buildComprehensiveCommunityForBatch5();
  c1 = updatePlcFinalReportNotes(c1, {
    customClosingNotes: 'ملاحظات ختامية خاصة بالمجتمع الأول فقط (الرياضيات)',
  });
  let c2 = createNewPlcCommunityRecord({
    name: 'مجتمع اللغة العربية المستقل',
    specialty: 'اللغة العربية',
  });
  c2 = updatePlcFinalReportNotes(c2, {
    customClosingNotes: 'ملاحظات ختامية خاصة بالمجتمع الثاني فقط (اللغة العربية)',
  });
  const report1 = buildPlcFinalReport(c1);
  const report2 = buildPlcFinalReport(c2);
  assert.equal(
    report1.section9_12.customClosingNotes,
    'ملاحظات ختامية خاصة بالمجتمع الأول فقط (الرياضيات)'
  );
  assert.equal(
    report2.section9_12.customClosingNotes,
    'ملاحظات ختامية خاصة بالمجتمع الثاني فقط (اللغة العربية)'
  );
});

test('الدفعة الخامسة - بند ٣٨ (التكامل الكامل): إنشاء مجتمع كامل من النموذج 1 إلى 8 ثم توليد التقرير 9 والتحقق من صحة جميع الأقسام', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  assert.equal(report.completeness.allComplete, true);
  assert.equal(report.completeness.completedSectionsCount, 9);
  assert.equal(report.completeness.incompleteSectionsCount, 0);
});

test('الدفعة الخامسة - بند ٣٩ (التكامل الكامل): تعديل بيانات في النماذج السابقة ثم إعادة فتح التقرير والتحقق من التحديث التلقائي', () => {
  const c = buildComprehensiveCommunityForBatch5();
  c.needs = addPlcNeedItem(c.needs, {
    description: 'احتياج تطوير مهارات حل المسائل اللفظية',
    source: 'survey',
    justification: 'زيارة المشرف التربوي',
    priority: 'high',
    proposedAction: 'تدريب أسبوعي على استراتيجيات الحل',
  });
  const updatedReport = buildPlcFinalReport(c);
  assert.equal(updatedReport.section9_3.totalNeedsCount, 4);
  assert.equal(updatedReport.section9_3.priorityDistribution.high, 2);
});

test('الدفعة الخامسة - بند ٤٠ (التكامل الكامل): تصدير PDF والتحقق من سلامته ومطابقته للمعاينة', () => {
  const c = buildComprehensiveCommunityForBatch5();
  const report = buildPlcFinalReport(c);
  const previewPagesModel = buildPlcFinalReportPdfPagesModel(
    report,
    DEFAULT_SCHOOL_SETTINGS,
    null
  );
  const exportedPdfArtifact = generatePlcFinalReportPdfArtifact(
    c,
    DEFAULT_SCHOOL_SETTINGS,
    report
  );
  assert.equal(exportedPdfArtifact.pageCount, previewPagesModel.pages.length);
  assert.deepEqual(
    exportedPdfArtifact.pagesModel.sectionsIncluded,
    previewPagesModel.sectionsIncluded
  );
});

// ============================================================================
// اختبارات الدفعة 5.5 (Batch 5.5): معاينة مجتمع تعلّم مهني نموذجي مكتمل (٢٠ اختباراً شاملاً)
// ============================================================================

test('الدفعة 5.5 - بند ١: تحميل بيانات المجتمع النموذجي المكتمل بالاسم والمجال والمدرسة الافتراضية المعتمدة واكتمال النماذج ١ إلى ٩', () => {
  const demo = getPlcDemoPreviewCommunity();
  assert.equal(demo.id, PLC_DEMO_COMMUNITY_ID);
  assert.equal(isPlcDemoPreviewId(demo.id), true);
  assert.equal(
    demo.name,
    'مجتمع تحسين نواتج التعلّم في مهارات القراءة والفهم القرائي'
  );
  assert.ok(demo.specialty.includes('اللغة العربية'));
  assert.ok(demo.specialty.includes('معلمو اللغة العربية'));
  assert.ok(demo.specialty.includes('المرحلة المتوسطة'));
  assert.equal(PLC_DEMO_TARGET_AUDIENCE, 'معلمو اللغة العربية');
  assert.equal(PLC_DEMO_STAGE_LABEL, 'المرحلة المتوسطة');
  assert.equal(PLC_DEMO_SCHOOL_NAME, 'مدرسة التميز المتوسطة النموذجية');

  const statusSummary = computePlcFormsCompletionStatus(demo);
  assert.equal(statusSummary.completedFormsCount, 9);
  for (let formNum = 1; formNum <= 9; formNum++) {
    assert.equal(
      statusSummary.forms[formNum as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9].state,
      'completed',
      `يجب أن يكون النموذج ${formNum} مكتملاً في المجتمع النموذجي`
    );
  }
});

test('الدفعة 5.5 - بند ٢: عدم حفظ بيانات المجتمع النموذجي في localStorage واستبعاده تلقائياً عند القراءة أو الحفظ', () => {
  const storage = createMemoryStorage();
  const realComm = createNewPlcCommunityRecord({
    name: 'مجتمع الرياضيات الفعلي للمستخدم',
    specialty: 'الرياضيات',
  });
  const demo = getPlcDemoPreviewCommunity();

  // محاولة حفظ قائمة تحتوي على المجتمع الفعلي + المجتمع التجريبي
  savePlcCommunitiesToStorage([realComm, demo], storage);
  const loaded = loadPlcCommunitiesFromStorage(storage);

  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, realComm.id);
  assert.equal(
    loaded.some((c) => isPlcDemoPreviewId(c.id)),
    false,
    'يجب ألا يُحفظ المجتمع التجريبي في التخزين المحلي مطلقاً'
  );
});

test('الدفعة 5.5 - بند ٣: عدم ظهور المجتمع النموذجي ضمن قائمة مجتمعات المستخدم الحقيقية عند الإضافة أو الفلترة', () => {
  const realComm = createNewPlcCommunityRecord({
    name: 'مجتمع العلوم الفعلي',
    specialty: 'العلوم',
  });
  const demo = getPlcDemoPreviewCommunity();

  const afterAttemptedAdd = addPlcCommunityToList([realComm], demo);
  assert.equal(afterAttemptedAdd.length, 1);
  assert.equal(afterAttemptedAdd[0].id, realComm.id);

  const filtered = filterAndSortPlcCommunities([realComm, demo], {
    searchQuery: '',
    statusFilter: 'all',
    semesterFilter: 'all',
    sortBy: 'newest',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, realComm.id);
});

test('الدفعة 5.5 - بند ٤: عدم احتساب المجتمع النموذجي ضمن الإحصاءات المدرسية العامة', () => {
  const realComm = createNewPlcCommunityRecord({
    name: 'مجتمع الفيزياء الفعلي',
    specialty: 'الفيزياء',
    status: 'active',
  });
  const demo = getPlcDemoPreviewCommunity();

  const summaryRealOnly = computePlcSchoolAggregateSummary([realComm]);
  const summaryWithDemo = computePlcSchoolAggregateSummary([realComm, demo]);

  assert.deepEqual(summaryWithDemo, summaryRealOnly);
  assert.equal(summaryWithDemo.selectedCommunitiesCount, 1);
  assert.equal(summaryWithDemo.totalMembersCount, 0);
});

test('الدفعة 5.5 - بند ٥: النموذج ١ (البيانات الأساسية والأعضاء) يحتوي على ٥ أعضاء ورئيس المجتمع مشتق من الأعضاء دون ازدواجية', () => {
  const demo = getPlcDemoPreviewCommunity();
  assert.equal(demo.members.length, 5);
  const leaders = demo.members.filter((m) => m.roles.includes('leader'));
  assert.equal(leaders.length, 1);
  const derivedLeader = getPlcCommunityLeader(demo);
  assert.ok(derivedLeader);
  assert.equal(derivedLeader.name, 'أ. عبدالرحمن بن صالح المنصور');
  assert.equal(derivedLeader.id, 'plc_demo_preview_mbr_leader_01');
});

test('الدفعة 5.5 - بند ٦: النموذج ٢ (التعريف بالمجتمع والأهداف والقيم والمبادئ) يحتوي على رؤية ورسالة و٤ أهداف و٤ قيم و٤ مبادئ مفصولة بوضوح', () => {
  const demo = getPlcDemoPreviewCommunity();
  assert.ok(demo.identity.vision.includes('الريادة في تمكين طلاب المرحلة المتوسطة'));
  assert.ok(demo.identity.mission.includes('تطوير استراتيجيات تدريس الفهم القرائي'));
  assert.equal(demo.identity.goals.length, 4);
  assert.equal(demo.identity.values.length, 4);
  assert.equal(demo.identity.principles.length, 4);
  // التأكد من عدم الخلط بين القيم والمبادئ
  assert.ok(demo.identity.values.some((v) => v.text.includes('التعاون المهني')));
  assert.ok(
    demo.identity.principles.some((p) => p.text.includes('التركيز على نواتج التعلّم القرائية الفعلية للطالب'))
  );
});

test('الدفعة 5.5 - بند ٧: النموذج ٣ (الاحتياجات والأولويات) يحتوي على ٤ احتياجات موزعة على الأولويات الثلاث ومرتبطة بالأهداف عبر ID', () => {
  const demo = getPlcDemoPreviewCommunity();
  assert.equal(demo.needs.length, 4);
  const highCount = demo.needs.filter((n) => n.priority === 'high').length;
  const mediumCount = demo.needs.filter((n) => n.priority === 'medium').length;
  const lowCount = demo.needs.filter((n) => n.priority === 'low').length;
  assert.equal(highCount, 2);
  assert.equal(mediumCount, 1);
  assert.equal(lowCount, 1);

  for (const need of demo.needs) {
    assert.ok((need.linkedGoalIds ?? []).length >= 1);
    for (const gid of need.linkedGoalIds ?? []) {
      assert.ok(demo.identity.goals.some((g) => g.id === gid));
    }
  }
});

test('الدفعة 5.5 - بند ٨: النموذج ٤ (الخطة التشغيلية) يحتوي على ٥ إجراءات موزعة على الحالات ومرتبطة بالأهداف والاحتياجات والأعضاء عبر ID', () => {
  const demo = getPlcDemoPreviewCommunity();
  assert.equal(demo.operationalPlan.length, 5);
  const statuses = demo.operationalPlan.map((a) => a.status);
  assert.equal(statuses.filter((s) => s === 'completed').length, 2);
  assert.equal(statuses.filter((s) => s === 'in_progress').length, 1);
  assert.equal(statuses.filter((s) => s === 'stalled').length, 1);
  assert.equal(statuses.filter((s) => s === 'not_started').length, 1);

  for (const action of demo.operationalPlan) {
    const resolved = resolvePlcPlanActionLinks(action, demo);
    assert.ok(resolved.goal);
    assert.ok(resolved.linkedNeeds.length >= 1);
    assert.ok(resolved.responsibleMember);
  }
});

test('الدفعة 5.5 - بند ٩: النموذج ٥ (الاجتماعات ومحاضرها) يحتوي على ٣ اجتماعات مكتملة المحاضر والحضور و٦ توصيات مرتبطة بالخطة عبر ID', () => {
  const demo = getPlcDemoPreviewCommunity();
  assert.equal(demo.meetings.length, 3);
  const overview = computePlcMeetingsOverview(demo);
  assert.equal(overview.totalMeetingsCount, 3);
  assert.equal(overview.totalRecommendationsCount, 6);

  for (const mtg of demo.meetings) {
    assert.ok(mtg.agenda.length >= 3);
    assert.ok(mtg.discussionSummary.trim().length > 20);
    const resolvedAtt = resolvePlcMeetingAttendance(mtg, demo);
    assert.equal(resolvedAtt.length, 5);
    for (const rec of mtg.recommendations) {
      const resolvedRec = resolvePlcMeetingRecommendationLinks(rec, demo);
      assert.ok(resolvedRec.responsibleMember);
      assert.ok(resolvedRec.linkedAction);
    }
  }
});

test('الدفعة 5.5 - بند ١٠: النموذج ٦ (البرامج والأنشطة والزيارات والشراكات) يغطي الأنواع الأربعة ويفصل النتيجة التنفيذية عن الأثر', () => {
  const demo = getPlcDemoPreviewCommunity();
  assert.equal(demo.activities.length, 4);
  const types = demo.activities.map((a) => a.type);
  assert.ok(types.includes('program'));
  assert.ok(types.includes('activity'));
  assert.ok(types.includes('mutual_visit'));
  assert.ok(types.includes('community_partnership'));

  for (const act of demo.activities) {
    const resolved = resolvePlcActivityRecordLinks(act, demo);
    assert.ok(resolved.linkedGoal);
    assert.ok(resolved.linkedNeed);
    assert.ok(resolved.linkedAction);
    assert.ok(resolved.responsibleMembers.length >= 1);
  }
});

test('الدفعة 5.5 - بند ١١: النموذج ٧ (تقييم التنفيذ 7.1) يحسب نسب إنجاز الخطة وتوزيع الحالات والملاحظات النوعية آلياً', () => {
  const demo = getPlcDemoPreviewCommunity();
  const evalSummary = computePlcExecutionEvaluationSummary(demo);
  assert.equal(evalSummary.plannedActionsTotalCount, 5);
  assert.equal(evalSummary.executedActionsCount, 2);
  assert.equal(evalSummary.actualPlanCompletionPercentage, 61);
  assert.equal(demo.evaluation.executionEvaluations.length, 3);
});

test('الدفعة 5.5 - بند ١٢: النموذج ٧ (مؤشرات الأداء 7.2) يحتوي على ٥ مؤشرات تغطي الاتجاهات الأربعة (higher_is_better وlower_is_better وexact_target وnot_applicable) بحساب آلي دقيق لكل اتجاه', () => {
  const demo = getPlcDemoPreviewCommunity();
  assert.equal(demo.evaluation.kpiIndicators.length, 5);
  const kpiTypes = demo.evaluation.kpiIndicators.map((k) => k.indicatorType);
  assert.ok(kpiTypes.includes('higher_is_better'));
  assert.ok(kpiTypes.includes('lower_is_better'));
  assert.ok(kpiTypes.includes('exact_target'));
  assert.ok(kpiTypes.includes('not_applicable'));

  for (const kpi of demo.evaluation.kpiIndicators) {
    const calc = computePlcKpiAchievement(kpi);
    if (kpi.indicatorType === 'not_applicable') {
      assert.equal(calc.isCalculated, false);
      assert.equal(calc.percentage, null);
    } else {
      assert.equal(calc.isCalculated, true);
      assert.ok(typeof calc.percentage === 'number');
    }
  }
});

test('الدفعة 5.5 - بند ١٣: النموذج ٧ (قياس الأثر 7.3) يحتوي على ٣ سجلات (٢ أثر كمي مثبت + ١ نتيجة موصوفة) مع قرارات التحسين', () => {
  const demo = getPlcDemoPreviewCommunity();
  assert.equal(demo.evaluation.impactMeasurements.length, 3);
  const classifications = demo.evaluation.impactMeasurements.map(
    (imp) => classifyPlcImpactMeasurementRecord(imp).classification
  );
  assert.equal(
    classifications.filter((c) => c === 'verified_impact').length,
    2
  );
  assert.equal(
    classifications.filter((c) => c === 'described_outcome').length,
    1
  );
});

test('الدفعة 5.5 - بند ١٤: النموذج ٨ (مستودع الشواهد الموحد) يحتوي على ٦ شواهد متنوعة مرتبطة بعدة كيانات عبر ID دون تكرار الملفات ودون تعارض رموز QR بين الاجتماعات/التنفيذ والشواهد', () => {
  const demo = getPlcDemoPreviewCommunity();
  assert.equal(demo.evidenceRepository.length, 6);
  const ev1 = demo.evidenceRepository.find(
    (e) => e.id === 'plc_demo_preview_evd_minutes_01'
  )!;
  assert.ok(ev1);
  assert.ok(ev1.links.length >= 3);
  const resolvedEv1 = resolvePlcEvidenceLinks(ev1, demo);
  assert.equal(resolvedEv1.length, ev1.links.length);
  assert.ok(resolvedEv1.every((l) => !l.isTargetDeleted));

  // التحقق من عدم وجود أي تعارض بين رموز QR الخاصة بالاجتماعات وسجلات التنفيذ والشواهد
  const meetingQrTokens = demo.meetings.map((m) => m.qrCodeToken);
  const activityQrTokens = demo.activities.map((a) => a.qrCodeToken);
  const evidenceQrTokens = demo.evidenceRepository.map((e) => e.qrCodeToken);
  const allQrTokens = [...meetingQrTokens, ...activityQrTokens, ...evidenceQrTokens];
  assert.equal(new Set(allQrTokens).size, allQrTokens.length);
});

test('الدفعة 5.5 - بند ١٥: النموذج ٨ يدعم البحث والتصفية داخل مستودع شواهد المجتمع النموذجي حسب النوع والارتباط والنص', () => {
  const demo = getPlcDemoPreviewCommunity();
  const pdfOnly = filterAndSortPlcEvidenceRepository(
    demo.evidenceRepository,
    demo,
    {
      evidenceTypeFilter: 'pdf',
    }
  );
  assert.equal(pdfOnly.length, 2);

  const linkedToImpact = filterAndSortPlcEvidenceRepository(
    demo.evidenceRepository,
    demo,
    {
      linkedTargetTypeFilter: 'impact',
    }
  );
  assert.equal(linkedToImpact.length, 4);

  const searchResult = filterAndSortPlcEvidenceRepository(
    demo.evidenceRepository,
    demo,
    {
      searchQuery: 'التدريس التبادلي',
    }
  );
  assert.ok(searchResult.length >= 1);
});

test('الدفعة 5.5 - بند ١٦: النموذج ٩ (التقرير الختامي) يُبنى آلياً بالكامل من المجتمع النموذجي بجميع الأقسام (9.1 إلى 9.13)', () => {
  const demo = getPlcDemoPreviewCommunity();
  const report = buildPlcFinalReport(demo);
  assert.equal(report.completeness.allComplete, true);
  assert.equal(report.completeness.completedSectionsCount, 9);
  assert.equal(report.section9_1.membersCount, 5);
  assert.equal(report.section9_2.goals.length, 4);
  assert.equal(report.section9_3.totalNeedsCount, 4);
  assert.equal(report.section9_4.totalActionsCount, 5);
  assert.equal(report.section9_5.totalMeetingsCount, 3);
  assert.equal(report.section9_6.totalRecordsCount, 4);
  assert.equal(report.section9_7.kpiRows.length, 5);
  assert.equal(report.section9_8.totalImpactRecordsCount, 3);
  assert.equal(report.section9_9.totalEvidencesCount, 6);
});

test('الدفعة 5.5 - بند ١٧: النموذج ٩ (الرسوم البيانية 9.13) يُنشئ جميع الرسوم البيانية الخمسة ببيانات كافية وصحيحة', () => {
  const demo = getPlcDemoPreviewCommunity();
  const report = buildPlcFinalReport(demo);
  assert.equal(report.section9_13.allCharts.length, 5);
  for (const chart of report.section9_13.allCharts) {
    assert.equal(
      chart.hasSufficientData,
      true,
      `الرسم البياني "${chart.title}" يجب أن يمتلك بيانات كافية`
    );
    assert.ok(chart.items.length >= 2);
  }
});

test('الدفعة 5.5 - بند ١٨: النموذج ٩ يستخرج الإنجازات والتحديات والتوصيات من سجلات المجتمع النموذجي الفعلي دون اختراع', () => {
  const demo = getPlcDemoPreviewCommunity();
  const report = buildPlcFinalReport(demo);
  assert.ok(report.section9_10.items.length >= 4);
  assert.ok(report.section9_11.items.length >= 1);
  assert.ok(report.section9_12.extractedRecommendations.length >= 3);
  assert.ok(
    report.section9_12.customExecutiveNotes.includes(
      'حقق مجتمع تحسين نواتج التعلّم في مهارات القراءة والفهم القرائي'
    )
  );
});

test('الدفعة 5.5 - بند ١٩: توليد ملف PDF للتقرير الختامي للمجتمع النموذجي بنجاح مع اسم المدرسة الافتراضية «مدرسة التميز المتوسطة النموذجية»', () => {
  const demo = getPlcDemoPreviewCommunity();
  const demoSchoolSettings = getPlcDemoPreviewSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
  assert.equal(demoSchoolSettings.schoolName, 'مدرسة التميز المتوسطة النموذجية');

  const artifact = generatePlcFinalReportPdfArtifact(demo, demoSchoolSettings);
  assert.ok(artifact.pdfBytes.byteLength > 1000);
  assert.ok(artifact.pageCount >= 2);
  assert.ok(
    artifact.pagesModel.allTextTokens.some((t) =>
      t.includes('مجتمع تحسين نواتج التعلّم في مهارات القراءة والفهم القرائي')
    )
  );
});

test('الدفعة 5.5 - بند ٢٠: عدم قابلية تلويث البيانات المرجعية للمجتمع النموذجي وتوفر التنويهات التوضيحية لجميع النماذج ١ إلى ٩', () => {
  const copy1 = getPlcDemoPreviewCommunity();
  copy1.name = 'اسم معدل مؤقتاً في الذاكرة';
  copy1.members.pop();

  const copy2 = getPlcDemoPreviewCommunity();
  assert.equal(
    copy2.name,
    'مجتمع تحسين نواتج التعلّم في مهارات القراءة والفهم القرائي'
  );
  assert.equal(copy2.members.length, 5);

  for (let formNum = 1; formNum <= 9; formNum++) {
    const hint = PLC_DEMO_FORM_HINTS[formNum as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9];
    assert.ok(typeof hint === 'string' && hint.trim().length > 15);
  }
});

test('الدفعة 5.5 - بند ٢١: تصدير تقرير المعلم الحقيقي (المكتمل والناقص جزئياً) بصيغة PDF باسم المجتمع الفعلي ودون أي اختلاط ببيانات المعاينة التجريبية', () => {
  // ١. مجتمع معلم حقيقي مكتمل (الرياضيات)
  const realComplete = buildComprehensiveCommunityForBatch5();
  const realArtifact = generatePlcFinalReportPdfArtifact(
    realComplete,
    DEFAULT_SCHOOL_SETTINGS
  );
  assert.ok(realArtifact.filename.includes('مجتمع_تطوير_تدريس_الرياضيات'));
  assert.ok(realArtifact.filename.endsWith('.pdf'));
  assert.ok(realArtifact.pdfBytes.byteLength > 1000);
  assert.ok(
    realArtifact.pagesModel.allTextTokens.some((t) =>
      t.includes('مجتمع تطوير تدريس الرياضيات')
    )
  );
  assert.equal(
    realArtifact.pagesModel.allTextTokens.some((t) =>
      t.includes('مجتمع تحسين نواتج التعلّم في مهارات القراءة والفهم القرائي')
    ),
    false,
    'تقرير المعلم الحقيقي لا يحتوي أي نص من المجتمع التجريبي'
  );

  // ٢. مجتمع معلم حقيقي ناقص البيانات جزئياً (يوضح ما ينقصه ويسمح بالتصدير دون اختلاق بيانات)
  const realPartial = createNewPlcCommunityRecord({
    name: 'مجتمع الكيمياء التطبيقي',
    specialty: 'الكيمياء',
    leader: { name: 'أ. طلال الحربي', specialty: 'الكيمياء' },
  });
  realPartial.identity.vision = 'تطوير التجارب الكيميائية الآمنة';
  realPartial.identity.mission = 'تمكين معلمي الكيمياء من المختبر الرقمي';
  realPartial.identity.goals = addPlcIdentityListItem(
    realPartial.identity.goals,
    'رفع كفاءة تطبيق معايير السلامة المعملية',
    'goal'
  );

  const partialReport = buildPlcFinalReport(realPartial);
  assert.equal(partialReport.completeness.allComplete, false);
  assert.ok(partialReport.completeness.incompleteSectionsCount > 0);

  const partialArtifact = generatePlcFinalReportPdfArtifact(
    realPartial,
    DEFAULT_SCHOOL_SETTINGS,
    partialReport
  );
  assert.ok(partialArtifact.filename.includes('مجتمع_الكيمياء_التطبيقي'));
  assert.ok(partialArtifact.pdfBytes.byteLength > 500);
  const partialHeader = new TextDecoder().decode(
    partialArtifact.pdfBytes.slice(0, 8)
  );
  assert.ok(partialHeader.startsWith('%PDF-1.4'));
});

// ============================================================================
// اختبارات إعادة التصميم الشاملة للنموذج التاسع (التقرير الختامي الرسمية والتربوية)
// ============================================================================

test('إعادة تصميم التقرير الختامي - ١: صفحة الغلاف المستقلة (Page 1) وهوية المدرسة الرسمية وإزالة تاريخ الإنشاء نهائياً', () => {
  const demo = getPlcDemoPreviewCommunity();
  const demoSettings = getPlcDemoPreviewSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
  const report = buildPlcFinalReport(demo);
  const pagesModel = buildPlcFinalReportPdfPagesModel(report, demoSettings, null);

  // ١. صفحة الغلاف هي الصفحة الأولى ومستقلة
  assert.equal(pagesModel.pages[0].pageNumber, 1);
  assert.equal(pagesModel.pages[0].isCoverPage, true);
  const coverBlock = pagesModel.pages[0].blocks[0];
  assert.equal(coverBlock.kind, 'cover_page');
  for (let i = 1; i < pagesModel.pages.length; i++) {
    assert.equal(pagesModel.pages[i].isCoverPage, false);
  }

  // ٢. احتواء الغلاف على اسم المجتمع، المجال، العام الدراسي، فترة التنفيذ، ورئيس المجتمع
  if (coverBlock.kind === 'cover_page') {
    assert.ok(
      coverBlock.communityNameLines
        .join(' ')
        .includes('مجتمع تحسين نواتج التعلّم في مهارات القراءة والفهم القرائي')
    );
    assert.equal(coverBlock.leaderName, 'أ. عبدالرحمن بن صالح المنصور');
    assert.equal(coverBlock.academicYear, '١٤٤٧هـ');
  }

  const fullJoinedTokens = pagesModel.allTextTokens.join(' ');
  assert.ok(fullJoinedTokens.includes('التقرير الختامي لمجتمع التعلّم المهني'));
  assert.ok(fullJoinedTokens.includes('مدرسة التميز المتوسطة النموذجية'));

  // ٣. إزالة تاريخ الإنشاء وتاريخ التوليد نهائياً من الغلاف والرأس والتذييل وجميع النصوص
  assert.equal(pagesModel.generatedDateDisplay, '');
  for (const page of pagesModel.pages) {
    assert.equal(page.createdDateText, '');
  }
  assert.equal(
    fullJoinedTokens.includes('تاريخ الإنشاء'),
    false,
    'يجب ألا يظهر تاريخ الإنشاء في التقرير'
  );
  assert.equal(
    fullJoinedTokens.includes('تاريخ توليد'),
    false,
    'يجب ألا يظهر تاريخ التوليد في التقرير'
  );
});

test('إعادة تصميم التقرير الختامي - ٢: التنظيم التنفيذي في ٦ صفحات للمجتمع المكتمل و٣ صفحات للمجتمع المختصر دون حشو أو تكرار', () => {
  const demo = getPlcDemoPreviewCommunity();
  const demoSettings = getPlcDemoPreviewSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
  const demoArtifact = generatePlcFinalReportPdfArtifact(demo, demoSettings);

  // المجتمع التجريبي المكتمل يخرج في 6 صفحات مركزة ومرتبة (1 غلاف + 5 فصول تنفيذية)
  assert.equal(
    demoArtifact.pageCount,
    6,
    'التقرير المكتمل يجب أن يكون مختصراً في 6 صفحات تنفيذية منظمة'
  );

  // المجتمع المختصر (قليل البيانات) يخرج في 3 صفحات فقط (غلاف + ملخص/ممارسات + توصيات واعتماد) دون صفحات فارغة
  const sparseComm = createNewPlcCommunityRecord({
    name: 'مجتمع العلوم المختصر',
    specialty: 'العلوم الطبيعية',
    academicYear: '1447هـ',
    leader: { name: 'أ. ماجد الشهري', specialty: 'العلوم' },
  });
  const sparseArtifact = generatePlcFinalReportPdfArtifact(
    sparseComm,
    DEFAULT_SCHOOL_SETTINGS
  );
  assert.equal(
    sparseArtifact.pageCount,
    3,
    'المجتمع قليل البيانات يجب أن يخرج في 3 صفحات متماسكة دون حشو'
  );
  for (const page of sparseArtifact.pagesModel.pages) {
    assert.ok(page.blocks.length >= 1, 'لا توجد أي صفحة فارغة');
  }
});

test('إعادة تصميم التقرير الختامي - ٣: الاعتماد الرسمي والتوقيعات (مدير المدرسة يساراً ورئيس المجتمع يميناً دون خلط أو افتراض تطابقهما)', () => {
  const demo = getPlcDemoPreviewCommunity();
  const customSchoolSettings = {
    ...getPlcDemoPreviewSchoolSettings(DEFAULT_SCHOOL_SETTINGS),
    principalName: 'أ. فهد بن عبدالعزيز السديري',
    gender: 'male' as const,
  };
  const report = buildPlcFinalReport(demo);
  const pagesModel = buildPlcFinalReportPdfPagesModel(
    report,
    customSchoolSettings,
    null
  );

  const lastPage = pagesModel.pages[pagesModel.pages.length - 1];
  const signoffBlock = lastPage.blocks.find(
    (b) => b.kind === 'official_signoff_block'
  );
  assert.ok(signoffBlock && signoffBlock.kind === 'official_signoff_block', 'يجب وجود كتلة الاعتماد الرسمي في ختام التقرير');
  if (signoffBlock && signoffBlock.kind === 'official_signoff_block') {
    assert.equal(
      signoffBlock.principalName,
      'أ. فهد بن عبدالعزيز السديري',
      'اسم مدير المدرسة يؤخذ من إعدادات المدرسة المعتمدة (الجهة اليسرى)'
    );
    assert.equal(signoffBlock.principalTitle, 'مدير المدرسة');
    assert.equal(
      signoffBlock.leaderName,
      'أ. عبدالرحمن بن صالح المنصور',
      'اسم رئيس المجتمع يؤخذ من سجل أعضاء المجتمع (الجهة اليمنى)'
    );
    assert.ok(signoffBlock.leaderTitle.includes('رئيس مجتمع التعلّم المهني'));
    assert.notEqual(
      signoffBlock.principalName,
      signoffBlock.leaderName,
      'لا يفترض النظام أن رئيس المجتمع هو مدير المدرسة'
    );
  }
});

test('إعادة تصميم التقرير الختامي - ٤: الشواهد المختارة ورموز QR الموثوقة (تظهر فقط للشواهد المرتبطة بسجل صالح)', () => {
  const demo = getPlcDemoPreviewCommunity();
  const demoReport = buildPlcFinalReport(demo);
  const selectedDemoEvidences = selectKeyEvidencesForExecutiveReport(demoReport);

  assert.equal(
    selectedDemoEvidences.length,
    4,
    'يعرض التقرير التنفيذي أهم 4 شواهد مختارة بدلاً من سرد المستودع كاملاً'
  );
  for (const ev of selectedDemoEvidences) {
    assert.equal(ev.hasValidQr, true);
    assert.ok(ev.qrPayload && ev.qrPayload.startsWith('plc://community/'));
    assert.ok(ev.whatItProves && ev.whatItProves.length > 5);
  }

  // اختبار شاهد غير مرتبط بأي سجل: لا يُولَّد له QR غير صالح
  let commWithUnlinkedEv = createNewPlcCommunityRecord({
    name: 'مجتمع اختبار الشاهد غير المرتبط',
    specialty: 'الحاسب الآلي',
  });
  const unlinkedEvRes = addPlcEvidenceToRepository(commWithUnlinkedEv, {
    title: 'ملف مسودة عامة غير مرتبطة بأي سجل',
    evidenceType: 'pdf',
    fileName: 'draft.pdf',
    mimeType: 'application/pdf',
    fileDataUrl: 'data:application/pdf;base64,DRAFT1',
    initialLinks: [],
  });
  commWithUnlinkedEv = unlinkedEvRes.community;
  const unlinkedReport = buildPlcFinalReport(commWithUnlinkedEv);
  assert.equal(unlinkedReport.section9_9.rows.length, 1);
  assert.equal(
    unlinkedReport.section9_9.rows[0].hasValidQr,
    false,
    'الشاهد غير المرتبط بأي سجل تنفيذي لا يظهر له رمز QR مضلل'
  );
});

test('إعادة تصميم التقرير الختامي - ٥: اختبار الأسماء العربية الطويلة جداً (اسم المجتمع، اسم القائد، نصوص الجداول) وبقاء الملاحظات اليدوية بعد إعادة التوليد', () => {
  let longNameComm = createNewPlcCommunityRecord({
    name: 'مجتمع التعلّم المهني التخصصي لتطوير استراتيجيات التقويم التكويني ومعالجة الفاقد التعليمي في مهارات الفهم القرائي والكتابة الإبداعية بالمرحلة المتوسطة',
    specialty: 'اللغة العربية والدراسات الأدبية واللغوية المتقدمة للمرحلة المتوسطة',
    academicYear: '1447هـ',
    leader: {
      name: 'أ. عبدالإله بن عبدالرحمن بن عبدالعزيز آل عبداللطيف التميمي',
      specialty: 'اللغة العربية',
    },
  });

  longNameComm = updatePlcFinalReportNotes(longNameComm, {
    customExecutiveNotes:
      'ملخص تنفيذي يدوي محفوظ للتأكد من عدم ضياعه عند إعادة التوليد مع النصوص العربية الطويلة.',
    customClosingNotes:
      'توصية ختامية يدوية محفوظة للفصل الدراسي القادم.',
  });

  const regen = regeneratePlcFinalReport(longNameComm);
  assert.equal(
    regen.report.section9_12.customExecutiveNotes,
    'ملخص تنفيذي يدوي محفوظ للتأكد من عدم ضياعه عند إعادة التوليد مع النصوص العربية الطويلة.'
  );
  assert.equal(
    regen.report.section9_12.customClosingNotes,
    'توصية ختامية يدوية محفوظة للفصل الدراسي القادم.'
  );

  const artifact = generatePlcFinalReportPdfArtifact(
    regen.community,
    DEFAULT_SCHOOL_SETTINGS,
    regen.report
  );
  assert.ok(artifact.pdfBytes.byteLength > 1000);
  assert.ok(artifact.pageCount >= 3 && artifact.pageCount <= 6);
});

test('إعادة تصميم التقرير النهائي - ٦: نظام التصميم الموحد (PLC_REPORT_DESIGN_SYSTEM)، أرقام الفصول (01..05)، المسار البصري، الفوتر برقم الصفحة فقط، والتوقيع والختم بدون كلمة اعتماد', () => {
  // ١. التحقق من لوحة الألوان المعتمدة في نظام التصميم الموحد
  assert.equal(PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen, '#153C43');
  assert.equal(PLC_REPORT_DESIGN_SYSTEM.colors.deepTurquoise, '#145B59');
  assert.equal(PLC_REPORT_DESIGN_SYSTEM.colors.mutedGold, '#C5A15D');
  assert.equal(PLC_REPORT_DESIGN_SYSTEM.colors.ivory, '#F2EFE7');
  assert.equal(PLC_REPORT_DESIGN_SYSTEM.colors.white, '#FFFFFF');

  const demo = getPlcDemoPreviewCommunity();
  const demoSettings = getPlcDemoPreviewSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
  const report = buildPlcFinalReport(demo);
  const pagesModel = buildPlcFinalReportPdfPagesModel(report, demoSettings, null);

  // ٢. التحقق من أن الغلاف بدون رقم صفحة، وأن الصفحات الداخلية (2..6) تحتوي في الفوتر على رقم الصفحة فقط ("2"، "3"... وليس "2 من 6")
  assert.equal(pagesModel.pages[0].isCoverPage, true);
  assert.equal(pagesModel.pages[0].footerLabel, '');
  for (let i = 1; i < pagesModel.pages.length; i++) {
    assert.equal(pagesModel.pages[i].footerLabel, `${i + 1}`);
    assert.equal(pagesModel.pages[i].footerLabel.includes('من'), false);
    assert.equal(pagesModel.pages[i].footerLabel.includes('of'), false);
  }

  // ٣. التحقق من أرقام الأقسام (01 إلى 05) في الصفحات الداخلية الخمس
  const sectionHeaders = pagesModel.pages
    .slice(1)
    .map((p) => p.blocks.find((b) => b.kind === 'section_header'))
    .filter((b): b is Extract<typeof b, { kind: 'section_header' }> => Boolean(b));
  assert.deepEqual(
    sectionHeaders.map((sh) => sh.sectionNumber),
    ['01', '02', '03', '04', '05']
  );

  // ٤. التحقق من وجود المسار البصري (الاحتياج → الهدف → الإجراء → النتيجة) في صفحة الملخص التنفيذي (الصفحة 2)
  const page2 = pagesModel.pages[1];
  const traceBlock = page2.blocks.find((b) => b.kind === 'traceability_chain');
  assert.ok(traceBlock && traceBlock.kind === 'traceability_chain');
  if (traceBlock && traceBlock.kind === 'traceability_chain') {
    assert.deepEqual(
      traceBlock.stages.map((s) => s.stageTitle),
      ['الاحتياج', 'الهدف', 'الإجراء', 'النتيجة']
    );
  }

  // ٥. التحقق من كتلة التوقيع والختم في أسفل الصفحة الأخيرة: خلو العنوان من كلمة "اعتماد" ووجود خانة الختم في الوسط
  const lastPage = pagesModel.pages[pagesModel.pages.length - 1];
  const signoff = lastPage.blocks.find((b) => b.kind === 'official_signoff_block');
  assert.ok(signoff && signoff.kind === 'official_signoff_block');
  if (signoff && signoff.kind === 'official_signoff_block') {
    assert.equal(
      signoff.signoffHeading.includes('اعتماد'),
      false,
      'لا يجوز استخدام كلمة اعتماد في عنوان التوقيع والختم'
    );
    assert.equal(
      signoff.stampLabel,
      'الختم',
      'في الوسط تظهر كلمة الختم فقط دون مكان الختم الرسمي للمدرسة'
    );
  }
});

test('إغلاق وحدة PLC - ٧: التحسينات التفصيلية للتقرير النهائي المختصر (٢.١ إلى ٢.٨: خلو التقرير من لفظ التنفيذي/التنفيذية، البطاقات المستقلة للفريق، الترقيم ١. ٢. ٣.، جدول التوصيات بدون استحقاق، الروابط التفاعلية /Subtype /Link، والتوقيع المحدّث)', () => {
  const demo = getPlcDemoPreviewCommunity();
  const demoSettings = getPlcDemoPreviewSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
  const report = buildPlcFinalReport(demo);
  const pagesModel = buildPlcFinalReportPdfPagesModel(report, demoSettings, null);
  const joinedTokens = pagesModel.allTextTokens.join(' | ');

  // ٢.٣ خلو التقرير المختصر من كلمتي «التنفيذي» و«التنفيذية»
  assert.equal(
    joinedTokens.includes('التنفيذي'),
    false,
    'يجب حذف كلمة التنفيذي من جميع مواضع التقرير المختصر'
  );
  assert.equal(
    joinedTokens.includes('التنفيذية'),
    false,
    'يجب حذف كلمة التنفيذية من جميع مواضع التقرير المختصر'
  );

  // ٢.٣ الصفحة الثانية: الخلاصة نقاط مختصرة بمحاذاة لليمين + فقرة تحليلية أسفل الرسمين البيانيين
  const page2 = pagesModel.pages[1];
  const page2SummaryBox = page2.blocks.find((b) => b.kind === 'paragraphs_box');
  assert.ok(page2SummaryBox && page2SummaryBox.kind === 'paragraphs_box');
  if (page2SummaryBox && page2SummaryBox.kind === 'paragraphs_box') {
    assert.equal(
      page2SummaryBox.centerAligned,
      false,
      'الخلاصة في الصفحة الثانية يجب أن تكون بمحاذاة لليمين'
    );
    assert.ok(
      page2SummaryBox.lines.some((p) => p.startsWith('•')),
      'الأفكار في الخلاصة تبدأ بنقاط واضحة'
    );
  }
  assert.ok(
    joinedTokens.includes('قراءة تحليلية للرسمين البيانيين'),
    'يجب وجود فقرة تحليلية أسفل الرسمين البيانيين في الصفحة الثانية'
  );

  // ٢.٤ الصفحة الثالثة: استبدال «تلخيص تنفيذي» بـ «أبرز الأعمال والنتائج» + ترقيم حصيلة الاجتماعات (١. ٢. ٣.) + بطاقات مستقلة لأعضاء الفريق
  const page3 = pagesModel.pages[2];
  assert.ok(joinedTokens.includes('أبرز الأعمال والنتائج'));
  const teamGrid = page3.blocks.find((b) => b.kind === 'team_members_cards');
  assert.ok(
    teamGrid && teamGrid.kind === 'team_members_cards',
    'أسماء أعضاء الفريق يجب أن تُعرض في بطاقات مستقلة'
  );
  if (teamGrid && teamGrid.kind === 'team_members_cards') {
    assert.equal(teamGrid.members.length, demo.members.length);
  }
  assert.ok(joinedTokens.includes('١.'));
  assert.ok(joinedTokens.includes('٢.'));
  assert.ok(joinedTokens.includes('٣.'));

  // ٢.٥ الصفحة الرابعة: القراءة التحليلية للمؤشرات بمحاذاة لليمين + قراءة تحليلية أسفل الرسم البياني للمؤشرات
  const page4 = pagesModel.pages[3];
  const page4Boxes = page4.blocks.filter(
    (b): b is Extract<typeof b, { kind: 'paragraphs_box' }> =>
      b.kind === 'paragraphs_box'
  );
  assert.ok(page4Boxes.length >= 1);
  for (const hb of page4Boxes) {
    assert.equal(hb.centerAligned, false, 'قراءة المؤشرات بمحاذاة لليمين');
  }
  assert.ok(
    joinedTokens.includes('قراءة تحليلية للرسم البياني ومؤشرات الأداء'),
    'يجب وجود قراءة تحليلية قصيرة أسفل الرسم البياني للمؤشرات'
  );

  // ٢.٦ الصفحة الخامسة: توضيح «6 شواهد مسجلة، 4 شواهد مختارة للعرض» + تطابق رابط QR مع الرابط النصي المجاور
  assert.ok(
    joinedTokens.includes('6 شواهد مسجلة، 4 شواهد مختارة للعرض'),
    'يجب النص صراحة على عدد الشواهد المسجلة والمختارة'
  );
  const page5 = pagesModel.pages[4];
  const evGrid = page5.blocks.find((b) => b.kind === 'selected_evidences_qr_grid');
  assert.ok(evGrid && evGrid.kind === 'selected_evidences_qr_grid');
  if (evGrid && evGrid.kind === 'selected_evidences_qr_grid') {
    assert.equal(evGrid.cards.length, 4);
    for (const item of evGrid.cards) {
      assert.ok((item.destinationUri || item.qrPayload || '').length > 5);
      assert.equal(item.linkLabel, 'فتح الشاهد / عرض الرابط');
      assert.equal(resolveEvidenceActionUri(item), item.destinationUri);
    }
  }

  // ٢.٧ الصفحة السادسة: جدول التوصيات الإجرائية من 3 أعمدة فقط بدون «الاستحقاق» أو تواريخ + الملاحظات بعناوين فرعية ملونة
  const page6 = pagesModel.pages[5];
  const tablesPage6 = page6.blocks.filter(
    (b): b is Extract<typeof b, { kind: 'table' }> => b.kind === 'table'
  );
  const recsTable = tablesPage6[1];
  assert.ok(recsTable);
  assert.deepEqual(recsTable.headers, [
    'م',
    'التوصية الإجرائية / الأولوية القادمة',
    'الجهة المسؤولة / القرار',
  ]);
  for (const row of recsTable.wrappedRows) {
    assert.equal(row.length, 3);
    for (const cellLines of row) {
      const joinedCell = cellLines.join(' ');
      assert.equal(
        /\d{4}[-/]\d{2}[-/]\d{2}/.test(joinedCell),
        false,
        'يجب خلو جدول التوصيات الإجرائية من أي تواريخ استحقاق'
      );
    }
  }

  const notesBlock = page6.blocks.find(
    (b): b is Extract<typeof b, { kind: 'paragraphs_box' }> =>
      b.kind === 'paragraphs_box' && Boolean(b.highlightedNotes?.length)
  );
  assert.ok(notesBlock && notesBlock.highlightedNotes);
  if (notesBlock && notesBlock.highlightedNotes) {
    assert.deepEqual(
      notesBlock.highlightedNotes.map((n) => n.prefix),
      ['خلاصة', 'التشخيص الدقيق للاحتياجات', 'الأولويات القادمة']
    );
  }

  // ٢.١ التحقق من تضمين تعليقات الروابط التفاعلية (/Subtype /Link و /URI) داخل ملف PDF المولد
  const artifact = generatePlcFinalReportPdfArtifact(demo, demoSettings, report);
  const pdfAscii = new TextDecoder('latin1').decode(artifact.pdfBytes);
  assert.ok(
    pdfAscii.includes('/Subtype /Link'),
    'ملف PDF المختصر يجب أن يتضمن تعليقات روابط تفاعلية قابلة للضغط (/Subtype /Link)'
  );
  assert.ok(
    pdfAscii.includes('/S /URI'),
    'ملف PDF المختصر يجب أن يتضمن إجراءات فتح الرابط (/S /URI)'
  );
});

test('إغلاق وحدة PLC - ٨: التقرير التفصيلي المستقل للمجتمع (شامل النماذج التسعة، فهرس المحتويات المستقل بأرقام الصفحات الدقيقة، ومستودع الشواهد الكامل بجميع الشواهد الـ ٦ دون تكرار)', () => {
  const demo = getPlcDemoPreviewCommunity();
  const demoSettings = getPlcDemoPreviewSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
  const report = buildPlcFinalReport(demo);

  const detailedModel = buildPlcDetailedReportPdfPagesModel(
    demo,
    demoSettings,
    report
  );
  const detailedTokens = detailedModel.allTextTokens.join(' | ');

  // ١. التحقق من وجود الغلاف المستقل (صفحة ١) وفهرس المحتويات في صفحة مستقلة (صفحة ٢) والملخص الإحصائي في صفحة مستقلة (صفحة ٣)
  assert.equal(detailedModel.pages[0].isCoverPage, true);
  assert.equal(detailedModel.pages[0].pageGroup, 0);

  assert.equal(detailedModel.pages[1].pageGroup, 1);
  assert.ok(detailedModel.pages[1].pageTitle.includes('فهرس المحتويات'));
  assert.equal(
    detailedModel.pages[1].blocks.length,
    1,
    'صفحة الفهرس يجب أن تكون مستقلة تمامًا ولا يدمج معها الملخص الإحصائي أو القسم الأول'
  );

  assert.equal(detailedModel.pages[2].pageGroup, 2);
  assert.ok(detailedModel.pages[2].pageTitle.includes('الملخص الإحصائي'));
  assert.equal(detailedModel.statisticalSummaryPageNumber, 3);

  const tocBlock = detailedModel.pages[1].blocks[0];
  assert.ok(tocBlock && tocBlock.kind === 'toc_block');
  if (tocBlock && tocBlock.kind === 'toc_block') {
    assert.equal(
      tocBlock.entries.length,
      7,
      'فهرس المحتويات يغطي الأقسام الرئيسية السبعة (01 - 07) الشاملة للنماذج التسعة الكاملة للمجتمع المهني'
    );
    for (const entry of tocBlock.entries) {
      assert.ok(
        entry.startPageNumber >= 4 && entry.startPageNumber <= detailedModel.pages.length,
        `رقم صفحة بداية القسم (${entry.chapterNumber}) يجب أن يكون دقيقاً وصحيحاً (>= 4)`
      );
      assert.notEqual(
        entry.chapterNumber,
        '00',
        'يُمنع استخدام الرقم 00 لأي قسم في التقرير التفصيلي'
      );
      const actualPage = detailedModel.pages.find((p) =>
        p.blocks.some(
          (b) =>
            b.kind === 'core_block' &&
            b.block.kind === 'section_header' &&
            b.block.sectionNumber === entry.chapterNumber
        )
      );
      assert.ok(actualPage, `يجب وجود عنوان القسم ${entry.chapterNumber} فعلياً في صفحات التقرير`);
      if (actualPage) {
        assert.equal(
          entry.startPageNumber,
          actualPage.pageNumber,
          `رقم الصفحة في الفهرس للقسم ${entry.chapterNumber} يجب أن يطابق الصفحة الفعلية (${actualPage.pageNumber})`
        );
      }
    }
  }

  // التحقق من عدم وجود أي ترقيم "00" في أي عنوان صفحة أو رأس قسم
  for (const p of detailedModel.pages) {
    assert.equal(
      p.pageTitle.includes('00'),
      false,
      `عنوان الصفحة (${p.pageTitle}) يجب ألا يحتوي على الترقيم 00`
    );
    for (const b of p.blocks) {
      if (b.kind === 'core_block' && b.block.kind === 'section_header') {
        assert.notEqual(b.block.sectionNumber, '00');
      }
    }
  }

  // ٢. التحقق من شمول الفصول ومستودع الشواهد الكامل (جميع الشواهد الـ 6 المسجلة دون حذف)
  assert.ok(detailedTokens.includes('التقرير التفصيلي لمجتمع التعلّم المهني'));
  assert.ok(detailedTokens.includes('فهرس المحتويات'));

  const evidenceCards = detailedModel.pages.flatMap((p) =>
    p.blocks.filter(
      (b): b is Extract<typeof b, { kind: 'detailed_evidence_repository_row' }> =>
        b.kind === 'detailed_evidence_repository_row'
    )
  );
  assert.equal(
    evidenceCards.length,
    demo.evidenceRepository.length,
    'مستودع الشواهد الكامل في التقرير التفصيلي يجب أن يعرض جميع الشواهد المسجلة (6 شواهد) دون اقتصار على 4'
  );

  // ٣. التحقق من توليد ملف PDF للتقرير التفصيلي واحتوائه على روابط تفاعلية (/Subtype /Link)
  const detailedArtifact = generatePlcDetailedReportPdfArtifact(
    demo,
    demoSettings,
    report
  );
  assert.ok(detailedArtifact.pdfBytes.byteLength > 1500);
  assert.ok(
    detailedArtifact.pageCount >= 10,
    `التقرير التفصيلي المهيكل بأقسام مستقلة وتحليلات بصرية يتكون من (${detailedArtifact.pageCount}) صفحة A4 غير مضغوطة`
  );
  assert.ok(detailedArtifact.filename.includes('التقرير_التفصيلي'));

  const detailedPdfAscii = new TextDecoder('latin1').decode(
    detailedArtifact.pdfBytes
  );
  assert.ok(detailedPdfAscii.includes('%PDF-1.4'));
  assert.ok(
    detailedPdfAscii.includes('/Subtype /Link'),
    'ملف PDF التفصيلي يجب أن يتضمن روابط قابلة للضغط لرموز QR والروابط النصية المجاورة'
  );
});

test('تحسين الغلاف والصفحة الثانية - ٩: إعادة ترتيب الغلاف من أعلى الصفحة واستثمار المساحة السفلية للصفحة الثانية بالمؤشرات الدائرية والتوزيع البصري ضمن ٦ صفحات', () => {
  const demo = getPlcDemoPreviewCommunity();
  const demoSettings = getPlcDemoPreviewSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
  const report = buildPlcFinalReport(demo);

  const model = buildPlcFinalReportPdfPagesModel(report, demoSettings, null);
  assert.equal(model.pages.length, 6, 'التقرير النهائي المختصر يحافظ على هيكله المكون من ٦ صفحات A4');

  // التحقق من الصفحة الأولى (الغلاف)
  const coverPage = model.pages[0];
  assert.equal(coverPage.isCoverPage, true);
  const coverBlock = coverPage.blocks[0];
  assert.equal(coverBlock.kind, 'cover_page');
  if (coverBlock.kind === 'cover_page') {
    assert.equal(coverBlock.leaderName, report.section9_1.leaderNameDisplay);
    assert.equal(coverBlock.principalName, demoSettings.principalName);
  }

  // التحقق من الصفحة الثانية (pageIndex === 1) واحتوائها على كتلة المؤشرات البصرية الإضافية (page2_visual_analytics)
  const page2 = model.pages[1];
  const visualAnalyticsBlock = page2.blocks.find(
    (b): b is Extract<typeof b, { kind: 'page2_visual_analytics' }> =>
      b.kind === 'page2_visual_analytics'
  );
  assert.ok(
    visualAnalyticsBlock,
    'الصفحة الثانية يجب أن تتضمن كتلة التحليلات البصرية الدائرية والفئوية (page2_visual_analytics)'
  );
  if (visualAnalyticsBlock) {
    assert.equal(visualAnalyticsBlock.donuts.length, 3, 'ثلاثة مؤشرات دائرية (Donut) للإنجاز والتحقق');
    assert.equal(visualAnalyticsBlock.categoryDistributions.length, 4, 'توزيع بصري للأعمال والأنشطة بحسب التصنيفات الأربعة');
    assert.ok(visualAnalyticsBlock.targetVsActualItems.length > 0, 'مقارنة المستهدف بالمتحقق من مؤشرات الأداء الفعلية');
  }
});

test('إعادة ضبط تصميم التقرير التفصيلي وإضافة التحليل البصري - ١٠: استقلال الفهرس والملخص الإحصائي، بدء كل قسم رئيسي في صفحة جديدة، والرسوم البيانية والتحليلات البصرية في جميع الأقسام', () => {
  const demo = getPlcDemoPreviewCommunity();
  const demoSettings = getPlcDemoPreviewSchoolSettings(DEFAULT_SCHOOL_SETTINGS);
  const report = buildPlcFinalReport(demo);

  const detailedModel = buildPlcDetailedReportPdfPagesModel(
    demo,
    demoSettings,
    report
  );

  // ١. الغلاف صفحة مستقلة (صفحة ١)، الفهرس صفحة مستقلة (صفحة ٢)، الملخص الإحصائي صفحة مستقلة (صفحة ٣)
  assert.equal(detailedModel.pages[0].pageNumber, 1);
  assert.equal(detailedModel.pages[0].isCoverPage, true);

  assert.equal(detailedModel.pages[1].pageNumber, 2);
  assert.equal(detailedModel.pages[1].pageGroup, 1);
  assert.equal(
    detailedModel.pages[1].blocks.every((b) => b.kind === 'toc_block'),
    true,
    'صفحة الفهرس مستقلة ولا تحتوي على الملخص الإحصائي أو بداية القسم الأول'
  );

  assert.equal(detailedModel.pages[2].pageNumber, 3);
  assert.equal(detailedModel.pages[2].pageGroup, 2);
  const statBlock = detailedModel.pages[2].blocks.find(
    (b): b is Extract<typeof b, { kind: 'statistical_summary_header_and_cards' }> =>
      b.kind === 'statistical_summary_header_and_cards'
  );
  assert.ok(statBlock, 'الصفحة الثالثة تتضمن بطاقات الملخص الإحصائي المستقل');
  if (statBlock) {
    assert.equal(statBlock.cards.length, 8, 'الملخص الإحصائي يعرض 8 بطاقات مؤشرات رقمية رئيسية');
  }

  // ٢. قاعدة الصفحات للأقسام الرئيسية: كل قسم رئيسي (01 .. 07) يبدأ في صفحة جديدة مستقلة
  const sectionStartPages: number[] = [];
  for (const entry of detailedModel.tocEntries) {
    const hostPage = detailedModel.pages.find((p) =>
      p.blocks.some(
        (b) =>
          b.kind === 'core_block' &&
          b.block.kind === 'section_header' &&
          b.block.sectionNumber === entry.chapterNumber
      )
    );
    assert.ok(hostPage, `القسم الرئيسي ${entry.chapterNumber} يجب أن يبدأ في صفحة فعلية`);
    if (hostPage) {
      assert.equal(
        hostPage.blocks[0].kind === 'core_block' &&
          hostPage.blocks[0].block.kind === 'section_header' &&
          hostPage.blocks[0].block.sectionNumber === entry.chapterNumber,
        true,
        `القسم الرئيسي (${entry.chapterNumber}) يجب أن يبدأ في أعلى صفحة جديدة مستقلة (${hostPage.pageNumber})`
      );
      assert.equal(
        entry.startPageNumber,
        hostPage.pageNumber,
        `تطابق رقم صفحة القسم ${entry.chapterNumber} في الفهرس مع الصفحة الفعلية`
      );
      assert.equal(
        sectionStartPages.includes(hostPage.pageNumber),
        false,
        `لا يشترك قسمان رئيسيان في نفس صفحة البداية (${hostPage.pageNumber})`
      );
      sectionStartPages.push(hostPage.pageNumber);
    }
  }

  // التحقق من عدم اختلاط مجموعات الأقسام داخل الصفحة الواحدة
  for (const p of detailedModel.pages) {
    for (const blk of p.blocks) {
      assert.equal(
        blk.pageGroup,
        p.pageGroup,
        `جميع عناصر الصفحة (${p.pageNumber}) تنتمي لنفس القسم الرئيسي (${p.pageGroup}) دون دمج أقسام مختلفة في صفحة واحدة`
      );
    }
  }

  // ٣. التحقق من وجود الرسوم البيانية والتحليلات البصرية في جميع الأقسام السبعة (01 .. 07)
  const allVisualCharts = detailedModel.pages.flatMap((p) =>
    p.blocks
      .filter((b): b is Extract<typeof b, { kind: 'visual_chart_block' }> => b.kind === 'visual_chart_block')
      .map((b) => b.chart.kind)
  );
  assert.deepEqual(
    allVisualCharts,
    [
      'section01_org_structure',
      'section01_identity_architecture',
      'section02_needs_plan_analytics',
      'section03_meetings_analytics',
      'section04_activities_analytics',
      'section05_kpi_impact_analytics',
      'section06_evidence_analytics',
      'section07_closing_analytics',
    ],
    'تضمين جميع الرسوم البيانية والمخططات التحليلية الثمانية عبر الأقسام السبعة'
  );

  // ٤. التحقق من عدم ظهور الترقيم "00" في أي موضع
  assert.deepEqual(
    detailedModel.tocEntries.map((e) => e.chapterNumber),
    ['01', '02', '03', '04', '05', '06', '07']
  );

  // ٥. التحقق من الحفاظ على جميع السجلات في النماذج التسعة والشواهد الـ 6 دون فقد أو حذف
  const allTokens = detailedModel.allTextTokens.join(' | ');
  for (const member of report.section9_1.members) {
    assert.ok(allTokens.includes(member.name), `حفظ سجل العضو: ${member.name}`);
  }
  for (const need of report.section9_3.rows) {
    assert.ok(allTokens.includes(need.needDescription), `حفظ سجل الاحتياج: ${need.needDescription}`);
  }
  for (const action of report.section9_4.rows) {
    assert.ok(allTokens.includes(action.actionTitle), `حفظ إجراء الخطة: ${action.actionTitle}`);
  }
  for (const meeting of report.section9_5.meetingsList) {
    assert.ok(
      allTokens.includes(meeting.discussionSummaryDisplay),
      `حفظ محضر الاجتماع (${meeting.meetingNumber})`
    );
  }
  for (const act of report.section9_6.rows) {
    assert.ok(allTokens.includes(act.title), `حفظ النشاط/الزيارة/الشراكة: ${act.title}`);
  }
  for (const kpi of report.section9_7.kpiRows) {
    assert.ok(allTokens.includes(kpi.indicatorName), `حفظ مؤشر الأداء: ${kpi.indicatorName}`);
  }
  for (const imp of report.section9_8.rows) {
    assert.ok(
      allTokens.includes(imp.impactDescriptionDisplay),
      `حفظ سجل قياس الأثر: ${imp.impactDescriptionDisplay}`
    );
  }
  for (const ev of report.section9_9.rows) {
    assert.ok(allTokens.includes(ev.title), `حفظ الشاهد في المستودع: ${ev.title}`);
  }

  // ٦. التحقق من عمل رموز QR والروابط النصية القابلة للنقر في التقرير التفصيلي
  const totalQrSpots = detailedModel.pages.reduce(
    (sum, p) => sum + p.plannedQrSpots.length,
    0
  );
  assert.equal(
    totalQrSpots,
    demo.meetings.length + demo.activities.length + demo.evidenceRepository.length,
    'جميع رموز QR والروابط التفاعلية للاجتماعات والأنشطة ومستودع الشواهد محفوظة وتعمل بالكامل'
  );
});

test('تحديث الهوية اللونية - ١١: اعتماد اللون التركوازي (#0F766E) لقسم مجتمعات التعلّم المهنية مع ثبات ألوان الأقسام الأخرى وهوية تقارير PDF', () => {
  // ١. التحقق من الرمز اللوني المركزي لقسم مجتمعات التعلّم المهنية (#0F766E)
  assert.equal(PLC_SECTION_THEME.id, 'plc');
  assert.equal(PLC_SECTION_THEME.primaryHex, '#0F766E');
  assert.equal(PLC_SECTION_THEME.hoverHex, '#115E59');
  assert.equal(PLC_SECTION_THEME.softBgHex, '#F0FDFA');
  assert.equal(PLC_SECTION_THEME.borderHex, '#99F6E4');

  // ٢. التحقق من عدم تغيير ألوان الأقسام الثلاثة الأخرى
  assert.equal(SECTIONS['professional-development'].primaryHex, '#7C1D34');
  assert.equal(SECTIONS['gifted'].primaryHex, '#7F1D3F');
  assert.equal(SECTIONS['teacher'].primaryHex, '#1E4D8C');

  // ٣. التحقق من استخدام اللون التركوازي في المعاينة النموذجية ورموز QR داخل الواجهة
  const demo = getPlcDemoPreviewCommunity();
  const qrDataUrl = generatePlcRecordQrSvgDataUrl(demo.id, 'meeting', demo.meetings[0].id);
  assert.ok(
    decodeURIComponent(qrDataUrl).includes('#0F766E'),
    'رمز QR في الواجهة يستخدم اللون التركوازي المعتمد #0F766E'
  );
  assert.ok(
    decodeURIComponent(demo.evidenceRepository[0].fileDataUrl || '').includes('#0F766E'),
    'معاينة الشواهد النموذجية تستخدم اللون التركوازي المعتمد #0F766E'
  );

  // ٤. التحقق من الحفاظ على الهوية البترولية والذهبية المعتمدة داخل تقارير PDF
  assert.equal(PLC_REPORT_DESIGN_SYSTEM.colors.petrolGreen, '#153C43');
  assert.equal(PLC_REPORT_DESIGN_SYSTEM.colors.deepTurquoise, '#145B59');
  assert.equal(PLC_REPORT_DESIGN_SYSTEM.colors.mutedGold, '#C5A15D');
});
