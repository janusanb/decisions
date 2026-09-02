import { useEffect, useRef, useState } from "react";
import type { Candidate } from "../../../shared/types.ts";

const COLORS = [
  "#c23a22",
  "#d4a017",
  "#2f6f4e",
  "#2c4a6e",
  "#b85c38",
  "#7a3b2e",
  "#c47b2b",
  "#4a3f2f",
];

function colorFor(id: string, index: number): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[(hash + index) % COLORS.length]!;
}

function slicePath(start: number, angle: number, radius: number): string {
  if (angle >= 359.999) {
    return `M ${radius} ${radius} m -${radius} 0 a ${radius} ${radius} 0 1 1 ${radius * 2} 0 a ${radius} ${radius} 0 1 1 -${radius * 2} 0`;
  }
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const end = start + angle;
  const large = angle > 180 ? 1 : 0;
  const x1 = radius + radius * Math.cos(toRad(start));
  const y1 = radius + radius * Math.sin(toRad(start));
  const x2 = radius + radius * Math.cos(toRad(end));
  const y2 = radius + radius * Math.sin(toRad(end));
  return `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
}

function labelPosition(start: number, angle: number, radius: number) {
  const mid = start + angle / 2;
  const rad = ((mid - 90) * Math.PI) / 180;
  const dist = radius * 0.62;
  return {
    x: radius + dist * Math.cos(rad),
    y: radius + dist * Math.sin(rad),
  };
}

type WheelProps = {
  candidates: Candidate[];
  rotationDegrees: number;
  spinning: boolean;
  resultName?: string | null;
};

export function Wheel({ candidates, rotationDegrees, spinning, resultName }: WheelProps) {
  const [animate, setAnimate] = useState(false);
  const previous = useRef(0);

  useEffect(() => {
    if (rotationDegrees > 0 && previous.current !== rotationDegrees) {
      previous.current = rotationDegrees;
      const frame = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(frame);
    }
    return undefined;
  }, [rotationDegrees]);

  const radius = 220;

  return (
    <div className="wheel-stage">
      <div className="wheel-lamp" aria-hidden="true" />
      <div className="wheel-pointer" aria-hidden="true" />
      <svg
        className={`wheel ${animate ? "is-spinning" : ""}`}
        viewBox="0 0 440 440"
        role="img"
        aria-label={resultName ? `Wheel landed on ${resultName}` : "Decision wheel"}
        style={{ transform: `rotate(${spinning || rotationDegrees ? rotationDegrees : 0}deg)` }}
      >
        <circle cx="220" cy="220" r="218" fill="#1c1410" />
        {candidates.map((candidate, index) => {
          const label = labelPosition(
            candidate.sliceStartDegrees,
            candidate.sliceAngleDegrees,
            radius,
          );
          return (
            <g key={candidate.restaurantId}>
              <path
                d={slicePath(candidate.sliceStartDegrees, candidate.sliceAngleDegrees, radius)}
                fill={colorFor(candidate.restaurantId, index)}
                stroke="#1c1410"
                strokeWidth="2"
              />
              {candidate.sliceAngleDegrees >= 18 ? (
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#faf6ee"
                  fontFamily="Gill Sans, Trebuchet MS, sans-serif"
                  fontSize={candidate.sliceAngleDegrees > 50 ? 16 : 12}
                  fontWeight="700"
                  transform={`rotate(${candidate.sliceStartDegrees + candidate.sliceAngleDegrees / 2} ${label.x} ${label.y})`}
                >
                  {candidate.name}
                </text>
              ) : null}
            </g>
          );
        })}
        <circle cx="220" cy="220" r="28" fill="#c9a227" stroke="#1c1410" strokeWidth="4" />
        <circle cx="220" cy="220" r="10" fill="#1c1410" />
      </svg>
      {resultName ? <p className="wheel-result">{resultName}</p> : null}
    </div>
  );
}
