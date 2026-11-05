use serde::Serialize;
use std::fmt::Write as _;
use std::time::Instant;

const BASE: u64 = 1_000_000_000;
const BASE_DIGITS: usize = 9;
const KARATSUBA_CUTOFF: usize = 32;
const TRACE_CUTOFF: usize = 1;
const MAX_TRACE_DIGITS: usize = 101;
const MAX_TRACE_STEPS: usize = 2_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AlgorithmStep {
    pub title: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub depth: Option<usize>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiplicationResult {
    pub product: String,
    pub left_digits: usize,
    pub right_digits: usize,
    pub elapsed_micros: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace: Option<Vec<AlgorithmStep>>,
}

struct TraceRecorder {
    enabled: bool,
    steps: Vec<AlgorithmStep>,
}

impl TraceRecorder {
    fn disabled() -> Self {
        Self {
            enabled: false,
            steps: Vec::new(),
        }
    }

    fn enabled() -> Self {
        Self {
            enabled: true,
            steps: Vec::new(),
        }
    }

    fn push(&mut self, depth: usize, title: &str, description: String) {
        if self.enabled && self.steps.len() < MAX_TRACE_STEPS {
            self.steps.push(AlgorithmStep {
                title: title.to_owned(),
                description,
                depth: Some(depth),
            });
        }
    }
}

pub fn multiply_input(input: &str) -> Result<MultiplicationResult, String> {
    let (left, right) = parse_operands(input)?;
    let left_limbs = limbs_from_decimal(&left);
    let right_limbs = limbs_from_decimal(&right);

    // Only the multiplication is timed; parsing, formatting, and tracing stay outside.
    let mut timed_trace = TraceRecorder::disabled();
    let started = Instant::now();
    let product_limbs = karatsuba(
        &left_limbs,
        &right_limbs,
        KARATSUBA_CUTOFF,
        0,
        &mut timed_trace,
    );
    let elapsed_micros = started.elapsed().as_micros().min(u64::MAX as u128) as u64;

    let product = limbs_to_decimal(&product_limbs);
    let trace = if left.len().max(right.len()) <= MAX_TRACE_DIGITS {
        let mut recorder = TraceRecorder::enabled();
        let _ = karatsuba(&left_limbs, &right_limbs, TRACE_CUTOFF, 0, &mut recorder);
        Some(recorder.steps)
    } else {
        None
    };

    Ok(MultiplicationResult {
        product,
        left_digits: left.len(),
        right_digits: right.len(),
        elapsed_micros,
        trace,
    })
}

fn parse_operands(input: &str) -> Result<(String, String), String> {
    let shape_error = || {
        "The input must contain exactly two non-empty decimal integers, one per line.".to_owned()
    };
    let mut lines = input.lines();
    let left_line = lines.next().ok_or_else(shape_error)?;
    let right_line = lines.next().ok_or_else(shape_error)?;
    if lines.next().is_some() {
        return Err(shape_error());
    }

    Ok((parse_operand(left_line)?, parse_operand(right_line)?))
}

fn parse_operand(line: &str) -> Result<String, String> {
    let line = line.trim();
    if line.is_empty() {
        return Err("Each input line must contain a non-empty decimal integer.".to_owned());
    }
    if line.starts_with('-') {
        return Err(
            "Negative integers are not supported; enter non-negative decimals only.".to_owned(),
        );
    }
    if !line.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err("Each input line must contain only decimal digits (0-9).".to_owned());
    }

    let normalized = line.trim_start_matches('0');
    Ok(if normalized.is_empty() {
        "0".to_owned()
    } else {
        normalized.to_owned()
    })
}

// Limbs are little-endian base 1e9, with zero represented by an empty vector.
fn limbs_from_decimal(digits: &str) -> Vec<u32> {
    let mut limbs = Vec::with_capacity(digits.len().div_ceil(BASE_DIGITS));
    let mut end = digits.len();
    while end > 0 {
        let start = end.saturating_sub(BASE_DIGITS);
        let mut value = 0_u32;
        for byte in &digits.as_bytes()[start..end] {
            value = value * 10 + u32::from(byte - b'0');
        }
        limbs.push(value);
        end = start;
    }
    trim_limbs(&mut limbs);
    limbs
}

fn limbs_to_decimal(limbs: &[u32]) -> String {
    let Some((&most_significant, remaining)) = limbs.split_last() else {
        return "0".to_owned();
    };

    let mut output = String::with_capacity(limbs.len() * BASE_DIGITS);
    output.push_str(&most_significant.to_string());
    for limb in remaining.iter().rev() {
        write!(output, "{limb:09}").expect("writing to a String cannot fail");
    }
    output
}

