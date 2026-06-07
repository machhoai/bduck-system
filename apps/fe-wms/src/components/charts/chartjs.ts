"use client";

import {
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    DoughnutController,
    Filler,
    Legend,
    LineController,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
} from "chart.js";

ChartJS.register(
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    DoughnutController,
    Filler,
    Legend,
    LineController,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
);

export const chartAxisColor = "#6b7280";
export const chartGridColor = "#e5e7eb";
export const chartTooltipOptions = {
    backgroundColor: "#fff",
    bodyColor: "#374151",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    boxPadding: 4,
    cornerRadius: 6,
    displayColors: true,
    padding: 10,
    titleColor: "#111827",
};

export const responsiveChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    resizeDelay: 100,
    animation: {
        duration: 450,
        easing: "easeOutQuart" as const,
    },
    transitions: {
        resize: {
            animation: {
                duration: 300,
                easing: "easeOutQuart" as const,
            },
        },
    },
};
