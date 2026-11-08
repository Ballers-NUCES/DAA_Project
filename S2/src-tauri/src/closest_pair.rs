use crate::model::{AlgorithmStep, TraceRecorder};
use rayon::join;
use serde::Serialize;
use specta::Type;
use std::fs;
use std::path::Path;
use std::time::Instant;

const CLOSEST_PAIR_FILES: [&str; 10] = [
    "cp01.txt", "cp02.txt", "cp03.txt", "cp04.txt", "cp05.txt", "cp06.txt", "cp07.txt", "cp08.txt",
    "cp09.txt", "cp10.txt",
];
const MAX_TRACE_POINTS: usize = 101;
const PARALLEL_THRESHOLD: usize = 16_384;
const BASE_CASE_LIMIT: usize = 16;
const TRACE_BASE_CASE_LIMIT: usize = 3;
const SMALL_SORT_LIMIT: usize = 16;
const RADIX_BITS: u32 = 11;
const RADIX_BUCKETS: usize = 1 << RADIX_BITS;
const RADIX_MASK: u64 = (RADIX_BUCKETS as u64) - 1;
const RADIX_PASSES: usize = 6;

#[allow(dead_code)]
#[derive(Clone, Copy)]
enum XSortStrategy {
    Merge,
    Radix,
}

const DEFAULT_X_SORT: XSortStrategy = XSortStrategy::Radix;

#[derive(Clone, Copy, Debug, Serialize, Type)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ClosestPairResult {
    pub first: Point,
    pub second: Point,
    pub distance: f64,
    pub input_size: usize,
    pub elapsed_micros: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trace: Option<Vec<AlgorithmStep>>,
}

#[derive(Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ClosestPairFileResult {
    pub file_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<ClosestPairResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ClosestPairProgressEvent {
    #[serde(rename_all = "camelCase")]
    Started { index: usize, file_name: String },
    #[serde(rename_all = "camelCase")]
    Finished {
        index: usize,
        file: ClosestPairFileResult,
    },
}

#[derive(Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ClosestPairBatchResult {
    pub source: String,
    pub files: Vec<ClosestPairFileResult>,
    pub total_files: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub total_elapsed_micros: u64,
}

#[derive(Clone, Copy)]
struct Candidate {
    first: Point,
    second: Point,
    distance_squared: f64,
}

impl Candidate {
    #[inline(always)]
    fn new(first: Point, second: Point) -> Self {
        Self {
            first,
            second,
            distance_squared: distance_squared(first, second),
        }
    }
}

pub fn run_input(input: &str) -> Result<ClosestPairResult, String> {
    let points = parse_points(input)?;

    // Parsing and trace construction stay outside the algorithm timer.
    let started = Instant::now();
    let candidate = find_closest(&points, &mut TraceRecorder::disabled());
    let distance = candidate.distance_squared.sqrt();
    let elapsed_micros = started.elapsed().as_micros().min(u64::MAX as u128) as u64;

    let trace = if points.len() <= MAX_TRACE_POINTS {
        let mut recorder = TraceRecorder::enabled();
        let _ = find_closest(&points, &mut recorder);
        Some(recorder.into_steps())
    } else {
        None
    };

    Ok(ClosestPairResult {
        first: candidate.first,
        second: candidate.second,
        distance,
        input_size: points.len(),
        elapsed_micros,
        trace,
    })
}

#[cfg(test)]
pub fn run_folder(directory: &str) -> Result<ClosestPairBatchResult, String> {
    run_folder_with_progress(directory, |_| {})
}

