pub mod amount_to_words;
pub mod db;
pub mod models;
pub mod quickbooks;

use db::DbState;
use models::{
    ClientProfile, SeriesConfig, SignatoriesConfig, VoucherData, VoucherHistoryEntry,
};
use tauri::{Manager, State};

#[tauri::command]
fn get_clients(db: State<'_, DbState>) -> Result<Vec<ClientProfile>, String> {
    db.get_all_clients().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_client_profile(db: State<'_, DbState>, profile: ClientProfile) -> Result<(), String> {
    db.save_client(&profile).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_series(
    db: State<'_, DbState>,
    client_code: String,
    form_type: String,
) -> Result<SeriesConfig, String> {
    db.get_series(&client_code, &form_type)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn update_series(db: State<'_, DbState>, config: SeriesConfig) -> Result<(), String> {
    db.update_series(&config).map_err(|e| e.to_string())
}

#[tauri::command]
fn increment_series(
    db: State<'_, DbState>,
    client_code: String,
    form_type: String,
) -> Result<SeriesConfig, String> {
    let mut cfg = db
        .get_series(&client_code, &form_type)
        .map_err(|e| e.to_string())?;
    cfg.current_number += 1;
    db.update_series(&cfg).map_err(|e| e.to_string())?;
    Ok(cfg)
}

#[tauri::command]
fn get_signatories(
    db: State<'_, DbState>,
    client_code: String,
) -> Result<SignatoriesConfig, String> {
    db.get_signatories(&client_code).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_signatories(db: State<'_, DbState>, config: SignatoriesConfig) -> Result<(), String> {
    db.save_signatories(&config).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_voucher_history(
    db: State<'_, DbState>,
    company_name: String,
    cv_number: String,
    ref_number: String,
    payee_name: String,
    voucher_date: String,
    total_amount: f64,
    voucher_data: VoucherData,
) -> Result<VoucherHistoryEntry, String> {
    db.save_voucher_history(
        &company_name,
        &cv_number,
        &ref_number,
        &payee_name,
        &voucher_date,
        total_amount,
        &voucher_data,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_voucher_history(
    db: State<'_, DbState>,
    company_name: Option<String>,
) -> Result<Vec<VoucherHistoryEntry>, String> {
    db.get_voucher_history(company_name.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_voucher_history(db: State<'_, DbState>, id: i64) -> Result<(), String> {
    db.delete_voucher_history(id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn query_quickbooks_voucher(
    db: State<'_, DbState>,
    form_type: String,
    client_code: String,
    company_name: String,
    ref_number: String,
) -> Result<VoucherData, String> {
    let series_key = if company_name.trim().is_empty() {
        client_code.clone()
    } else {
        company_name.clone()
    };

    let series_form = if form_type.eq_ignore_ascii_case("Check") {
        "CV"
    } else {
        form_type.as_str()
    };

    let series = db
        .get_series(&series_key, series_form)
        .map_err(|e| e.to_string())?;
    let sig = db
        .get_signatories(&client_code)
        .map_err(|e| e.to_string())?;

    let formatted_series = if series.digit_count == 0 {
        series.prefix.clone()
    } else if series.prefix.is_empty() {
        format!(
            "{:0width$}",
            series.current_number,
            width = series.digit_count as usize
        )
    } else {
        format!(
            "{}{:0width$}",
            series.prefix,
            series.current_number,
            width = series.digit_count as usize
        )
    };

    tauri::async_runtime::spawn_blocking(move || {
        quickbooks::query_voucher_from_qb(
            &form_type,
            &client_code,
            &company_name,
            &ref_number,
            &formatted_series,
            sig,
        )
    })
    .await
    .map_err(|e| format!("Background task error: {}", e))?
}

fn disable_webview_print_headers(app_local_data_dir: &std::path::Path) {
    let pref_paths = [
        app_local_data_dir
            .join("EBWebView")
            .join("Default")
            .join("Preferences"),
    ];

    for pref_path in &pref_paths {
        if !pref_path.exists() {
            if let Some(parent) = pref_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let initial = serde_json::json!({
                "printing": {
                    "print_preview_sticky_settings": {
                        "appState": "{\"version\":2,\"isHeaderFooterEnabled\":false,\"marginsType\":1}"
                    }
                }
            });
            if let Ok(s) = serde_json::to_string(&initial) {
                let _ = std::fs::write(pref_path, s);
            }
            continue;
        }

        if let Ok(raw) = std::fs::read_to_string(pref_path) {
            if let Ok(mut root) = serde_json::from_str::<serde_json::Value>(&raw) {
                let printing = root
                    .as_object_mut()
                    .and_then(|obj| {
                        obj.entry("printing")
                            .or_insert_with(|| serde_json::json!({}))
                            .as_object_mut()
                    })
                    .and_then(|p| {
                        p.entry("print_preview_sticky_settings")
                            .or_insert_with(|| serde_json::json!({}))
                            .as_object_mut()
                    });

                if let Some(sticky) = printing {
                    let mut app_state = sticky
                        .get("appState")
                        .and_then(|v| v.as_str())
                        .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
                        .unwrap_or_else(|| serde_json::json!({"version": 2}));

                    if let Some(state_obj) = app_state.as_object_mut() {
                        state_obj.insert(
                            "isHeaderFooterEnabled".to_string(),
                            serde_json::Value::Bool(false),
                        );
                        state_obj.insert("marginsType".to_string(), serde_json::json!(1));
                    }

                    if let Ok(app_state_str) = serde_json::to_string(&app_state) {
                        sticky.insert(
                            "appState".to_string(),
                            serde_json::Value::String(app_state_str),
                        );
                    }
                }

                if let Ok(updated_raw) = serde_json::to_string(&root) {
                    let _ = std::fs::write(pref_path, updated_raw);
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let webview_dir = std::path::PathBuf::from(local_app_data).join("com.voucherpro.desktop");
        disable_webview_print_headers(&webview_dir);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app: &mut tauri::App| {
            let app_dir = app
                .handle()
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap());
            disable_webview_print_headers(&app_dir);
            let db_path = app_dir.join("voucherpro_drc.db");
            let state = DbState::new(db_path).expect("Failed to initialize SQLite database");
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_clients,
            save_client_profile,
            get_series,
            update_series,
            increment_series,
            get_signatories,
            save_signatories,
            save_voucher_history,
            get_voucher_history,
            delete_voucher_history,
            query_quickbooks_voucher
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
