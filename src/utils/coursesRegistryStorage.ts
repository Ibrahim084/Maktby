import { FormValues, TableRowData } from '../types/forms';

export const SAVED_COURSES_STORAGE_KEY = 'maktabi_pd_saved_courses_v1';

/**
 * Stored summary of a completed training course for automatic recall in the Semester Final Report.
 * Strictly excludes images, signatures, drafts, and national IDs.
 */
export interface SavedTrainingCourse {
  id: string;
  academicYear: string;
  semester: string;
  programName: string;
  domain: string;
  executionDate: string;
  executionHijriDate?: string;
  location: string;
  beneficiariesCount: string;
  targetGroups?: string[];
  summaryDescription?: string;
  objectives?: string[];
  topics?: string[];
  trainingMethods?: string[];
  keyOutputs: string;
  outputsList?: string[];
  recommendations?: string[];
  executorName?: string;
  updatedAt: string;
}

function cleanStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

/**
 * Normalizes an academic year string (converting Arabic-Indic numerals ٠-٩ to 0-9
 * and stripping "هـ", spaces, and dashes) so minor formatting differences between forms
 * never hide saved courses.
 */
export function normalizeAcademicYearForMatch(rawYear: string): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  let out = (rawYear ?? '').trim();
  for (let i = 0; i < 10; i++) {
    out = out.replaceAll(arabicDigits[i], String(i));
  }
  return out
    .replace(/هـ/g, '')
    .replace(/[\s\-_/\\ـ.,]+/g, '')
    .toLowerCase();
}