fn karatsuba(
    a: &[u32],
    b: &[u32],
    cutoff: usize,
    depth: usize,
    trace: &mut TraceRecorder,
) -> Vec<u32> {
    let a = canonical_slice(a);
    let b = canonical_slice(b);

    if a.is_empty() || b.is_empty() {
        if trace.enabled {
            trace.push(depth, "Zero operand", "The product is 0.".to_owned());
        }
        return Vec::new();
    }

    // A fixed-size schoolbook base case also keeps very unbalanced inputs linear.
    if a.len() <= cutoff || b.len() <= cutoff {
        let product = schoolbook(a, b);
        if trace.enabled {
            trace.push(
                depth,
                "Base-case multiplication",
                format!(
                    "{} * {} = {}",
                    limbs_to_decimal(a),
                    limbs_to_decimal(b),
                    limbs_to_decimal(&product)
                ),
            );
        }
        return product;
    }

    // Balanced limb splits handle odd lengths and keep recursion depth logarithmic.
    let split = a.len().max(b.len()) / 2;
    let (a0, a1) = split_limbs(a, split);
    let (b0, b1) = split_limbs(b, split);
    let a_sum = add(a0, a1);
    let b_sum = add(b0, b1);

    if trace.enabled {
        trace.push(
            depth,
            "Split operands",
            format!(
                "A = {}\nB = {}\nm = {split} limbs\na0 = {}, a1 = {}\nb0 = {}, b1 = {}",
                limbs_to_decimal(a),
                limbs_to_decimal(b),
                limbs_to_decimal(a0),
                limbs_to_decimal(a1),
                limbs_to_decimal(b0),
                limbs_to_decimal(b1)
            ),
        );
    }

    let z0 = karatsuba(a0, b0, cutoff, depth + 1, trace);
    let z2 = karatsuba(a1, b1, cutoff, depth + 1, trace);
    let z_sum = karatsuba(&a_sum, &b_sum, cutoff, depth + 1, trace);
    let mut z1 = z_sum;
    subtract_in_place(&mut z1, &z0);
    subtract_in_place(&mut z1, &z2);

    let result_len = z0.len().max(split + z1.len()).max(2 * split + z2.len());
    let mut result = vec![0; result_len];
    add_shifted(&mut result, &z0, 0);
    add_shifted(&mut result, &z1, split);
    add_shifted(&mut result, &z2, 2 * split);
    trim_limbs(&mut result);

    if trace.enabled {
        trace.push(
            depth,
            "Combine Karatsuba products",
            format!(
                "z2 = {}\nz1 = {}\nz0 = {}\nA * B = z2 * B^(2m) + z1 * B^m + z0\n= {}",
                limbs_to_decimal(&z2),
                limbs_to_decimal(&z1),
                limbs_to_decimal(&z0),
                limbs_to_decimal(&result)
            ),
        );
    }

    result
}

fn split_limbs(values: &[u32], split: usize) -> (&[u32], &[u32]) {
    let low_end = values.len().min(split);
    let high = if values.len() > split {
        &values[split..]
    } else {
        &[]
    };
    (canonical_slice(&values[..low_end]), canonical_slice(high))
}

fn schoolbook(a: &[u32], b: &[u32]) -> Vec<u32> {
    if a.is_empty() || b.is_empty() {
        return Vec::new();
    }

    let mut product = vec![0_u32; a.len() + b.len()];
    for (i, &left) in a.iter().enumerate() {
        let mut carry = 0_u64;
        for (j, &right) in b.iter().enumerate() {
            let index = i + j;
            let total = u64::from(left) * u64::from(right) + u64::from(product[index]) + carry;
            product[index] = (total % BASE) as u32;
            carry = total / BASE;
        }

        let mut index = i + b.len();
        while carry > 0 {
            if index == product.len() {
                product.push(0);
            }
            let total = u64::from(product[index]) + carry;
            product[index] = (total % BASE) as u32;
            carry = total / BASE;
            index += 1;
        }
    }
    trim_limbs(&mut product);
    product
}

fn add(a: &[u32], b: &[u32]) -> Vec<u32> {
    let mut sum = Vec::with_capacity(a.len().max(b.len()) + 1);
    let mut carry = 0_u64;
    for i in 0..a.len().max(b.len()) {
        let total = u64::from(a.get(i).copied().unwrap_or(0))
            + u64::from(b.get(i).copied().unwrap_or(0))
            + carry;
        sum.push((total % BASE) as u32);
        carry = total / BASE;
    }
    if carry > 0 {
        sum.push(carry as u32);
    }
    sum
}

