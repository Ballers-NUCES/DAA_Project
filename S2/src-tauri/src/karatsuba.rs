use serde::{Deserialize, Serialize};
use std::fmt::Write as _;
use std::fs;
use std::path::Path;
use std::thread;
use std::time::Instant;

const BASE: u64 = 1_000_000_000;
const BASE_DIGITS: usize = 9;
const KARATSUBA_CUTOFF: usize = 64;
const PARALLEL_THRESHOLD: usize = 16_384;
const TRACE_CUTOFF: usize = 1;
const MAX_TRACE_DIGITS: usize = 101;
const MAX_TRACE_STEPS: usize = 2_000;
const MULTIPLICATION_FILES: [&str; 10] = [
    "im01.txt", "im02.txt", "im03.txt", "im04.txt", "im05.txt", "im06.txt", "im07.txt", "im08.txt",
    "im09.txt", "im10.txt",
];

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

#[derive(Deserialize)]
pub struct DecimalInput {
    pub name: String,
    pub content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiplicationFileResult {
    pub file_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<MultiplicationResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiplicationBatchResult {
    pub source: String,
    pub files: Vec<MultiplicationFileResult>,
    pub total_files: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub total_elapsed_micros: u64,
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
    let started = Instant::now();
    let product_limbs = karatsuba_parallel(&left_limbs, &right_limbs);
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

pub fn multiply_folder(directory: &str) -> Result<MultiplicationBatchResult, String> {
    let directory = directory.trim();
    if directory.is_empty() {
        return Err("Enter the Karatsuba dataset folder before running the batch.".to_owned());
    }
    let directory_path = Path::new(directory);
    if !directory_path.is_absolute() {
        return Err("The Karatsuba dataset folder must be an absolute path.".to_owned());
    }
    if !directory_path.is_dir() {
        return Err(
            "The Karatsuba dataset folder does not exist. Choose the folder containing im01.txt through im10.txt."
                .to_owned(),
        );
    }

    let inputs = MULTIPLICATION_FILES.iter().map(|file_name| {
        let content = fs::read_to_string(directory_path.join(file_name)).map_err(|error| {
            format!("The file could not be read: {error}. Generate the datasets or choose a different file.")
        });
        ((*file_name).to_owned(), content)
    });
    Ok(multiply_named_files(directory.to_owned(), inputs))
}

pub fn multiply_files(inputs: Vec<DecimalInput>) -> Result<MultiplicationBatchResult, String> {
    if inputs.is_empty() {
        return Err(
            "Choose at least one multiplication input file before running Karatsuba.".to_owned(),
        );
    }

    let inputs = inputs
        .into_iter()
        .map(|input| (input.name, Ok(input.content)));
    Ok(multiply_named_files("Selected files".to_owned(), inputs))
}

fn multiply_named_files(
    source: String,
    inputs: impl IntoIterator<Item = (String, Result<String, String>)>,
) -> MultiplicationBatchResult {
    let mut files = Vec::new();
    let mut succeeded = 0;
    let mut total_elapsed_micros = 0_u128;

    for (file_name, input) in inputs {
        let outcome = input.and_then(|content| multiply_input(&content));
        match outcome {
            Ok(result) => {
                total_elapsed_micros += u128::from(result.elapsed_micros);
                succeeded += 1;
                files.push(MultiplicationFileResult {
                    file_name,
                    result: Some(result),
                    error: None,
                });
            }
            Err(error) => files.push(MultiplicationFileResult {
                file_name,
                result: None,
                error: Some(error),
            }),
        }
    }

    let total_files = files.len();
    MultiplicationBatchResult {
        source,
        total_files,
        succeeded,
        failed: total_files - succeeded,
        total_elapsed_micros: total_elapsed_micros.min(u128::from(u64::MAX)) as u64,
        files,
    }
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
    let z1 = middle_term(z_sum, &z0, &z2);
    let result = assemble(&z0, &z1, &z2, split);

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

fn karatsuba_parallel(a: &[u32], b: &[u32]) -> Vec<u32> {
    karatsuba_parallel_with_threshold(a, b, PARALLEL_THRESHOLD)
}

fn karatsuba_parallel_with_threshold(a: &[u32], b: &[u32], threshold: usize) -> Vec<u32> {
    let a = canonical_slice(a);
    let b = canonical_slice(b);

    if a.is_empty() || b.is_empty() {
        return Vec::new();
    }
    if a.len().max(b.len()) < threshold || a.len().min(b.len()) <= KARATSUBA_CUTOFF {
        return karatsuba(
            a,
            b,
            KARATSUBA_CUTOFF,
            0,
            &mut TraceRecorder::disabled(),
        );
    }

    let split = a.len().max(b.len()) / 2;
    let (a0, a1) = split_limbs(a, split);
    let (b0, b1) = split_limbs(b, split);
    let a_sum = add(a0, a1);
    let b_sum = add(b0, b1);

    thread::scope(|scope| {
        let z0_worker = scope.spawn(move || karatsuba_parallel_with_threshold(a0, b0, threshold));
        let z2_worker = scope.spawn(move || karatsuba_parallel_with_threshold(a1, b1, threshold));
        let z_sum = karatsuba_parallel_with_threshold(&a_sum, &b_sum, threshold);

        let z0 = z0_worker
            .join()
            .expect("the Karatsuba z0 worker thread panicked");
        let z2 = z2_worker
            .join()
            .expect("the Karatsuba z2 worker thread panicked");
        let z1 = middle_term(z_sum, &z0, &z2);
        assemble(&z0, &z1, &z2, split)
    })
}

fn middle_term(mut z_sum: Vec<u32>, z0: &[u32], z2: &[u32]) -> Vec<u32> {
    subtract_in_place(&mut z_sum, z0);
    subtract_in_place(&mut z_sum, z2);
    z_sum
}

fn assemble(z0: &[u32], z1: &[u32], z2: &[u32], split: usize) -> Vec<u32> {
    let result_len = z0.len().max(split + z1.len()).max(2 * split + z2.len());
    let mut result = vec![0; result_len];
    add_shifted(&mut result, z0, 0);
    add_shifted(&mut result, z1, split);
    add_shifted(&mut result, z2, 2 * split);
    trim_limbs(&mut result);
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

    // Iterate the shorter operand so normalization passes cost less.
    let (a, b) = if a.len() <= b.len() { (a, b) } else { (b, a) };
    const ROWS_PER_PASS: usize = 16;

    let mut accumulated = vec![0_u64; a.len() + b.len()];
    for (chunk_index, rows) in a.chunks(ROWS_PER_PASS).enumerate() {
        for (row, &left) in rows.iter().enumerate() {
            let start = chunk_index * ROWS_PER_PASS + row;
            let left = u64::from(left);
            for (slot, &right) in accumulated[start..start + b.len()].iter_mut().zip(b) {
                *slot += left * u64::from(right);
            }
        }

        let mut carry = 0_u64;
        for slot in &mut accumulated {
            let total = *slot + carry;
            *slot = total % BASE;
            carry = total / BASE;
        }
        debug_assert_eq!(carry, 0, "schoolbook normalization overflowed its buffer");
    }

    let mut product: Vec<u32> = accumulated.into_iter().map(|value| value as u32).collect();
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
    fn parallel_and_sequential_paths_agree() {
        let left = "12345678901234567890".repeat(500);
        let right = "98765432109876543210".repeat(500);
        let left_limbs = limbs_from_decimal(&left);
        let right_limbs = limbs_from_decimal(&right);
        let sequential = karatsuba(
            &left_limbs,
            &right_limbs,
            KARATSUBA_CUTOFF,
            0,
            &mut TraceRecorder::disabled(),
        );
        let parallel = karatsuba_parallel_with_threshold(&left_limbs, &right_limbs, 1_024);
        assert_eq!(parallel, sequential);
    }

    #[test]
    fn rejects_invalid_input() {
        for input in ["", "1", "1\n", "1\n2\n3", "-1\n2", "1\n2a"] {
            assert!(multiply_input(input).is_err(), "accepted {input:?}");
        }
    }

    #[test]
    fn batches_preserve_file_order_and_continue_after_errors() {
        let batch = multiply_files(vec![
            DecimalInput {
                name: "first.txt".to_owned(),
                content: "12\n34".to_owned(),
            },
            DecimalInput {
                name: "invalid.txt".to_owned(),
                content: "not a number".to_owned(),
            },
            DecimalInput {
                name: "last.txt".to_owned(),
                content: "0\n999".to_owned(),
            },
        ])
        .unwrap();

        assert_eq!(batch.total_files, 3);
        assert_eq!(batch.succeeded, 2);
        assert_eq!(batch.failed, 1);
        assert_eq!(batch.files[0].file_name, "first.txt");
        assert_eq!(batch.files[0].result.as_ref().unwrap().product, "408");
        assert!(batch.files[1].error.is_some());
        assert_eq!(batch.files[2].file_name, "last.txt");
        assert_eq!(batch.files[2].result.as_ref().unwrap().product, "0");
        let expected_micros: u128 = batch
            .files
            .iter()
            .filter_map(|file| file.result.as_ref())
            .map(|result| u128::from(result.elapsed_micros))
            .sum();
        assert_eq!(u128::from(batch.total_elapsed_micros), expected_micros);
    }

    #[test]
    fn reads_a_dataset_folder_in_assignment_order() {
        let directory = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join(format!("test-karatsuba-folder-{}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        for (index, file_name) in MULTIPLICATION_FILES.iter().enumerate() {
            fs::write(directory.join(file_name), format!("{}\n2", index + 1)).unwrap();
        }

        let batch = multiply_folder(directory.to_str().unwrap()).unwrap();
        fs::remove_dir_all(&directory).unwrap();

        assert_eq!(batch.total_files, 10);
        assert_eq!(batch.succeeded, 10);
        assert_eq!(batch.failed, 0);
        for (index, file) in batch.files.iter().enumerate() {
            assert_eq!(file.file_name, MULTIPLICATION_FILES[index]);
            assert_eq!(
                file.result.as_ref().unwrap().product,
                ((index + 1) * 2).to_string()
            );
        }
    }

    #[test]
    fn rejects_an_empty_batch() {
        assert!(multiply_files(Vec::new()).is_err());
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
