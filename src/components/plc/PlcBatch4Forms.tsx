import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderArchive,
  Image as ImageIcon,
  Link2,
  ListChecks,
  Paperclip,
  Plus,
  QrCode,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Unlink,
  Upload,
  X,
} from 'lucide-react';
import {
  addPlcEvidenceToRepository,
  addPlcExecutionEvaluationItem,
  addPlcImpactMeasurement,
  addPlcKpiIndicator,
  buildPlcRecordQrPayload,
  computePlcExecutionEvaluationSummary,
  deletePlcEvidenceFromRepository,
  deletePlcExecutionEvaluationItem,
  deletePlcImpactMeasurement,
  deletePlcKpiIndicator,
  filterAndSortPlcEvidenceRepository,
  generatePlcRecordQrSvgDataUrl,
  inferPlcEvidenceTypeFromMimeOrUrl,
  linkPlcEvidenceToTarget,
  PLC_ACTIVITY_TYPE_LABELS,
  PLC_EVIDENCE_TARGET_TYPE_LABELS,
  PLC_EVIDENCE_TYPE_LABELS,
  PLC_FORMS_CATALOG,
  PLC_IMPACT_METHOD_LABELS,
  PLC_IMPROVEMENT_DECISION_LABELS,
  PLC_KPI_DIRECTION_LABELS,
  PLC_KPI_UNIT_OPTIONS,
  PlcCommunityRecord,
  PlcEvidenceItem,
  PlcEvidenceLinkRef,
  PlcEvidenceLinkTargetType,
  PlcEvidenceType,
  PlcExecutionEvaluationItem,
  PlcFormNumber,
  PlcImpactMeasurementItem,
  PlcImpactMeasurementMethod,
  PlcImprovementDecisionType,
  PlcKpiDirectionType,
  PlcKpiIndicatorItem,
  resolvePlcEvidenceLinks,
  resolvePlcExecutionEvaluationLinks,
  resolvePlcImpactMeasurementLinks,
  resolvePlcKpiIndicatorLinks,
  syncCommunityImpactEvidenceLinks,
  unlinkPlcEvidenceFromTarget,
  updatePlcEvidenceInRepository,
  updatePlcExecutionEvaluationItem,
  updatePlcImpactMeasurement,
  updatePlcKpiIndicator,
  validatePlcEvidenceRepositoryInput,
  validatePlcImpactMeasurementInput,
  validatePlcKpiIndicatorInput,
} from '../../utils/plcEngine';

interface PlcBatch4FormsProps {
  community: PlcCommunityRecord;
  activeFormNumber: 7 | 8;
  onSelectFormNumber: (formNumber: PlcFormNumber) => void;
  onUpdateCommunity: (
    updater: (current: PlcCommunityRecord) => PlcCommunityRecord
  ) => void;
  onShowBanner: (message: string) => void;
  readOnly?: boolean;
}