// The Karatsuba invariant guarantees a >= b at both subtraction sites.
fn subtract_in_place(a: &mut Vec<u32>, b: &[u32]) {
    let mut borrow = 0_i64;
    for i in 0..a.len() {
        let mut value = i64::from(a[i]) - i64::from(b.get(i).copied().unwrap_or(0)) - borrow;
        if value < 0 {
            value += BASE as i64;
            borrow = 1;
        } else {
            borrow = 0;
        }
        a[i] = value as u32;
    }
    debug_assert_eq!(borrow, 0, "Karatsuba subtraction became negative");
    trim_limbs(a);
}

fn add_shifted(target: &mut Vec<u32>, values: &[u32], offset: usize) {
    let mut carry = 0_u64;
    for (i, &value) in values.iter().enumerate() {
        let index = offset + i;
        if index == target.len() {
            target.push(0);
        }
        let total = u64::from(target[index]) + u64::from(value) + carry;
        target[index] = (total % BASE) as u32;
        carry = total / BASE;
    }

    let mut index = offset + values.len();
    while carry > 0 {
        if index == target.len() {
            target.push(0);
        }
        let total = u64::from(target[index]) + carry;
        target[index] = (total % BASE) as u32;
        carry = total / BASE;
        index += 1;
    }
}

fn canonical_slice(mut values: &[u32]) -> &[u32] {
    while values.last() == Some(&0) {
        values = &values[..values.len() - 1];
    }
    values
}

fn trim_limbs(values: &mut Vec<u32>) {
    while values.last() == Some(&0) {
        values.pop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_u128_product(left: &str, right: &str) {
        let expected = (left.parse::<u128>().unwrap() * right.parse::<u128>().unwrap()).to_string();
        let result = multiply_input(&format!("{left}\n{right}")).unwrap();
        assert_eq!(result.product, expected);
    }

    #[test]
    fn multiplies_small_values() {
        for (left, right) in [
            ("1", "1"),
            ("12", "34"),
            ("12345", "6789"),
            ("999999999", "999999999"),
            ("1000000000", "1000000000"),
        ] {
            assert_u128_product(left, right);
        }
    }

    #[test]
    fn handles_zero() {
        for input in ["0\n987654321", "987654321\n0", "000\n000"] {
            assert_eq!(multiply_input(input).unwrap().product, "0");
        }
    }

    #[test]
    fn handles_odd_and_unbalanced_lengths() {
        assert_u128_product("123456789012345678901", "987654321");
        assert_u128_product("7", "99999999999999999999");
    }

    #[test]
    fn normalizes_leading_zeros() {
        let result = multiply_input("0000012\n00034").unwrap();
        assert_eq!(result.product, "408");
        assert_eq!(result.left_digits, 2);
        assert_eq!(result.right_digits, 2);
        assert!(result.trace.is_some());
    }

    #[test]
    fn moderate_case_matches_decimal_schoolbook() {
        let left = "12345678901234567890".repeat(25);
        let right = "98765432109876543210".repeat(22);
        let result = multiply_input(&format!("{left}\n{right}")).unwrap();
        assert_eq!(result.product, reference_product(&left, &right));
        assert!(result.trace.is_none());
    }

    #[test]
    fn rejects_invalid_input() {
        for input in ["", "1", "1\n", "1\n2\n3", "-1\n2", "1\n2a"] {
            assert!(multiply_input(input).is_err(), "accepted {input:?}");
        }
    }

    fn reference_product(left: &str, right: &str) -> String {
        let left: Vec<u32> = left
            .bytes()
            .rev()
            .map(|byte| u32::from(byte - b'0'))
            .collect();
        let right: Vec<u32> = right
            .bytes()
            .rev()
            .map(|byte| u32::from(byte - b'0'))
            .collect();
        let mut digits = vec![0_u32; left.len() + right.len()];

        for i in 0..left.len() {
            for j in 0..right.len() {
                digits[i + j] += left[i] * right[j];
            }
        }

        let mut carry = 0_u32;
        for digit in &mut digits {
            let total = *digit + carry;
            *digit = total % 10;
            carry = total / 10;
        }
        while carry > 0 {
            digits.push(carry % 10);
            carry /= 10;
        }
        while digits.len() > 1 && digits.last() == Some(&0) {
            digits.pop();
        }

        digits
            .iter()
            .rev()
            .map(|digit| char::from(b'0' + *digit as u8))
            .collect()
    }
}
