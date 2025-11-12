"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

export default function DashboardCharts({ data: chartData }) {
  const data = {
    labels: chartData.map((item) => item.name),
    datasets: [
      {
        label: "จำนวนประชุม",
        data: chartData.map((item) => item.count),
        backgroundColor: "rgba(14, 165, 233, 0.6)", // sky-500 with opacity
        borderColor: "rgba(14, 165, 233, 1)",
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "จำนวนประชุมตามหน่วยงานผู้จัด",
        font: {
          size: 18,
          family: "inherit", // Inherits font from parent
        },
      },
    },
    scales: {
      x: {
        ticks: {
          font: {
            family: "inherit",
          },
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1, // Ensure y-axis has integer steps
          font: {
            family: "inherit",
          },
        },
      },
    },
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <div style={{ height: "350px" }}>
        <Bar options={options} data={data} />
      </div>
    </div>
  );
}
