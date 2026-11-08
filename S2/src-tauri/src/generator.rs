use rayon::prelude::*;
use serde::Serialize;
use specta::Type;
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

const COORDINATE_LIMIT: f64 = 1_000_000.0;
const FILE_COUNT: usize = 20;
const SPLIT_LEFT_INDEX: usize = 500_499;
const SPLIT_RIGHT_INDEX: usize = 500_500;
const SPLIT_MIDDLE: f64 = 499_500.0;

#[derive(Clone, Copy)]
enum ClosestPairKind {
    Uniform,
    Clustered,
    Duplicates,
    Vertical,
    Grid,
    Split,
}

struct ClosestPairSpec {
    file: &'static str,
    points: usize,
    kind: ClosestPairKind,
}

const CLOSEST_PAIR_SPECS: [ClosestPairSpec; 10] = [
    ClosestPairSpec {
        file: "cp01.txt",
        points: 1_000,
        kind: ClosestPairKind::Uniform,
    },
    ClosestPairSpec {
        file: "cp02.txt",
        points: 10_000,
        kind: ClosestPairKind::Uniform,
    },
    ClosestPairSpec {
        file: "cp03.txt",
        points: 100_000,
        kind: ClosestPairKind::Uniform,
    },
    ClosestPairSpec {
        file: "cp04.txt",
        points: 1_000_000,
        kind: ClosestPairKind::Uniform,
    },
    ClosestPairSpec {
        file: "cp05.txt",
        points: 1_000_000,
        kind: ClosestPairKind::Clustered,
    },
    ClosestPairSpec {
        file: "cp06.txt",
        points: 1_000_000,
        kind: ClosestPairKind::Duplicates,
    },
    ClosestPairSpec {
        file: "cp07.txt",
        points: 100_000,
        kind: ClosestPairKind::Vertical,
    },
    ClosestPairSpec {
        file: "cp08.txt",
        points: 100_000,
        kind: ClosestPairKind::Grid,
    },
    ClosestPairSpec {
        file: "cp09.txt",
        points: 1_000_000,
        kind: ClosestPairKind::Split,
    },
    ClosestPairSpec {
        file: "cp10.txt",
        points: 101,
        kind: ClosestPairKind::Uniform,
    },
];

#[derive(Clone, Copy)]
enum MultiplicationKind {
    Random {
        left_digits: usize,
        right_digits: usize,
    },
    AllNines {
        digits: usize,
    },
    ManyZeros {
        digits: usize,
    },
    PowersOfTen {
        digits: usize,
    },
    Zero {
        other_digits: usize,
    },
}

struct MultiplicationSpec {
    file: &'static str,
    kind: MultiplicationKind,
}

const MULTIPLICATION_SPECS: [MultiplicationSpec; 10] = [
    MultiplicationSpec {
        file: "im01.txt",
        kind: MultiplicationKind::Random {
            left_digits: 1_000,
            right_digits: 1_000,
        },
    },
    MultiplicationSpec {
        file: "im02.txt",
        kind: MultiplicationKind::Random {
            left_digits: 10_000,
            right_digits: 10_000,
        },
    },
    MultiplicationSpec {
        file: "im03.txt",
        kind: MultiplicationKind::Random {
            left_digits: 100_000,
            right_digits: 100_000,
        },
    },
    MultiplicationSpec {
        file: "im04.txt",
        kind: MultiplicationKind::Random {
            left_digits: 1_000_000,
            right_digits: 1_000_000,
        },
    },
    MultiplicationSpec {
        file: "im05.txt",
        kind: MultiplicationKind::Random {
            left_digits: 1_000_000,
            right_digits: 10,
        },
    },
    MultiplicationSpec {
        file: "im06.txt",
        kind: MultiplicationKind::AllNines { digits: 100_000 },
    },
    MultiplicationSpec {
        file: "im07.txt",
        kind: MultiplicationKind::ManyZeros { digits: 99_999 },
    },
    MultiplicationSpec {
        file: "im08.txt",
        kind: MultiplicationKind::PowersOfTen { digits: 1_000_000 },
    },
    MultiplicationSpec {
        file: "im09.txt",
        kind: MultiplicationKind::Zero {
            other_digits: 1_000_000,
        },
    },
    MultiplicationSpec {
        file: "im10.txt",
        kind: MultiplicationKind::Random {
            left_digits: 101,
            right_digits: 101,
        },
    },
];

