"use client";

import { useEffect, useRef } from "react";
import {
    Chart as ChartJS,
    type ChartConfiguration,
    type ChartData,
    type ChartOptions,
    type ChartType,
    type Plugin,
} from "chart.js";
import "./chartjs";

type SupportedChartData =
    | ChartData<"bar", number[], string>
    | ChartData<"doughnut", number[], string>
    | ChartData<"bar" | "line", number[], string>;

type SupportedChartOptions =
    | ChartOptions<"bar">
    | ChartOptions<"doughnut">
    | ChartOptions<"bar" | "line">;

interface ChartCanvasProps {
    type: "bar" | "doughnut";
    data: SupportedChartData;
    options: SupportedChartOptions;
    plugins?: Plugin<ChartType>[];
}

export default function ChartCanvas({
    type,
    data,
    options,
    plugins,
}: ChartCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<ChartJS<ChartType, number[], string> | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !canvas.isConnected) return;

        const config: ChartConfiguration<ChartType, number[], string> = {
            type,
            data: data as ChartData<ChartType, number[], string>,
            options: options as ChartOptions<ChartType>,
            plugins,
        };

        const chart = new ChartJS(canvas, config);
        chartRef.current = chart;

        return () => {
            chartRef.current = null;
            chart.destroy();
        };
    }, [type, plugins]);

    useEffect(() => {
        const chart = chartRef.current;
        if (!chart) return;

        chart.config.data = data as ChartData<ChartType, number[], string>;
        chart.options = options as ChartOptions<ChartType>;
        chart.update();
    }, [data, options]);

    return <canvas ref={canvasRef} role="img" />;
}