pub fn run_folder_with_progress(
    directory: &str,
    mut on_progress: impl FnMut(ClosestPairProgressEvent),
) -> Result<ClosestPairBatchResult, String> {
    let directory = directory.trim().trim_matches('"').trim_matches('\'').trim();
    if directory.is_empty() {
        return Err("Enter the closest-pair dataset folder before running the batch.".to_owned());
    }
    let directory_path = Path::new(directory);
    if !directory_path.is_absolute() {
        return Err("The closest-pair dataset folder must be an absolute path.".to_owned());
    }
    if !directory_path.is_dir() {
        return Err(
            "The closest-pair dataset folder does not exist. Choose the folder containing cp01.txt through cp10.txt."
                .to_owned(),
        );
    }

    let inputs = CLOSEST_PAIR_FILES.iter().map(|file_name| {
        let path = directory_path.join(file_name);
        ((*file_name).to_owned(), move || read_dataset(&path))
    });
    Ok(run_named_files(
        directory.to_owned(),
        inputs,
        &mut on_progress,
    ))
}

#[cfg(test)]
pub fn run_files(paths: Vec<String>) -> Result<ClosestPairBatchResult, String> {
    run_files_with_progress(paths, |_| {})
}

pub fn run_files_with_progress(
    paths: Vec<String>,
    mut on_progress: impl FnMut(ClosestPairProgressEvent),
) -> Result<ClosestPairBatchResult, String> {
    if paths.is_empty() {
        return Err("Choose at least one closest-pair input file before running.".to_owned());
    }

    let inputs = paths.into_iter().map(|path| {
        let file_name = Path::new(&path)
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(&path)
            .to_owned();
        (file_name, move || read_dataset(Path::new(&path)))
    });
    Ok(run_named_files(
        "Selected files".to_owned(),
        inputs,
        &mut on_progress,
    ))
}

fn read_dataset(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|error| {
        format!("The file could not be read: {error}. Choose a readable plain-text file.")
    })
}

fn run_named_files<F>(
    source: String,
    inputs: impl IntoIterator<Item = (String, F)>,
    on_progress: &mut impl FnMut(ClosestPairProgressEvent),
) -> ClosestPairBatchResult
where
    F: FnOnce() -> Result<String, String>,
{
    let mut files = Vec::new();
    let mut succeeded = 0;
    let mut total_elapsed_micros = 0_u128;

    for (index, (file_name, load_input)) in inputs.into_iter().enumerate() {
        on_progress(ClosestPairProgressEvent::Started {
            index,
            file_name: file_name.clone(),
        });

        let outcome = load_input().and_then(|content| run_input(&content));
        let file_result = match outcome {
            Ok(result) => {
                total_elapsed_micros += u128::from(result.elapsed_micros);
                succeeded += 1;
                ClosestPairFileResult {
                    file_name,
                    result: Some(result),
                    error: None,
                }
            }
            Err(error) => ClosestPairFileResult {
                file_name,
                result: None,
                error: Some(error),
            },
        };

        on_progress(ClosestPairProgressEvent::Finished {
            index,
            file: file_result.clone(),
        });
        files.push(file_result);
    }

    let total_files = files.len();
    ClosestPairBatchResult {
        source,
        total_files,
        succeeded,
        failed: total_files - succeeded,
        total_elapsed_micros: total_elapsed_micros.min(u128::from(u64::MAX)) as u64,
        files,
    }
}

fn parse_points(input: &str) -> Result<Vec<Point>, String> {
    let mut lines = input.lines();
    let count = lines
        .next()
        .ok_or_else(|| "The input must start with the number of points.".to_owned())?
        .trim()
        .parse::<usize>()
        .map_err(|_| "The first line must contain a valid number of points.".to_owned())?;
    if count < 2 {
        return Err("At least two points are required to find a closest pair.".to_owned());
    }

    let mut points = Vec::with_capacity(count);
    for index in 0..count {
        let line = lines
            .next()
            .ok_or_else(|| format!("Point {} is missing from the input.", index + 1))?;
        let mut coordinates = line.split_whitespace();
        let x = coordinates
            .next()
            .ok_or_else(|| format!("Point {} must contain two coordinates.", index + 1))?
            .parse::<f64>()
            .map_err(|_| format!("Point {} has an invalid x coordinate.", index + 1))?;
        let y = coordinates
            .next()
            .ok_or_else(|| format!("Point {} must contain two coordinates.", index + 1))?
            .parse::<f64>()
            .map_err(|_| format!("Point {} has an invalid y coordinate.", index + 1))?;
        if coordinates.next().is_some() {
            return Err(format!(
                "Point {} must contain exactly two coordinates.",
                index + 1
            ));
        }
        if !x.is_finite() || !y.is_finite() {
            return Err(format!("Point {} must have finite coordinates.", index + 1));
        }
        points.push(Point { x, y });
    }

    if lines.any(|line| !line.trim().is_empty()) {
        return Err(
            "The declared point count does not match the number of input lines.".to_owned(),
        );
    }
    Ok(points)
}

