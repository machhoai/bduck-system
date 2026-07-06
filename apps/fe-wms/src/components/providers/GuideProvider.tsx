"use client";

import { NextStepProvider, NextStep } from "nextstepjs";
import { useTranslation } from "@/lib/i18n";
import { getGuideTours } from "../../config/tours";
import GuideCard from "./GuideCard";

export default function GuideProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { t } = useTranslation();
    const tours = getGuideTours(t.guide);

    return (
        <NextStepProvider>
            <NextStep
                steps={tours}
                cardComponent={GuideCard}
                shadowRgb="29, 29, 31"
                shadowOpacity="0.28"
                overlayZIndex={9000}
                disableConsoleLogs
                scrollToTop={false}
            >
                {children}
            </NextStep>
        </NextStepProvider>
    );
}
