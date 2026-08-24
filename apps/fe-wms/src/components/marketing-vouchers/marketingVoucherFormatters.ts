export const formatVoucherNumber = (value: number, lang: string) =>
  new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "vi-VN").format(value);

export const formatVoucherDateTime = (value: Date | null, lang: string) =>
  value
    ? new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(value)
    : "—";

export const formatVoucherReward = (
  rewardType: string,
  rewardValue: number,
  lang: string,
) => {
  if (rewardType === "DISCOUNT_PERCENT") return `${rewardValue}%`;
  if (rewardType === "DISCOUNT_FIXED") {
    return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(rewardValue);
  }
  return rewardValue > 1 ? `×${formatVoucherNumber(rewardValue, lang)}` : "×1";
};
