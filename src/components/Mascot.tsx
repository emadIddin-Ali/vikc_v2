import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * "Gnista" — LEVLA's mascot: a 4-point yellow star face. Ported from the prototype.
 * `eyes` adds highlight dots; `mouth` = 'smile' | 'grin' (bigger celebration smile).
 */
export function Mascot({
  size = 86,
  eyes = false,
  mouth = 'smile',
}: {
  size?: number;
  eyes?: boolean;
  mouth?: 'smile' | 'grin';
}) {
  const smilePath = mouth === 'grin' ? 'M38 60 Q50 74 62 60' : 'M40 60 Q50 70 60 60';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d="M50 6C57 32 68 43 94 50C68 57 57 68 50 94C43 68 32 57 6 50C32 43 43 32 50 6Z"
        fill="#ffd23f"
      />
      <Circle cx={40} cy={46} r={6} fill="#2c2340" />
      <Circle cx={60} cy={46} r={6} fill="#2c2340" />
      {eyes && <Circle cx={42} cy={44} r={2} fill="#fff" />}
      {eyes && <Circle cx={62} cy={44} r={2} fill="#fff" />}
      <Path
        d={smilePath}
        stroke="#2c2340"
        strokeWidth={mouth === 'grin' ? 4.5 : 4}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}