#[inline(always)]
fn distance_squared(first: Point, second: Point) -> f64 {
    let dx = first.x - second.x;
    let dy = first.y - second.y;
    dx * dx + dy * dy
}

#[inline(always)]
fn less_or_equal_x(first: Point, second: Point) -> bool {
    first.x <= second.x
}

#[inline(always)]
fn less_or_equal_y(first: Point, second: Point) -> bool {
    first.y <= second.y
}

#[inline(always)]
fn insertion_sort_x(points: &mut [Point]) {
    for index in 1..points.len() {
        let current = points[index];
        let mut cursor = index;
        while cursor > 0 && !less_or_equal_x(points[cursor - 1], current) {
            points[cursor] = points[cursor - 1];
            cursor -= 1;
        }
        points[cursor] = current;
    }
}

#[inline(always)]
fn insertion_sort_y(points: &mut [Point]) {
    for index in 1..points.len() {
        let current = points[index];
        let mut cursor = index;
        while cursor > 0 && !less_or_equal_y(points[cursor - 1], current) {
            points[cursor] = points[cursor - 1];
            cursor -= 1;
        }
        points[cursor] = current;
    }
}

#[inline(always)]
fn merge_x_slices(left: &[Point], right: &[Point], dst: &mut [Point]) {
    debug_assert_eq!(left.len() + right.len(), dst.len());
    if left.is_empty() {
        dst.copy_from_slice(right);
        return;
    }
    if right.is_empty() {
        dst.copy_from_slice(left);
        return;
    }
    if less_or_equal_x(left[left.len() - 1], right[0]) {
        let (dst_left, dst_right) = dst.split_at_mut(left.len());
        dst_left.copy_from_slice(left);
        dst_right.copy_from_slice(right);
        return;
    }

    let (mut left_index, mut right_index, mut output_index) = (0, 0, 0);
    while left_index < left.len() && right_index < right.len() {
        let left_point = left[left_index];
        let right_point = right[right_index];
        let take_left = less_or_equal_x(left_point, right_point);
        dst[output_index] = if take_left { left_point } else { right_point };
        left_index += usize::from(take_left);
        right_index += usize::from(!take_left);
        output_index += 1;
    }
    if left_index < left.len() {
        dst[output_index..].copy_from_slice(&left[left_index..]);
    } else if right_index < right.len() {
        dst[output_index..].copy_from_slice(&right[right_index..]);
    }
}

