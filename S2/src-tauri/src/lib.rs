mod closest_pair;
mod generator;
mod karatsuba;
mod model;

use closest_pair::{ClosestPairBatchResult, ClosestPairProgressEvent, XSortStrategy};
use generator::GenerationResult;
use karatsuba::{KaratsubaProgressEvent, MultiplicationBatchResult};
use specta_typescript::Typescript;
use tauri::ipc::Channel;
use tauri_specta::{Builder, collect_commands};

#[tauri::command]
#[specta::specta]
async fn run_closest_pair_folder(
    directory: String,
    sort_strategy: XSortStrategy,
    on_progress: Channel<ClosestPairProgressEvent>,
) -> Result<ClosestPairBatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        closest_pair::run_folder_with_progress(&directory, sort_strategy, |event| {
            let _ = on_progress.send(event);
        })
    })
    .await
    .map_err(|error| format!("The closest-pair batch could not complete: {error}"))?
}

#[tauri::command]
#[specta::specta]
async fn run_closest_pair_files(
    paths: Vec<String>,
    sort_strategy: XSortStrategy,
    on_progress: Channel<ClosestPairProgressEvent>,
) -> Result<ClosestPairBatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        closest_pair::run_files_with_progress(paths, sort_strategy, |event| {
            let _ = on_progress.send(event);
        })
    })
    .await
    .map_err(|error| format!("The closest-pair batch could not complete: {error}"))?
}

#[tauri::command]
#[specta::specta]
async fn run_karatsuba_folder(
    directory: String,
    on_progress: Channel<KaratsubaProgressEvent>,
) -> Result<MultiplicationBatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        karatsuba::multiply_folder_with_progress(&directory, |event| {
            let _ = on_progress.send(event);
        })
    })
    .await
    .map_err(|error| format!("The Karatsuba batch could not complete: {error}"))?
}

#[tauri::command]
#[specta::specta]
async fn run_karatsuba_files(
    paths: Vec<String>,
    on_progress: Channel<KaratsubaProgressEvent>,
) -> Result<MultiplicationBatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        karatsuba::multiply_files_with_progress(paths, |event| {
            let _ = on_progress.send(event);
        })
    })
    .await
    .map_err(|error| format!("The Karatsuba batch could not complete: {error}"))?
}

#[tauri::command]
#[specta::specta]
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

fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            run_closest_pair_folder,
            run_closest_pair_files,
            run_karatsuba_folder,
            run_karatsuba_files,
            generate_datasets,
        ])
        .dangerously_cast_bigints_to_number()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = specta_builder();

    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_bindings() {
        specta_builder()
            .export(Typescript::default(), "../src/bindings.ts")
            .expect("failed to export typescript bindings");
    }
}
