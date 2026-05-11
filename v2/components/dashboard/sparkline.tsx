"use client";

import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SparklineProps {
  data: Record<string, unknown>[];
  dataKey: string;
  color: string;
  gradientId: string;
  label?: string;
}

export function Sparkline({ data, dataKey, color, gradientId, label }: SparklineProps) {
  return (
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0}    />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{ fontSize: 11, padding: "2px 8px", borderRadius: 6 }}
          labelFormatter={(l) => String(l)}
          formatter={(v) => [v, label ?? dataKey]}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