/// Ping-pong merge sort by x.
/// When `into_scratch` is false, `points` ends up sorted in `points`.
/// When `into_scratch` is true, `points` ends up sorted in `scratch`.
fn merge_sort_x_ping_pong(
    points: &mut [Point],
    scratch: &mut [Point],
    into_scratch: bool,
    parallel_threshold: usize,
) {
    let count = points.len();
    debug_assert_eq!(count, scratch.len());
    if count <= SMALL_SORT_LIMIT {
        insertion_sort_x(points);
        if into_scratch {
            scratch.copy_from_slice(points);
        }
        return;
    }

    let middle = count / 2;
    let (left_points, right_points) = points.split_at_mut(middle);
    let (left_scratch, right_scratch) = scratch.split_at_mut(middle);
    if count >= parallel_threshold {
        join(
            || merge_sort_x_ping_pong(left_points, left_scratch, !into_scratch, parallel_threshold),
            || {
                merge_sort_x_ping_pong(
                    right_points,
                    right_scratch,
                    !into_scratch,
                    parallel_threshold,
                )
            },
        );
    } else {
        merge_sort_x_ping_pong(left_points, left_scratch, !into_scratch, parallel_threshold);
        merge_sort_x_ping_pong(
            right_points,
            right_scratch,
            !into_scratch,
            parallel_threshold,
        );
    }

    if into_scratch {
        merge_x_slices(left_points, right_points, scratch);
    } else {
        merge_x_slices(left_scratch, right_scratch, points);
    }
}

pub(crate) fn merge_sort_by_x(
    points: &mut [Point],
    scratch: &mut [Point],
    parallel_threshold: usize,
) {
    merge_sort_x_ping_pong(points, scratch, false, parallel_threshold);
}

#[inline(always)]
fn sortable_f64_key(value: f64) -> u64 {
    // Canonicalize -0.0 and +0.0 so equal x coordinates map to the same key.
    let canonical = if value == 0.0 { 0.0 } else { value };
    let bits = canonical.to_bits();
    let mask = ((bits as i64) >> 63) as u64 | (1_u64 << 63);
    bits ^ mask
}

#[allow(dead_code)]
pub(crate) fn radix_sort_by_x(points: &mut [Point], scratch: &mut [Point]) {
    let count = points.len();
    debug_assert_eq!(count, scratch.len());
    if count <= SMALL_SORT_LIMIT {
        insertion_sort_x(points);
        return;
    }

    let mut counts = [[0_u32; RADIX_BUCKETS]; RADIX_PASSES];
    let mut already_sorted = true;
    let mut previous_key = 0_u64;

    for (index, point) in points.iter().enumerate() {
        let key = sortable_f64_key(point.x);
        if index > 0 && key < previous_key {
            already_sorted = false;
        }
        previous_key = key;

        for (pass, pass_counts) in counts.iter_mut().enumerate() {
            let shift = (pass as u32) * RADIX_BITS;
            pass_counts[((key >> shift) & RADIX_MASK) as usize] += 1;
        }
    }

    if already_sorted {
        return;
    }

    let mut in_scratch = false;
    for (pass, pass_counts) in counts.iter_mut().enumerate() {
        let shift = (pass as u32) * RADIX_BITS;
        let active_buckets = if pass == RADIX_PASSES - 1 {
            1 << (64 - (RADIX_PASSES as u32 - 1) * RADIX_BITS)
        } else {
            RADIX_BUCKETS
        };

        // Skip pass if every point has the exact same 11-bit digit in this position.
        if pass_counts[..active_buckets]
            .iter()
            .any(|&bucket_count| bucket_count as usize == count)
        {
            continue;
        }

        let mut offset = 0_u32;
        for bucket in &mut pass_counts[..active_buckets] {
            let current = *bucket;
            *bucket = offset;
            offset += current;
        }

        if !in_scratch {
            for &point in points.iter() {
                let digit = ((sortable_f64_key(point.x) >> shift) & RADIX_MASK) as usize;
                let destination = pass_counts[digit] as usize;
                pass_counts[digit] += 1;
                scratch[destination] = point;
            }
        } else {
            for &point in scratch.iter() {
                let digit = ((sortable_f64_key(point.x) >> shift) & RADIX_MASK) as usize;
                let destination = pass_counts[digit] as usize;
                pass_counts[digit] += 1;
                points[destination] = point;
            }
        }
        in_scratch = !in_scratch;
    }

    if in_scratch {
        points.copy_from_slice(scratch);
    }
}

