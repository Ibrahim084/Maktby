import React from 'react';

interface LogoProps {
  className?: string;
  compact?: boolean;
}

/**
 * الشعار الكامل لمنصة «مكتبي»
 * ملف مدرسي أزرق بترولي هادئ (#5D8C91 / #376B70) + أوراق فاتحة (#F9F8F5 / #FFFFFF)
 * + قلم داكن (#292F33) بتفاصيل رمادية متزنة (#9AA5AA)
 * + كلمة «مكتبي» باللون الأساسي للنصوص (#292F33)
 */
export const MaktbyLogo: React.FC<LogoProps> = ({
  className = 'h-12 w-auto',
  compact = false,
}) => {
  if (compact) {
    return (
      <svg
        viewBox="0 0 186 58"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label="شعار منصة مكتبي"
      >
        {/* Emblem Mark on Right (RTL) */}
        <g transform="translate(120, 4) scale(0.54)">
          {/* Folder back */}
          <path
            d="M16 30C16 24.477 20.477 20 26 20H46L54 28H88C93.523 28 98 32.477 98 38V68H16V30Z"
            fill="#376B70"
          />
          {/* Back paper */}
          <rect
            x="38"
            y="8"
            width="46"
            height="42"
            rx="5"
            transform="rotate(9 38 8)"
            fill="#EAF2F1"
            stroke="#C4D8D6"
            strokeWidth="2.5"
          />
          {/* Front paper */}
          <rect
            x="30"
            y="12"
            width="48"
            height="42"
            rx="5"
            transform="rotate(4 30 12)"
            fill="#FFFFFF"
            stroke="#E2E5E6"
            strokeWidth="2.5"
          />
          <line x1="40" y1="22" x2="68" y2="24" stroke="#9AA5AA" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="39" y1="30" x2="66" y2="32" stroke="#9AA5AA" strokeWidth="2.8" strokeLinecap="round" />
          <line x1="38" y1="38" x2="58" y2="39.5" stroke="#C9D2D5" strokeWidth="2.8" strokeLinecap="round" />
          {/* Folder front flap */}
          <path
            d="M12 42C12 37.582 15.582 34 20 34H47L55 41H94C98.418 41 102 44.582 102 49V74C102 78.418 98.418 82 94 82H20C15.582 82 12 78.418 12 74V42Z"
            fill="#5D8C91"
          />
          <path
            d="M16 42H45L53 49H97"
            stroke="#EAF2F1"
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.75"
          />
          {/* Diagonal Pen */}
          <g transform="rotate(34 18 60)">
            <rect x="11" y="22" width="14" height="54" rx="7" fill="#292F33" />
            <rect x="11" y="38" width="14" height="4" fill="#9AA5AA" />
            <path d="M12.5 73L18 88L23.5 73H12.5Z" fill="#9AA5AA" />
            <path d="M15.6 81.5L18 88L20.4 81.5H15.6Z" fill="#292F33" />
            <rect x="16.5" y="26" width="3" height="14" rx="1.5" fill="#9AA5AA" />
          </g>
        </g>

        {/* Arabic Wordmark «مكتبي» centered cleanly to the left of the emblem */}
        <text
          x="60"
          y="39"
          textAnchor="middle"
          direction="rtl"
          fill="#292F33"
          fontFamily="Tajawal, Cairo, sans-serif"
          fontWeight="800"
          fontSize="30"
        >
          مكتبي
        </text>
        {/* Subtle Curve Underline */}
        <path
          d="M22 50C46 45 74 45 98 49"
          stroke="#5D8C91"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 210 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="شعار منصة مكتبي"
    >
      {/* Folder + Papers + Pen Lockup */}
      <g transform="translate(46, 2)">
        {/* Folder back body */}
        <path
          d="M22 25C22 19.477 26.477 15 32 15H55L63 23H104C109.523 23 114 27.477 114 33V58H22V25Z"
          fill="#376B70"
        />
        {/* Back Paper */}
        <rect
          x="52"
          y="4"
          width="50"
          height="42"
          rx="5"
          transform="rotate(10 52 4)"
          fill="#EAF2F1"
          stroke="#C4D8D6"
          strokeWidth="2"
        />
        {/* Main White Paper */}
        <rect
          x="42"
          y="7"
          width="52"
          height="44"
          rx="5"
          transform="rotate(4 42 7)"
          fill="#FFFFFF"
          stroke="#E2E5E6"
          strokeWidth="2.2"
        />
        {/* Paper Lines */}
        <line x1="52" y1="18" x2="83" y2="20" stroke="#9AA5AA" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="51" y1="26" x2="80" y2="28" stroke="#9AA5AA" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="50" y1="34" x2="71" y2="35.5" stroke="#C9D2D5" strokeWidth="2.4" strokeLinecap="round" />
        {/* Folder Front Flap in Calm Petrol Blue #5D8C91 */}
        <path
          d="M18 35C18 30.582 21.582 27 26 27H56L64 34H108C112.418 34 116 37.582 116 42V58C116 62.418 112.418 66 108 66H26C21.582 66 18 62.418 18 58V35Z"
          fill="#5D8C91"
        />
        {/* Crisp Light Petrol Inner Fold Highlight */}
        <path
          d="M22 35H54L62 42H111"
          stroke="#EAF2F1"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.75"
        />
        {/* Framing Ink Stroke connecting folder to wordmark */}
        <path
          d="M112 37C119 37 121 41 119 49"
          stroke="#292F33"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* Diagonal Pen in #292F33 + #9AA5AA */}
        <g transform="rotate(35 24 50)">
          <rect x="17" y="14" width="13.5" height="51" rx="6.75" fill="#292F33" />
          <rect x="17" y="30" width="13.5" height="4" fill="#9AA5AA" />
          <rect x="17" y="51" width="13.5" height="2.6" fill="#9AA5AA" opacity="0.85" />
          <path d="M18.5 62L23.75 76L29 62H18.5Z" fill="#9AA5AA" />
          <path d="M21.4 70L23.75 76L26.1 70H21.4Z" fill="#292F33" />
          <rect x="22.4" y="18" width="2.8" height="13" rx="1.4" fill="#9AA5AA" />
        </g>
      </g>

      {/* Bold Arabic Wordmark «مكتبي» in #292F33 */}
      <text
        x="108"
        y="106"
        textAnchor="middle"
        direction="rtl"
        fill="#292F33"
        fontFamily="Tajawal, Cairo, sans-serif"
        fontWeight="800"
        fontSize="44"
      >
        مكتبي
      </text>

      {/* Graceful Curved Accent Stroke */}
      <path
        d="M52 121C88 111 130 110 164 116"
        stroke="#5D8C91"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
};

/**
 * الأيقونة المستقلة المربعة لمنصة «مكتبي» (PWA / التطبيق / Favicon)
 */
export const MaktbyAppIcon: React.FC<{ className?: string }> = ({
  className = 'w-12 h-12',
}) => (
  <svg
    viewBox="0 0 128 128"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role="img"
    aria-label="أيقونة تطبيق مكتبي"
  >
    <rect
      x="4"
      y="4"
      width="120"
      height="120"
      rx="28"
      fill="#F9F8F5"
      stroke="#E2E5E6"
      strokeWidth="3"
    />
    <path
      d="M4 96C34 102 68 108 106 86C116 80 124 72 124 72V96C124 111.464 111.464 124 96 124H32C16.536 124 4 111.464 4 96Z"
      fill="#5D8C91"
    />
    <path
      d="M35 37C35 32.582 38.582 29 43 29H57L63 35H89C93.418 35 97 38.582 97 43V63H35V37Z"
      fill="#376B70"
    />
    <rect
      x="46"
      y="21"
      width="38"
      height="34"
      rx="4"
      transform="rotate(6 46 21)"
      fill="#FFFFFF"
      stroke="#E2E5E6"
      strokeWidth="2"
    />
    <line x1="53" y1="30" x2="76" y2="32.5" stroke="#9AA5AA" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="52" y1="37" x2="74" y2="39.3" stroke="#9AA5AA" strokeWidth="2.2" strokeLinecap="round" />
    <path
      d="M32 45C32 41.686 34.686 39 38 39H57L62.5 44.5H93C96.314 44.5 99 47.186 99 50.5V65C99 68.314 96.314 71 93 71H38C34.686 71 32 68.314 32 65V45Z"
      fill="#5D8C91"
    />
    <g transform="rotate(33 34 62)">
      <rect x="29" y="34" width="10" height="40" rx="5" fill="#292F33" />
      <rect x="29" y="45" width="10" height="3" fill="#9AA5AA" />
      <path d="M30 72L34 83L38 72H30Z" fill="#9AA5AA" />
      <path d="M32.3 78L34 83L35.7 78H32.3Z" fill="#292F33" />
    </g>
    <text
      x="68"
      y="92"
      textAnchor="middle"
      direction="rtl"
      fill="#292F33"
      fontFamily="Tajawal, Cairo, sans-serif"
      fontWeight="800"
      fontSize="27"
    >
      مكتبي
    </text>
  </svg>
);

/**
 * عنصر بصري هادئ للملف والأوراق والقلم للاستخدام في بطاقة الترحيب بالصفحة الرئيسية
 */
export const MaktbyFolderIllustration: React.FC<{ className?: string }> = ({
  className = 'w-44 h-36',
}) => (
  <svg
    viewBox="0 0 220 164"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Soft organic backdrop */}
    <ellipse cx="112" cy="134" rx="88" ry="18" fill="#DCE9E8" opacity="0.65" />
    {/* Folder Back */}
    <path
      d="M42 54C42 46.268 48.268 40 56 40H94L108 54H168C175.732 54 182 60.268 182 68V122C182 129.732 175.732 136 168 136H56C48.268 136 42 129.732 42 122V54Z"
      fill="#376B70"
    />
    {/* Back Paper Sheet */}
    <rect
      x="72"
      y="20"
      width="74"
      height="86"
      rx="9"
      transform="rotate(9 72 20)"
      fill="#EAF2F1"
      stroke="#C4D8D6"
      strokeWidth="2.5"
    />
    {/* Front Paper Sheet */}
    <rect
      x="60"
      y="24"
      width="76"
      height="88"
      rx="9"
      transform="rotate(3 60 24)"
      fill="#FFFFFF"
      stroke="#E2E5E6"
      strokeWidth="2.5"
    />
    <line x1="74" y1="44" x2="120" y2="46.5" stroke="#9AA5AA" strokeWidth="3.2" strokeLinecap="round" />
    <line x1="73" y1="56" x2="118" y2="58.5" stroke="#9AA5AA" strokeWidth="3.2" strokeLinecap="round" />
    <line x1="72" y1="68" x2="104" y2="69.5" stroke="#D2D9DB" strokeWidth="3.2" strokeLinecap="round" />
    {/* Front Folder Flap in Calm Petrol Blue #5D8C91 */}
    <path
      d="M34 74C34 67.373 39.373 62 46 62H92L104 72H164C170.627 72 176 77.373 176 84V124C176 130.627 170.627 136 164 136H46C39.373 136 34 130.627 34 124V74Z"
      fill="#5D8C91"
    />
    <path
      d="M42 74H89L101 84H168"
      stroke="#EAF2F1"
      strokeWidth="2.4"
      strokeLinecap="round"
      opacity="0.7"
    />
    {/* Foreground Soft Petrol Pocket Accent */}
    <path
      d="M34 86C34 80.477 38.477 76 44 76H82L92 84H136C141.523 84 146 88.477 146 94V126C146 131.523 141.523 136 136 136H44C38.477 136 34 131.523 34 126V86Z"
      fill="#DCE9E8"
      stroke="#C4D8D6"
      strokeWidth="2"
    />
    {/* Diagonal Sleek Pen */}
    <g transform="rotate(36 156 82)">
      <rect x="147" y="30" width="18" height="82" rx="9" fill="#292F33" />
      <rect x="147" y="54" width="18" height="5" fill="#9AA5AA" />
      <rect x="154" y="36" width="4" height="20" rx="2" fill="#9AA5AA" />
      <path d="M149 109L156 128L163 109H149Z" fill="#9AA5AA" />
      <path d="M152.8 119.5L156 128L159.2 119.5H152.8Z" fill="#292F33" />
    </g>
  </svg>
);