#[derive(Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GenerationResult {
    pub files_generated: usize,
    pub manifest_path: String,
    pub output_directory: String,
    pub karatsuba_directory: String,
    pub closest_pair_directory: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SeedManifest {
    base_seed: String,
    files: Vec<ManifestFile>,
}

#[derive(Serialize)]
struct ManifestFile {
    file: String,
    seed: String,
}

pub fn generate_datasets(output_directory: &str, seed: &str) -> Result<GenerationResult, String> {
    let base_seed = seed.parse::<u64>().map_err(|_| {
        "The base seed must be a whole number from 0 to 18,446,744,073,709,551,615.".to_owned()
    })?;
    let output_directory = output_directory
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .trim();
    if output_directory.is_empty() {
        return Err("Enter an output directory before generating datasets.".to_owned());
    }

    let output_path = PathBuf::from(output_directory);
    if !output_path.is_absolute() {
        return Err("The output directory must be an absolute path.".to_owned());
    }
    let closest_pair_path = output_path.join("cpp");
    let karatsuba_path = output_path.join("karatsuba");
    fs::create_dir_all(&closest_pair_path)
        .and_then(|()| fs::create_dir_all(&karatsuba_path))
        .map_err(|error| format!("The output directories could not be created: {error}"))?;

    let (cp_results, im_results) = rayon::join(
        || {
            CLOSEST_PAIR_SPECS
                .par_iter()
                .enumerate()
                .map(|(index, spec)| {
                    let file_seed = seed_for_file(base_seed, index);
                    write_closest_pair_file(&closest_pair_path.join(spec.file), spec, file_seed)?;
                    Ok(ManifestFile {
                        file: format!("cpp/{}", spec.file),
                        seed: file_seed.to_string(),
                    })
                })
                .collect::<Result<Vec<ManifestFile>, String>>()
        },
        || {
            MULTIPLICATION_SPECS
                .par_iter()
                .enumerate()
                .map(|(index, spec)| {
                    let file_seed = seed_for_file(base_seed, CLOSEST_PAIR_SPECS.len() + index);
                    write_multiplication_file(
                        &karatsuba_path.join(spec.file),
                        spec.kind,
                        file_seed,
                    )?;
                    Ok(ManifestFile {
                        file: format!("karatsuba/{}", spec.file),
                        seed: file_seed.to_string(),
                    })
                })
                .collect::<Result<Vec<ManifestFile>, String>>()
        },
    );

    let mut manifest_files = Vec::with_capacity(FILE_COUNT);
    manifest_files.extend(cp_results?);
    manifest_files.extend(im_results?);

    let manifest_path = output_path.join("manifest.json");
    let manifest = SeedManifest {
        base_seed: base_seed.to_string(),
        files: manifest_files,
    };
    let mut writer = create_writer(&manifest_path)?;
    serde_json::to_writer_pretty(&mut writer, &manifest)
        .map_err(|error| format!("The seed manifest could not be written: {error}"))?;
    writer
        .write_all(b"\n")
        .and_then(|()| writer.flush())
        .map_err(|error| format!("The seed manifest could not be finished: {error}"))?;

    Ok(GenerationResult {
        files_generated: manifest.files.len(),
        manifest_path: manifest_path.to_string_lossy().into_owned(),
        output_directory: output_path.to_string_lossy().into_owned(),
        karatsuba_directory: karatsuba_path.to_string_lossy().into_owned(),
        closest_pair_directory: closest_pair_path.to_string_lossy().into_owned(),
    })
}

fn seed_for_file(base_seed: u64, index: usize) -> u64 {
    base_seed.wrapping_add(index as u64)
}

fn create_writer(path: &Path) -> Result<BufWriter<File>, String> {
    let file = File::create(path)
        .map_err(|error| format!("{} could not be created: {error}", path.display()))?;
    Ok(BufWriter::new(file))
}