/// Copies the left half `points[..middle]` into `left_copy`, merges it with
/// `points[middle..]` by y back into `points`, and collects strip candidates
/// (`(p.x - split_x)^2 < best_distance_squared`) into `strip`.
#[inline(always)]
fn merge_y_and_build_strip(
    points: &mut [Point],
    middle: usize,
    left_copy: &mut [Point],
    strip: &mut Vec<Point>,
    split_x: f64,
    best_distance_squared: f64,
) {
    strip.clear();
    if !less_or_equal_y(points[middle - 1], points[middle]) {
        left_copy.copy_from_slice(&points[..middle]);
        let right_len = points.len() - middle;
        let (mut left_index, mut right_index, mut output_index) = (0, 0, 0);

        while left_index < middle && right_index < right_len {
            let left_point = left_copy[left_index];
            let right_point = points[middle + right_index];
            let take_left = less_or_equal_y(left_point, right_point);
            let chosen = if take_left { left_point } else { right_point };
            points[output_index] = chosen;
            left_index += usize::from(take_left);
            right_index += usize::from(!take_left);
            output_index += 1;

            let dx = chosen.x - split_x;
            if dx * dx < best_distance_squared {
                strip.push(chosen);
            }
        }

        while left_index < middle {
            let chosen = left_copy[left_index];
            points[output_index] = chosen;
            left_index += 1;
            output_index += 1;

            let dx = chosen.x - split_x;
            if dx * dx < best_distance_squared {
                strip.push(chosen);
            }
        }

        while right_index < right_len {
            let chosen = points[middle + right_index];
            right_index += 1;
            output_index += 1;

            let dx = chosen.x - split_x;
            if dx * dx < best_distance_squared {
                strip.push(chosen);
            }
        }
        debug_assert_eq!(output_index, points.len());
    } else {
        for &point in points.iter() {
            let dx = point.x - split_x;
            if dx * dx < best_distance_squared {
                strip.push(point);
            }
        }
    }
}

#[inline(always)]
fn check_strip(strip: &[Point], mut best: Candidate) -> Candidate {
    for index in 0..strip.len() {
        let first = strip[index];
        let mut next = index + 1;
        while next < strip.len() {
            let second = strip[next];
            let dy = second.y - first.y;
            if dy * dy >= best.distance_squared {
                break;
            }
            let dx = first.x - second.x;
            let distance_squared = dx * dx + dy * dy;
            if distance_squared < best.distance_squared {
                best = Candidate {
                    first,
                    second,
                    distance_squared,
                };
            }
            next += 1;
        }
    }
    best
}

fn find_closest(points: &[Point], trace: &mut TraceRecorder) -> Candidate {
    find_closest_with_options(points, trace, PARALLEL_THRESHOLD, DEFAULT_X_SORT)
}

fn find_closest_with_options(
    points: &[Point],
    trace: &mut TraceRecorder,
    parallel_threshold: usize,
    sort_strategy: XSortStrategy,
) -> Candidate {
    let sort_threshold = if trace.is_enabled() {
        usize::MAX
    } else {
        parallel_threshold
    };
    let mut sorted_points = points.to_vec();
    let mut scratch = vec![Point { x: 0.0, y: 0.0 }; points.len()];

    match sort_strategy {
        XSortStrategy::Merge => {
            merge_sort_by_x(&mut sorted_points, &mut scratch, sort_threshold);
        }
        XSortStrategy::Radix => {
            radix_sort_by_x(&mut sorted_points, &mut scratch);
        }
    }

    let base_case_limit = if trace.is_enabled() {
        TRACE_BASE_CASE_LIMIT
    } else {
        BASE_CASE_LIMIT
    };
    let mut strip = Vec::with_capacity(64);

    solve(
        &mut sorted_points,
        &mut scratch,
        &mut strip,
        0,
        parallel_threshold,
        base_case_limit,
        trace,
    )
}

