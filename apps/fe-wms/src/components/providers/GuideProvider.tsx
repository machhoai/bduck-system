"use client";

import { NextStepProvider, NextStep } from "nextstepjs";
import { tours } from "../../config/tours";

export default function GuideProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <NextStepProvider>
            <NextStep steps={tours}>{children}</NextStep>
        </NextStepProvider>
    );
}