fn write_closest_pair_file(path: &Path, spec: &ClosestPairSpec, seed: u64) -> Result<(), String> {
    let mut writer = create_writer(path)?;
    write_closest_pairs(&mut writer, spec.kind, spec.points, SplitMix64::new(seed))
        .and_then(|()| writer.flush())
        .map_err(|error| format!("{} could not be written: {error}", path.display()))
}

fn write_closest_pairs<W: Write>(
    writer: &mut W,
    kind: ClosestPairKind,
    points: usize,
    mut rng: SplitMix64,
) -> std::io::Result<()> {
    writeln!(writer, "{points}")?;

    if matches!(kind, ClosestPairKind::Clustered) {
        let centers: [(f64, f64); 10] =
            std::array::from_fn(|_| (random_coordinate(&mut rng), random_coordinate(&mut rng)));
        for _ in 0..points {
            let (center_x, center_y) = centers[rng.next_range(10) as usize];
            let x = (center_x + rng.next_f64() * 2_000.0 - 1_000.0).clamp(0.0, COORDINATE_LIMIT);
            let y = (center_y + rng.next_f64() * 2_000.0 - 1_000.0).clamp(0.0, COORDINATE_LIMIT);
            write_real_point(writer, x, y)?;
        }
        return Ok(());
    }

    for index in 0..points {
        match kind {
            ClosestPairKind::Uniform => {
                write_real_point(
                    writer,
                    random_coordinate(&mut rng),
                    random_coordinate(&mut rng),
                )?;
            }
            ClosestPairKind::Duplicates => {
                writeln!(writer, "{} {}", rng.next_range(256), rng.next_range(256))?;
            }
            ClosestPairKind::Vertical => {
                write_real_point(writer, 500_000.0, random_coordinate(&mut rng))?;
            }
            ClosestPairKind::Grid => {
                let column = index % 250;
                let row = index / 250;
                writeln!(writer, "{} {}", column * 10, row * 10)?;
            }
            ClosestPairKind::Split => {
                let (x, y) = split_grid_point(index);
                write_real_point(writer, x, y)?;
            }
            ClosestPairKind::Clustered => unreachable!("clustered points returned above"),
        }
    }
    Ok(())
}

fn write_real_point<W: Write>(writer: &mut W, x: f64, y: f64) -> std::io::Result<()> {
    writeln!(writer, "{x:.6} {y:.6}")
}

fn split_grid_point(index: usize) -> (f64, f64) {
    match index {
        SPLIT_LEFT_INDEX => (SPLIT_MIDDLE - 0.0005, 500_000.0),
        SPLIT_RIGHT_INDEX => (SPLIT_MIDDLE + 0.0005, 500_000.0),
        _ => {
            let column = index % 1_000;
            let row = index / 1_000;
            ((column * 1_000) as f64, (row * 1_000) as f64)
        }
    }
}

fn random_coordinate(rng: &mut SplitMix64) -> f64 {
    rng.next_f64() * COORDINATE_LIMIT
}

fn write_multiplication_file(
    path: &Path,
    kind: MultiplicationKind,
    seed: u64,
) -> Result<(), String> {
    let mut writer = create_writer(path)?;
    write_multiplication(&mut writer, kind, SplitMix64::new(seed))
        .and_then(|()| writer.flush())
        .map_err(|error| format!("{} could not be written: {error}", path.display()))
}

