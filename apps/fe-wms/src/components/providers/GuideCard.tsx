"use client";

import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import type { CardComponentProps } from "nextstepjs";
import { useTranslation } from "@/lib/i18n";

export default function GuideCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) {
  const { t } = useTranslation();
  const copy = t.guide.card;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep + 1 >= totalSteps;

  return (
    <div className="relative w-80 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-4 text-[var(--color-text-primary)] shadow-xl sm:w-96">
      {arrow}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-xxs font-semibold uppercase tracking-normal text-[var(--color-brand-primary)]">
            {copy.step} {currentStep + 1}/{totalSteps}
          </p>
          <h2 className="text-base font-semibold leading-snug tracking-normal">
            {step.title}
          </h2>
        </div>

        {skipTour && (
          <button
            type="button"
            onClick={skipTour}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
            aria-label={copy.skip}
            title={copy.skip}
          >
            <X size={16} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {step.content}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={prevStep}
          disabled={isFirstStep}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)] disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowLeft size={15} strokeWidth={2} />
          {copy.previous}
        </button>

        <button
          type="button"
          onClick={nextStep}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--color-brand-primary)] px-3 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-primary-hover)]"
        >
          {isLastStep ? (
            <>
              <Check size={15} strokeWidth={2} />
              {copy.finish}
            </>
          ) : (
            <>
              {copy.next}
              <ArrowRight size={15} strokeWidth={2} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
