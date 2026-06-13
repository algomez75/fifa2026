import Svg, { Circle, Path, Rect } from 'react-native-svg';

export interface IconProps {
  color: string;
  size?: number;
  strokeWidth?: number;
}

const base = (size = 24) => ({ width: size, height: size, viewBox: '0 0 24 24' });

export function HomeIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ScheduleIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Rect x={3} y={4.5} width={18} height={16} rx={3} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M3 9h18M8 2.5v4M16 2.5v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function GroupsIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Rect x={3} y={3} width={7.5} height={7.5} rx={1.5} stroke={color} strokeWidth={strokeWidth} />
      <Rect x={13.5} y={3} width={7.5} height={7.5} rx={1.5} stroke={color} strokeWidth={strokeWidth} />
      <Rect x={3} y={13.5} width={7.5} height={7.5} rx={1.5} stroke={color} strokeWidth={strokeWidth} />
      <Rect x={13.5} y={13.5} width={7.5} height={7.5} rx={1.5} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function TeamsIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M12 2.5 5 5v6c0 4.4 3.1 8 7 9 3.9-1 7-4.6 7-9V5l-7-2.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10} r={2.2} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function HistoryIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M7 4h10v3a5 5 0 0 1-10 0V4Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M7 5H4.5v1.5A2.5 2.5 0 0 0 7 9M17 5h2.5v1.5A2.5 2.5 0 0 1 17 9M9.5 12.5 9 16h6l-.5-3.5M8 20h8M10 16v4M14 16v4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TrophyIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M7 4h10v4a5 5 0 0 1-10 0V4Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path
        d="M7 5H4.5v1.5A2.5 2.5 0 0 0 7 9M17 5h2.5v1.5A2.5 2.5 0 0 1 17 9M12 13v3M8.5 20h7M9.5 20l.5-4h4l.5 4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HeartIcon({
  color,
  size = 24,
  strokeWidth = 2,
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <Svg {...base(size)} fill={filled ? color : 'none'}>
      <Path
        d="M12 20.5 4.6 13a4.7 4.7 0 0 1 0-6.7 4.7 4.7 0 0 1 6.7 0l.7.7.7-.7a4.7 4.7 0 0 1 6.7 0 4.7 4.7 0 0 1 0 6.7L12 20.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronLeftIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M15 5l-7 7 7 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M9 5l7 7-7 7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function UserIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M4.5 20a7.5 7.5 0 0 1 15 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SearchIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={strokeWidth} />
      <Path d="m20 20-3.5-3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function EyeIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function EyeOffIcon({ color, size = 24, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.2 6.2A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 3-.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
