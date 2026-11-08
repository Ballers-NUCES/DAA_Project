use crate::model::{AlgorithmStep, TraceRecorder};
use rayon::join;
use serde::Serialize;
use specta::Type;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;
use std::time::Instant;

const BASE: u64 = 1_000_000_000;
const BASE32: u32 = 1_000_000_000;
const BASE_DIGITS: usize = 9;
const KARATSUBA_CUTOFF: usize = 64;
const PARALLEL_THRESHOLD: usize = 4_096; // limbs
const ROWS_PER_PASS: usize = 16;
const TRACE_CUTOFF: usize = 1;
const MAX_TRACE_DIGITS: usize = 101;
const MULTIPLICATION_FILES: [&str; 10] = [
    "im01.txt", "im02.txt", "im03.txt", "im04.txt", "im05.txt", "im06.txt", "im07.txt", "im08.txt",
    "im09.txt", "im10.txt",
];

#[derive(Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MultiplicationResult {
    pub product: String,
    pub left_digits: usize,
    pub right_digits: usize,
    pub elapsed_micros: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace: Option<Vec<AlgorithmStep>>,
}

#[derive(Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MultiplicationFileResult {
    pub file_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<MultiplicationResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum KaratsubaProgressEvent {
    #[serde(rename_all = "camelCase")]
    Started { index: usize, file_name: String },
    #[serde(rename_all = "camelCase")]
    Finished {
        index: usize,
        file: MultiplicationFileResult,
    },
}

#[derive(Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MultiplicationBatchResult {
    pub source: String,
    pub files: Vec<MultiplicationFileResult>,
    pub total_files: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub total_elapsed_micros: u64,
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
        Some(recorder.into_steps())
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

#[cfg(test)]
pub fn multiply_folder(directory: &str) -> Result<MultiplicationBatchResult, String> {
    multiply_folder_with_progress(directory, |_| {})
}

pub fn multiply_folder_with_progress(
    directory: &str,
    mut on_progress: impl FnMut(KaratsubaProgressEvent),
) -> Result<MultiplicationBatchResult, String> {
    let directory = directory.trim().trim_matches('"').trim_matches('\'').trim();
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
        let path = directory_path.join(file_name);
        (
            (*file_name).to_owned(),
            move || {
                fs::read_to_string(&path).map_err(|error| {
                    format!("The file could not be read: {error}. Generate the datasets or choose a different file.")
                })
            },
        )
    });
    Ok(multiply_named_files(
        directory.to_owned(),
        inputs,
        &mut on_progress,
    ))
}

#[cfg(test)]
pub fn multiply_files(paths: Vec<String>) -> Result<MultiplicationBatchResult, String> {
    multiply_files_with_progress(paths, |_| {})
}

