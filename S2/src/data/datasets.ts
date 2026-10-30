export interface DatasetRow {
  file: string
  size: string
  description: string
}

export const closestPairDatasets: DatasetRow[] = [
  { file: "cp01", size: "1,000 points", description: "Uniform random coordinates" },
  { file: "cp02", size: "10,000 points", description: "Uniform random coordinates" },
  { file: "cp03", size: "100,000 points", description: "Uniform random coordinates" },
  { file: "cp04", size: "1,000,000 points", description: "Uniform random coordinates" },
  { file: "cp05", size: "1,000,000 points", description: "Clustered around 10 random centers" },
  { file: "cp06", size: "1,000,000 points", description: "Duplicate points; closest distance 0" },
  { file: "cp07", size: "100,000 points", description: "All points on one vertical line" },
  { file: "cp08", size: "100,000 points", description: "Equally spaced grid with tied pairs" },
  { file: "cp09", size: "1,000,000 points", description: "Closest pair across the middle split" },
  { file: "cp10", size: "101 points", description: "Small step-by-step demonstration" },
]

export const multiplicationDatasets: DatasetRow[] = [
  { file: "im01", size: "1,000 digits", description: "Two random integers" },
  { file: "im02", size: "10,000 digits", description: "Two random integers" },
  { file: "im03", size: "100,000 digits", description: "Two random integers" },
  { file: "im04", size: "1,000,000 digits", description: "Two random integers" },
  { file: "im05", size: "1,000,000 / 10 digits", description: "Very different operand lengths" },
  { file: "im06", size: "100,000 digits", description: "One operand contains only 9s" },
  { file: "im07", size: "99,999 digits", description: "Odd length with many zeros" },
  { file: "im08", size: "1,000,000 digits", description: "Both operands are powers of 10" },
  { file: "im09", size: "1 / 1,000,000 digits", description: "One operand is zero" },
  { file: "im10", size: "101 digits", description: "Small step-by-step demonstration" },
]
