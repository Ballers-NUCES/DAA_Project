mod generator;
mod karatsuba;

use generator::GenerationResult;
use karatsuba::{DecimalInput, MultiplicationBatchResult};

#[tauri::command]
async fn run_karatsuba_folder(directory: String) -> Result<MultiplicationBatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || karatsuba::multiply_folder(&directory))
        .await
        .map_err(|error| format!("The Karatsuba batch could not complete: {error}"))?
}

#[tauri::command]
async fn run_karatsuba_files(
    inputs: Vec<DecimalInput>,
) -> Result<MultiplicationBatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || karatsuba::multiply_files(inputs))
        .await
        .map_err(|error| format!("The Karatsuba batch could not complete: {error}"))?
}

#[tauri::command]
async fn generate_datasets(
    output_directory: String,
    seed: String,
) -> Result<GenerationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        generator::generate_datasets(&output_directory, &seed)
    })
    .await
    .map_err(|error| format!("The dataset generation task could not complete: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            run_karatsuba_folder,
            run_karatsuba_files,
            generate_datasets
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
