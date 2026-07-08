"use client";

import {
  Bar,
  Line
} from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from "chart.js";
import { RISK_META } from "@/lib/weatherWatch";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

function chartOptions(unitLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y} ${unitLabel}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#475569", font: { weight: 700 } }
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.22)" },
        ticks: { color: "#64748b" }
      }
    }
  };
}

function riskColor(level) {
  return RISK_META[level]?.color || RISK_META.normal.color;
}

export default function WeatherCharts({ charts }) {
  const rainfall7d = charts?.rainfall_7d || [];
  const districtRainfall = charts?.district_rainfall || [];
  const riskTrend = charts?.risk_trend || [];

  const rain7dData = {
    labels: rainfall7d.map((item) => item.label),
    datasets: [{
      data: rainfall7d.map((item) => item.rainfall),
      backgroundColor: "#0ea5e9",
      borderRadius: 6
    }]
  };

  const districtData = {
    labels: districtRainfall.map((item) => item.label),
    datasets: [{
      data: districtRainfall.map((item) => item.rainfall),
      backgroundColor: districtRainfall.map((item) => riskColor(item.risk_level)),
      borderRadius: 6
    }]
  };

  const riskData = {
    labels: riskTrend.map((item) => item.label),
    datasets: [{
      data: riskTrend.map((item) => item.score),
      borderColor: "#7c3aed",
      backgroundColor: "rgba(124, 58, 237, 0.12)",
      pointBackgroundColor: riskTrend.map((item) => riskColor(item.risk_level)),
      pointBorderColor: "#ffffff",
      pointRadius: 5,
      tension: 0.35,
      fill: true
    }]
  };

  return (
    <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <ChartCard title="กราฟฝนสะสม 7 วัน" subtitle="ปริมาณฝนเฉลี่ยระดับจังหวัด">
        <Bar data={rain7dData} options={chartOptions("มม.")} />
      </ChartCard>
      <ChartCard title="กราฟฝนรายอำเภอ" subtitle="เปรียบเทียบฝนสะสม 24 ชม.">
        <Bar data={districtData} options={chartOptions("มม.")} />
      </ChartCard>
      <ChartCard title="แนวโน้มความเสี่ยง" subtitle="1 ปกติ, 4 วิกฤต">
        <Line
          data={riskData}
          options={{
            ...chartOptions("ระดับ"),
            scales: {
              ...chartOptions("ระดับ").scales,
              y: {
                min: 0,
                max: 4,
                ticks: {
                  stepSize: 1,
                  callback: (value) => ["", "ปกติ", "เฝ้าระวัง", "เสี่ยงสูง", "วิกฤต"][value] || value
                }
              }
            }
          }}
        />
      </ChartCard>
    </section>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-black text-slate-900">{title}</h3>
        <p className="text-xs font-semibold text-slate-500">{subtitle}</p>
      </div>
      <div className="h-[230px]">{children}</div>
    </div>
  );
}
