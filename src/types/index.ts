export type SectionId = 'professional-development' | 'gifted' | 'teacher';

export type PageId = 'home' | SectionId | 'plc' | 'settings';

export type UserGender = 'male' | 'female';

export type TeacherPdfTemplateStyle = 'waves' | 'waves-2' | 'geometric';

export type TeacherPdfColorSystem = 'green' | 'blue' | 'slate';

export type ApprovedSchoolSemester = 'الفصل الدراسي الأول' | 'الفصل الدراسي الثاني';

export const APPROVED_SCHOOL_SEMESTERS: readonly ApprovedSchoolSemester[] = [
  'الفصل الدراسي الأول',
  'الفصل الدراسي الثاني',
] as const;

export interface SchoolSettings {
  schoolName: string;
  educationDepartment: string;
  principalName: string;
  userName: string;
  academicYear: string;
  semester?: ApprovedSchoolSemester;
  gender: UserGender;
  teacherPdfTemplate?: TeacherPdfTemplateStyle;
  teacherPdfColorSystem?: TeacherPdfColorSystem;
  roles: {
    professionalDevelopment: string;
    gifted: string;
    teacher: string;
  };
}

export interface SectionTheme {
  id: SectionId;
  title: string;
  shortDescription: string;
  detailedDescription: string;
  futureFormsMessage: string;
  roleKey: keyof SchoolSettings['roles'];
  colorName: string;
  primaryHex: string;
  badgeTextClass: string;
  accentBgClass: string;
  accentSoftBgClass: string;
  accentBorderClass: string;
  accentHoverBorderClass: string;
  accentTextClass: string;
  buttonBgClass: string;
  iconBgClass: string;
}

export * from './forms';