export const PlcBatch4Forms: React.FC<PlcBatch4FormsProps> = ({
  community,
  activeFormNumber,
  onSelectFormNumber,
  onUpdateCommunity,
  onShowBanner,
  readOnly = false,
}) => {
  // ==========================================================================
  // ١. حالات القسم 7.1: تقويم التنفيذ (ملاحظات تقويمية مرتبطة بالـID)
  // ==========================================================================
  const [editingExecEvalId, setEditingExecEvalId] = useState<string | null>(
    null
  );
  const [execEvalTargetId, setExecEvalTargetId] = useState('');
  const [execEvalLevel, setExecEvalLevel] = useState('منفذ وفق الخطة');
  const [execEvalStrengths, setExecEvalStrengths] = useState('');
  const [execEvalImprovements, setExecEvalImprovements] = useState('');
  const [execEvalNotes, setExecEvalNotes] = useState('');
  const [confirmDeleteExecEvalId, setConfirmDeleteExecEvalId] = useState<
    string | null
  >(null);

  // ==========================================================================
  // ٢. حالات القسم 7.2: مؤشرات الأداء (KPIs)
  // ==========================================================================
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [kpiName, setKpiName] = useState('');
  const [kpiDescription, setKpiDescription] = useState('');
  const [kpiGoalId, setKpiGoalId] = useState('');
  const [kpiNeedId, setKpiNeedId] = useState('');
  const [kpiActionId, setKpiActionId] = useState('');
  const [kpiActivityId, setKpiActivityId] = useState('');
  const [kpiBaseline, setKpiBaseline] = useState('');
  const [kpiTarget, setKpiTarget] = useState('');
  const [kpiActual, setKpiActual] = useState('');
  const [kpiUnit, setKpiUnit] = useState('عدد');
  const [kpiCustomUnit, setKpiCustomUnit] = useState('');
  const [kpiDirection, setKpiDirection] =
    useState<PlcKpiDirectionType>('higher_is_better');
  const [kpiDataSource, setKpiDataSource] = useState('');
  const [kpiPeriod, setKpiPeriod] = useState('');
  const [kpiPeriodStart, setKpiPeriodStart] = useState('');
  const [kpiPeriodEnd, setKpiPeriodEnd] = useState('');
  const [kpiMeasurementDate, setKpiMeasurementDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [kpiCalculationMethod, setKpiCalculationMethod] = useState('');
  const [kpiNotes, setKpiNotes] = useState('');
  const [kpiValidationError, setKpiValidationError] = useState<string | null>(
    null
  );
  const [confirmDeleteKpiId, setConfirmDeleteKpiId] = useState<string | null>(
    null
  );

  // ==========================================================================
  // ٣. حالات القسم 7.3: قياس الأثر
  // ==========================================================================
  const [editingImpactId, setEditingImpactId] = useState<string | null>(null);
  const [impactGoalId, setImpactGoalId] = useState('');
  const [impactNeedId, setImpactNeedId] = useState('');
  const [impactActionId, setImpactActionId] = useState('');
  const [impactActivityId, setImpactActivityId] = useState('');
  const [impactBeneficiary, setImpactBeneficiary] = useState('');
  const [impactMethod, setImpactMethod] = useState<string>(
    'pre_post_comparison'
  );
  const [impactCustomMethod, setImpactCustomMethod] = useState('');
  const [impactBaselineDate, setImpactBaselineDate] = useState('');
  const [impactMeasurementDate, setImpactMeasurementDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [impactTool, setImpactTool] = useState('');
  const [impactBaselineVal, setImpactBaselineVal] = useState('');
  const [impactTargetVal, setImpactTargetVal] = useState('');
  const [impactActualVal, setImpactActualVal] = useState('');
  const [impactUnit, setImpactUnit] = useState('نسبة مئوية');
  const [impactCustomUnit, setImpactCustomUnit] = useState('');
  const [impactResultsText, setImpactResultsText] = useState('');
  const [impactObservedDescription, setImpactObservedDescription] =
    useState('');
  const [impactSelectedEvidenceIds, setImpactSelectedEvidenceIds] = useState<
    string[]
  >([]);
  const [impactDecision, setImpactDecision] = useState<string>('continue');
  const [impactCustomDecision, setImpactCustomDecision] = useState('');
  const [impactOpportunities, setImpactOpportunities] = useState('');
  const [impactNotes, setImpactNotes] = useState('');
  const [impactValidationError, setImpactValidationError] = useState<
    string | null
  >(null);
  const [confirmDeleteImpactId, setConfirmDeleteImpactId] = useState<
    string | null
  >(null);

  // ==========================================================================
  // ٤. حالات النموذج 8: مستودع الشواهد والمرفقات الموحد
  // ==========================================================================
  const [editingEvidenceId, setEditingEvidenceId] = useState<string | null>(
    null
  );
  const [evdTitle, setEvdTitle] = useState('');
  const [evdType, setEvdType] = useState<PlcEvidenceType>('pdf');
  const [evdCustomType, setEvdCustomType] = useState('');
  const [evdDescription, setEvdDescription] = useState('');
  const [evdDate, setEvdDate] = useState(new Date().toISOString().slice(0, 10));
  const [evdSourceEntity, setEvdSourceEntity] = useState('');
  const [evdExternalUrl, setEvdExternalUrl] = useState('');
  const [evdNotes, setEvdNotes] = useState('');
  const [evdFileName, setEvdFileName] = useState('');
  const [evdMimeType, setEvdMimeType] = useState('');
  const [evdFileDataUrl, setEvdFileDataUrl] = useState('');
  const [evdValidationError, setEvdValidationError] = useState<string | null>(
    null
  );

  // ربط الشاهد عند إضافته أو عبر نافذة إدارة العلاقات
  const [newLinkTargetType, setNewLinkTargetType] =
    useState<PlcEvidenceLinkTargetType>('need');
  const [newLinkTargetId, setNewLinkTargetId] = useState('');
  const [pendingInitialLinks, setPendingInitialLinks] = useState<
    PlcEvidenceLinkRef[]
  >([]);

  // ربط شاهد موجود بسجل جديد من داخل المستودع
  const [activeLinkingEvidenceId, setActiveLinkingEvidenceId] = useState<
    string | null
  >(null);
  const [repoLinkTargetType, setRepoLinkTargetType] =
    useState<PlcEvidenceLinkTargetType>('need');
  const [repoLinkTargetId, setRepoLinkTargetId] = useState('');
  const [repoLinkError, setRepoLinkError] = useState<string | null>(null);

  // البحث والتصفية والترتيب في مستودع الشواهد
  const [repoSearchQuery, setRepoSearchQuery] = useState('');
  const [repoTypeFilter, setRepoTypeFilter] = useState<PlcEvidenceType | 'all'>(
    'all'
  );
  const [repoTargetFilter, setRepoTargetFilter] = useState<
    PlcEvidenceLinkTargetType | 'all' | 'unlinked'
  >('all');
  const [repoDateFilter, setRepoDateFilter] = useState('');
  const [repoSortBy, setRepoSortBy] = useState<'newest' | 'oldest'>('newest');

  // نافذة تأكيد حذف الشاهد المرتبط أو غير المرتبط
  const [pendingDeleteEvidence, setPendingDeleteEvidence] = useState<{
    evidence: PlcEvidenceItem;
    requiresForceConfirmation: boolean;
    linkedCount: number;
    warningMessage: string;
  } | null>(null);

  // نافذة معاينة المرفق أو رمز QR
  const [previewEvidenceModal, setPreviewEvidenceModal] =
    useState<PlcEvidenceItem | null>(null);
  const [qrModalEvidence, setQrModalEvidence] =
    useState<PlcEvidenceItem | null>(null);

  // ==========================================================================
  // حساب ملخص تقويم التنفيذ التلقائي (القسم 7.1)
  // ==========================================================================
  const derivedExecSummary = useMemo(
    () => computePlcExecutionEvaluationSummary(community),
    [community]
  );

  const filteredRepositoryEvidences = useMemo(
    () =>
      filterAndSortPlcEvidenceRepository(
        community.evidenceRepository,
        community,
        {
          searchQuery: repoSearchQuery,
          evidenceTypeFilter: repoTypeFilter,
          linkedTargetTypeFilter: repoTargetFilter,
          dateFilter: repoDateFilter,
          sortBy: repoSortBy,
        }
      ),
    [
      community,
      repoSearchQuery,
      repoTypeFilter,
      repoTargetFilter,
      repoDateFilter,
      repoSortBy,
    ]
  );

  // ==========================================================================
  // دوال مساعدة للقسم 7.1 (ملاحظات تقويم التنفيذ)
  // ==========================================================================
  const resetExecEvalForm = () => {
    setEditingExecEvalId(null);
    setExecEvalTargetId('');
    setExecEvalLevel('منفذ وفق الخطة');
    setExecEvalStrengths('');
    setExecEvalImprovements('');
    setExecEvalNotes('');
  };

  const handleSubmitExecEval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!execEvalTargetId.trim()) return;

    const isPlanAction = community.operationalPlan.some(
      (a) => a.id === execEvalTargetId
    );
    const targetKind = isPlanAction ? 'plan_action' : 'activity';

    onUpdateCommunity((curr) => ({
      ...curr,
      evaluation: {
        ...curr.evaluation,
        executionEvaluations: editingExecEvalId
          ? updatePlcExecutionEvaluationItem(
              curr.evaluation.executionEvaluations,
              editingExecEvalId,
              {
                targetKind,
                actionOrActivityId: execEvalTargetId,
                executionLevel: execEvalLevel,
                strengths: execEvalStrengths,
                improvements: execEvalImprovements,
                notes: execEvalNotes,
              }
            )
          : addPlcExecutionEvaluationItem(
              curr.evaluation.executionEvaluations,
              {
                targetKind,
                actionOrActivityId: execEvalTargetId,
                executionLevel: execEvalLevel,
                strengths: execEvalStrengths,
                improvements: execEvalImprovements,
                notes: execEvalNotes,
              }
            ),
      },
    }));

    const wasEditing = Boolean(editingExecEvalId);
    resetExecEvalForm();
    onShowBanner(
      wasEditing
        ? 'تم تحديث ملاحظة تقويم التنفيذ.'
        : 'تمت إضافة ملاحظة تقويم التنفيذ وربطها بالسجل.'
    );
  };

  const handleStartEditExecEval = (item: PlcExecutionEvaluationItem) => {
    setEditingExecEvalId(item.id);
    setExecEvalTargetId(item.actionOrActivityId);
    setExecEvalLevel(item.executionLevel || 'منفذ وفق الخطة');
    setExecEvalStrengths(item.strengths || '');
    setExecEvalImprovements(item.improvements || '');
    setExecEvalNotes(item.notes || '');
  };

  const handleConfirmDeleteExecEval = (itemId: string) => {
    onUpdateCommunity((curr) => ({
      ...curr,
      evaluation: {
        ...curr.evaluation,
        executionEvaluations: deletePlcExecutionEvaluationItem(
          curr.evaluation.executionEvaluations,
          itemId
        ),
      },
    }));
    if (editingExecEvalId === itemId) resetExecEvalForm();
    setConfirmDeleteExecEvalId(null);
    onShowBanner('تم حذف ملاحظة تقويم التنفيذ.');
  };

  // ==========================================================================
  // دوال مساعدة للقسم 7.2 (مؤشرات الأداء KPIs)
  // ==========================================================================
  const resetKpiForm = () => {
    setEditingKpiId(null);
    setKpiName('');
    setKpiDescription('');
    setKpiGoalId('');
    setKpiNeedId('');
    setKpiActionId('');
    setKpiActivityId('');
    setKpiBaseline('');
    setKpiTarget('');
    setKpiActual('');
    setKpiUnit('عدد');
    setKpiCustomUnit('');
    setKpiDirection('higher_is_better');
    setKpiDataSource('');
    setKpiPeriod('');
    setKpiPeriodStart('');
    setKpiPeriodEnd('');
    setKpiMeasurementDate(new Date().toISOString().slice(0, 10));
    setKpiCalculationMethod('');
    setKpiNotes('');
    setKpiValidationError(null);
  };

  const handleSelectKpiActionAutoFill = (actionId: string) => {
    setKpiActionId(actionId);
    if (!actionId) return;
    const foundAction = community.operationalPlan.find(
      (a) => a.id === actionId
    );
    if (!foundAction) return;
    if (!kpiGoalId && foundAction.goalId) {
      setKpiGoalId(foundAction.goalId);
    }
    const actionNeedIds = foundAction.needIds ?? [];
    if (!kpiNeedId && actionNeedIds.length > 0) {
      setKpiNeedId(actionNeedIds[0]);
    }
  };

  const handleSubmitKpi = (e: React.FormEvent) => {
    e.preventDefault();
    setKpiValidationError(null);

    const parsedBaseline =
      kpiBaseline.trim() === '' ? null : Number(kpiBaseline);
    const parsedTarget = kpiTarget.trim() === '' ? null : Number(kpiTarget);
    const parsedActual = kpiActual.trim() === '' ? null : Number(kpiActual);

    const inputPayload = {
      name: kpiName,
      description: kpiDescription,
      linkedGoalId: kpiGoalId,
      linkedNeedId: kpiNeedId,
      linkedActionId: kpiActionId,
      linkedActivityId: kpiActivityId,
      baselineValue: parsedBaseline,
      targetValue: parsedTarget,
      achievedValue: parsedActual,
      unit: kpiUnit,
      customUnit: kpiCustomUnit,
      indicatorType: kpiDirection,
      dataSource: kpiDataSource,
      measurementPeriod: kpiPeriod,
      periodStartDate: kpiPeriodStart,
      periodEndDate: kpiPeriodEnd,
      measurementDate: kpiMeasurementDate,
      calculationMethod: kpiCalculationMethod,
      notes: kpiNotes,
    };

    const validation = validatePlcKpiIndicatorInput(inputPayload);
    if (!validation.valid) {
      setKpiValidationError(validation.error || 'بيانات المؤشر غير مكتملة.');
      return;
    }

    onUpdateCommunity((curr) => ({
      ...curr,
      evaluation: {
        ...curr.evaluation,
        kpiIndicators: editingKpiId
          ? updatePlcKpiIndicator(
              curr.evaluation.kpiIndicators,
              editingKpiId,
              inputPayload
            )
          : addPlcKpiIndicator(curr.evaluation.kpiIndicators, inputPayload),
      },
    }));

    const wasEditing = Boolean(editingKpiId);
    resetKpiForm();
    onShowBanner(
      wasEditing
        ? 'تم تحديث مؤشر الأداء مع الحفاظ على معرفه الثابت.'
        : 'تمت إضافة مؤشر الأداء وربطه بالسجلات بنجاح.'
    );
  };

  const handleStartEditKpi = (kpi: PlcKpiIndicatorItem) => {
    setEditingKpiId(kpi.id);
    setKpiName(kpi.name);
    setKpiDescription(kpi.description || '');
    setKpiGoalId(kpi.linkedGoalId || '');
    setKpiNeedId(kpi.linkedNeedId || '');
    setKpiActionId(kpi.linkedActionId || '');
    setKpiActivityId(kpi.linkedActivityId || '');
    setKpiBaseline(
      kpi.baselineValue !== null && kpi.baselineValue !== undefined
        ? String(kpi.baselineValue)
        : ''
    );
    setKpiTarget(
      kpi.targetValue !== null && kpi.targetValue !== undefined
        ? String(kpi.targetValue)
        : ''
    );
    setKpiActual(
      kpi.achievedValue !== null && kpi.achievedValue !== undefined
        ? String(kpi.achievedValue)
        : ''
    );
    setKpiUnit(kpi.unit || 'عدد');
    setKpiCustomUnit(kpi.customUnit || '');
    setKpiDirection(kpi.indicatorType || 'higher_is_better');
    setKpiDataSource(kpi.dataSource || '');
    setKpiPeriod(kpi.measurementPeriod || '');
    setKpiPeriodStart(kpi.periodStartDate || '');
    setKpiPeriodEnd(kpi.periodEndDate || '');
    setKpiMeasurementDate(kpi.measurementDate || '');
    setKpiCalculationMethod(kpi.calculationMethod || '');
    setKpiNotes(kpi.notes || '');
    setKpiValidationError(null);
  };

  const handleConfirmDeleteKpi = (kpiId: string) => {
    onUpdateCommunity((curr) => ({
      ...curr,
      evaluation: {
        ...curr.evaluation,
        kpiIndicators: deletePlcKpiIndicator(
          curr.evaluation.kpiIndicators,
          kpiId
        ),
      },
    }));
    if (editingKpiId === kpiId) resetKpiForm();
    setConfirmDeleteKpiId(null);
    onShowBanner('تم حذف مؤشر الأداء.');
  };

  // ==========================================================================
  // دوال مساعدة للقسم 7.3 (قياس الأثر)
  // ==========================================================================
  const resetImpactForm = () => {
    setEditingImpactId(null);
    setImpactGoalId('');
    setImpactNeedId('');
    setImpactActionId('');
    setImpactActivityId('');
    setImpactBeneficiary('');
    setImpactMethod('pre_post_comparison');
    setImpactCustomMethod('');
    setImpactBaselineDate('');
    setImpactMeasurementDate(new Date().toISOString().slice(0, 10));
    setImpactTool('');
    setImpactBaselineVal('');
    setImpactTargetVal('');
    setImpactActualVal('');
    setImpactUnit('نسبة مئوية');
    setImpactCustomUnit('');
    setImpactResultsText('');
    setImpactObservedDescription('');
    setImpactSelectedEvidenceIds([]);
    setImpactDecision('continue');
    setImpactCustomDecision('');
    setImpactOpportunities('');
    setImpactNotes('');
    setImpactValidationError(null);
  };

  const handleSelectImpactActionAutoFill = (actionId: string) => {
    setImpactActionId(actionId);
    if (!actionId) return;
    const foundAction = community.operationalPlan.find(
      (a) => a.id === actionId
    );
    if (!foundAction) return;
    if (!impactGoalId && foundAction.goalId) {
      setImpactGoalId(foundAction.goalId);
    }
    const actionNeedIds = foundAction.needIds ?? [];
    if (!impactNeedId && actionNeedIds.length > 0) {
      setImpactNeedId(actionNeedIds[0]);
    }
  };

  const handleToggleImpactEvidence = (evidenceId: string) => {
    setImpactSelectedEvidenceIds((prev) =>
      prev.includes(evidenceId)
        ? prev.filter((id) => id !== evidenceId)
        : [...prev, evidenceId]
    );
  };

  const handleSubmitImpact = (e: React.FormEvent) => {
    e.preventDefault();
    setImpactValidationError(null);

    const parsedBaseline =
      impactBaselineVal.trim() === '' ? null : Number(impactBaselineVal);
    const parsedTarget =
      impactTargetVal.trim() === '' ? null : Number(impactTargetVal);
    const parsedActual =
      impactActualVal.trim() === '' ? null : Number(impactActualVal);

    const payload = {
      linkedGoalId: impactGoalId,
      linkedNeedId: impactNeedId,
      linkedActionId: impactActionId,
      linkedActivityId: impactActivityId,
      beneficiaryCategory: impactBeneficiary,
      measurementMethod: impactMethod,
      customMeasurementMethod: impactCustomMethod,
      baselineDate: impactBaselineDate,
      measurementDate: impactMeasurementDate,
      measurementTool: impactTool,
      baselineValue: parsedBaseline,
      targetValue: parsedTarget,
      actualValue: parsedActual,
      unit: impactUnit,
      customUnit: impactCustomUnit,
      measurementResults: impactResultsText,
      observedChangeDescription: impactObservedDescription,
      supportingEvidenceIds: impactSelectedEvidenceIds,
      improvementDecision: impactDecision,
      customImprovementDecision: impactCustomDecision,
      improvementOpportunities: impactOpportunities,
      notes: impactNotes,
    };

    const validation = validatePlcImpactMeasurementInput(payload);
    if (!validation.valid) {
      setImpactValidationError(
        validation.error || 'يرجى التحقق من بيانات قياس الأثر.'
      );
      return;
    }

    onUpdateCommunity((curr) => {
      const nextImpacts = editingImpactId
        ? updatePlcImpactMeasurement(
            curr.evaluation.impactMeasurements,
            editingImpactId,
            payload
          )
        : addPlcImpactMeasurement(curr.evaluation.impactMeasurements, payload);

      return syncCommunityImpactEvidenceLinks({
        ...curr,
        evaluation: {
          ...curr.evaluation,
          impactMeasurements: nextImpacts,
        },
      });
    });

    const wasEditing = Boolean(editingImpactId);
    resetImpactForm();
    onShowBanner(
      wasEditing
        ? 'تم تحديث سجل قياس الأثر ومزامنة الشواهد المرتبطة به.'
        : 'تمت إضافة سجل قياس الأثر وربطه بالهدف والإجراء والشواهد.'
    );
  };

  const handleStartEditImpact = (imp: PlcImpactMeasurementItem) => {
    setEditingImpactId(imp.id);
    setImpactGoalId(imp.linkedGoalId || '');
    setImpactNeedId(imp.linkedNeedId || '');
    setImpactActionId(imp.linkedActionId || '');
    setImpactActivityId(imp.linkedActivityId || '');
    setImpactBeneficiary(imp.beneficiaryCategory || '');
    setImpactMethod(imp.measurementMethod || 'pre_post_comparison');
    setImpactCustomMethod(imp.customMeasurementMethod || '');
    setImpactBaselineDate(imp.baselineDate || '');
    setImpactMeasurementDate(imp.measurementDate || '');
    setImpactTool(imp.measurementTool || '');
    setImpactBaselineVal(
      imp.baselineValue !== null && imp.baselineValue !== undefined
        ? String(imp.baselineValue)
        : ''
    );
    setImpactTargetVal(
      imp.targetValue !== null && imp.targetValue !== undefined
        ? String(imp.targetValue)
        : ''
    );
    setImpactActualVal(
      imp.actualValue !== null && imp.actualValue !== undefined
        ? String(imp.actualValue)
        : ''
    );
    setImpactUnit(imp.unit || 'نسبة مئوية');
    setImpactCustomUnit(imp.customUnit || '');
    setImpactResultsText(imp.measurementResults || '');
    setImpactObservedDescription(imp.observedChangeDescription || '');
    setImpactSelectedEvidenceIds(imp.supportingEvidenceIds || []);
    setImpactDecision(imp.improvementDecision || 'continue');
    setImpactCustomDecision(imp.customImprovementDecision || '');
    setImpactOpportunities(imp.improvementOpportunities || '');
    setImpactNotes(imp.notes || '');
    setImpactValidationError(null);
  };

  const handleConfirmDeleteImpact = (impactId: string) => {
    onUpdateCommunity((curr) =>
      syncCommunityImpactEvidenceLinks({
        ...curr,
        evaluation: {
          ...curr.evaluation,
          impactMeasurements: deletePlcImpactMeasurement(
            curr.evaluation.impactMeasurements,
            impactId
          ),
        },
      })
    );
    if (editingImpactId === impactId) resetImpactForm();
    setConfirmDeleteImpactId(null);
    onShowBanner('تم حذف سجل قياس الأثر وتحديث روابط الشواهد.');
  };

  // ==========================================================================
  // دوال مساعدة للنموذج 8 (مستودع الشواهد والمرفقات الموحد)
  // ==========================================================================
  const resetEvidenceForm = () => {
    setEditingEvidenceId(null);
    setEvdTitle('');
    setEvdType('pdf');
    setEvdCustomType('');
    setEvdDescription('');
    setEvdDate(new Date().toISOString().slice(0, 10));
    setEvdSourceEntity('');
    setEvdExternalUrl('');
    setEvdNotes('');
    setEvdFileName('');
    setEvdMimeType('');
    setEvdFileDataUrl('');
    setPendingInitialLinks([]);
    setEvdValidationError(null);
  };

  const handleEvidenceFileSelection = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      setEvdFileName(file.name);
      setEvdMimeType(file.type || 'application/octet-stream');
      setEvdFileDataUrl(dataUrl);
      const inferred = inferPlcEvidenceTypeFromMimeOrUrl(
        file.type,
        file.name,
        evdExternalUrl
      );
      setEvdType(inferred);
      if (!evdTitle.trim()) {
        setEvdTitle(file.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  const getAvailableTargetsForType = (
    targetType: PlcEvidenceLinkTargetType
  ): { id: string; label: string }[] => {
    if (targetType === 'need') {
      return community.needs.map((n, idx) => ({
        id: n.id,
        label: `احتياج ${idx + 1}: ${n.description}`,
      }));
    }
    if (targetType === 'goal') {
      return community.identity.goals.map((g, idx) => ({
        id: g.id,
        label: `هدف ${idx + 1}: ${g.text}`,
      }));
    }
    if (targetType === 'operational_plan') {
      return [
        {
          id: community.id,
          label: `الخطة التشغيلية للمجتمع (${community.name})`,
        },
      ];
    }
    if (targetType === 'plan_action') {
      return community.operationalPlan.map((a, idx) => ({
        id: a.id,
        label: `إجراء ${idx + 1}: ${a.title}`,
      }));
    }
    if (targetType === 'meeting') {
      return community.meetings.map((m) => ({
        id: m.id,
        label: `الاجتماع (${m.meetingNumber}) — ${m.meetingType}`,
      }));
    }
    if (
      targetType === 'program' ||
      targetType === 'activity' ||
      targetType === 'mutual_visit' ||
      targetType === 'community_partnership'
    ) {
      return community.activities
        .filter((a) => a.type === targetType)
        .map((a) => ({
          id: a.id,
          label: `${PLC_ACTIVITY_TYPE_LABELS[a.type]}: ${a.title}`,
        }));
    }
    if (targetType === 'kpi') {
      return community.evaluation.kpiIndicators.map((k, idx) => ({
        id: k.id,
        label: `مؤشر ${idx + 1}: ${k.name}`,
      }));
    }
    if (targetType === 'impact') {
      return community.evaluation.impactMeasurements.map((imp, idx) => ({
        id: imp.id,
        label: `قياس أثر ${idx + 1}: ${imp.observedChangeDescription || imp.measurementResults || imp.beneficiaryCategory}`,
      }));
    }
    if (targetType === 'final_report') {
      return [
        {
          id: community.id,
          label: `التقرير الختامي للمجتمع (${community.name})`,
        },
      ];
    }
    return [];
  };

  const handleAddPendingInitialLink = () => {
    if (!newLinkTargetId.trim()) return;
    setPendingInitialLinks((prev) => {
      const exists = prev.some(
        (l) =>
          l.targetType === newLinkTargetType && l.targetId === newLinkTargetId
      );
      if (exists) return prev;
      return [
        ...prev,
        { targetType: newLinkTargetType, targetId: newLinkTargetId },
      ];
    });
    setNewLinkTargetId('');
  };

  const handleSubmitEvidenceRepository = (e: React.FormEvent) => {
    e.preventDefault();
    setEvdValidationError(null);

    const validation = validatePlcEvidenceRepositoryInput({ title: evdTitle });
    if (!validation.valid) {
      setEvdValidationError(validation.error || 'يجب إدخال اسم الشاهد.');
      return;
    }

    if (editingEvidenceId) {
      onUpdateCommunity((curr) => {
        const res = updatePlcEvidenceInRepository(curr, editingEvidenceId, {
          title: evdTitle,
          evidenceType: evdType,
          customEvidenceType: evdCustomType,
          description: evdDescription,
          evidenceDate: evdDate,
          sourceOrEntity: evdSourceEntity,
          externalUrl: evdExternalUrl,
          notes: evdNotes,
          fileName: evdFileName,
          mimeType: evdMimeType,
          fileDataUrl: evdFileDataUrl,
        });
        return res.community;
      });
      resetEvidenceForm();
      onShowBanner('تم تحديث بيانات الشاهد في المستودع الموحد.');
      return;
    }

    onUpdateCommunity((curr) => {
      const res = addPlcEvidenceToRepository(curr, {
        title: evdTitle,
        evidenceType: evdType,
        customEvidenceType: evdCustomType,
        description: evdDescription,
        evidenceDate: evdDate,
        sourceOrEntity: evdSourceEntity,
        externalUrl: evdExternalUrl,
        notes: evdNotes,
        fileName: evdFileName,
        mimeType: evdMimeType,
        fileDataUrl: evdFileDataUrl,
        initialLinks: pendingInitialLinks,
      });
      return res.community;
    });

    resetEvidenceForm();
    onShowBanner('تم حفظ الشاهد في المستودع الموحد وربطه بالسجلات المحددة.');
  };

  const handleStartEditEvidence = (ev: PlcEvidenceItem) => {
    setEditingEvidenceId(ev.id);
    setEvdTitle(ev.title);
    setEvdType(
      ev.evidenceType ??
        inferPlcEvidenceTypeFromMimeOrUrl(
          ev.mimeType,
          ev.fileName,
          ev.externalUrl
        )
    );
    setEvdCustomType(ev.customEvidenceType || '');
    setEvdDescription(ev.description || '');
    setEvdDate(ev.evidenceDate || ev.createdAt.slice(0, 10));
    setEvdSourceEntity(ev.sourceOrEntity || '');
    setEvdExternalUrl(ev.externalUrl || '');
    setEvdNotes(ev.notes || '');
    setEvdFileName(ev.fileName || '');
    setEvdMimeType(ev.mimeType || '');
    setEvdFileDataUrl(ev.fileDataUrl || '');
    setEvdValidationError(null);
  };

  const handleLinkExistingEvidenceInRepo = (evidenceId: string) => {
    setRepoLinkError(null);
    if (!repoLinkTargetId.trim()) {
      setRepoLinkError('يرجى اختيار السجل المراد ربط الشاهد به.');
      return;
    }

    let opError: string | null = null;
    onUpdateCommunity((curr) => {
      const res = linkPlcEvidenceToTarget(
        curr,
        evidenceId,
        repoLinkTargetType,
        repoLinkTargetId
      );
      if (!res.ok) {
        opError = res.error || 'تعذر ربط الشاهد بالسجل.';
      }
      return res.community;
    });

    if (opError) {
      setRepoLinkError(opError);
      return;
    }

    setRepoLinkTargetId('');
    setActiveLinkingEvidenceId(null);
    onShowBanner('تم ربط الشاهد بالسجل المحدد دون تكرار رفعه في المستودع.');
  };

  const handleUnlinkSingleRelation = (
    evidenceId: string,
    targetType: PlcEvidenceLinkTargetType,
    targetId: string
  ) => {
    onUpdateCommunity((curr) =>
      unlinkPlcEvidenceFromTarget(curr, evidenceId, targetType, targetId)
    );
    onShowBanner('تم فك ارتباط الشاهد بالسجل مع بقاء الشاهد محفوظاً في المستودع.');
  };

  const handleInitiateDeleteEvidence = (ev: PlcEvidenceItem) => {
    const relations = resolvePlcEvidenceLinks(ev, community).filter(
      (r) => !r.isTargetDeleted
    );
    setPendingDeleteEvidence({
      evidence: ev,
      requiresForceConfirmation: relations.length > 0,
      linkedCount: relations.length,
      warningMessage:
        relations.length > 0
          ? 'هذا الشاهد مرتبط بسجلات أخرى. هل تريد حذف الشاهد وإزالة ارتباطاته؟'
          : 'هل أنت متأكد من حذف هذا الشاهد نهائياً من مستودع الشواهد؟',
    });
  };

  const handleConfirmDeleteEvidence = () => {
    if (!pendingDeleteEvidence) return;
    const evId = pendingDeleteEvidence.evidence.id;

    onUpdateCommunity((curr) => {
      const res = deletePlcEvidenceFromRepository(curr, evId, {
        forceRemoveLinks: true,
      });
      return res.community;
    });

    if (editingEvidenceId === evId) {
      resetEvidenceForm();
    }
    setPendingDeleteEvidence(null);
    onShowBanner('تم حذف الشاهد من المستودع وإزالة جميع ارتباطاته بأمان.');
  };

  // ==========================================================================
  // شريط التنقل السفلي بين النماذج (١ إلى ٨)
  // ==========================================================================
  const renderBatch4NavigationFooter = () => {
    const prevForm = (activeFormNumber - 1) as PlcFormNumber;
    const nextForm =
      activeFormNumber < 9 ? ((activeFormNumber + 1) as PlcFormNumber) : null;

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-200">
        <div>
          <button
            type="button"
            data-testid={`plc-prev-form-btn-${prevForm}`}
            onClick={() => onSelectFormNumber(prevForm)}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 shrink-0" />
            <span>
              الانتقال إلى{' '}
              {PLC_FORMS_CATALOG.find((f) => f.formNumber === prevForm)
                ?.shortTitle ?? ''}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {nextForm && (
            <button
              type="button"
              data-testid={`plc-next-form-btn-${nextForm}`}
              onClick={() => onSelectFormNumber(nextForm)}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>
                الانتقال إلى{' '}
                {PLC_FORMS_CATALOG.find((f) => f.formNumber === nextForm)
                  ?.shortTitle ?? ''}
              </span>
              <ArrowLeft className="w-4 h-4 shrink-0" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // ==========================================================================
  // العرض 1: النموذج السابع — التقويم ومؤشرات الأداء وقياس الأثر
  // ==========================================================================
  if (activeFormNumber === 7) {
    return (
      <section
        data-testid="plc-form-7-container"
        className="bg-white rounded-2xl border-2 border-plc/30 p-5 sm:p-7 space-y-8"
      >
        {/* ترويسة النموذج السابع */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>الدفعة الرابعة: التقويم والأثر • النموذج ٧</span>
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold font-display text-stone-900">
              النموذج السابع: التقويم ومؤشرات الأداء وقياس الأثر
            </h3>
            <p className="text-xs sm:text-sm text-stone-600">
              ينقسم هذا النموذج إلى ثلاثة أقسام مترابطة بالمعرفات الثابتة: تقويم
              التنفيذ، مؤشرات الأداء (KPIs)، وقياس الأثر الفعلي.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums">
              مؤشرات الأداء: {community.evaluation.kpiIndicators.length}
            </span>
            <span className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums">
              سجلات قياس الأثر: {community.evaluation.impactMeasurements.length}
            </span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* القسم 7.1: تقويم التنفيذ (مشتق تلقائياً من النموذج 4 والنموذج 6) */}
        {/* ================================================================= */}
        <div
          data-testid="plc-f7-section-execution-eval"
          className="rounded-2xl border border-stone-200 bg-stone-50/60 p-5 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-3">
            <div>
              <span className="text-xs font-extrabold text-plc">
                القسم 7.1
              </span>
              <h4 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                7.1 تقويم التنفيذ (هل تم تنفيذ الخطة والأنشطة كما خطط لها؟)
              </h4>
              <p className="text-xs text-stone-600 mt-0.5">
                جميع الأرقام في هذا القسم مشتقة تلقائياً من بيانات الخطة
                التشغيلية (النموذج 4) وسجلات البرامج والأنشطة والزيارات والشراكات
                (النموذج 6). علماً بأن تنفيذ النشاط لا يُعد دليلاً على وجود أثر.
              </p>
            </div>
            <span
              data-testid="plc-f7-exec-data-status-badge"
              className={`px-3 py-1 rounded-lg text-xs font-extrabold ${
                derivedExecSummary.hasSufficientData
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {derivedExecSummary.hasSufficientData
                ? 'بيانات التنفيذ متوفرة ومشتقة آلياً'
                : 'لا توجد بيانات كافية للحساب'}
            </span>
          </div>

          {!derivedExecSummary.hasSufficientData ? (
            <div
              data-testid="plc-f7-insufficient-data-notice"
              className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-center space-y-1.5"
            >
              <div className="text-sm font-extrabold text-amber-900">
                لا توجد بيانات كافية للحساب
              </div>
              <p className="text-xs text-amber-800">
                لم يتم تسجيل إجراءات في الخطة التشغيلية (النموذج 4) أو سجلات
                تنفيذ في النموذج 6 حتى الآن. لا يعرض النظام صفراً كنتيجة افتراضية
                قبل إدخال بيانات التخطيط والتنفيذ الفعلية.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* أولاً: ملخص إجراءات الخطة التشغيلية (النموذج 4) */}
              <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="text-xs sm:text-sm font-extrabold text-stone-900">
                    أولاً: إحصاءات تنفيذ الخطة التشغيلية (مشتقة من النموذج 4)
                  </h5>
                  <span
                    data-testid="plc-f7-plan-completion-display"
                    className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums"
                  >
                    نسبة الإنجاز الفعلية للخطة:{' '}
                    {derivedExecSummary.actualPlanCompletionDisplay}
                  </span>
                </div>

                {!derivedExecSummary.hasPlanData ? (
                  <p className="text-xs font-bold text-amber-800">
                    لا توجد بيانات كافية للحساب في الخطة التشغيلية (لم تُسجل
                    إجراءات بعد).
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
                    <div className="rounded-xl bg-stone-50 border border-stone-200 p-2.5">
                      <div className="text-[11px] font-bold text-stone-600">
                        إجمالي المخطط لها
                      </div>
                      <div
                        data-testid="plc-f7-plan-total-count"
                        className="text-base font-extrabold text-stone-900 tabular-nums mt-0.5"
                      >
                        {derivedExecSummary.plannedActionsTotalCount}
                      </div>
                    </div>
                    <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-2.5">
                      <div className="text-[11px] font-bold text-emerald-800">
                        الإجراءات المنفذة
                      </div>
                      <div
                        data-testid="plc-f7-plan-executed-count"
                        className="text-base font-extrabold text-emerald-900 tabular-nums mt-0.5"
                      >
                        {derivedExecSummary.executedActionsCount}
                      </div>
                    </div>
                    <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-2.5">
                      <div className="text-[11px] font-bold text-amber-800">
                        قيد التنفيذ
                      </div>
                      <div className="text-base font-extrabold text-amber-900 tabular-nums mt-0.5">
                        {derivedExecSummary.inProgressActionsCount}
                      </div>
                    </div>
                    <div className="rounded-xl bg-red-50/70 border border-red-200 p-2.5">
                      <div className="text-[11px] font-bold text-red-800">
                        الإجراءات المتعثرة
                      </div>
                      <div className="text-base font-extrabold text-red-900 tabular-nums mt-0.5">
                        {derivedExecSummary.stalledActionsCount}
                      </div>
                    </div>
                    <div className="rounded-xl bg-stone-100 border border-stone-200 p-2.5">
                      <div className="text-[11px] font-bold text-stone-600">
                        الإجراءات الملغاة
                      </div>
                      <div className="text-base font-extrabold text-stone-800 tabular-nums mt-0.5">
                        {derivedExecSummary.cancelledActionsCount}
                      </div>
                    </div>
                    <div className="rounded-xl bg-plc-soft border border-plc-border p-2.5">
                      <div className="text-[11px] font-bold text-plc">
                        نسبة الإنجاز الفعلية
                      </div>
                      <div className="text-xs sm:text-sm font-extrabold text-plc tabular-nums mt-1">
                        {derivedExecSummary.actualPlanCompletionDisplay}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ثانياً: ملخص البرامج والأنشطة والزيارات والشراكات (النموذج 6) */}
              <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="text-xs sm:text-sm font-extrabold text-stone-900">
                    ثانياً: إحصاءات البرامج والأنشطة والزيارات والشراكات (مشتقة من
                    النموذج 6)
                  </h5>
                  <span
                    data-testid="plc-f7-activities-completion-display"
                    className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums"
                  >
                    نسبة التنفيذ الفعلي للسجلات:{' '}
                    {derivedExecSummary.actualActivitiesExecutionDisplay}
                  </span>
                </div>

                {!derivedExecSummary.hasActivitiesData ? (
                  <p className="text-xs font-bold text-amber-800">
                    لا توجد بيانات كافية للحساب في سجلات التنفيذ (النموذج 6).
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-stone-200">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-plc-soft text-plc border-b border-plc-border">
                          <th className="py-2.5 px-3 font-extrabold">
                            نوع السجل
                          </th>
                          <th className="py-2.5 px-3 font-extrabold text-center">
                            إجمالي المسجل
                          </th>
                          <th className="py-2.5 px-3 font-extrabold text-center">
                            مخطط له
                          </th>
                          <th className="py-2.5 px-3 font-extrabold text-center">
                            قيد التنفيذ
                          </th>
                          <th className="py-2.5 px-3 font-extrabold text-center">
                            منفذ فعلياً
                          </th>
                          <th className="py-2.5 px-3 font-extrabold text-center">
                            ملغى
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {(
                          [
                            'program',
                            'activity',
                            'mutual_visit',
                            'community_partnership',
                          ] as const
                        ).map((tKey) => {
                          const row = derivedExecSummary.byRecordType[tKey];
                          return (
                            <tr key={tKey}>
                              <td className="py-2 px-3 font-extrabold text-stone-900">
                                {PLC_ACTIVITY_TYPE_LABELS[tKey]}
                              </td>
                              <td className="py-2 px-3 text-center font-bold tabular-nums">
                                {row.total}
                              </td>
                              <td className="py-2 px-3 text-center text-stone-700 tabular-nums">
                                {row.planned}
                              </td>
                              <td className="py-2 px-3 text-center text-amber-800 font-bold tabular-nums">
                                {row.inProgress}
                              </td>
                              <td className="py-2 px-3 text-center text-emerald-800 font-extrabold tabular-nums">
                                {row.executed}
                              </td>
                              <td className="py-2 px-3 text-center text-stone-500 tabular-nums">
                                {row.cancelled}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-stone-50 font-extrabold">
                          <td className="py-2.5 px-3 text-plc">
                            الإجمالي الكلي
                          </td>
                          <td className="py-2.5 px-3 text-center tabular-nums">
                            {derivedExecSummary.totalExecutionRecordsCount}
                          </td>
                          <td className="py-2.5 px-3 text-center tabular-nums">
                            {derivedExecSummary.plannedExecutionRecordsCount}
                          </td>
                          <td className="py-2.5 px-3 text-center tabular-nums">
                            {derivedExecSummary.inProgressExecutionRecordsCount}
                          </td>
                          <td className="py-2.5 px-3 text-center text-emerald-800 tabular-nums">
                            {derivedExecSummary.executedExecutionRecordsCount}
                          </td>
                          <td className="py-2.5 px-3 text-center tabular-nums">
                            {derivedExecSummary.cancelledExecutionRecordsCount}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* نموذج اختياري لتسجيل ملاحظات تقويم التنفيذ مرتبطة بإجراء أو نشاط بالـID */}
          {(community.operationalPlan.length > 0 ||
            community.activities.length > 0) && (
            <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-4">
              <h5 className="text-xs sm:text-sm font-extrabold text-stone-900">
                تدوين ملاحظات تقويم التنفيذ ونقاط القوة والتحسين (مرتبطة بالـID)
              </h5>
              {!readOnly && (
                <form
                  onSubmit={handleSubmitExecEval}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3"
                >
                <div>
                  <label
                    htmlFor="plc-f7-exeval-target"
                    className="block text-xs font-extrabold text-stone-800 mb-1"
                  >
                    الإجراء أو النشاط المرتبط *
                  </label>
                  <select
                    id="plc-f7-exeval-target"
                    data-testid="plc-f7-exeval-target-select"
                    value={execEvalTargetId}
                    onChange={(e) => setExecEvalTargetId(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                  >
                    <option value="">— اختر إجراءً أو نشاطاً —</option>
                    {community.operationalPlan.map((act, idx) => (
                      <option key={act.id} value={act.id}>
                        [إجراء {idx + 1}] {act.title}
                      </option>
                    ))}
                    {community.activities.map((rec) => (
                      <option key={rec.id} value={rec.id}>
                        [{PLC_ACTIVITY_TYPE_LABELS[rec.type]}] {rec.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="plc-f7-exeval-level"
                    className="block text-xs font-extrabold text-stone-800 mb-1"
                  >
                    مستوى جودة التنفيذ
                  </label>
                  <select
                    id="plc-f7-exeval-level"
                    value={execEvalLevel}
                    onChange={(e) => setExecEvalLevel(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                  >
                    <option value="منفذ وفق الخطة">منفذ وفق الخطة</option>
                    <option value="منفذ جزئياً">منفذ جزئياً</option>
                    <option value="متأخر عن الجدول الزمني">
                      متأخر عن الجدول الزمني
                    </option>
                    <option value="يحتاج إعادة جدولة">يحتاج إعادة جدولة</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="plc-f7-exeval-strengths"
                    className="block text-xs font-extrabold text-stone-800 mb-1"
                  >
                    أبرز نقاط القوة في التنفيذ
                  </label>
                  <input
                    id="plc-f7-exeval-strengths"
                    type="text"
                    value={execEvalStrengths}
                    onChange={(e) => setExecEvalStrengths(e.target.value)}
                    placeholder="نقاط القوة الملاحظة..."
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="plc-f7-exeval-improvements"
                    className="block text-xs font-extrabold text-stone-800 mb-1"
                  >
                    فرص التحسين الإجرائية
                  </label>
                  <input
                    id="plc-f7-exeval-improvements"
                    type="text"
                    value={execEvalImprovements}
                    onChange={(e) => setExecEvalImprovements(e.target.value)}
                    placeholder="التحسينات المقترحة..."
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                  />
                </div>

                <div className="md:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    data-testid="plc-f7-save-exeval-btn"
                    className="min-h-[38px] px-4 py-1.5 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {editingExecEvalId
                        ? 'حفظ تعديل تقويم التنفيذ'
                        : 'إضافة ملاحظة تقويم تنفيذ'}
                    </span>
                  </button>
                  {editingExecEvalId && (
                    <button
                      type="button"
                      onClick={resetExecEvalForm}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </form>
              )}

              {community.evaluation.executionEvaluations.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-stone-200">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-plc-soft text-plc border-b border-plc-border">
                        <th className="py-2.5 px-3 font-extrabold">
                          السجل المرتبط (بالـID)
                        </th>
                        <th className="py-2.5 px-3 font-extrabold">
                          مستوى التنفيذ
                        </th>
                        <th className="py-2.5 px-3 font-extrabold">
                          نقاط القوة
                        </th>
                        <th className="py-2.5 px-3 font-extrabold">
                          فرص التحسين
                        </th>
                        {!readOnly && (
                          <th className="py-2.5 px-3 font-extrabold text-center">
                            إجراءات
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {community.evaluation.executionEvaluations.map((ev) => {
                        const resolved = resolvePlcExecutionEvaluationLinks(
                          ev,
                          community
                        );
                        return (
                          <tr key={ev.id}>
                            <td className="py-2.5 px-3 font-extrabold text-stone-900">
                              <div>{resolved.targetDisplayTitle}</div>
                              <span className="text-[11px] text-stone-500">
                                {resolved.targetTypeLabel} •{' '}
                                {resolved.targetStatusLabel}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-plc">
                              {ev.executionLevel || 'غير متوفر'}
                            </td>
                            <td className="py-2.5 px-3 text-stone-700">
                              {ev.strengths || 'غير متوفر'}
                            </td>
                            <td className="py-2.5 px-3 text-stone-700">
                              {ev.improvements || 'غير متوفر'}
                            </td>
                            {!readOnly && (
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditExecEval(ev)}
                                    aria-label={`تعديل تقويم ${resolved.targetDisplayTitle}`}
                                    className="p-1.5 rounded-lg text-stone-600 hover:text-plc hover:bg-plc-soft cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  {confirmDeleteExecEvalId === ev.id ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleConfirmDeleteExecEval(ev.id)
                                      }
                                      className="px-2 py-1 rounded-md bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                                    >
                                      تأكيد الحذف
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmDeleteExecEvalId(ev.id)
                                      }
                                      aria-label={`حذف تقويم ${resolved.targetDisplayTitle}`}
                                      className="p-1.5 rounded-lg text-stone-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* القسم 7.2: مؤشرات الأداء (KPIs)                                   */}
        {/* ================================================================= */}
        <div
          data-testid="plc-f7-section-kpis"
          className="rounded-2xl border border-stone-200 bg-stone-50/60 p-5 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-3">
            <div>
              <span className="text-xs font-extrabold text-plc">
                القسم 7.2
              </span>
              <h4 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                7.2 جدول مؤشرات الأداء (KPIs)
              </h4>
              <p className="text-xs text-stone-600 mt-0.5">
                ربط كل مؤشر بالهدف والاحتياج والإجراء والنشاط عبر المعرفات
                الثابتة، مع حساب نسبة الإنجاز آلياً وفق طبيعة المؤشر عند اكتمال
                البيانات فقط.
              </p>
            </div>
            <span className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums">
              إجمالي المؤشرات: {community.evaluation.kpiIndicators.length}
            </span>
          </div>

          {kpiValidationError && (
            <div
              data-testid="plc-f7-kpi-error"
              className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-bold text-red-800 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{kpiValidationError}</span>
            </div>
          )}

          {/* نموذج إضافة / تعديل مؤشر أداء */}
          {!readOnly && (
          <form
            onSubmit={handleSubmitKpi}
            className="bg-white rounded-xl border border-stone-200 p-4 space-y-4"
          >
            <h5 className="text-xs sm:text-sm font-extrabold text-stone-900">
              {editingKpiId
                ? 'تعديل مؤشر الأداء المحدد'
                : 'إضافة مؤشر أداء جديد'}
            </h5>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label
                  htmlFor="plc-f7-kpi-name"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  اسم المؤشر *
                </label>
                <input
                  id="plc-f7-kpi-name"
                  data-testid="plc-f7-kpi-name-input"
                  type="text"
                  value={kpiName}
                  onChange={(e) => setKpiName(e.target.value)}
                  placeholder="مثال: نسبة إتقان الطلاب لمهارات الفهم القرائي النقدي"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="plc-f7-kpi-desc"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  وصف المؤشر
                </label>
                <input
                  id="plc-f7-kpi-desc"
                  data-testid="plc-f7-kpi-desc-input"
                  type="text"
                  value={kpiDescription}
                  onChange={(e) => setKpiDescription(e.target.value)}
                  placeholder="وصف مختصر لما يقيسه المؤشر..."
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                />
              </div>

              {/* العلاقات بالـIDs */}
              <div>
                <label
                  htmlFor="plc-f7-kpi-goal"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  الهدف المرتبط به (النموذج 2)
                </label>
                <select
                  id="plc-f7-kpi-goal"
                  data-testid="plc-f7-kpi-goal-select"
                  value={kpiGoalId}
                  onChange={(e) => setKpiGoalId(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                >
                  <option value="">— غير مرتبط بهدف —</option>
                  {community.identity.goals.map((g, idx) => (
                    <option key={g.id} value={g.id}>
                      هدف {idx + 1}: {g.text}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="plc-f7-kpi-need"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  الاحتياج المرتبط به (النموذج 3)
                </label>
                <select
                  id="plc-f7-kpi-need"
                  data-testid="plc-f7-kpi-need-select"
                  value={kpiNeedId}
                  onChange={(e) => setKpiNeedId(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                >
                  <option value="">— غير مرتبط باحتياج —</option>
                  {community.needs.map((n, idx) => (
                    <option key={n.id} value={n.id}>
                      احتياج {idx + 1}: {n.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="plc-f7-kpi-action"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  الإجراء المرتبط به (النموذج 4)
                </label>
                <select
                  id="plc-f7-kpi-action"
                  data-testid="plc-f7-kpi-action-select"
                  value={kpiActionId}
                  onChange={(e) =>
                    handleSelectKpiActionAutoFill(e.target.value)
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                >
                  <option value="">— غير مرتبط بإجراء —</option>
                  {community.operationalPlan.map((a, idx) => (
                    <option key={a.id} value={a.id}>
                      إجراء {idx + 1}: {a.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="plc-f7-kpi-activity"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  البرنامج / النشاط المرتبط (النموذج 6)
                </label>
                <select
                  id="plc-f7-kpi-activity"
                  data-testid="plc-f7-kpi-activity-select"
                  value={kpiActivityId}
                  onChange={(e) => setKpiActivityId(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                >
                  <option value="">— غير مرتبط بنشاط —</option>
                  {community.activities.map((act) => (
                    <option key={act.id} value={act.id}>
                      [{PLC_ACTIVITY_TYPE_LABELS[act.type]}] {act.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* القيم والوحدة ونوع المؤشر */}
              <div>
                <label
                  htmlFor="plc-f7-kpi-direction"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  نوع المؤشر (اتجاه الحساب)
                </label>
                <select
                  id="plc-f7-kpi-direction"
                  data-testid="plc-f7-kpi-direction-select"
                  value={kpiDirection}
                  onChange={(e) =>
                    setKpiDirection(e.target.value as PlcKpiDirectionType)
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                >
                  <option value="higher_is_better">
                    {PLC_KPI_DIRECTION_LABELS.higher_is_better}
                  </option>
                  <option value="lower_is_better">
                    {PLC_KPI_DIRECTION_LABELS.lower_is_better}
                  </option>
                  <option value="exact_target">
                    {PLC_KPI_DIRECTION_LABELS.exact_target}
                  </option>
                  <option value="not_applicable">
                    {PLC_KPI_DIRECTION_LABELS.not_applicable}
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="plc-f7-kpi-unit"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  وحدة القياس
                </label>
                <select
                  id="plc-f7-kpi-unit"
                  data-testid="plc-f7-kpi-unit-select"
                  value={kpiUnit}
                  onChange={(e) => setKpiUnit(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                >
                  {PLC_KPI_UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {kpiUnit === 'أخرى' && (
                <div>
                  <label
                    htmlFor="plc-f7-kpi-custom-unit"
                    className="block text-xs font-extrabold text-stone-800 mb-1"
                  >
                    تحديد وحدة القياس الأخرى
                  </label>
                  <input
                    id="plc-f7-kpi-custom-unit"
                    type="text"
                    value={kpiCustomUnit}
                    onChange={(e) => setKpiCustomUnit(e.target.value)}
                    placeholder="اكتب وحدة القياس..."
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="plc-f7-kpi-baseline"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  خط الأساس (Baseline)
                </label>
                <input
                  id="plc-f7-kpi-baseline"
                  data-testid="plc-f7-kpi-baseline-input"
                  type="number"
                  step="any"
                  value={kpiBaseline}
                  onChange={(e) => setKpiBaseline(e.target.value)}
                  placeholder="غير متوفر إن ترك فارغاً"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f7-kpi-target"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  المستهدف (Target)
                </label>
                <input
                  id="plc-f7-kpi-target"
                  data-testid="plc-f7-kpi-target-input"
                  type="number"
                  step="any"
                  value={kpiTarget}
                  onChange={(e) => setKpiTarget(e.target.value)}
                  placeholder="القيمة المستهدفة..."
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f7-kpi-actual"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  القيمة الفعلية (Actual)
                </label>
                <input
                  id="plc-f7-kpi-actual"
                  data-testid="plc-f7-kpi-actual-input"
                  type="number"
                  step="any"
                  value={kpiActual}
                  onChange={(e) => setKpiActual(e.target.value)}
                  placeholder="لم يتم القياس إن ترك فارغاً"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f7-kpi-source"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  مصدر البيانات
                </label>
                <input
                  id="plc-f7-kpi-source"
                  data-testid="plc-f7-kpi-source-input"
                  type="text"
                  value={kpiDataSource}
                  onChange={(e) => setKpiDataSource(e.target.value)}
                  placeholder="مثال: نتائج الاختبار البعدي / بطاقة الملاحظة"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f7-kpi-period"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  فترة القياس
                </label>
                <input
                  id="plc-f7-kpi-period"
                  type="text"
                  value={kpiPeriod}
                  onChange={(e) => setKpiPeriod(e.target.value)}
                  placeholder="مثال: نهاية الفصل الدراسي الأول"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f7-kpi-date"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  تاريخ القياس
                </label>
                <input
                  id="plc-f7-kpi-date"
                  type="date"
                  value={kpiMeasurementDate}
                  onChange={(e) => setKpiMeasurementDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 tabular-nums"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="plc-f7-kpi-calc-method"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  طريقة الحساب (نص قابل للتحرير)
                </label>
                <input
                  id="plc-f7-kpi-calc-method"
                  data-testid="plc-f7-kpi-calc-method-input"
                  type="text"
                  value={kpiCalculationMethod}
                  onChange={(e) => setKpiCalculationMethod(e.target.value)}
                  placeholder="مثال: (عدد الطلاب المتقنين ÷ إجمالي الطلاب) × 100"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="plc-f7-kpi-notes"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  ملاحظات
                </label>
                <input
                  id="plc-f7-kpi-notes"
                  type="text"
                  value={kpiNotes}
                  onChange={(e) => setKpiNotes(e.target.value)}
                  placeholder="ملاحظات إضافية حول المؤشر..."
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                data-testid="plc-f7-save-kpi-btn"
                className="min-h-[40px] px-5 py-2 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {editingKpiId
                    ? 'حفظ تعديلات مؤشر الأداء'
                    : 'إضافة مؤشر الأداء للجدول'}
                </span>
              </button>
              {editingKpiId && (
                <button
                  type="button"
                  onClick={resetKpiForm}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>
          </form>
          )}

          {/* جدول مؤشرات الأداء */}
          {community.evaluation.kpiIndicators.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-xs sm:text-sm text-stone-500">
              لم يتم تسجيل مؤشرات أداء (KPIs) في هذا المجتمع بعد.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
              <table
                data-testid="plc-f7-kpis-table"
                className="w-full text-right text-xs border-collapse"
              >
                <thead>
                  <tr className="bg-plc-soft text-plc border-b border-plc-border">
                    <th className="py-3 px-3 font-extrabold">المؤشر ووصفه</th>
                    <th className="py-3 px-3 font-extrabold">
                      العلاقات المرتبطة (بالـID)
                    </th>
                    <th className="py-3 px-3 font-extrabold">
                      خط الأساس / المستهدف / الفعلي
                    </th>
                    <th className="py-3 px-3 font-extrabold">
                      طريقة الحساب والمصدر والفترة
                    </th>
                    <th className="py-3 px-3 font-extrabold text-center">
                      نسبة الإنجاز المحسوبة
                    </th>
                    {!readOnly && (
                      <th className="py-3 px-3 font-extrabold text-center">
                        إجراءات
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {community.evaluation.kpiIndicators.map((kpi, idx) => {
                    const resolved = resolvePlcKpiIndicatorLinks(
                      kpi,
                      community
                    );
                    return (
                      <tr key={kpi.id} data-testid={`plc-f7-kpi-row-${idx}`}>
                        <td className="py-3 px-3 max-w-[230px] space-y-1">
                          <div className="font-extrabold text-stone-900 text-xs sm:text-sm">
                            {kpi.name}
                          </div>
                          {kpi.description && (
                            <p className="text-[11px] text-stone-600">
                              {kpi.description}
                            </p>
                          )}
                          <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[10px] font-bold">
                            {resolved.indicatorTypeLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-[250px] space-y-1 text-[11px]">
                          <div>
                            <strong className="text-stone-700">الهدف:</strong>{' '}
                            {resolved.linkedGoalDisplay}
                          </div>
                          <div>
                            <strong className="text-stone-700">
                              الاحتياج:
                            </strong>{' '}
                            {resolved.linkedNeedDisplay}
                          </div>
                          <div>
                            <strong className="text-stone-700">الإجراء:</strong>{' '}
                            {resolved.linkedActionDisplay}
                          </div>
                          <div>
                            <strong className="text-stone-700">النشاط:</strong>{' '}
                            {resolved.linkedActivityDisplay}
                          </div>
                        </td>
                        <td className="py-3 px-3 space-y-1 text-[11px] tabular-nums">
                          <div>
                            <strong className="text-stone-700">
                              خط الأساس:
                            </strong>{' '}
                            {resolved.achievement.baselineDisplay}
                          </div>
                          <div>
                            <strong className="text-stone-700">
                              المستهدف:
                            </strong>{' '}
                            {resolved.achievement.targetDisplay}
                          </div>
                          <div>
                            <strong className="text-stone-700">الفعلي:</strong>{' '}
                            <span className="font-extrabold text-stone-900">
                              {resolved.achievement.actualDisplay}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-[220px] space-y-1 text-[11px]">
                          <div>
                            <strong className="text-stone-700">
                              طريقة الحساب:
                            </strong>{' '}
                            {kpi.calculationMethod || 'غير متوفر'}
                          </div>
                          <div>
                            <strong className="text-stone-700">المصدر:</strong>{' '}
                            {kpi.dataSource || 'غير متوفر'}
                          </div>
                          <div>
                            <strong className="text-stone-700">الفترة:</strong>{' '}
                            {kpi.measurementPeriod || 'غير متوفر'}
                            {kpi.measurementDate
                              ? ` (${kpi.measurementDate})`
                              : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            data-testid={`plc-f7-kpi-achievement-${idx}`}
                            className={`inline-block px-2.5 py-1 rounded-lg text-xs font-extrabold tabular-nums ${
                              resolved.achievement.isCalculated
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-stone-100 text-stone-700 border border-stone-200'
                            }`}
                          >
                            {resolved.achievement.statusText}
                          </span>
                        </td>
                        {!readOnly && (
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                data-testid={`plc-f7-edit-kpi-btn-${idx}`}
                                onClick={() => handleStartEditKpi(kpi)}
                                aria-label={`تعديل مؤشر ${kpi.name}`}
                                className="p-1.5 rounded-lg text-stone-600 hover:text-plc hover:bg-plc-soft cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {confirmDeleteKpiId === kpi.id ? (
                                <button
                                  type="button"
                                  data-testid={`plc-f7-confirm-delete-kpi-btn-${idx}`}
                                  onClick={() => handleConfirmDeleteKpi(kpi.id)}
                                  className="px-2 py-1 rounded-md bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  تأكيد
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  data-testid={`plc-f7-delete-kpi-btn-${idx}`}
                                  onClick={() => setConfirmDeleteKpiId(kpi.id)}
                                  aria-label={`حذف مؤشر ${kpi.name}`}
                                  className="p-1.5 rounded-lg text-stone-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* القسم 7.3: قياس الأثر (تنفيذ النشاط ≠ تحقق الأثر)                */}
        {/* ================================================================= */}
        <div
          data-testid="plc-f7-section-impact"
          className="rounded-2xl border border-stone-200 bg-stone-50/60 p-5 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-3">
            <div>
              <span className="text-xs font-extrabold text-plc">
                القسم 7.3
              </span>
              <h4 className="text-base sm:text-lg font-extrabold font-display text-stone-900">
                7.3 سجل قياس الأثر وقرارات التحسين
              </h4>
              <p className="text-xs text-stone-600 mt-0.5">
                القاعدة المنهجية: <strong>تنفيذ النشاط ≠ تحقق الأثر</strong>.
                يُوثق هنا الأثر الفعلي المقاس على ممارسات المعلمين أو تعلم
                الطلاب بالأدوات والشواهد، مع تحديد قرار التحسين المبني على
                النتائج.
              </p>
            </div>
            <span className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums">
              سجلات قياس الأثر: {community.evaluation.impactMeasurements.length}
            </span>
          </div>

          {impactValidationError && (
            <div
              data-testid="plc-f7-impact-error"
              className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-bold text-red-800 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{impactValidationError}</span>
            </div>
          )}

          {/* نموذج إضافة / تعديل قياس أثر */}
          {!readOnly && (
          <form
            onSubmit={handleSubmitImpact}
            className="bg-white rounded-xl border border-stone-200 p-4 space-y-4"
          >
            <h5 className="text-xs sm:text-sm font-extrabold text-stone-900">
              {editingImpactId
                ? 'تعديل سجل قياس الأثر المحدد'
                : 'إضافة سجل قياس أثر جديد'}
            </h5>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* العلاقات بالـIDs */}
              <div>
                <label
                  htmlFor="plc-f7-impact-goal"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  الهدف المرتبط (النموذج 2)
                </label>
                <select
                  id="plc-f7-impact-goal"
                  data-testid="plc-f7-impact-goal-select"
                  value={impactGoalId}
                  onChange={(e) => setImpactGoalId(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                >
                  <option value="">— اختر الهدف المرتبط —</option>
                  {community.identity.goals.map((g, idx) => (
                    <option key={g.id} value={g.id}>
                      هدف {idx + 1}: {g.text}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="plc-f7-impact-need"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  الاحتياج المرتبط، إن وجد (النموذج 3)
                </label>
                <select
                  id="plc-f7-impact-need"
                  data-testid="plc-f7-impact-need-select"
                  value={impactNeedId}
                  onChange={(e) => setImpactNeedId(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                >
                  <option value="">— غير مرتبط باحتياج —</option>
                  {community.needs.map((n, idx) => (
                    <option key={n.id} value={n.id}>
                      احتياج {idx + 1}: {n.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="plc-f7-impact-action"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  الإجراء المرتبط (النموذج 4)
                </label>
                <select
                  id="plc-f7-impact-action"
                  data-testid="plc-f7-impact-action-select"
                  value={impactActionId}
                  onChange={(e) =>
                    handleSelectImpactActionAutoFill(e.target.value)
                  }
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                >
                  <option value="">— اختر الإجراء المرتبط —</option>
                  {community.operationalPlan.map((a, idx) => (
                    <option key={a.id} value={a.id}>
                      إجراء {idx + 1}: {a.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="plc-f7-impact-activity"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  البرنامج / النشاط المرتبط، إن وجد (النموذج 6)
                </label>
                <select
                  id="plc-f7-impact-activity"
                  data-testid="plc-f7-impact-activity-select"
                  value={impactActivityId}
                  onChange={(e) => setImpactActivityId(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                >
                  <option value="">— غير مرتبط بنشاط —</option>
                  {community.activities.map((act) => (
                    <option key={act.id} value={act.id}>
                      [{PLC_ACTIVITY_TYPE_LABELS[act.type]}] {act.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="plc-f7-impact-beneficiary"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  الفئة المستهدفة
                </label>
                <input
                  id="plc-f7-impact-beneficiary"
                  data-testid="plc-f7-impact-beneficiary-input"
                  type="text"
                  value={impactBeneficiary}
                  onChange={(e) => setImpactBeneficiary(e.target.value)}
                  placeholder="مثال: معلمو التخصص / طلاب الصف الثاني"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f7-impact-method"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  طريقة القياس
                </label>
                <select
                  id="plc-f7-impact-method"
                  data-testid="plc-f7-impact-method-select"
                  value={impactMethod}
                  onChange={(e) => setImpactMethod(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                >
                  {(
                    Object.entries(PLC_IMPACT_METHOD_LABELS) as [
                      PlcImpactMeasurementMethod,
                      string,
                    ][]
                  ).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {impactMethod === 'other' && (
                <div>
                  <label
                    htmlFor="plc-f7-impact-custom-method"
                    className="block text-xs font-extrabold text-stone-800 mb-1"
                  >
                    تحديد طريقة القياس الأخرى
                  </label>
                  <input
                    id="plc-f7-impact-custom-method"
                    type="text"
                    value={impactCustomMethod}
                    onChange={(e) => setImpactCustomMethod(e.target.value)}
                    placeholder="اكتب طريقة القياس..."
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="plc-f7-impact-tool"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  أداة القياس
                </label>
                <input
                  id="plc-f7-impact-tool"
                  data-testid="plc-f7-impact-tool-input"
                  type="text"
                  value={impactTool}
                  onChange={(e) => setImpactTool(e.target.value)}
                  placeholder="مثال: بطاقة ملاحظة صفية / اختبار قبلي-بعدي"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f7-impact-date"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  تاريخ القياس
                </label>
                <input
                  id="plc-f7-impact-date"
                  type="date"
                  value={impactMeasurementDate}
                  onChange={(e) => setImpactMeasurementDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 tabular-nums"
                />
              </div>

              {/* خط الأساس والمستهدف والنتيجة الفعلية ووحدة القياس */}
              <div>
                <label
                  htmlFor="plc-f7-impact-baseline"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  خط الأساس (Baseline)
                </label>
                <input
                  id="plc-f7-impact-baseline"
                  data-testid="plc-f7-impact-baseline-input"
                  type="number"
                  step="any"
                  value={impactBaselineVal}
                  onChange={(e) => setImpactBaselineVal(e.target.value)}
                  placeholder="غير متوفر إن ترك فارغاً"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f7-impact-target"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  المستهدف (Target)
                </label>
                <input
                  id="plc-f7-impact-target"
                  data-testid="plc-f7-impact-target-input"
                  type="number"
                  step="any"
                  value={impactTargetVal}
                  onChange={(e) => setImpactTargetVal(e.target.value)}
                  placeholder="المستهدف..."
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f7-impact-actual"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  النتيجة الفعلية (Actual)
                </label>
                <input
                  id="plc-f7-impact-actual"
                  data-testid="plc-f7-impact-actual-input"
                  type="number"
                  step="any"
                  value={impactActualVal}
                  onChange={(e) => setImpactActualVal(e.target.value)}
                  placeholder="لم يتم القياس إن ترك فارغاً"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f7-impact-unit"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  وحدة القياس
                </label>
                <select
                  id="plc-f7-impact-unit"
                  value={impactUnit}
                  onChange={(e) => setImpactUnit(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                >
                  {PLC_KPI_UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="plc-f7-impact-results"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  وصف النتائج
                </label>
                <input
                  id="plc-f7-impact-results"
                  data-testid="plc-f7-impact-results-input"
                  type="text"
                  value={impactResultsText}
                  onChange={(e) => setImpactResultsText(e.target.value)}
                  placeholder="مثال: ارتفاع متوسط درجات الطلاب في الفهم النقدي من 62% إلى 81%"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="plc-f7-impact-observed"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  وصف الأثر المتحقق (التغير الملاحظ)
                </label>
                <input
                  id="plc-f7-impact-observed"
                  data-testid="plc-f7-impact-observed-input"
                  type="text"
                  value={impactObservedDescription}
                  onChange={(e) => setImpactObservedDescription(e.target.value)}
                  placeholder="مثال: تحسن ملموس في توظيف المعلمين لاستراتيجيات التساؤل السقراطي داخل الحصص"
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                />
              </div>

              <div>
                <label
                  htmlFor="plc-f7-impact-decision"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  قرار التحسين المبني على الأثر
                </label>
                <select
                  id="plc-f7-impact-decision"
                  data-testid="plc-f7-impact-decision-select"
                  value={impactDecision}
                  onChange={(e) => setImpactDecision(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                >
                  {(
                    Object.entries(PLC_IMPROVEMENT_DECISION_LABELS) as [
                      PlcImprovementDecisionType,
                      string,
                    ][]
                  ).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {impactDecision === 'other' && (
                <div>
                  <label
                    htmlFor="plc-f7-impact-custom-decision"
                    className="block text-xs font-extrabold text-stone-800 mb-1"
                  >
                    تحديد قرار التحسين الآخر
                  </label>
                  <input
                    id="plc-f7-impact-custom-decision"
                    type="text"
                    value={impactCustomDecision}
                    onChange={(e) => setImpactCustomDecision(e.target.value)}
                    placeholder="اكتب قرار التحسين..."
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label
                  htmlFor="plc-f7-impact-notes"
                  className="block text-xs font-extrabold text-stone-800 mb-1"
                >
                  ملاحظات وتفاصيل التحسين
                </label>
                <input
                  id="plc-f7-impact-notes"
                  type="text"
                  value={impactNotes}
                  onChange={(e) => setImpactNotes(e.target.value)}
                  placeholder="ملاحظات إضافية..."
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
                />
              </div>
            </div>

            {/* اختيار الشواهد المرتبطة من مستودع الشواهد الموحد بالـID */}
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-stone-800">
                  الشواهد المرتبطة بقياس الأثر (اختيار من مستودع الشواهد الموحد
                  بالـID دون تكرار الرفع):
                </span>
                <button
                  type="button"
                  onClick={() => onSelectFormNumber(8)}
                  className="text-xs font-bold text-plc hover:underline cursor-pointer"
                >
                  فتح مستودع الشواهد (النموذج 8) لإضافة شواهد جديدة
                </button>
              </div>
              {community.evidenceRepository.length === 0 ? (
                <p className="text-xs text-stone-500">
                  لا توجد شواهد مضافة في مستودع المجتمع بعد. يمكنك إضافة الشواهد
                  من النموذج الثامن أو من داخل سجلات الاجتماعات والتنفيذ.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {community.evidenceRepository.map((ev) => {
                    const selected = impactSelectedEvidenceIds.includes(ev.id);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        data-testid={`plc-f7-impact-evd-toggle-${ev.id}`}
                        onClick={() => handleToggleImpactEvidence(ev.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                          selected
                            ? 'bg-plc text-white border-plc'
                            : 'bg-stone-50 text-stone-800 border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        <Paperclip className="w-3.5 h-3.5 shrink-0" />
                        <span>{ev.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                data-testid="plc-f7-save-impact-btn"
                className="min-h-[40px] px-5 py-2 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {editingImpactId
                    ? 'حفظ تعديلات سجل قياس الأثر'
                    : 'إضافة سجل قياس الأثر للجدول'}
                </span>
              </button>
              {editingImpactId && (
                <button
                  type="button"
                  onClick={resetImpactForm}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer"
                >
                  إلغاء التعديل
                </button>
              )}
            </div>
          </form>
          )}

          {/* جدول سجلات قياس الأثر */}
          {community.evaluation.impactMeasurements.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-xs sm:text-sm text-stone-500">
              لم يتم تسجيل قياسات أثر بعد. تذكر أن تنفيذ الأنشطة لا ينشئ أثراً
              تلقائياً إلا بعد قياسه وتوثيقه.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
              <table
                data-testid="plc-f7-impacts-table"
                className="w-full text-right text-xs border-collapse"
              >
                <thead>
                  <tr className="bg-plc-soft text-plc border-b border-plc-border">
                    <th className="py-3 px-3 font-extrabold">
                      العلاقات المرتبطة (بالـID)
                    </th>
                    <th className="py-3 px-3 font-extrabold">
                      الفئة وطريقة وأداة القياس
                    </th>
                    <th className="py-3 px-3 font-extrabold">
                      خط الأساس / المستهدف / النتيجة الفعلية
                    </th>
                    <th className="py-3 px-3 font-extrabold">
                      وصف النتائج والأثر المتحقق
                    </th>
                    <th className="py-3 px-3 font-extrabold">
                      الشواهد وقرار التحسين
                    </th>
                    {!readOnly && (
                      <th className="py-3 px-3 font-extrabold text-center">
                        إجراءات
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {community.evaluation.impactMeasurements.map((imp, idx) => {
                    const resolved = resolvePlcImpactMeasurementLinks(
                      imp,
                      community
                    );
                    return (
                      <tr key={imp.id} data-testid={`plc-f7-impact-row-${idx}`}>
                        <td className="py-3 px-3 max-w-[230px] space-y-1 text-[11px]">
                          <div>
                            <strong className="text-stone-700">الهدف:</strong>{' '}
                            {resolved.linkedGoalDisplay}
                          </div>
                          <div>
                            <strong className="text-stone-700">
                              الاحتياج:
                            </strong>{' '}
                            {resolved.linkedNeedDisplay}
                          </div>
                          <div>
                            <strong className="text-stone-700">الإجراء:</strong>{' '}
                            {resolved.linkedActionDisplay}
                          </div>
                          <div>
                            <strong className="text-stone-700">النشاط:</strong>{' '}
                            {resolved.linkedActivityDisplay}
                          </div>
                        </td>
                        <td className="py-3 px-3 space-y-1 text-[11px]">
                          <div className="font-extrabold text-stone-900">
                            الفئة: {imp.beneficiaryCategory || 'غير متوفر'}
                          </div>
                          <div>
                            <strong className="text-stone-700">الطريقة:</strong>{' '}
                            {resolved.methodDisplay}
                          </div>
                          <div>
                            <strong className="text-stone-700">الأداة:</strong>{' '}
                            {imp.measurementTool || 'غير متوفر'}
                          </div>
                          <div className="tabular-nums text-stone-500">
                            التاريخ: {imp.measurementDate || 'غير متوفر'}
                          </div>
                        </td>
                        <td className="py-3 px-3 space-y-1 text-[11px] tabular-nums">
                          <div>
                            <strong className="text-stone-700">
                              خط الأساس:
                            </strong>{' '}
                            {resolved.baselineDisplay}
                          </div>
                          <div>
                            <strong className="text-stone-700">
                              المستهدف:
                            </strong>{' '}
                            {resolved.targetDisplay}
                          </div>
                          <div>
                            <strong className="text-stone-700">
                              النتيجة الفعلية:
                            </strong>{' '}
                            <span className="font-extrabold text-stone-900">
                              {resolved.actualDisplay}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-[240px] space-y-1.5 text-[11px]">
                          <div>
                            <strong className="text-stone-700">النتائج:</strong>{' '}
                            {imp.measurementResults || 'غير متوفر'}
                          </div>
                          <div>
                            <strong className="text-plc">
                              وصف الأثر:
                            </strong>{' '}
                            <span className="font-bold text-stone-900">
                              {imp.observedChangeDescription || 'غير متوفر'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 max-w-[220px] space-y-1.5 text-[11px]">
                          <div>
                            <span className="inline-block px-2.5 py-0.5 rounded-md bg-plc-soft text-plc font-extrabold">
                              قرار التحسين: {resolved.decisionDisplay}
                            </span>
                          </div>
                          {resolved.supportingEvidences.length === 0 ? (
                            <div className="text-stone-400">
                              لا توجد شواهد مرتبطة
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {resolved.supportingEvidences.map((ev) => (
                                <span
                                  key={ev.id}
                                  className="px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-stone-800 text-[10px] font-bold"
                                >
                                  {ev.title}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        {!readOnly && (
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                data-testid={`plc-f7-edit-impact-btn-${idx}`}
                                onClick={() => handleStartEditImpact(imp)}
                                aria-label={`تعديل قياس أثر ${idx + 1}`}
                                className="p-1.5 rounded-lg text-stone-600 hover:text-plc hover:bg-plc-soft cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {confirmDeleteImpactId === imp.id ? (
                                <button
                                  type="button"
                                  data-testid={`plc-f7-confirm-delete-impact-btn-${idx}`}
                                  onClick={() =>
                                    handleConfirmDeleteImpact(imp.id)
                                  }
                                  className="px-2 py-1 rounded-md bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  تأكيد
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  data-testid={`plc-f7-delete-impact-btn-${idx}`}
                                  onClick={() => setConfirmDeleteImpactId(imp.id)}
                                  aria-label={`حذف قياس أثر ${idx + 1}`}
                                  className="p-1.5 rounded-lg text-stone-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {renderBatch4NavigationFooter()}
      </section>
    );
  }

  // ==========================================================================
  // العرض 2: النموذج الثامن — الشواهد والمرفقات (المستودع الموحد)
  // ==========================================================================
  return (
    <section
      data-testid="plc-form-8-container"
      className="bg-white rounded-2xl border-2 border-plc/30 p-5 sm:p-7 space-y-6"
    >
      {/* ترويسة النموذج الثامن */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold">
            <FolderArchive className="w-3.5 h-3.5" />
            <span>الدفعة الرابعة: التوثيق الموحد • النموذج ٨</span>
          </span>
          <h3 className="text-lg sm:text-xl font-extrabold font-display text-stone-900">
            النموذج الثامن: مستودع الشواهد والمرفقات الموحد
          </h3>
          <p className="text-xs sm:text-sm text-stone-600">
            مستودع مركزي لجميع شواهد المجتمع؛ يتيح ربط الشاهد الواحد بأكثر من
            موضع (احتياج، هدف، إجراء، اجتماع، برنامج، نشاط، زيارة، شراكة، مؤشر
            أداء، قياس أثر) بالـID دون إعادة رفع الملف.
          </p>
        </div>
        <span
          data-testid="plc-f8-total-evidences-badge"
          className="px-3 py-1 rounded-lg bg-plc-soft text-plc text-xs font-extrabold tabular-nums"
        >
          إجمالي الشواهد في المستودع: {community.evidenceRepository.length}
        </span>
      </div>

      {evdValidationError && (
        <div
          data-testid="plc-f8-validation-error"
          className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs font-bold text-red-800 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{evdValidationError}</span>
        </div>
      )}

      {/* نموذج إضافة / تعديل شاهد في المستودع الموحد */}
      {!readOnly && (
      <form
        onSubmit={handleSubmitEvidenceRepository}
        className="rounded-2xl border border-stone-200 bg-stone-50/70 p-5 space-y-4"
      >
        <h4 className="text-sm sm:text-base font-extrabold font-display text-stone-900">
          {editingEvidenceId
            ? 'تعديل بيانات الشاهد في المستودع الموحد'
            : 'إضافة شاهد جديد إلى مستودع الشواهد الموحد'}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label
              htmlFor="plc-f8-evd-title"
              className="block text-xs font-extrabold text-stone-800 mb-1"
            >
              اسم الشاهد *
            </label>
            <input
              id="plc-f8-evd-title"
              data-testid="plc-f8-evd-title-input"
              type="text"
              value={evdTitle}
              onChange={(e) => setEvdTitle(e.target.value)}
              placeholder="مثال: نتائج الاستبانة القبلية والبعدية / محضر الاجتماع الثالث"
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
            />
          </div>

          <div>
            <label
              htmlFor="plc-f8-evd-type"
              className="block text-xs font-extrabold text-stone-800 mb-1"
            >
              نوع الشاهد
            </label>
            <select
              id="plc-f8-evd-type"
              data-testid="plc-f8-evd-type-select"
              value={evdType}
              onChange={(e) => setEvdType(e.target.value as PlcEvidenceType)}
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
            >
              {(
                Object.entries(PLC_EVIDENCE_TYPE_LABELS) as [
                  PlcEvidenceType,
                  string,
                ][]
              ).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="plc-f8-evd-date"
              className="block text-xs font-extrabold text-stone-800 mb-1"
            >
              تاريخ الشاهد
            </label>
            <input
              id="plc-f8-evd-date"
              data-testid="plc-f8-evd-date-input"
              type="date"
              value={evdDate}
              onChange={(e) => setEvdDate(e.target.value)}
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 tabular-nums"
            />
          </div>

          <div>
            <label
              htmlFor="plc-f8-evd-source"
              className="block text-xs font-extrabold text-stone-800 mb-1"
            >
              مصدر / جهة الشاهد (إن وجد)
            </label>
            <input
              id="plc-f8-evd-source"
              data-testid="plc-f8-evd-source-input"
              type="text"
              value={evdSourceEntity}
              onChange={(e) => setEvdSourceEntity(e.target.value)}
              placeholder="مثال: لجنة التطوير المهني / إدارة المدرسة"
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="plc-f8-evd-desc"
              className="block text-xs font-extrabold text-stone-800 mb-1"
            >
              وصف الشاهد
            </label>
            <input
              id="plc-f8-evd-desc"
              data-testid="plc-f8-evd-desc-input"
              type="text"
              value={evdDescription}
              onChange={(e) => setEvdDescription(e.target.value)}
              placeholder="وصف موجز لمضمون الشاهد..."
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
            />
          </div>

          <div>
            <label
              htmlFor="plc-f8-evd-url"
              className="block text-xs font-extrabold text-stone-800 mb-1"
            >
              الرابط الإلكتروني (عند اختيار رابط أو مرفق سحابي)
            </label>
            <input
              id="plc-f8-evd-url"
              data-testid="plc-f8-evd-url-input"
              type="url"
              value={evdExternalUrl}
              onChange={(e) => setEvdExternalUrl(e.target.value)}
              placeholder="https://..."
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="plc-f8-evd-file"
              className="block text-xs font-extrabold text-stone-800 mb-1"
            >
              رفع الملف أو المرفق (PDF / صورة / مستند / عرض / جدول)
            </label>
            <div className="flex items-center gap-2">
              <label
                htmlFor="plc-f8-evd-file"
                className="min-h-[40px] px-4 py-2 rounded-xl border border-plc-border bg-white hover:bg-plc-soft text-plc text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>
                  {evdFileName ? `الملف: ${evdFileName}` : 'اختيار ملف مرفق'}
                </span>
              </label>
              <input
                id="plc-f8-evd-file"
                type="file"
                onChange={handleEvidenceFileSelection}
                className="hidden"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="plc-f8-evd-notes"
              className="block text-xs font-extrabold text-stone-800 mb-1"
            >
              ملاحظات
            </label>
            <input
              id="plc-f8-evd-notes"
              type="text"
              value={evdNotes}
              onChange={(e) => setEvdNotes(e.target.value)}
              placeholder="ملاحظات إضافية..."
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
            />
          </div>
        </div>

        {/* ربط الشاهد مباشرة بواحد أو أكثر من السجلات عند إضافته */}
        {!editingEvidenceId && (
          <div className="bg-white rounded-xl border border-stone-200 p-3.5 space-y-2.5">
            <span className="block text-xs font-extrabold text-stone-800">
              ربط الشاهد بسجل أو أكثر داخل المجتمع (بالـID دون تكرار الملف):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <select
                data-testid="plc-f8-initial-link-type"
                value={newLinkTargetType}
                onChange={(e) => {
                  setNewLinkTargetType(
                    e.target.value as PlcEvidenceLinkTargetType
                  );
                  setNewLinkTargetId('');
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-900"
              >
                {(
                  Object.entries(PLC_EVIDENCE_TARGET_TYPE_LABELS) as [
                    PlcEvidenceLinkTargetType,
                    string,
                  ][]
                ).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                data-testid="plc-f8-initial-link-target"
                value={newLinkTargetId}
                onChange={(e) => setNewLinkTargetId(e.target.value)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900"
              >
                <option value="">— اختر السجل المراد الربط به —</option>
                {getAvailableTargetsForType(newLinkTargetType).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                data-testid="plc-f8-add-initial-link-btn"
                onClick={handleAddPendingInitialLink}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-plc-soft hover:bg-plc-soft-hover text-plc text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>إضافة الارتباط للقائمة</span>
              </button>
            </div>

            {pendingInitialLinks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {pendingInitialLinks.map((lnk, idx) => (
                  <span
                    key={`${lnk.targetType}-${lnk.targetId}-${idx}`}
                    className="px-2.5 py-1 rounded-lg bg-plc-soft text-plc text-[11px] font-bold inline-flex items-center gap-1.5"
                  >
                    <span>
                      {PLC_EVIDENCE_TARGET_TYPE_LABELS[lnk.targetType]}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingInitialLinks((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="text-red-700 hover:text-red-900 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="submit"
            data-testid="plc-f8-save-evidence-btn"
            className="min-h-[42px] px-5 py-2 rounded-xl bg-plc hover:bg-plc-hover text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>
              {editingEvidenceId
                ? 'حفظ تعديلات الشاهد في المستودع'
                : 'إضافة الشاهد إلى المستودع الموحد'}
            </span>
          </button>
          {editingEvidenceId && (
            <button
              type="button"
              onClick={resetEvidenceForm}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer"
            >
              إلغاء التعديل
            </button>
          )}
        </div>
      </form>
      )}

      {/* شريط البحث والتصفية والترتيب في مستودع الشواهد */}
      <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            data-testid="plc-f8-search-input"
            value={repoSearchQuery}
            onChange={(e) => setRepoSearchQuery(e.target.value)}
            placeholder="بحث باسم الشاهد أو الوصف..."
            className="w-full min-h-[40px] pr-10 pl-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
          />
        </div>

        <div>
          <select
            data-testid="plc-f8-filter-type"
            value={repoTypeFilter}
            onChange={(e) =>
              setRepoTypeFilter(e.target.value as PlcEvidenceType | 'all')
            }
            className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
          >
            <option value="all">جميع أنواع الشواهد</option>
            {(
              Object.entries(PLC_EVIDENCE_TYPE_LABELS) as [
                PlcEvidenceType,
                string,
              ][]
            ).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            data-testid="plc-f8-filter-target"
            value={repoTargetFilter}
            onChange={(e) =>
              setRepoTargetFilter(
                e.target.value as PlcEvidenceLinkTargetType | 'all' | 'unlinked'
              )
            }
            className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
          >
            <option value="all">جميع أنواع السجلات المرتبطة</option>
            <option value="unlinked">شواهد غير مرتبطة بأي سجل</option>
            {(
              Object.entries(PLC_EVIDENCE_TARGET_TYPE_LABELS) as [
                PlcEvidenceLinkTargetType,
                string,
              ][]
            ).map(([key, label]) => (
              <option key={key} value={key}>
                مرتبط بـ: {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <input
            type="date"
            data-testid="plc-f8-filter-date"
            value={repoDateFilter}
            onChange={(e) => setRepoDateFilter(e.target.value)}
            aria-label="تصفية الشواهد حسب التاريخ"
            className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900 tabular-nums"
          />
        </div>

        <div>
          <select
            data-testid="plc-f8-sort-select"
            value={repoSortBy}
            onChange={(e) =>
              setRepoSortBy(e.target.value as 'newest' | 'oldest')
            }
            className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs sm:text-sm text-stone-900"
          >
            <option value="newest">الترتيب: الأحدث أولاً</option>
            <option value="oldest">الترتيب: الأقدم أولاً</option>
          </select>
        </div>
      </div>

      {/* قائمة الشواهد في المستودع الموحد مع عرض العلاقات وإدارتها */}
      {filteredRepositoryEvidences.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-7 text-center text-xs sm:text-sm text-stone-500">
          {community.evidenceRepository.length === 0
            ? 'مستودع الشواهد فارغ حالياً في هذا المجتمع. أضف شاهداً من النموذج أعلاه أو من داخل الاجتماعات وسجلات التنفيذ.'
            : 'لا توجد شواهد مطابقة لمعايير البحث أو التصفية المحددة.'}
        </div>
      ) : (
        <div className="space-y-4" data-testid="plc-f8-repository-list">
          {filteredRepositoryEvidences.map((ev, idx) => {
            const relations = resolvePlcEvidenceLinks(ev, community);
            const effectiveType =
              ev.evidenceType ??
              inferPlcEvidenceTypeFromMimeOrUrl(
                ev.mimeType,
                ev.fileName,
                ev.externalUrl
              );
            const isLinkingOpen = activeLinkingEvidenceId === ev.id;

            return (
              <article
                key={ev.id}
                data-testid={`plc-f8-evidence-card-${idx}`}
                className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-plc-soft text-plc text-xs font-extrabold">
                        {PLC_EVIDENCE_TYPE_LABELS[effectiveType]}
                      </span>
                      <span
                        data-testid={`plc-f8-evidence-relations-count-${idx}`}
                        className="px-2.5 py-0.5 rounded-md bg-stone-100 text-stone-800 text-xs font-extrabold tabular-nums"
                      >
                        عدد العلاقات المرتبطة: {relations.length}
                      </span>
                      <span className="text-xs text-stone-500 tabular-nums">
                        تاريخ الشاهد:{' '}
                        {ev.evidenceDate || ev.createdAt.slice(0, 10)}
                      </span>
                      {ev.sourceOrEntity && (
                        <span className="text-xs text-stone-600 font-semibold">
                          • الجهة/المصدر: {ev.sourceOrEntity}
                        </span>
                      )}
                    </div>

                    <h5 className="text-sm sm:text-base font-extrabold font-display text-stone-900">
                      {ev.title}
                    </h5>
                    {ev.description && (
                      <p className="text-xs text-stone-600">{ev.description}</p>
                    )}
                    {ev.fileName && (
                      <div className="text-[11px] text-stone-500">
                        الملف المرفق: <strong>{ev.fileName}</strong>{' '}
                        {ev.mimeType ? `(${ev.mimeType})` : ''}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {(ev.fileDataUrl || ev.externalUrl) && (
                      <button
                        type="button"
                        data-testid={`plc-f8-preview-evd-btn-${idx}`}
                        onClick={() => setPreviewEvidenceModal(ev)}
                        className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>معاينة المرفق</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setQrModalEvidence(ev)}
                      className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR</span>
                    </button>

                    {!readOnly && (
                      <>
                        <button
                          type="button"
                          data-testid={`plc-f8-link-more-btn-${idx}`}
                          onClick={() => {
                            setActiveLinkingEvidenceId(
                              isLinkingOpen ? null : ev.id
                            );
                            setRepoLinkError(null);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-plc-soft hover:bg-plc-soft-hover text-plc text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>ربط بسجل إضافي</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`plc-f8-edit-evd-btn-${idx}`}
                          onClick={() => handleStartEditEvidence(ev)}
                          aria-label={`تعديل الشاهد ${ev.title}`}
                          className="p-2 rounded-xl text-stone-600 hover:text-plc hover:bg-plc-soft cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          data-testid={`plc-f8-delete-evd-btn-${idx}`}
                          onClick={() => handleInitiateDeleteEvidence(ev)}
                          aria-label={`حذف الشاهد ${ev.title}`}
                          className="p-2 rounded-xl text-stone-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* عرض كل الأماكن والسجلات التي تم ربط الشاهد بها بالـID */}
                <div className="rounded-xl bg-stone-50 border border-stone-200/80 p-3 space-y-2">
                  <div className="text-xs font-extrabold text-stone-800">
                    السجلات المرتبطة بهذا الشاهد (بدون تكرار رفع الملف):
                  </div>
                  {relations.length === 0 ? (
                    <div className="text-xs text-stone-500">
                      غير مرتبط بأي سجل حالياً (محفوظ في المستودع العام للمجتمع).
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {relations.map((rel, rIdx) => (
                        <div
                          key={`${rel.targetType}-${rel.targetId}-${rIdx}`}
                          className="px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs flex items-center gap-2"
                        >
                          <span className="font-extrabold text-plc">
                            {rel.targetTypeLabel}:
                          </span>
                          <span className="font-semibold text-stone-900">
                            {rel.targetDisplayTitle}
                          </span>
                          {!readOnly && (
                            <button
                              type="button"
                              data-testid={`plc-f8-unlink-btn-${idx}-${rIdx}`}
                              onClick={() =>
                                handleUnlinkSingleRelation(
                                  ev.id,
                                  rel.targetType,
                                  rel.targetId
                                )
                              }
                              title="فك ارتباط هذا السجل فقط دون حذف الشاهد من المستودع"
                              aria-label={`فك ارتباط ${rel.targetDisplayTitle}`}
                              className="text-stone-400 hover:text-red-700 cursor-pointer"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* لوحة ربط الشاهد الموجود بسجل إضافي داخل المجتمع */}
                {isLinkingOpen && (
                  <div className="rounded-xl border border-plc-border bg-plc-soft/50 p-3.5 space-y-2.5">
                    <div className="text-xs font-extrabold text-plc">
                      اختيار سجل إضافي لربط الشاهد «{ev.title}» به بالـID:
                    </div>
                    {repoLinkError && (
                      <div className="text-xs font-bold text-red-700">
                        {repoLinkError}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        data-testid={`plc-f8-repo-link-type-${idx}`}
                        value={repoLinkTargetType}
                        onChange={(e) => {
                          setRepoLinkTargetType(
                            e.target.value as PlcEvidenceLinkTargetType
                          );
                          setRepoLinkTargetId('');
                        }}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-900"
                      >
                        {(
                          Object.entries(PLC_EVIDENCE_TARGET_TYPE_LABELS) as [
                            PlcEvidenceLinkTargetType,
                            string,
                          ][]
                        ).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>

                      <select
                        data-testid={`plc-f8-repo-link-target-${idx}`}
                        value={repoLinkTargetId}
                        onChange={(e) => setRepoLinkTargetId(e.target.value)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl border border-stone-300 bg-white text-xs text-stone-900"
                      >
                        <option value="">— اختر السجل —</option>
                        {getAvailableTargetsForType(repoLinkTargetType).map(
                          (t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          )
                        )}
                      </select>

                      <button
                        type="button"
                        data-testid={`plc-f8-confirm-repo-link-btn-${idx}`}
                        onClick={() => handleLinkExistingEvidenceInRepo(ev.id)}
                        className="min-h-[38px] px-4 py-1.5 rounded-xl bg-plc text-white text-xs font-extrabold cursor-pointer"
                      >
                        تأكيد الربط بالسجل
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* نافذة تأكيد حذف الشاهد (مع التحذير الإلزامي عند وجود سجلات مرتبطة) */}
      {pendingDeleteEvidence && (
        <div
          data-testid="plc-f8-delete-warning-modal"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-red-200 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h4 className="text-base font-extrabold font-display">
                تأكيد حذف الشاهد من المستودع
              </h4>
            </div>

            <p
              data-testid="plc-f8-delete-warning-message"
              className="text-xs sm:text-sm font-bold text-stone-800 leading-relaxed"
            >
              {pendingDeleteEvidence.warningMessage}
            </p>

            {pendingDeleteEvidence.requiresForceConfirmation && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                الشاهد <strong>«{pendingDeleteEvidence.evidence.title}»</strong>{' '}
                مرتبط حالياً بـ{' '}
                <strong>{pendingDeleteEvidence.linkedCount}</strong> سجل داخل
                المجتمع. عند التأكيد سيتم حذف الشاهد وإزالة جميع ارتباطاته حتى لا
                تبقى أي روابط مكسورة.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                data-testid="plc-f8-cancel-delete-evd-btn"
                onClick={() => setPendingDeleteEvidence(null)}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                data-testid="plc-f8-confirm-delete-evd-btn"
                onClick={handleConfirmDeleteEvidence}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-extrabold cursor-pointer"
              >
                حذف الشاهد وإزالة ارتباطاته
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة معاينة المرفق */}
      {previewEvidenceModal && (
        <div
          data-testid="plc-f8-preview-modal"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-stone-200 max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h4 className="text-base font-extrabold font-display text-stone-900">
                معاينة الشاهد: {previewEvidenceModal.title}
              </h4>
              <button
                type="button"
                onClick={() => setPreviewEvidenceModal(null)}
                className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {previewEvidenceModal.fileDataUrl &&
            previewEvidenceModal.mimeType?.startsWith('image/') ? (
              <img
                src={previewEvidenceModal.fileDataUrl}
                alt={previewEvidenceModal.title}
                className="max-h-[420px] w-auto mx-auto rounded-xl border border-stone-200"
              />
            ) : previewEvidenceModal.fileDataUrl &&
              previewEvidenceModal.mimeType?.includes('pdf') ? (
              <iframe
                src={previewEvidenceModal.fileDataUrl}
                title={previewEvidenceModal.title}
                className="w-full h-[420px] rounded-xl border border-stone-200"
              />
            ) : (
              <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 space-y-2 text-xs text-stone-700">
                <div>
                  <strong>اسم الملف:</strong>{' '}
                  {previewEvidenceModal.fileName || 'غير متوفر'}
                </div>
                <div>
                  <strong>النوع:</strong>{' '}
                  {previewEvidenceModal.mimeType || 'غير متوفر'}
                </div>
                {previewEvidenceModal.externalUrl && (
                  <div>
                    <strong>الرابط الإلكتروني:</strong>{' '}
                    <span className="font-mono break-all text-plc">
                      {previewEvidenceModal.externalUrl}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* نافذة رمز QR للشاهد (بمعرف آمن خالٍ من البيانات الحساسة) */}
      {qrModalEvidence && (
        <div
          data-testid="plc-f8-qr-modal"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-stone-200 max-w-sm w-full p-6 space-y-4 text-center shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h4 className="text-sm font-extrabold font-display text-stone-900">
                رمز QR للشاهد الموثق
              </h4>
              <button
                type="button"
                onClick={() => setQrModalEvidence(null)}
                className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <img
              src={generatePlcRecordQrSvgDataUrl(
                community.id,
                'activity',
                qrModalEvidence.id,
                qrModalEvidence.qrCodeToken || qrModalEvidence.id
              )}
              alt={`QR ${qrModalEvidence.title}`}
              className="w-44 h-44 mx-auto rounded-xl border border-plc-border p-2 bg-white"
            />

            <div className="text-xs font-extrabold text-stone-900">
              {qrModalEvidence.title}
            </div>
            <p className="text-[11px] text-stone-500 font-mono break-all">
              {buildPlcRecordQrPayload(
                community.id,
                'activity',
                qrModalEvidence.id,
                qrModalEvidence.qrCodeToken || qrModalEvidence.id
              )}
            </p>
          </div>
        </div>
      )}

      {renderBatch4NavigationFooter()}
    </section>
  );
};
