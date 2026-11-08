use crate::model::{AlgorithmStep, TraceRecorder};
use rayon::join;
use serde::Serialize;
use specta::Type;
use std::cmp::Ordering;
use std::fs;
use std::path::Path;
use std::time::Instant;

const CLOSEST_PAIR_FILES: [&str; 10] = [
    "cp01.txt", "cp02.txt", "cp03.txt", "cp04.txt", "cp05.txt", "cp06.txt", "cp07.txt", "cp08.txt",
    "cp09.txt", "cp10.txt",
];
const MAX_TRACE_POINTS: usize = 101;
const PARALLEL_THRESHOLD: usize = 16_384;

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
struct RankedPoint {
    point: Point,
    x_rank: usize,
}

#[derive(Clone, Copy)]
struct Candidate {
    first: Point,
    second: Point,
    distance_squared: f64,
}

impl Candidate {
    fn new(first: Point, second: Point) -> Self {
        Self {
            first,
            second,
            distance_squared: distance_squared(first, second),
        }
    }
}

type Comparator<T> = fn(&T, &T) -> Ordering;

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

fn distance_squared(first: Point, second: Point) -> f64 {
    let dx = first.x - second.x;
    let dy = first.y - second.y;
    dx * dx + dy * dy
}

fn compare_x(first: &RankedPoint, second: &RankedPoint) -> Ordering {
    first
        .point
        .x
        .total_cmp(&second.point.x)
        .then_with(|| first.point.y.total_cmp(&second.point.y))
}

fn compare_y(first: &RankedPoint, second: &RankedPoint) -> Ordering {
    first
        .point
        .y
        .total_cmp(&second.point.y)
        .then_with(|| first.x_rank.cmp(&second.x_rank))
}

fn merge_runs<T: Copy>(values: &mut [T], scratch: &mut [T], compare: Comparator<T>) {
    if values.len() < 2 {
        return;
    }
    let middle = values.len() / 2;
    let (left, right) = values.split_at(middle);
    let (mut left_index, mut right_index, mut output_index) = (0, 0, 0);

    while left_index < left.len() && right_index < right.len() {
        if compare(&left[left_index], &right[right_index]) != Ordering::Greater {
            scratch[output_index] = left[left_index];
            left_index += 1;
        } else {
            scratch[output_index] = right[right_index];
            right_index += 1;
        }
        output_index += 1;
    }
    while left_index < left.len() {
        scratch[output_index] = left[left_index];
        left_index += 1;
        output_index += 1;
    }
    while right_index < right.len() {
        scratch[output_index] = right[right_index];
        right_index += 1;
        output_index += 1;
    }
    values.copy_from_slice(scratch);
}

fn merge_sort<T: Copy>(values: &mut [T], scratch: &mut [T], compare: Comparator<T>) {
    if values.len() < 2 {
        return;
    }
    let middle = values.len() / 2;
    merge_sort(&mut values[..middle], &mut scratch[..middle], compare);
    merge_sort(&mut values[middle..], &mut scratch[middle..], compare);
    merge_runs(values, scratch, compare);
}

fn find_closest(points: &[Point], trace: &mut TraceRecorder) -> Candidate {
    find_closest_with_threshold(points, trace, PARALLEL_THRESHOLD)
}

fn find_closest_with_threshold(
    points: &[Point],
    trace: &mut TraceRecorder,
    parallel_threshold: usize,
) -> Candidate {
    let mut px: Vec<RankedPoint> = points
        .iter()
        .map(|&point| RankedPoint { point, x_rank: 0 })
        .collect();
    let mut scratch = px.clone();
    merge_sort(&mut px, &mut scratch, compare_x);
    for (rank, point) in px.iter_mut().enumerate() {
        point.x_rank = rank;
    }

    let mut py = px.clone();
    merge_sort(&mut py, &mut scratch, compare_y);
    let mut strip = Vec::with_capacity(points.len());
    solve(
        &px,
        &mut py,
        &mut scratch,
        &mut strip,
        0,
        parallel_threshold,
        trace,
    )
}

fn solve(
    px: &[RankedPoint],
    py: &mut [RankedPoint],
    scratch: &mut [RankedPoint],
    strip: &mut Vec<RankedPoint>,
    depth: usize,
    parallel_threshold: usize,
    trace: &mut TraceRecorder,
) -> Candidate {
    let count = px.len();
    debug_assert!(count >= 2);
    debug_assert_eq!(count, py.len());
    debug_assert_eq!(count, scratch.len());

    if count <= 3 {
        return brute_force(px, depth, trace);
    }

    let middle = count / 2;
    let split_rank = px[middle].x_rank;
    let split_x = px[middle - 1].point.x;
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

    let (mut left_count, mut right_count) = (0, middle);
    for &point in py.iter() {
        if point.x_rank < split_rank {
            scratch[left_count] = point;
            left_count += 1;
        } else {
            scratch[right_count] = point;
            right_count += 1;
        }
    }
    debug_assert_eq!(left_count, middle);
    debug_assert_eq!(right_count, count);
    py.copy_from_slice(scratch);

    let (left_px, right_px) = px.split_at(middle);
    let (left_py, right_py) = py.split_at_mut(middle);
    let (left_scratch, right_scratch) = scratch.split_at_mut(middle);
    let (left, right) = if count >= parallel_threshold && !trace.is_enabled() {
        let mut left_strip = Vec::with_capacity(middle);
        let mut right_strip = Vec::with_capacity(count - middle);
        let mut left_trace = TraceRecorder::disabled();
        let mut right_trace = TraceRecorder::disabled();
        join(
            || {
                solve(
                    left_px,
                    left_py,
                    left_scratch,
                    &mut left_strip,
                    depth + 1,
                    parallel_threshold,
                    &mut left_trace,
                )
            },
            || {
                solve(
                    right_px,
                    right_py,
                    right_scratch,
                    &mut right_strip,
                    depth + 1,
                    parallel_threshold,
                    &mut right_trace,
                )
            },
        )
    } else {
        (
            solve(
                left_px,
                left_py,
                left_scratch,
                strip,
                depth + 1,
                parallel_threshold,
                &mut *trace,
            ),
            solve(
                right_px,
                right_py,
                right_scratch,
                strip,
                depth + 1,
                parallel_threshold,
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

    merge_runs(py, scratch, compare_y);
    strip.clear();
    strip.extend(py.iter().copied().filter(|point| {
        let dx = point.point.x - split_x;
        dx * dx < best.distance_squared
    }));

    for index in 0..strip.len() {
        let mut next = index + 1;
        while next < strip.len() {
            let dy = strip[next].point.y - strip[index].point.y;
            if dy * dy >= best.distance_squared {
                break;
            }
            let candidate = Candidate::new(strip[index].point, strip[next].point);
            if candidate.distance_squared < best.distance_squared {
                best = candidate;
            }
            next += 1;
        }
    }

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

fn brute_force(points: &[RankedPoint], depth: usize, trace: &mut TraceRecorder) -> Candidate {
    let mut best = Candidate::new(points[0].point, points[1].point);
    for first in 0..points.len() {
        for second in first + 1..points.len() {
            let candidate = Candidate::new(points[first].point, points[second].point);
            if candidate.distance_squared < best.distance_squared {
                best = candidate;
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
        let candidate =
            find_closest_with_threshold(points, &mut TraceRecorder::disabled(), parallel_threshold);
        let expected = naive_distance_squared(points);
        assert!((candidate.distance_squared - expected).abs() < 1e-9);
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
