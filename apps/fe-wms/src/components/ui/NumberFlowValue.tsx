"use client";

import NumberFlow, { type Format } from "@number-flow/react";

const integerFormat: Format = { maximumFractionDigits: 0 };
const decimalFormat: Format = {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
};

interface NumberFlowValueProps {
    value: number;
    className?: string;
    format?: Format;
    prefix?: string;
    suffix?: string;
}

export function NumberFlowValue({
    value,
    className,
    format = integerFormat,
    prefix,
    suffix,
}: NumberFlowValueProps) {
    return (
        <NumberFlow
            className={className}
            value={Number.isFinite(value) ? value : 0}
            locales="vi-VN"
            format={format}
            prefix={prefix}
            suffix={suffix}
            willChange
        />
    );
}

export function CurrencyNumberFlow({
    value,
    className,
}: {
    value: number;
    className?: string;
}) {
    return (
        <NumberFlowValue
            value={value}
            className={className}
            suffix={"\u0111"}
        />
    );
}

export function PercentNumberFlow({
    value,
    className,
    prefix,
}: {
    value: number;
    className?: string;
    prefix?: string;
}) {
    return (
        <NumberFlowValue
            value={value}
            className={className}
            format={decimalFormat}
            prefix={prefix}
            suffix="%"
        />
    );
}
