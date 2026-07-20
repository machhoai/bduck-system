export type DecimalInput = string | number;

interface DecimalValue {
  coefficient: bigint;
  scale: number;
}

const powerOfTen = (value: number) => 10n ** BigInt(value);

const expandScientificNotation = (value: string): string => {
  const match = value.match(/^([+-]?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/);
  if (!match) return value;
  const sign = match[1];
  const digits = `${match[2]}${match[3] ?? ""}`;
  const decimalPosition = match[2].length + Number(match[4]);
  if (decimalPosition <= 0) {
    return `${sign}0.${"0".repeat(-decimalPosition)}${digits}`;
  }
  if (decimalPosition >= digits.length) {
    return `${sign}${digits}${"0".repeat(decimalPosition - digits.length)}`;
  }
  return `${sign}${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
};

const normalize = (value: DecimalValue): DecimalValue => {
  let { coefficient, scale } = value;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
};

export const parseDecimal = (input: DecimalInput): DecimalValue => {
  if (typeof input === "number" && !Number.isFinite(input)) {
    throw new Error("DECIMAL_INPUT_NOT_FINITE");
  }
  const text = expandScientificNotation(String(input).trim());
  const match = text.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error("DECIMAL_INPUT_INVALID");
  const scale = match[3]?.length ?? 0;
  const coefficient = BigInt(`${match[1]}${match[2]}${match[3] ?? ""}`);
  return normalize({ coefficient, scale });
};

const align = (left: DecimalValue, right: DecimalValue) => {
  const scale = Math.max(left.scale, right.scale);
  return {
    left: left.coefficient * powerOfTen(scale - left.scale),
    right: right.coefficient * powerOfTen(scale - right.scale),
    scale,
  };
};

const roundQuotient = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator === 0n) throw new Error("DECIMAL_DIVISION_BY_ZERO");
  const negative = (numerator < 0n) !== (denominator < 0n);
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  const quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  const rounded = remainder * 2n >= absoluteDenominator ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
};

export const addDecimal = (left: DecimalValue, right: DecimalValue): DecimalValue => {
  const values = align(left, right);
  return normalize({ coefficient: values.left + values.right, scale: values.scale });
};

export const subtractDecimal = (
  left: DecimalValue,
  right: DecimalValue,
): DecimalValue => {
  const values = align(left, right);
  return normalize({ coefficient: values.left - values.right, scale: values.scale });
};

export const multiplyDecimal = (
  left: DecimalValue,
  right: DecimalValue,
): DecimalValue => normalize({
  coefficient: left.coefficient * right.coefficient,
  scale: left.scale + right.scale,
});

export const divideDecimal = (
  left: DecimalValue,
  right: DecimalValue,
  targetScale: number,
): DecimalValue => {
  const numerator = left.coefficient * powerOfTen(right.scale + targetScale);
  const denominator = right.coefficient * powerOfTen(left.scale);
  return normalize({
    coefficient: roundQuotient(numerator, denominator),
    scale: targetScale,
  });
};

export const roundDecimal = (
  value: DecimalValue,
  targetScale: number,
): DecimalValue => {
  if (value.scale <= targetScale) {
    return normalize({
      coefficient: value.coefficient * powerOfTen(targetScale - value.scale),
      scale: targetScale,
    });
  }
  return normalize({
    coefficient: roundQuotient(
      value.coefficient,
      powerOfTen(value.scale - targetScale),
    ),
    scale: targetScale,
  });
};

export const compareDecimal = (left: DecimalValue, right: DecimalValue): number => {
  const values = align(left, right);
  return values.left === values.right ? 0 : values.left > values.right ? 1 : -1;
};

export const decimalToString = (value: DecimalValue): string => {
  const negative = value.coefficient < 0n;
  const digits = String(negative ? -value.coefficient : value.coefficient).padStart(
    value.scale + 1,
    "0",
  );
  const text = value.scale === 0
    ? digits
    : `${digits.slice(0, -value.scale)}.${digits.slice(-value.scale)}`;
  return negative ? `-${text}` : text;
};

export const decimalToNumber = (value: DecimalValue): number =>
  Number(decimalToString(value));

export const zeroDecimal = (): DecimalValue => ({ coefficient: 0n, scale: 0 });