fn solve(
    points: &mut [Point],
    scratch: &mut [Point],
    strip: &mut Vec<Point>,
    depth: usize,
    parallel_threshold: usize,
    base_case_limit: usize,
    trace: &mut TraceRecorder,
) -> Candidate {
    let count = points.len();
    debug_assert!(count >= 2);
    debug_assert_eq!(count, scratch.len());

    if count <= base_case_limit {
        return solve_base_case(points, depth, trace);
    }

    let middle = count / 2;
    // Read split_x BEFORE recursing, as the recursive calls reorder both halves by y.
    let split_x = points[middle - 1].x;
    if trace.is_active() {
        trace.push(
            depth,
            "Split points",
            format!(
                "{count} points\nSplit at x = {split_x}\nLeft: {middle}\nRight: {}",
                count - middle
            ),
        );
    }

    let (left_points, right_points) = points.split_at_mut(middle);
    let (left_scratch, right_scratch) = scratch.split_at_mut(middle);
    let (left, right) = if count >= parallel_threshold && !trace.is_enabled() {
        let mut left_strip = Vec::with_capacity(64);
        let mut right_strip = Vec::with_capacity(64);
        let mut left_trace = TraceRecorder::disabled();
        let mut right_trace = TraceRecorder::disabled();
        join(
            || {
                solve(
                    left_points,
                    left_scratch,
                    &mut left_strip,
                    depth + 1,
                    parallel_threshold,
                    base_case_limit,
                    &mut left_trace,
                )
            },
            || {
                solve(
                    right_points,
                    right_scratch,
                    &mut right_strip,
                    depth + 1,
                    parallel_threshold,
                    base_case_limit,
                    &mut right_trace,
                )
            },
        )
    } else {
        (
            solve(
                left_points,
                left_scratch,
                strip,
                depth + 1,
                parallel_threshold,
                base_case_limit,
                &mut *trace,
            ),
            solve(
                right_points,
                right_scratch,
                strip,
                depth + 1,
                parallel_threshold,
                base_case_limit,
                trace,
            ),
        )
    };

    let mut best = if left.distance_squared <= right.distance_squared {
        left
    } else {
        right
    };
    if trace.is_active() {
        trace.push(
            depth,
            "Combine halves",
            format!(
                "Left distance: {}\nRight distance: {}\nCurrent best: {}",
                left.distance_squared.sqrt(),
                right.distance_squared.sqrt(),
                best.distance_squared.sqrt()
            ),
        );
    }

    merge_y_and_build_strip(
        points,
        middle,
        &mut scratch[..middle],
        strip,
        split_x,
        best.distance_squared,
    );
    best = check_strip(strip, best);

    if trace.is_active() {
        trace.push(
            depth,
            "Check middle strip",
            format!(
                "{} points in the strip\nClosest distance: {}\nPair: ({}, {}) and ({}, {})",
                strip.len(),
                best.distance_squared.sqrt(),
                best.first.x,
                best.first.y,
                best.second.x,
                best.second.y
            ),
        );
    }
    best
}

