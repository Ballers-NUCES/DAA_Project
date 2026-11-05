mod karatsuba;

use karatsuba::MultiplicationResult;

#[tauri::command]
async fn run_karatsuba(decimal_content: String) -> Result<MultiplicationResult, String> {
    tauri::async_runtime::spawn_blocking(move || karatsuba::multiply_input(&decimal_content))
        .await
        .map_err(|error| format!("The multiplication task could not complete: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![run_karatsuba])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
