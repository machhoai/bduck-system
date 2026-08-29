"use client";

import {
    Chart as ChartJS,
    type ChartConfiguration,
    type ChartData,
    type ChartOptions,
    type ChartType,
    type Plugin,
} from "chart.js";
import { useLayoutEffect, useRef } from "react";
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
    onElementClick?: (index: number) => void;
}

export default function ChartCanvas({
    type,
    data,
    options,
    plugins,
    onElementClick,
}: ChartCanvasProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<ChartJS<ChartType, number[], string> | null>(null);
    const initialDataRef = useRef(data);
    const initialOptionsRef = useRef(options);

    useLayoutEffect(() => {
        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!container || !canvas || !canvas.isConnected || !container.isConnected) {
            return;
        }

        const config: ChartConfiguration<ChartType, number[], string> = {
            type,
            data: initialDataRef.current as ChartData<ChartType, number[], string>,
            options: {
                ...(initialOptionsRef.current as ChartOptions<ChartType>),
                responsive: false,
                maintainAspectRatio: false,
            },
            plugins,
        };

        const chart = new ChartJS(canvas, config);
        chartRef.current = chart;
        const resizeObserver = new ResizeObserver((entries) => {
            const currentChart = chartRef.current;
            const currentCanvas = canvasRef.current;
            if (
                currentChart !== chart ||
                currentCanvas !== canvas ||
                chart.canvas !== canvas ||
                !canvas.isConnected ||
                !container.isConnected
            ) {
                return;
            }
            const size = entries[0]?.contentRect;
            const width = Math.floor(size?.width ?? 0);
            const height = Math.floor(size?.height ?? 0);
            if (width > 0 && height > 0) chart.resize(width, height);
        });
        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
            chart.stop();
            chart.destroy();
            if (chartRef.current === chart) chartRef.current = null;
        };
    }, [type, plugins]);

    useLayoutEffect(() => {
        const chart = chartRef.current;
        const canvas = canvasRef.current;
        if (
            !chart ||
            !canvas ||
            chart.canvas !== canvas ||
            !canvas.isConnected ||
            !canvas.parentElement?.isConnected
        ) {
            return;
        }

        chart.config.data = data as ChartData<ChartType, number[], string>;
        chart.options = {
            ...(options as ChartOptions<ChartType>),
            responsive: false,
            maintainAspectRatio: false,
        };
        chart.update("none");
    }, [data, options]);

    return (
        <div ref={containerRef} className="relative h-full min-h-[150px] w-full">
            <canvas
                ref={canvasRef}
                role="img"
                onClick={(event) => {
                    if (!onElementClick || !chartRef.current) return;
                    const points = chartRef.current.getElementsAtEventForMode(
                        event.nativeEvent,
                        "nearest",
                        { intersect: true },
                        true,
                    );
                    const index = points[0]?.index;
                    if (typeof index === "number") onElementClick(index);
                }}
            />
        </div>
    );
}