export function sanitizeSavedCourse(raw: unknown): SavedTrainingCourse | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const pick = (val: unknown): string => {
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number' && !Number.isNaN(val)) return String(val);
    return '';
  };

  const programName = pick(obj.programName) || pick(obj.programTitle);
  if (!programName) return null;

  const semester = pick(obj.semester) || pick(obj.semesterName);
  // Enforce only First and Second semester (never Third semester)
  const validSemester =
    semester === 'الفصل الدراسي الثاني'
      ? 'الفصل الدراسي الثاني'
      : 'الفصل الدراسي الأول';

  const outputsList = cleanStringArray(obj.outputsList);
  const objectives = cleanStringArray(obj.objectives ?? obj.objectivesList);
  const topics = cleanStringArray(obj.topics ?? obj.topicsList);
  const recommendations = cleanStringArray(
    obj.recommendations ?? obj.recommendationsList
  );
  const targetGroups = cleanStringArray(obj.targetGroups);
  const trainingMethods = cleanStringArray(obj.trainingMethods);
  const summaryDescription = pick(obj.summaryDescription);

  const keyOutputs =
    pick(obj.keyOutputs) ||
    outputsList.join(' ، ') ||
    objectives.join(' ، ') ||
    summaryDescription;

  return {
    id:
      pick(obj.id) ||
      `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    academicYear: pick(obj.academicYear) || pick(obj.academicYearInput),
    semester: validSemester,
    programName,
    domain: pick(obj.domain) || pick(obj.executionDomain),
    executionDate: pick(obj.executionDate),
    executionHijriDate: pick(obj.executionHijriDate),
    location: pick(obj.location) || pick(obj.executionLocation),
    beneficiariesCount: pick(obj.beneficiariesCount),
    targetGroups,
    summaryDescription,
    objectives,
    topics,
    trainingMethods,
    keyOutputs,
    outputsList,
    recommendations,
    executorName: pick(obj.executorName),
    updatedAt: pick(obj.updatedAt) || new Date().toISOString(),
  };
}

export function loadSavedCoursesFromStorage(
  storage?: Pick<Storage, 'getItem'>
): SavedTrainingCourse[] {
  try {
    const store =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return [];
    const raw = store.getItem(SAVED_COURSES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => sanitizeSavedCourse(item))
      .filter((item): item is SavedTrainingCourse => item !== null);
  } catch {
    return [];
  }
}

export function writeSavedCoursesToStorage(
  courses: SavedTrainingCourse[],
  storage?: Pick<Storage, 'setItem'>
): boolean {
  try {
    const store =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return false;
    const sanitized = courses
      .map((c) => sanitizeSavedCourse(c))
      .filter((c): c is SavedTrainingCourse => c !== null);
    store.setItem(SAVED_COURSES_STORAGE_KEY, JSON.stringify(sanitized));
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts all entered course fields from a Training Execution Report form
 * (strictly excluding photos, signatures, and national ID) for saving and recall.
 */
export function buildCourseFromExecutionValues(
  values: FormValues,
  fallbackAcademicYear = ''
): Omit<SavedTrainingCourse, 'id' | 'updatedAt'> {
  const str = (val: unknown): string => {
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number' && !Number.isNaN(val)) return String(val);
    return '';
  };

  const rawDomain = str(values.executionDomain);
  const customDomain = str(values.customExecutionDomain);
  const resolvedDomain =
    rawDomain === 'أخرى' && customDomain ? customDomain : rawDomain;

  const outputsList = cleanStringArray(values.outputsList);
  const objectives = cleanStringArray(values.objectivesList);
  const topics = cleanStringArray(values.topicsList);
  const recommendations = cleanStringArray(values.recommendationsList);
  const targetGroups = cleanStringArray(values.targetGroups);
  const trainingMethods = cleanStringArray(values.trainingMethods);
  const summaryDescription = str(values.summaryDescription);

  const academicYear =
    str(values.academicYearInput) || fallbackAcademicYear.trim();
  const rawSemester = str(values.semesterName);
  const semester =
    rawSemester === 'الفصل الدراسي الثاني'
      ? 'الفصل الدراسي الثاني'
      : 'الفصل الدراسي الأول';

  const executionDate =
    str(values.executionDate) || str(values.executionHijriDate);
  const executionHijriDate = str(values.executionHijriDate);

  const keyOutputs =
    outputsList.join(' ، ') ||
    objectives.join(' ، ') ||
    summaryDescription;

  return {
    academicYear,
    semester,
    programName: str(values.programTitle),
    domain: resolvedDomain,
    executionDate,
    executionHijriDate,
    location: str(values.executionLocation),
    beneficiariesCount: str(values.beneficiariesCount),
    targetGroups,
    summaryDescription,
    objectives,
    topics,
    trainingMethods,
    keyOutputs,
    outputsList,
    recommendations,
    executorName: str(values.executorName),
  };
}

export function saveCourseToLocalRegistry(
  courseInput: Omit<SavedTrainingCourse, 'id' | 'updatedAt'> & { id?: string },
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): {
  saved: SavedTrainingCourse;
  updatedExisting: boolean;
  allCourses: SavedTrainingCourse[];
} {
  const current = loadSavedCoursesFromStorage(storage);
  const norm = (s: string) => (s ?? '').trim().toLowerCase();
  const inputYearNorm = normalizeAcademicYearForMatch(courseInput.academicYear);
  const inputSemester =
    (courseInput.semester ?? '').trim() === 'الفصل الدراسي الثاني'
      ? 'الفصل الدراسي الثاني'
      : 'الفصل الدراسي الأول';

  // Deduplicate by matching id (when programName matches) OR by matching programName + semester (+ compatible academic year)
  const existingIdx = current.findIndex((c) => {
    if (
      courseInput.id &&
      c.id === courseInput.id &&
      norm(c.programName) === norm(courseInput.programName)
    ) {
      return true;
    }
    const sameName = norm(c.programName) === norm(courseInput.programName);
    if (!sameName) return false;
    const sameSemester = norm(c.semester) === norm(inputSemester);
    if (!sameSemester) return false;
    const cYearNorm = normalizeAcademicYearForMatch(c.academicYear);
    const sameOrEmptyYear =
      !cYearNorm ||
      !inputYearNorm ||
      cYearNorm === inputYearNorm ||
      cYearNorm.includes(inputYearNorm) ||
      inputYearNorm.includes(cYearNorm);
    return sameOrEmptyYear;
  });

  const nowIso = new Date().toISOString();

  const buildRecord = (id: string): SavedTrainingCourse => ({
    id,
    academicYear: (courseInput.academicYear ?? '').trim(),
    semester: inputSemester,
    programName: (courseInput.programName ?? '').trim(),
    domain: (courseInput.domain ?? '').trim(),
    executionDate: (courseInput.executionDate ?? '').trim(),
    executionHijriDate: (courseInput.executionHijriDate ?? '').trim(),
    location: (courseInput.location ?? '').trim(),
    beneficiariesCount: (courseInput.beneficiariesCount ?? '').trim(),
    targetGroups: cleanStringArray(courseInput.targetGroups),
    summaryDescription: (courseInput.summaryDescription ?? '').trim(),
    objectives: cleanStringArray(courseInput.objectives),
    topics: cleanStringArray(courseInput.topics),
    trainingMethods: cleanStringArray(courseInput.trainingMethods),
    keyOutputs: (courseInput.keyOutputs ?? '').trim(),
    outputsList: cleanStringArray(courseInput.outputsList),
    recommendations: cleanStringArray(courseInput.recommendations),
    executorName: (courseInput.executorName ?? '').trim(),
    updatedAt: nowIso,
  });

  if (existingIdx >= 0) {
    const existing = current[existingIdx];
    const updatedRecord = buildRecord(existing.id);
    const next = [...current];
    next[existingIdx] = updatedRecord;
    writeSavedCoursesToStorage(next, storage);
    return { saved: updatedRecord, updatedExisting: true, allCourses: next };
  }

  const newRecord = buildRecord(
    courseInput.id ||
      `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  );

  const next = [...current, newRecord];
  writeSavedCoursesToStorage(next, storage);
  return { saved: newRecord, updatedExisting: false, allCourses: next };
}

