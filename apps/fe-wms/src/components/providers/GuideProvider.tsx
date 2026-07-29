"use client";

import { useEffect, useMemo, useState } from "react";
import { NextStepProvider, NextStep } from "nextstepjs";
import { useTranslation } from "@/lib/i18n";
import { getGuideTours } from "../../config/tours";
import { getVoucherGuideSelectors } from "../../config/guides/voucherTours";
import GuideCard from "./GuideCard";

const voucherSelectors = getVoucherGuideSelectors();

function getVisibleVoucherSelectors() {
    return voucherSelectors.filter((selector) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element || element.getClientRects().length === 0) return false;
        const style = window.getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
    });
}

export default function GuideProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { t } = useTranslation();
    const [visibleVoucherSelectors, setVisibleVoucherSelectors] = useState<string[] | null>(null);

    useEffect(() => {
        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const next = getVisibleVoucherSelectors();
                setVisibleVoucherSelectors((current) =>
                    current !== null &&
                        current.length === next.length &&
                        current.every((selector, index) => selector === next[index])
                        ? current
                        : next,
                );
            });
        };

        update();
        const observer = new MutationObserver(update);
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener("resize", update);
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            window.removeEventListener("resize", update);
        };
    }, []);

    const tours = useMemo(
        () =>
            getGuideTours(
                t.guide,
                visibleVoucherSelectors ? new Set(visibleVoucherSelectors) : null,
            ),
        [t.guide, visibleVoucherSelectors],
    );

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