fn write_multiplication<W: Write>(
    writer: &mut W,
    kind: MultiplicationKind,
    mut rng: SplitMix64,
) -> std::io::Result<()> {
    match kind {
        MultiplicationKind::Random {
            left_digits,
            right_digits,
        } => {
            writer.write_all(&random_decimal(left_digits, false, &mut rng))?;
            writer.write_all(b"\n")?;
            writer.write_all(&random_decimal(right_digits, false, &mut rng))?;
            writer.write_all(b"\n")
        }
        MultiplicationKind::AllNines { digits } => {
            writer.write_all(&vec![b'9'; digits])?;
            writer.write_all(b"\n")?;
            writer.write_all(&random_decimal(digits, false, &mut rng))?;
            writer.write_all(b"\n")
        }
        MultiplicationKind::ManyZeros { digits } => {
            writer.write_all(&random_decimal(digits, true, &mut rng))?;
            writer.write_all(b"\n")?;
            writer.write_all(&random_decimal(digits, true, &mut rng))?;
            writer.write_all(b"\n")
        }
        MultiplicationKind::PowersOfTen { digits } => {
            writer.write_all(&power_of_ten(digits))?;
            writer.write_all(b"\n")?;
            writer.write_all(&power_of_ten(digits))?;
            writer.write_all(b"\n")
        }
        MultiplicationKind::Zero { other_digits } => {
            writer.write_all(b"0\n")?;
            writer.write_all(&random_decimal(other_digits, false, &mut rng))?;
            writer.write_all(b"\n")
        }
    }
}

fn random_decimal(digits: usize, many_zeros: bool, rng: &mut SplitMix64) -> Vec<u8> {
    debug_assert!(digits > 0);
    let mut output = Vec::with_capacity(digits);
    output.push(b'1' + rng.next_range(9) as u8);
    for _ in 1..digits {
        let digit = if many_zeros && rng.next_range(4) != 0 {
            0
        } else {
            rng.next_range(10)
        };
        output.push(b'0' + digit as u8);
    }
    output
}

fn power_of_ten(digits: usize) -> Vec<u8> {
    debug_assert!(digits > 0);
    let mut output = vec![b'0'; digits];
    output[0] = b'1';
    output
}

#[derive(Clone, Copy)]
struct SplitMix64 {
    state: u64,
}

impl SplitMix64 {
    fn new(seed: u64) -> Self {
        Self { state: seed }
    }