export function updateSavedCourseInRegistry(
  id: string,
  updates: Partial<Omit<SavedTrainingCourse, 'id' | 'updatedAt'>>,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): SavedTrainingCourse[] {
  const current = loadSavedCoursesFromStorage(storage);
  const next = current.map((c) => {
    if (c.id !== id) return c;
    return {
      ...c,
      ...updates,
      academicYear: (updates.academicYear ?? c.academicYear).trim(),
      semester:
        (updates.semester ?? c.semester).trim() === 'الفصل الدراسي الثاني'
          ? 'الفصل الدراسي الثاني'
          : 'الفصل الدراسي الأول',
      programName: (updates.programName ?? c.programName).trim(),
      domain: (updates.domain ?? c.domain).trim(),
      executionDate: (updates.executionDate ?? c.executionDate).trim(),
      location: (updates.location ?? c.location).trim(),
      beneficiariesCount: (
        updates.beneficiariesCount ?? c.beneficiariesCount
      ).trim(),
      keyOutputs: (updates.keyOutputs ?? c.keyOutputs).trim(),
      updatedAt: new Date().toISOString(),
    };
  });
  writeSavedCoursesToStorage(next, storage);
  return next;
}

export function deleteSavedCourseFromRegistry(
  id: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'>
): SavedTrainingCourse[] {
  const current = loadSavedCoursesFromStorage(storage);
  const next = current.filter((c) => c.id !== id);
  writeSavedCoursesToStorage(next, storage);
  return next;
}

/**
 * Filters saved courses by academicYear and semester while tolerating empty academicYear
 * or minor formatting differences (e.g., "1447" vs "1447 هـ" vs "١٤٤٧").
 */
export function filterCoursesByAcademicPeriod(
  courses: SavedTrainingCourse[],
  academicYear: string,
  semester: string
): SavedTrainingCourse[] {
  const normYear = normalizeAcademicYearForMatch(academicYear);
  const normSem = (semester ?? '').trim();

  return courses.filter((course) => {
    const courseSem = (course.semester ?? '').trim();
    const matchesSemester = !normSem || !courseSem || courseSem === normSem;

    const courseYear = normalizeAcademicYearForMatch(course.academicYear);
    const matchesYear =
      !normYear ||
      !courseYear ||
      courseYear === normYear ||
      courseYear.includes(normYear) ||
      normYear.includes(courseYear);

    return matchesSemester && matchesYear;
  });
}

export function convertSavedCoursesToTableRows(
  courses: SavedTrainingCourse[]
): TableRowData[] {
  if (courses.length === 0) return [];
  return courses.map((c) => ({
    programName: c.programName,
    domain: c.domain || '—',
    executionDate: c.executionDate || c.executionHijriDate || '—',
    location: c.location || '—',
    beneficiariesCount: c.beneficiariesCount || '0',
    keyOutputs:
      c.keyOutputs ||
      (c.outputsList && c.outputsList.length > 0
        ? c.outputsList.join(' ، ')
        : '') ||
      (c.objectives && c.objectives.length > 0
        ? c.objectives.join(' ، ')
        : '') ||
      c.summaryDescription ||
      '—',
  }));
}
