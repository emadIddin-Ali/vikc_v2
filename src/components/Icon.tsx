import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * LEVLA icon system — inline SVG on a 24×24 grid, ported 1:1 from the design
 * prototype (2px stroke, round caps). No emoji. `color` sets stroke/fill.
 */
export type IconName =
  | 'bell' | 'fire' | 'coin' | 'gift' | 'target' | 'home' | 'bag' | 'user'
  | 'camera' | 'pin' | 'check' | 'calendar' | 'trophy' | 'map' | 'locate'
  | 'arrowL' | 'chev' | 'palette' | 'heart' | 'book' | 'soccer' | 'moon'
  | 'diamond' | 'shirt' | 'ticket' | 'film' | 'gamepad' | 'sparkles'
  | 'coffee' | 'wrench' | 'shield' | 'org' | 'star' | 'starO';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  opacity?: number;
};

export function Icon({ name, size = 22, color = '#2c2340', opacity = 1 }: Props) {
  const stroke = {
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const svg = { width: size, height: size, viewBox: '0 0 24 24', opacity };

  switch (name) {
    case 'bell':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M6 15v-4a6 6 0 1112 0v4l1.6 2H4.4L6 15z" />
          <Path {...stroke} d="M9.5 20a2.5 2.5 0 005 0" />
        </Svg>
      );
    case 'fire':
      return (
        <Svg {...svg}>
          <Path fill="#ff7a4d" d="M12 2c1.2 3.6 4.5 5 4.5 8.7A4.5 4.5 0 0112 15a3.4 3.4 0 01-3.4-3.4c0-1.2.6-2 .6-2 .3 1.2 1.2 1.7 1.8 1.7C11 8.6 10.3 6 12 2z" />
          <Path fill={color} d="M12 22a5.5 5.5 0 005.5-5.5c0-2.6-1.8-4.2-2.6-5.2.2 2.4-1 3.6-1.9 4-.2-1.6-1-2.6-1.6-3.4-1.6 1.2-2.9 3-2.9 5A5.5 5.5 0 0012 22z" />
        </Svg>
      );
    case 'coin':
      return (
        <Svg {...svg}>
          <Circle cx={12} cy={12} r={9} fill={color} />
          <Path fill="#fff" opacity={0.9} d="M12 6.6l1.5 3.5 3.8.3-2.9 2.5.9 3.7L12 14.9 8.7 16.6l.9-3.7-2.9-2.5 3.8-.3z" />
        </Svg>
      );
    case 'gift':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M4 12h16v8H4z" />
          <Path {...stroke} d="M3 8h18v4H3z" />
          <Path {...stroke} d="M12 8v12" />
          <Path {...stroke} d="M12 8C10.5 8 8.5 7.4 8.5 5.8S10.5 4 12 8z" />
          <Path {...stroke} d="M12 8c1.5 0 3.5-.6 3.5-2.2S13.5 4 12 8z" />
        </Svg>
      );
    case 'target':
      return (
        <Svg {...svg}>
          <Circle {...stroke} cx={12} cy={12} r={8.5} />
          <Circle {...stroke} cx={12} cy={12} r={4.5} />
          <Circle {...stroke} cx={12} cy={12} r={1} />
        </Svg>
      );
    case 'home':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M3.5 11.5 12 4l8.5 7.5" />
          <Path {...stroke} d="M5.5 10v10h13V10" />
        </Svg>
      );
    case 'bag':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M6 8h12l1 12H5L6 8z" />
          <Path {...stroke} d="M9 8V6.5a3 3 0 016 0V8" />
        </Svg>
      );
    case 'user':
      return (
        <Svg {...svg}>
          <Circle {...stroke} cx={12} cy={8} r={4} />
          <Path {...stroke} d="M4.5 20c.5-4 4-6 7.5-6s7 2 7.5 6" />
        </Svg>
      );
    case 'camera':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M4 8.5h3.2l1.4-2.2h6.8l1.4 2.2H20a1 1 0 011 1V19a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5a1 1 0 011-1z" />
          <Circle {...stroke} cx={12} cy={13.5} r={3.2} />
        </Svg>
      );
    case 'pin':
      return (
        <Svg {...svg}>
          <Path fill={color} d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
          <Circle cx={12} cy={10} r={2.6} fill="#fff" />
        </Svg>
      );
    case 'check':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M5 12.5l4.5 4.5L19 7" />
        </Svg>
      );
    case 'calendar':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M4 6.5h16V20a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
          <Path {...stroke} d="M4 10.5h16" />
          <Path {...stroke} d="M8 3v4" />
          <Path {...stroke} d="M16 3v4" />
        </Svg>
      );
    case 'trophy':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M7 4h10v4a5 5 0 01-10 0z" />
          <Path {...stroke} d="M17 5h3v1.5a3 3 0 01-3 3" />
          <Path {...stroke} d="M7 5H4v1.5a3 3 0 003 3" />
          <Path {...stroke} d="M12 13v3" />
          <Path {...stroke} d="M8.5 20h7" />
          <Path {...stroke} d="M10 16.5h4" />
        </Svg>
      );
    case 'map':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2z" />
          <Path {...stroke} d="M9 4v14" />
          <Path {...stroke} d="M15 6v14" />
        </Svg>
      );
    case 'locate':
      return (
        <Svg {...svg}>
          <Circle {...stroke} cx={12} cy={12} r={3} />
          <Circle {...stroke} cx={12} cy={12} r={7.5} />
          <Path {...stroke} d="M12 2v2.5" />
          <Path {...stroke} d="M12 19.5V22" />
          <Path {...stroke} d="M2 12h2.5" />
          <Path {...stroke} d="M19.5 12H22" />
        </Svg>
      );
    case 'arrowL':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M19 12H5" />
          <Path {...stroke} d="M11 6l-6 6 6 6" />
        </Svg>
      );
    case 'chev':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M9 6l6 6-6 6" />
        </Svg>
      );
    case 'palette':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M12 3a9 9 0 100 18c1.2 0 1.8-1 1.5-2-.3-1 .4-2 1.5-2H18a3 3 0 003-3c0-5-4-9-9-9z" />
          <Circle cx={7.5} cy={11.5} r={1} fill={color} />
          <Circle cx={10} cy={7.5} r={1} fill={color} />
          <Circle cx={14.5} cy={7.5} r={1} fill={color} />
        </Svg>
      );
    case 'heart':
      return (
        <Svg {...svg}>
          <Path fill={color} d="M12 21s-7-4.5-7-10a4 4 0 018-1 4 4 0 018 1c0 5.5-7 10-7 10z" />
        </Svg>
      );
    case 'book':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M5 4h13v14H6a1 1 0 00-1 1z" />
          <Path {...stroke} d="M5 19a1 1 0 011-1h12" />
        </Svg>
      );
    case 'soccer':
      return (
        <Svg {...svg}>
          <Circle {...stroke} cx={12} cy={12} r={8.5} />
          <Path fill={color} d="M12 8l3.2 2.3-1.2 3.9h-4L8.8 10.3z" />
        </Svg>
      );
    case 'moon':
      return (
        <Svg {...svg}>
          <Path fill={color} d="M20 14.5A8 8 0 1110 4a6.5 6.5 0 0010 10.5z" />
        </Svg>
      );
    case 'diamond':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M6 3.5h12l3 5-9 12L3 8.5z" />
          <Path {...stroke} d="M3 8.5h18" />
          <Path {...stroke} d="M9.5 3.5 8 8.5" />
          <Path {...stroke} d="M14.5 3.5 16 8.5" />
        </Svg>
      );
    case 'shirt':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M8 4l4 2 4-2 4 3-2.5 2.5V20H6.5V9.5L4 7z" />
        </Svg>
      );
    case 'ticket':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M4 7h16v3a2 2 0 000 4v3H4v-3a2 2 0 000-4z" />
          <Path {...stroke} d="M13 7v2" />
          <Path {...stroke} d="M13 12v2" />
          <Path {...stroke} d="M13 17v-2" />
        </Svg>
      );
    case 'film':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M4 5h16v14H4z" />
          <Path {...stroke} d="M9 5v14" />
          <Path {...stroke} d="M15 5v14" />
          <Path {...stroke} d="M4 9.5h5" />
          <Path {...stroke} d="M4 14.5h5" />
          <Path {...stroke} d="M15 9.5h5" />
          <Path {...stroke} d="M15 14.5h5" />
        </Svg>
      );
    case 'gamepad':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M8 9h8a4.5 4.5 0 014.5 4.5A2.5 2.5 0 0116 15l-1-1.2H9L8 15a2.5 2.5 0 01-4.5-1.5A4.5 4.5 0 018 9z" />
          <Path {...stroke} d="M6.5 11.5v3" />
          <Path {...stroke} d="M5 13h3" />
          <Circle cx={16} cy={12.5} r={0.9} fill={color} />
          <Circle cx={17.8} cy={14} r={0.9} fill={color} />
        </Svg>
      );
    case 'sparkles':
      return (
        <Svg {...svg}>
          <Path fill={color} d="M11 3c.8 3 2 4.2 5 5-3 .8-4.2 2-5 5-.8-3-2-4.2-5-5 3-.8 4.2-2 5-5z" />
          <Path fill={color} d="M18.5 13c.4 1.5 1 2.1 2.5 2.5-1.5.4-2.1 1-2.5 2.5-.4-1.5-1-2.1-2.5-2.5 1.5-.4 2.1-1 2.5-2.5z" />
        </Svg>
      );
    case 'coffee':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M5 8h11v4a5 5 0 01-11 0z" />
          <Path {...stroke} d="M16 9h2.5a2.5 2.5 0 010 5H16" />
          <Path {...stroke} d="M8 3.5c-.8 1 .8 1.8 0 3" />
          <Path {...stroke} d="M12 3.5c-.8 1 .8 1.8 0 3" />
        </Svg>
      );
    case 'wrench':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M14.5 6a4 4 0 00-5.2 5.2l-6 6 3 3 6-6A4 4 0 0017.5 8l-2.6 2.6-2-2z" />
        </Svg>
      );
    case 'shield':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M12 3l7 2.6v5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9v-5z" />
          <Path {...stroke} d="M9 12l2 2 4-4" />
        </Svg>
      );
    // Stars are the teacher role's unit of praise — filled when earned,
    // outlined for the levels the student did not reach.
    case 'star':
      return (
        <Svg {...svg}>
          <Path fill={color} d="M12 3.2l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.9z" />
        </Svg>
      );
    case 'starO':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M12 3.2l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.9z" />
        </Svg>
      );
    case 'org':
      return (
        <Svg {...svg}>
          <Path {...stroke} d="M5 21V5.5a1 1 0 011-1h6a1 1 0 011 1V21" />
          <Path {...stroke} d="M13 10h5a1 1 0 011 1v10" />
          <Path {...stroke} d="M3 21h18" />
          <Path {...stroke} d="M8 8h2" />
          <Path {...stroke} d="M8 12h2" />
          <Path {...stroke} d="M8 16h2" />
          <Path {...stroke} d="M16 14h1" />
          <Path {...stroke} d="M16 18h1" />
        </Svg>
      );
    default:
      return null;
  }
}