    fn next_u64(&mut self) -> u64 {
        self.state = self.state.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut value = self.state;
        value = (value ^ (value >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        value = (value ^ (value >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        value ^ (value >> 31)
    }

    fn next_f64(&mut self) -> f64 {
        const SCALE: f64 = 1.0 / (1_u64 << 53) as f64;
        ((self.next_u64() >> 11) as f64) * SCALE
    }

    fn next_range(&mut self, bound: u64) -> u64 {
        debug_assert!(bound > 0);
        let threshold = bound.wrapping_neg() % bound;
        loop {
            let value = self.next_u64();
            if value >= threshold {
                return value % bound;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn seeds_are_reproducible_and_unique_even_when_wrapping() {
        let seeds: HashSet<u64> = (0..FILE_COUNT)
            .map(|index| seed_for_file(u64::MAX - 3, index))
            .collect();
        assert_eq!(seeds.len(), FILE_COUNT);
        assert_eq!(seed_for_file(42, 0), 42);
        assert_eq!(seed_for_file(42, 19), 61);
    }

    #[test]
    fn closest_pair_output_is_reproducible_and_has_the_declared_size() {
        let mut first = Vec::new();
        let mut second = Vec::new();
        write_closest_pairs(
            &mut first,
            ClosestPairKind::Uniform,
            101,
            SplitMix64::new(7),
        )
        .unwrap();
        write_closest_pairs(
            &mut second,
            ClosestPairKind::Uniform,
            101,
            SplitMix64::new(7),
        )
        .unwrap();
        assert_eq!(first, second);

        let text = String::from_utf8(first).unwrap();
        let mut lines = text.lines();
        assert_eq!(lines.next(), Some("101"));
        assert_eq!(lines.count(), 101);
        for line in text.lines().skip(1) {
            let coordinates: Vec<f64> = line
                .split_whitespace()
                .map(|value| value.parse().unwrap())
                .collect();
            assert_eq!(coordinates.len(), 2);
            assert!(
                coordinates
                    .iter()
                    .all(|value| (0.0..=COORDINATE_LIMIT).contains(value))
            );
        }
    }

    #[test]
    fn duplicate_grid_and_vertical_cases_have_the_required_shape() {
        let mut duplicates = Vec::new();
        write_closest_pairs(
            &mut duplicates,
            ClosestPairKind::Duplicates,
            1_000,
            SplitMix64::new(11),
        )
        .unwrap();
        let duplicate_text = String::from_utf8(duplicates).unwrap();
        let unique: HashSet<&str> = duplicate_text.lines().skip(1).collect();
        assert!(unique.len() < 1_000);

        let mut grid = Vec::new();
        write_closest_pairs(&mut grid, ClosestPairKind::Grid, 251, SplitMix64::new(12)).unwrap();
        let grid_text = String::from_utf8(grid).unwrap();
        assert!(grid_text.lines().any(|line| line == "0 0"));
        assert!(grid_text.lines().any(|line| line == "10 0"));
        assert!(grid_text.lines().any(|line| line == "0 10"));

        let mut vertical = Vec::new();
        write_closest_pairs(
            &mut vertical,
            ClosestPairKind::Vertical,
            10,
            SplitMix64::new(13),
        )
        .unwrap();
        let vertical_text = String::from_utf8(vertical).unwrap();
        assert!(
            vertical_text
                .lines()
                .skip(1)
                .all(|line| line.starts_with("500000.000000 "))
        );
    }

    #[test]
    fn split_pair_is_unique_and_straddles_the_median() {
        let left = split_grid_point(SPLIT_LEFT_INDEX);
        let right = split_grid_point(SPLIT_RIGHT_INDEX);
        assert!(left.0 < SPLIT_MIDDLE && right.0 > SPLIT_MIDDLE);
        assert!((right.0 - left.0 - 0.001).abs() < 1e-9);
        assert_eq!(left.1, right.1);

        let nearest_same_row_left = split_grid_point(SPLIT_LEFT_INDEX - 1);
        let nearest_same_row_right = split_grid_point(SPLIT_RIGHT_INDEX + 1);
        assert!(nearest_same_row_left.0 < left.0 - 1_000.0);
        assert!(nearest_same_row_right.0 > right.0 + 1_000.0);
    }

    #[test]
    fn random_decimals_have_exact_lengths_and_no_leading_zero() {
        let mut rng = SplitMix64::new(21);
        let random = random_decimal(101, false, &mut rng);
        let zeros = random_decimal(99_999, true, &mut rng);
        assert_eq!(random.len(), 101);
        assert_eq!(zeros.len(), 99_999);
        assert!(random[0].is_ascii_digit() && random[0] != b'0');
        assert!(zeros[0].is_ascii_digit() && zeros[0] != b'0');
        assert!(random.iter().all(u8::is_ascii_digit));
        assert!(zeros.iter().all(u8::is_ascii_digit));
        assert!(zeros.iter().filter(|&&digit| digit == b'0').count() > 60_000);
    }

    #[test]
    fn special_integer_files_follow_the_required_formats() {
        let mut nines = Vec::new();
        write_multiplication(
            &mut nines,
            MultiplicationKind::AllNines { digits: 100 },
            SplitMix64::new(31),
        )
        .unwrap();
        let nines_text = String::from_utf8(nines).unwrap();
        let mut nines_lines = nines_text.lines();
        assert_eq!(nines_lines.next(), Some("9".repeat(100).as_str()));
        assert_eq!(nines_lines.next().unwrap().len(), 100);

        let mut powers = Vec::new();
        write_multiplication(
            &mut powers,
            MultiplicationKind::PowersOfTen { digits: 100 },
            SplitMix64::new(32),
        )
        .unwrap();
        let powers_text = String::from_utf8(powers).unwrap();
        let expected = format!("1{}\n1{}\n", "0".repeat(99), "0".repeat(99));
        assert_eq!(powers_text, expected);

        let mut zero = Vec::new();
        write_multiplication(
            &mut zero,
            MultiplicationKind::Zero { other_digits: 100 },
            SplitMix64::new(33),
        )
        .unwrap();
        let zero_text = String::from_utf8(zero).unwrap();
        assert!(zero_text.starts_with("0\n"));
        assert_eq!(zero_text.lines().nth(1).unwrap().len(), 100);
    }
}