fn solve_base_case(points: &mut [Point], depth: usize, trace: &mut TraceRecorder) -> Candidate {
    insertion_sort_y(points);
    let mut best = Candidate::new(points[0], points[1]);
    for first_index in 0..points.len() {
        let first = points[first_index];
        for second_index in first_index + 1..points.len() {
            let second = points[second_index];
            let dy = second.y - first.y;
            if dy * dy >= best.distance_squared {
                break;
            }
            let dx = first.x - second.x;
            let distance_squared = dx * dx + dy * dy;
            if distance_squared < best.distance_squared {
                best = Candidate {
                    first,
                    second,
                    distance_squared,
                };
            }
        }
    }
    if trace.is_active() {
        trace.push(
            depth,
            "Base case",
            format!(
                "{} points checked directly\nClosest distance: {}",
                points.len(),
                best.distance_squared.sqrt()
            ),
        );
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;

    fn point(x: f64, y: f64) -> Point {
        Point { x, y }
    }

    fn naive_distance_squared(points: &[Point]) -> f64 {
        let mut best = f64::INFINITY;
        for first in 0..points.len() {
            for second in first + 1..points.len() {
                best = best.min(distance_squared(points[first], points[second]));
            }
        }
        best
    }

    fn assert_matches_naive(points: &[Point], parallel_threshold: usize) {
        let expected = naive_distance_squared(points);
        let merge_candidate = find_closest_with_options(
            points,
            &mut TraceRecorder::disabled(),
            parallel_threshold,
            XSortStrategy::Merge,
        );
        assert!((merge_candidate.distance_squared - expected).abs() < 1e-9);

        let radix_candidate = find_closest_with_options(
            points,
            &mut TraceRecorder::disabled(),
            parallel_threshold,
            XSortStrategy::Radix,
        );
        assert!((radix_candidate.distance_squared - expected).abs() < 1e-9);
    }

    fn deterministic_points(count: usize) -> Vec<Point> {
        (0..count)
            .map(|index| {
                point(
                    ((index * 73) % 101) as f64 - 50.0,
                    ((index * 37) % 211) as f64 - 100.0,
                )
            })
            .collect()
    }

    #[test]
    fn parses_and_solves_a_simple_input() {
        let result = run_input("2\n0 0\n3 4\n").unwrap();
        assert_eq!(result.input_size, 2);
        assert_eq!(result.distance, 5.0);
        assert!(result.trace.is_some());
    }

    #[test]
    fn rejects_malformed_inputs() {
        for input in [
            "",
            "1\n0 0\n",
            "two\n0 0\n1 1\n",
            "3\n0 0\n1 1\n",
            "2\n0 0\n1 1\n2 2\n",
            "2\n0 0\n1\n",
            "2\n0 0\n1 1 2\n",
            "2\n0 0\nNaN 1\n",
        ] {
            assert!(run_input(input).is_err(), "accepted {input:?}");
        }
    }

    #[test]
    fn matches_brute_force_on_edge_cases_and_small_inputs() {
        let cases = [
            vec![point(0.0, 0.0), point(1.0, 1.0)],
            vec![point(-2.0, 4.0), point(3.0, -1.0), point(0.0, 0.0)],
            vec![point(0.0, 0.0), point(0.0, 0.0), point(2.0, 0.0)],
            (0..10).map(|index| point(index as f64, 0.0)).collect(),
            (0..100)
                .map(|index| point(500_000.0, ((index * 37) % 101) as f64))
                .collect(),
            (0..100)
                .map(|index| point((index % 10) as f64, (index / 10) as f64))
                .collect(),
            vec![
                point(-10.0, 0.0),
                point(-1.0, 4.0),
                point(-0.001, 2.0),
                point(0.001, 2.0),
                point(1.0, -3.0),
                point(10.0, 0.0),
            ],
        ];
        for points in cases {
            assert_matches_naive(&points, usize::MAX);
        }
    }

    #[test]
    fn sequential_and_parallel_paths_match_naive() {
        let points = deterministic_points(257);
        assert_matches_naive(&points, usize::MAX);
        assert_matches_naive(&points, 16);
    }

    #[test]
    fn matches_brute_force_across_sizes_and_signed_zero_edges() {
        let signed_zero_cases = [
            vec![point(-0.0, 1.0), point(0.0, 1.5), point(10.0, 20.0)],
            vec![
                point(-0.0, -0.0),
                point(0.0, 0.0),
                point(-5.0, -5.0),
                point(5.0, 5.0),
            ],
            vec![
                point(-100.5, -200.25),
                point(-0.0, 3.0),
                point(0.0, -3.0),
                point(-0.0, 3.125),
                point(42.0, -17.0),
            ],
        ];
        for points in signed_zero_cases {
            assert_matches_naive(&points, usize::MAX);
            assert_matches_naive(&points, 2);
        }

        for count in (2..=64).chain([65, 100, 101, 127, 128, 129, 255, 256, 384, 513, 600]) {
            let points = deterministic_points(count);
            assert_matches_naive(&points, usize::MAX);
            assert_matches_naive(&points, 32);
        }
    }

    #[test]
    fn custom_sorts_order_by_x_across_signs_and_scales() {
        let mut base = vec![
            point(1e300, 1.0),
            point(-1e300, 2.0),
            point(0.0, 3.0),
            point(-0.0, 4.0),
            point(-1e-300, 5.0),
            point(1e-300, 6.0),
            point(-42.5, 7.0),
            point(42.5, 8.0),
        ];
        base.extend(deterministic_points(150));

        let mut merge_sorted = base.clone();
        let mut radix_sorted = base.clone();
        let mut scratch = vec![point(0.0, 0.0); base.len()];

        merge_sort_by_x(&mut merge_sorted, &mut scratch, 32);
        radix_sort_by_x(&mut radix_sorted, &mut scratch);

        assert!(merge_sorted.windows(2).all(|pair| pair[0].x <= pair[1].x));
        assert!(radix_sorted.windows(2).all(|pair| pair[0].x <= pair[1].x));
    }

    #[test]
    fn traces_are_limited_to_small_inputs() {
        let small = format!(
            "101\n{}",
            (0..101)
                .map(|index| format!("{index} 0\n"))
                .collect::<String>()
        );
        let large = format!(
            "102\n{}",
            (0..102)
                .map(|index| format!("{index} 0\n"))
                .collect::<String>()
        );
        assert!(run_input(&small).unwrap().trace.is_some());
        assert!(run_input(&large).unwrap().trace.is_none());
    }

    #[test]
    fn selected_files_preserve_order_and_continue_after_errors() {
        let directory = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join(format!("test-closest-pair-files-{}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        for (file_name, content) in [
            ("first.txt", "2\n0 0\n3 4\n"),
            ("invalid.txt", "not points"),
            ("last.txt", "2\n1 1\n1 1\n"),
        ] {
            fs::write(directory.join(file_name), content).unwrap();
        }
        let paths = ["first.txt", "invalid.txt", "last.txt"]
            .map(|file_name| directory.join(file_name).to_string_lossy().into_owned())
            .to_vec();

        let batch = run_files(paths).unwrap();
        fs::remove_dir_all(&directory).unwrap();

        assert_eq!(batch.total_files, 3);
        assert_eq!(batch.succeeded, 2);
        assert_eq!(batch.failed, 1);
        assert_eq!(batch.files[0].file_name, "first.txt");
        assert_eq!(batch.files[0].result.as_ref().unwrap().distance, 5.0);
        assert!(batch.files[1].error.is_some());
        assert_eq!(batch.files[2].file_name, "last.txt");
        assert_eq!(batch.files[2].result.as_ref().unwrap().distance, 0.0);
    }

    #[test]
    fn reads_a_dataset_folder_in_assignment_order() {
        let directory = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join(format!("test-closest-pair-folder-{}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        for file_name in CLOSEST_PAIR_FILES {
            fs::write(directory.join(file_name), "2\n0 0\n3 4\n").unwrap();
        }

        let quoted_path = format!("  \"{}\"  ", directory.to_str().unwrap());
        let batch = run_folder(&quoted_path).unwrap();
        fs::remove_dir_all(&directory).unwrap();

        assert_eq!(batch.total_files, 10);
        assert_eq!(batch.succeeded, 10);
        assert_eq!(batch.failed, 0);
        for (index, file) in batch.files.iter().enumerate() {
            assert_eq!(file.file_name, CLOSEST_PAIR_FILES[index]);
            assert_eq!(file.result.as_ref().unwrap().distance, 5.0);
        }
    }

    #[test]
    fn folder_errors_are_reported() {
        assert!(run_folder("").is_err());
        assert!(run_folder("relative/path").is_err());
        assert!(run_files(Vec::new()).is_err());
    }
}