pub fn multiply_files_with_progress(
    paths: Vec<String>,
    mut on_progress: impl FnMut(KaratsubaProgressEvent),
) -> Result<MultiplicationBatchResult, String> {
    if paths.is_empty() {
        return Err(
            "Choose at least one multiplication input file before running Karatsuba.".to_owned(),
        );
    }

    let inputs = paths.into_iter().map(|path| {
        let file_name = Path::new(&path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(&path)
            .to_owned();
        (file_name, move || {
            fs::read_to_string(&path).map_err(|error| {
                format!("The file could not be read: {error}. Choose a readable plain-text file.")
            })
        })
    });
    Ok(multiply_named_files(
        "Selected files".to_owned(),
        inputs,
        &mut on_progress,
    ))
}

fn multiply_named_files<F>(
    source: String,
    inputs: impl IntoIterator<Item = (String, F)>,
    on_progress: &mut impl FnMut(KaratsubaProgressEvent),
) -> MultiplicationBatchResult
where
    F: FnOnce() -> Result<String, String>,
{
    let mut files = Vec::new();
    let mut succeeded = 0;
    let mut total_elapsed_micros = 0_u128;

    for (index, (file_name, load_input)) in inputs.into_iter().enumerate() {
        on_progress(KaratsubaProgressEvent::Started {
            index,
            file_name: file_name.clone(),
        });

        let outcome = load_input().and_then(|content| multiply_input(&content));
        let file_result = match outcome {
            Ok(result) => {
                total_elapsed_micros += u128::from(result.elapsed_micros);
                succeeded += 1;
                MultiplicationFileResult {
                    file_name,
                    result: Some(result),
                    error: None,
                }
            }
            Err(error) => MultiplicationFileResult {
                file_name,
                result: None,
                error: Some(error),
            },
        };

        on_progress(KaratsubaProgressEvent::Finished {
            index,
            file: file_result.clone(),
        });
        files.push(file_result);
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
    let mut lines = input.trim_end().lines();
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

// ---------------------------------------------------------------------------
// Traced (teaching) Karatsuba: used for the step-by-step view on small inputs.
// ---------------------------------------------------------------------------

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
        if trace.is_active() {
            trace.push(depth, "Zero operand", "The product is 0.".to_owned());
        }
        return Vec::new();
    }

    // A fixed-size schoolbook base case also keeps very unbalanced inputs linear.
    if a.len() <= cutoff || b.len() <= cutoff {
        let product = schoolbook(a, b);
        if trace.is_active() {
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

    if trace.is_active() {
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

    if trace.is_active() {
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

// ---------------------------------------------------------------------------
// Fast path
//
// * Balanced operands are zero-padded to base * 2^k (base <= cutoff, < 3% waste),
//   so every recursion level splits exactly in half.
// * The (a0 + a1)(b0 + b1) carry bits are handled separately, so the middle
//   product also has exactly n/2 limbs.
// * One scratch buffer per sequential subtree: no allocation inside recursion.
// * Unbalanced operands are cut into chunks the size of the shorter operand.
// * The leaf schoolbook defers carries: no serial carry chain per pass.
// ---------------------------------------------------------------------------

fn karatsuba_parallel(a: &[u32], b: &[u32]) -> Vec<u32> {
    karatsuba_rayon_with_threshold(a, b, PARALLEL_THRESHOLD)
}

fn karatsuba_rayon_with_threshold(a: &[u32], b: &[u32], threshold: usize) -> Vec<u32> {
    let a = canonical_slice(a);
    let b = canonical_slice(b);
    if a.is_empty() || b.is_empty() {
        return Vec::new();
    }
    let (long, short) = if a.len() >= b.len() { (a, b) } else { (b, a) };
    let mut product = vec![0_u32; long.len() + short.len()];
    multiply_into(&mut product, long, short, threshold);
    trim_limbs(&mut product);
    product
}

/// Writes long * short into `out` (out.len() == long.len() + short.len()).
fn multiply_into(out: &mut [u32], long: &[u32], short: &[u32], threshold: usize) {
    debug_assert!(long.len() >= short.len());
    debug_assert_eq!(out.len(), long.len() + short.len());
    if short.len() <= KARATSUBA_CUTOFF {
        schoolbook_into(out, long, short); // linear for very unbalanced inputs
    } else if long.len() >= 2 * short.len() {
        multiply_unbalanced(out, long, short, threshold);
    } else {
        multiply_balanced(out, long, short, threshold);
    }
}

fn multiply_unbalanced(out: &mut [u32], long: &[u32], short: &[u32], threshold: usize) {
    let chunk_len = short.len();
    out.fill(0);
    let mut buffer = vec![0_u32; 2 * chunk_len];
    for (index, chunk) in long.chunks(chunk_len).enumerate() {
        let chunk = canonical_slice(chunk);
        if chunk.is_empty() {
            continue;
        }
        let product = &mut buffer[..chunk.len() + chunk_len];
        multiply_into(product, short, chunk, threshold);
        let carry = add_assign(&mut out[index * chunk_len..], product);
        debug_assert_eq!(carry, 0);
    }
}

fn multiply_balanced(out: &mut [u32], long: &[u32], short: &[u32], threshold: usize) {
    let n = padded_len(long.len());
    let mut a = vec![0_u32; n];
    let mut b = vec![0_u32; n];
    a[..long.len()].copy_from_slice(long);
    b[..short.len()].copy_from_slice(short);
    let mut product = vec![0_u32; 2 * n];
    karatsuba_par(&mut product, &a, &b, threshold);
    out.copy_from_slice(&product[..out.len()]);
}

/// Smallest base * 2^k >= len with base <= KARATSUBA_CUTOFF.
fn padded_len(len: usize) -> usize {
    let mut base = len;
    let mut factor = 1;
    while base > KARATSUBA_CUTOFF {
        base = base.div_ceil(2);
        factor *= 2;
    }
    base * factor
}

fn scratch_len(n: usize) -> usize {
    4 * n + 64
}

/// Parallel top levels; hands sequential subtrees their own scratch buffer.
fn karatsuba_par(out: &mut [u32], a: &[u32], b: &[u32], threshold: usize) {
    let n = a.len();
    if n < threshold || n <= KARATSUBA_CUTOFF || n % 2 != 0 {
        let mut scratch = vec![0_u32; scratch_len(n)];
        karatsuba_seq(out, a, b, &mut scratch);
        return;
    }

    let h = n / 2;
    let (a0, a1) = a.split_at(h);
    let (b0, b1) = b.split_at(h);
    let mut sa = vec![0_u32; h];
    let mut sb = vec![0_u32; h];
    let mut t = vec![0_u32; n + 1];
    let ca = add_to(&mut sa, a0, a1);
    let cb = add_to(&mut sb, b0, b1);

    {
        let (z0, z2) = out.split_at_mut(n);
        let (t_low, _) = t.split_at_mut(n);
        let (sa, sb) = (&sa[..], &sb[..]);
        join(
            || {
                join(
                    || karatsuba_par(z0, a0, b0, threshold),
                    || karatsuba_par(z2, a1, b1, threshold),
                )
            },
            || karatsuba_par(t_low, sa, sb, threshold),
        );
    }
    combine_middle(out, &mut t, &sa, &sb, ca, cb);
}

/// out.len() == 2n, a.len() == b.len() == n, scratch.len() >= scratch_len(n).
fn karatsuba_seq(out: &mut [u32], a: &[u32], b: &[u32], scratch: &mut [u32]) {
    let n = a.len();
    debug_assert!(b.len() == n && out.len() == 2 * n);
    if n <= KARATSUBA_CUTOFF || n % 2 != 0 {
        schoolbook_into(out, a, b);
        return;
    }

    let h = n / 2;
    let (a0, a1) = a.split_at(h);
    let (b0, b1) = b.split_at(h);
    {
        let (z0, z2) = out.split_at_mut(n);
        karatsuba_seq(z0, a0, b0, scratch);
        karatsuba_seq(z2, a1, b1, scratch);
    }

    let (sa, tail) = scratch.split_at_mut(h);
    let (sb, tail) = tail.split_at_mut(h);
    let (t, rest) = tail.split_at_mut(n + 1);
    let ca = add_to(sa, a0, a1);
    let cb = add_to(sb, b0, b1);
    karatsuba_seq(&mut t[..n], sa, sb, rest);
    combine_middle(out, t, sa, sb, ca, cb);
}

/// out = [z0 | z2] on entry. t[..n] = (a0+a1 mod B^h) * (b0+b1 mod B^h).
/// Adds z1 = (a0+a1)(b0+b1) - z0 - z2 into out at offset h.
fn combine_middle(out: &mut [u32], t: &mut [u32], sa: &[u32], sb: &[u32], ca: u32, cb: u32) {
    let n = t.len() - 1;
    let h = n / 2;
    t[n] = 0;
    // (sa + ca*B^h)(sb + cb*B^h) = sa*sb + B^h (ca*sb + cb*sa) + ca*cb*B^2h
    if ca != 0 {
        let carry = add_assign(&mut t[h..], sb);
        debug_assert_eq!(carry, 0);
    }
    if cb != 0 {
        let carry = add_assign(&mut t[h..], sa);
        debug_assert_eq!(carry, 0);
    }
    t[n] += ca & cb;

    let borrow = sub_assign(t, &out[..n]);
    debug_assert_eq!(borrow, 0);
    let borrow = sub_assign(t, &out[n..]);
    debug_assert_eq!(borrow, 0);

    let carry = add_assign(&mut out[h..], t);
    debug_assert_eq!(carry, 0);
}

// --- Leaf multiplication ----------------------------------------------------

fn schoolbook(a: &[u32], b: &[u32]) -> Vec<u32> {
    if a.is_empty() || b.is_empty() {
        return Vec::new();
    }
    let mut product = vec![0_u32; a.len() + b.len()];
    schoolbook_into(&mut product, a, b);
    trim_limbs(&mut product);
    product
}

fn schoolbook_into(out: &mut [u32], a: &[u32], b: &[u32]) {
    debug_assert_eq!(out.len(), a.len() + b.len());
    let mut stack = [0_u64; 2 * KARATSUBA_CUTOFF];
    let mut heap: Vec<u64>;
    let acc: &mut [u64] = if out.len() <= stack.len() {
        &mut stack[..out.len()]
    } else {
        heap = vec![0; out.len()];
        &mut heap
    };
    multiply_accumulate(acc, a, b);
    resolve_carries(out, acc);
}

/// Row-wise product into u64 slots without full normalization. Every
/// ROWS_PER_PASS rows the carries are pushed up one slot (independent per slot,
/// no serial chain). Slots stay below ~4e10 after a pass, and
/// 16 * (1e9-1)^2 + 4e10 < 2^64, so nothing overflows.
fn multiply_accumulate(acc: &mut [u64], a: &[u32], b: &[u32]) {
    let (a, b) = if a.len() <= b.len() { (a, b) } else { (b, a) };
    let mut first = 0;
    for rows in a.chunks(ROWS_PER_PASS) {
        for (row, &left) in rows.iter().enumerate() {
            let left = u64::from(left);
            let start = first + row;
            for (slot, &right) in acc[start..start + b.len()].iter_mut().zip(b) {
                *slot += left * u64::from(right);
            }
        }
        let next = first + rows.len();
        if next < a.len() {
            // Touched slots end at next + b.len() - 2; the last window slot
            // absorbs the final carry.
            defer_carries(&mut acc[first..next + b.len()]);
        }
        first = next;
    }
}

fn defer_carries(window: &mut [u64]) {
    let (spill, body) = window
        .split_last_mut()
        .expect("carry window is never empty");
    let mut carry = 0_u64;
    for slot in body.iter_mut() {
        let value = *slot;
        let quotient = value / BASE;
        *slot = value - quotient * BASE + carry;
        carry = quotient;
    }
    *spill += carry;
}

fn resolve_carries(out: &mut [u32], acc: &[u64]) {
    let mut carry = 0_u64;
    for (limb, &value) in out.iter_mut().zip(acc) {
        let total = value + carry;
        let quotient = total / BASE;
        *limb = (total - quotient * BASE) as u32;
        carry = quotient;
    }
    debug_assert_eq!(carry, 0, "schoolbook product overflowed its buffer");
}

// --- Limb arithmetic (branch-free carries) ------------------------------------

/// dst = x + y (equal lengths), returns the carry out.
fn add_to(dst: &mut [u32], x: &[u32], y: &[u32]) -> u32 {
    let mut carry = 0_u32;
    for ((slot, &p), &q) in dst.iter_mut().zip(x).zip(y) {
        let sum = p + q + carry;
        carry = u32::from(sum >= BASE32);
        *slot = sum - carry * BASE32;
    }
    carry
}

/// target += values (values.len() <= target.len()), returns the carry out.
fn add_assign(target: &mut [u32], values: &[u32]) -> u32 {
    debug_assert!(values.len() <= target.len());
    let (head, tail) = target.split_at_mut(values.len());
    let mut carry = 0_u32;
    for (slot, &value) in head.iter_mut().zip(values) {
        let sum = *slot + value + carry;
        carry = u32::from(sum >= BASE32);
        *slot = sum - carry * BASE32;
    }
    for slot in tail.iter_mut() {
        if carry == 0 {
            break;
        }
        let sum = *slot + carry;
        carry = u32::from(sum >= BASE32);
        *slot = sum - carry * BASE32;
    }
    carry
}

/// target -= values (values.len() <= target.len()), returns the borrow out.
fn sub_assign(target: &mut [u32], values: &[u32]) -> u32 {
    debug_assert!(values.len() <= target.len());
    let (head, tail) = target.split_at_mut(values.len());
    let mut borrow = 0_u32;
    for (slot, &value) in head.iter_mut().zip(values) {
        let (diff, under) = slot.overflowing_sub(value + borrow);
        borrow = u32::from(under);
        *slot = diff.wrapping_add(borrow * BASE32);
    }
    for slot in tail.iter_mut() {
        if borrow == 0 {
            break;
        }
        let (diff, under) = slot.overflowing_sub(borrow);
        borrow = u32::from(under);
        *slot = diff.wrapping_add(borrow * BASE32);
    }
    borrow
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Independent reference: plain decimal schoolbook on digit vectors.
    fn reference_product(left: &str, right: &str) -> String {
        let a: Vec<u64> = left.bytes().rev().map(|d| u64::from(d - b'0')).collect();
        let b: Vec<u64> = right.bytes().rev().map(|d| u64::from(d - b'0')).collect();
        let mut acc = vec![0_u64; a.len() + b.len()];
        for (i, &x) in a.iter().enumerate() {
            for (j, &y) in b.iter().enumerate() {
                acc[i + j] += x * y;
            }
        }
        let mut carry = 0_u64;
        for slot in acc.iter_mut() {
            let total = *slot + carry;
            *slot = total % 10;
            carry = total / 10;
        }
        let mut digits: String = acc
            .iter()
            .rev()
            .map(|&d| char::from(b'0' + d as u8))
            .collect();
        let trimmed = digits.trim_start_matches('0').to_owned();
        digits = if trimmed.is_empty() {
            "0".to_owned()
        } else {
            trimmed
        };
        digits
    }

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
        assert_eq!(multiply_input("12\n34\n\n").unwrap().product, "408");
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
        let parallel = karatsuba_rayon_with_threshold(&left_limbs, &right_limbs, 1_024);
        assert_eq!(parallel, sequential);
    }

    #[test]
    fn fast_path_matches_reference_on_stress_shapes() {
        let nines = |n: usize| "9".repeat(n);
        let pow10 = |n: usize| format!("1{}", "0".repeat(n - 1));
        let sparse = |n: usize| format!("7{}7", "0".repeat(n - 2));
        let cases = [
            (nines(4_000), nines(3_500)),
            (nines(6_000), nines(900)),
            (pow10(5_000), pow10(4_999)),
            (sparse(4_321), nines(4_321)),
            (
                "12345678901234567890".repeat(250),
                "98765432109876543210".repeat(80),
            ),
        ];
        for (left, right) in cases {
            let result = multiply_input(&format!("{left}\n{right}")).unwrap();
            assert_eq!(result.product, reference_product(&left, &right));
        }
    }

    #[test]
    fn rejects_invalid_input() {
        for input in ["", "1", "1\n", "1\n   \n", "1\n2\n3", "-1\n2", "1\n2a"] {
            assert!(multiply_input(input).is_err(), "accepted {input:?}");
        }
    }

    #[test]
    fn batches_preserve_file_order_and_continue_after_errors() {
        let directory = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join(format!("test-karatsuba-files-{}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        for (file_name, content) in [
            ("first.txt", "12\n34"),
            ("invalid.txt", "not a number"),
            ("last.txt", "0\n999"),
        ] {
            fs::write(directory.join(file_name), content).unwrap();
        }
        let paths = ["first.txt", "invalid.txt", "last.txt"]
            .map(|file_name| directory.join(file_name).to_string_lossy().into_owned())
            .to_vec();

        let batch = multiply_files(paths).unwrap();
        fs::remove_dir_all(&directory).unwrap();

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

        let quoted_path = format!("  \"{}\"  ", directory.to_str().unwrap());
        let batch = multiply_folder(&quoted_path).unwrap();
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
    fn folder_errors_are_reported() {
        assert!(multiply_folder("").is_err());
        assert!(multiply_folder("relative/path").is_err());
    }
}
