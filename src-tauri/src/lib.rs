use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use http::{header::CONTENT_TYPE, Request, Response, StatusCode};
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sysinfo::System;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

const REMOTE_API_BASE_URL: &str = "https://mxtsl8.cn:12377/yys-cbg-inspector";
const PRODUCT_API_URL: &str = "https://yys.cbg.163.com/cgi/api/get_equip_detail";
const API_TIMEOUT: Duration = Duration::from_secs(20);
const STATIC_ASSET_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Deserialize)]
struct ProductRequest {
    serverid: Option<String>,
    ordersn: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StaticAssetUpdateRequest {
    #[serde(default, rename = "heroIds")]
    hero_ids: Vec<u64>,
    #[serde(default, rename = "suitIds")]
    suit_ids: Vec<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ComputeCapacity {
    logical_cores: usize,
    total_memory_mb: u64,
    free_memory_mb: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StaticAssetUpdateResult {
    hero_icons: u32,
    suit_icons: u32,
    failed: u32,
}

#[cfg(debug_assertions)]
macro_rules! log_api {
    ($message:expr) => {
        println!("[Tauri API] {}", $message);
    };
}

#[cfg(not(debug_assertions))]
macro_rules! log_api {
    ($message:expr) => {};
}

fn is_risk_control_text(text: &str) -> bool {
    [
        "风控",
        "账号安全",
        "安全验证",
        "请登录之后继续访问",
        "请登录后继续访问",
        "请完成验证",
        "验证码",
        "访问频繁",
        "请求频繁",
        "操作频繁",
        "请求被拦截",
        "异常请求",
        "访问异常",
        "稍后再试",
        "too many requests",
        "rate limit",
        "forbidden",
        "blocked",
        "captcha",
        "security verification",
    ]
    .iter()
    .any(|keyword| text.to_ascii_lowercase().contains(keyword))
}

fn is_risk_control_payload(payload: &Value) -> bool {
    let status_code = payload
        .get("status_code")
        .or_else(|| payload.get("status"))
        .and_then(Value::as_i64)
        .unwrap_or_default();
    status_code == 403 || status_code == 429 || is_risk_control_text(&payload.to_string())
}

fn risk_control_error() -> String {
    "接口触发风控，请下载 App 使用".to_owned()
}

fn invalid_endpoint(endpoint: &str) -> Result<PathBuf, String> {
    Err(format!("数据类型无效：{endpoint}"))
}

fn static_data_path<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    endpoint: &str,
) -> Result<PathBuf, String> {
    let file_name = match endpoint {
        "/static/heroes" => "heroes.json",
        "/static/relic-suits" => "relic-suits.json",
        _ => return invalid_endpoint(endpoint),
    };
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法获取应用数据目录：{error}"))?;
    Ok(root.join("static-data").join(file_name))
}

fn static_asset_path<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    kind: &str,
    id: u64,
) -> Result<PathBuf, String> {
    if kind != "heroes" && kind != "suits" {
        return Err("图标类型无效".to_owned());
    }
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法获取应用数据目录：{error}"))?;
    Ok(root
        .join("static-data")
        .join("assets")
        .join(kind)
        .join(format!("{id}.png")))
}

fn bundled_asset_roots<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        roots.push(resource_dir.join("static-data").join("assets"));
    }

    // 免安装版把 static-data 放在可执行文件同级，补充该路径以兼容直接复制运行的目录结构。
    if let Ok(executable) = std::env::current_exe() {
        if let Some(app_dir) = executable.parent() {
            roots.push(app_dir.join("static-data").join("assets"));
        }
    }

    // 开发模式下资源仍由 Vite 托管，补充项目目录候选路径，保证自定义协议也能读到内置图标。
    if cfg!(debug_assertions) {
        if let Ok(current_dir) = std::env::current_dir() {
            roots.push(
                current_dir
                    .join("public")
                    .join("static-data")
                    .join("assets"),
            );
            roots.push(
                current_dir
                    .join("..")
                    .join("public")
                    .join("static-data")
                    .join("assets"),
            );
        }
    }

    roots
}

fn is_png(bytes: &[u8]) -> bool {
    bytes.len() >= 8 && bytes[0..8] == [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
}

fn read_valid_png(path: &Path) -> Option<Vec<u8>> {
    let bytes = fs::read(path).ok()?;
    is_png(&bytes).then_some(bytes)
}

fn read_static_asset<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    kind: &str,
    id: u64,
) -> Option<Vec<u8>> {
    if let Ok(path) = static_asset_path(app, kind, id) {
        if let Some(bytes) = read_valid_png(&path) {
            return Some(bytes);
        }
    }

    bundled_asset_roots(app)
        .into_iter()
        .map(|root| root.join(kind).join(format!("{id}.png")))
        .find_map(|path| read_valid_png(&path))
}

fn official_asset_url(kind: &str, id: u64) -> String {
    match kind {
        "heroes" => format!("https://cbg-yys.res.netease.com/game_res/hero/{id}/{id}.png"),
        _ => format!("https://cbg-yys.res.netease.com/game_res/suit/{id}.png"),
    }
}

async fn download_static_asset<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    client: &Client,
    kind: &str,
    id: u64,
) -> Result<(), String> {
    let response = client
        .get(official_asset_url(kind, id))
        .send()
        .await
        .map_err(|_| "图标请求失败".to_owned())?;
    if !response.status().is_success() {
        return Err(format!("图标请求失败：{}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|_| "图标内容读取失败".to_owned())?
        .to_vec();
    if !is_png(&bytes) {
        return Err("图标内容不是有效 PNG".to_owned());
    }

    let target = static_asset_path(app, kind, id)?;
    let parent = target.parent().ok_or_else(|| "图标目录无效".to_owned())?;
    fs::create_dir_all(parent).map_err(|_| "图标目录创建失败".to_owned())?;

    // 先写临时文件再替换，避免更新过程中页面读到半截 PNG。
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temporary = parent.join(format!("{id}.png.{}.{}.tmp", std::process::id(), timestamp));
    fs::write(&temporary, bytes).map_err(|_| "图标保存失败".to_owned())?;
    if let Err(error) = fs::rename(&temporary, &target) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("图标替换失败：{error}"));
    }

    Ok(())
}

fn unique_asset_ids(ids: Vec<u64>) -> Vec<u64> {
    let mut seen = HashSet::new();
    ids.into_iter()
        .filter(|id| *id > 0 && seen.insert(*id))
        .take(1_000)
        .collect()
}

async fn update_static_asset_group<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    client: &Client,
    kind: &str,
    ids: Vec<u64>,
) -> (u32, u32) {
    let mut updated = 0;
    let mut failed = 0;

    for id in ids {
        // 内置资源或用户目录已有有效图标时不访问官方图床。
        if read_static_asset(app, kind, id).is_some() {
            continue;
        }
        match download_static_asset(app, client, kind, id).await {
            Ok(()) => updated += 1,
            Err(_) => failed += 1,
        }
    }

    (updated, failed)
}

fn write_static_json<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    endpoint: &str,
    data: &Value,
) -> Result<(), String> {
    let file_path = static_data_path(app, endpoint)?;
    let parent = file_path
        .parent()
        .ok_or_else(|| "静态数据目录无效".to_owned())?;
    fs::create_dir_all(parent).map_err(|_| "静态数据目录创建失败".to_owned())?;
    let content = serde_json::to_vec_pretty(data).map_err(|_| "静态数据格式异常".to_owned())?;
    fs::write(file_path, content).map_err(|_| "静态数据保存失败".to_owned())
}

fn not_found_response() -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Vec::new())
        .expect("固定的 404 响应必须有效")
}

fn is_safe_ui_name(name: &str) -> bool {
    (name.ends_with(".png") || name.ends_with(".svg"))
        && name.chars().all(|character| {
            character.is_ascii_lowercase()
                || character.is_ascii_digit()
                || matches!(character, '-' | '.' | '_')
        })
}

fn serve_asset<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    request: Request<Vec<u8>>,
) -> Response<Vec<u8>> {
    let Ok(url) = Url::parse(&request.uri().to_string()) else {
        return not_found_response();
    };
    let Some(host) = url.host_str() else {
        return not_found_response();
    };
    let Some(mut segments) = url.path_segments().map(|items| items.collect::<Vec<_>>()) else {
        return not_found_response();
    };
    // Windows WebView2 会把自定义协议改写为 http://yys-cbg-assets.localhost/...；
    // localhost 和旧版直接把资源类型放在 host 中的格式也一并兼容。
    let kind = match host {
        "yys-cbg-assets.localhost" | "localhost" => {
            let Some((kind, remaining)) = segments.split_first() else {
                return not_found_response();
            };
            let kind = *kind;
            segments = remaining.to_vec();
            kind
        }
        "ui" | "heroes" | "suits" => host,
        _ => return not_found_response(),
    };

    let (file_path, content_type) = if kind == "ui" {
        let Some(name) = segments.first().copied() else {
            return not_found_response();
        };
        if segments.len() != 1 || !is_safe_ui_name(name) {
            return not_found_response();
        }
        let candidates = bundled_asset_roots(app)
            .into_iter()
            .map(|root| root.join("ui").join(name))
            .collect::<Vec<_>>();
        let Some(path) = candidates.into_iter().find(|path| path.is_file()) else {
            return not_found_response();
        };
        let content_type = if name.ends_with(".svg") {
            "image/svg+xml"
        } else {
            "image/png"
        };
        (path, content_type)
    } else {
        let Some(id_text) = segments.first().copied() else {
            return not_found_response();
        };
        let Ok(id) = id_text
            .strip_suffix(".png")
            .unwrap_or_default()
            .parse::<u64>()
        else {
            return not_found_response();
        };
        if segments.len() != 1 || id == 0 || (kind != "heroes" && kind != "suits") {
            return not_found_response();
        }
        let Some(path) = static_asset_path(app, kind, id)
            .ok()
            .filter(|path| path.is_file())
            .or_else(|| {
                bundled_asset_roots(app)
                    .into_iter()
                    .map(|root| root.join(kind).join(format!("{id}.png")))
                    .find(|path| path.is_file())
            })
        else {
            return not_found_response();
        };
        (path, "image/png")
    };

    let Ok(bytes) = fs::read(file_path) else {
        return not_found_response();
    };
    Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, content_type)
        .header("Cache-Control", "public, max-age=31536000")
        .body(bytes)
        .expect("固定的资源响应头必须有效")
}

#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn get_compute_capacity() -> ComputeCapacity {
    let mut system = System::new();
    system.refresh_memory();
    ComputeCapacity {
        logical_cores: std::thread::available_parallelism()
            .map(|value| value.get())
            .unwrap_or(1),
        total_memory_mb: system.total_memory() / 1024 / 1024,
        free_memory_mb: system.available_memory() / 1024 / 1024,
    }
}

#[tauri::command]
async fn load_product(request: ProductRequest) -> Result<Value, String> {
    let serverid = request.serverid.unwrap_or_default();
    let ordersn = request.ordersn.unwrap_or_default();
    if !serverid.chars().all(|character| character.is_ascii_digit()) || ordersn.is_empty() {
        return Err("商品链接参数无效".to_owned());
    }

    let mut url = Url::parse(PRODUCT_API_URL).map_err(|_| "商品接口地址无效".to_owned())?;
    url.query_pairs_mut().append_pair("client_type", "h5");

    let form_body = {
        let mut form_url =
            Url::parse(PRODUCT_API_URL).map_err(|_| "商品接口地址无效".to_owned())?;
        form_url
            .query_pairs_mut()
            .append_pair("serverid", &serverid)
            .append_pair("ordersn", &ordersn)
            .append_pair("h5_device", "other")
            .append_pair("app_client", "other")
            .append_pair("exter", "direct");
        form_url.query().unwrap_or_default().to_owned()
    };

    log_api!(&format!(
        "load_product 请求：POST {url}（serverid={serverid}, ordersn={ordersn}）"
    ));
    let client = Client::builder()
        .timeout(API_TIMEOUT)
        .build()
        .map_err(|_| "商品请求客户端初始化失败".to_owned())?;
    let response = match client
        .post(url)
        .header("accept", "application/json")
        .header(
            "content-type",
            "application/x-www-form-urlencoded; charset=UTF-8",
        )
        .header("user-agent", "YYS-CBG-Inspector/1.0")
        .header("referer", "https://yys.cbg.163.com/")
        .body(form_body)
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => {
            log_api!(&format!("load_product 请求失败：{error}"));
            return Err("商品数据暂时无法获取，请稍后重试".to_owned());
        }
    };

    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|_| "商品响应内容读取失败".to_owned())?;
    if status.as_u16() == 403 || status.as_u16() == 429 || is_risk_control_text(&response_text) {
        log_api!(&format!("load_product 被风控：HTTP {status}"));
        return Err(risk_control_error());
    }
    if !status.is_success() {
        log_api!(&format!("load_product 响应异常：HTTP {status}"));
        return Err("商品数据暂时无法获取，请稍后重试".to_owned());
    }

    let payload = serde_json::from_str::<Value>(&response_text).map_err(|_| {
        log_api!("load_product 响应不是有效 JSON");
        "商品数据格式异常，请稍后重试".to_owned()
    })?;
    if is_risk_control_payload(&payload) {
        log_api!("load_product 返回风控数据");
        return Err(risk_control_error());
    }
    log_api!(&format!(
        "load_product 响应成功：HTTP {status}，{} 字节",
        response_text.len()
    ));
    Ok(payload)
}

#[tauri::command]
fn read_static_data(app: tauri::AppHandle, endpoint: String) -> Result<Option<Value>, String> {
    let file_path = static_data_path(&app, &endpoint)?;
    let Ok(content) = fs::read_to_string(file_path) else {
        return Ok(None);
    };
    Ok(serde_json::from_str(&content).ok())
}

#[tauri::command]
async fn update_static_data(app: tauri::AppHandle, endpoint: String) -> Result<Value, String> {
    static_data_path(&app, &endpoint)?;
    let url = format!("{REMOTE_API_BASE_URL}{endpoint}");
    log_api!(&format!("update_static_data 请求：GET {url}"));
    let client = Client::builder()
        .timeout(API_TIMEOUT)
        .build()
        .map_err(|_| "远程请求客户端初始化失败".to_owned())?;
    let response = match client
        .get(&url)
        .header("accept", "application/json")
        .header("user-agent", "YYS-CBG-Inspector/1.0")
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => {
            log_api!(&format!("update_static_data 请求失败：{error}"));
            return Err("远程数据暂时无法获取，请稍后重试".to_owned());
        }
    };

    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|_| "远程响应内容读取失败".to_owned())?;
    if status.as_u16() == 403 || status.as_u16() == 429 || is_risk_control_text(&response_text) {
        log_api!(&format!("update_static_data 被风控：HTTP {status}"));
        return Err(risk_control_error());
    }
    if !status.is_success() {
        log_api!(&format!("update_static_data 响应异常：HTTP {status}"));
        return Err("远程数据暂时无法获取，请稍后重试".to_owned());
    }

    let data = serde_json::from_str::<Value>(&response_text).map_err(|_| {
        log_api!("update_static_data 响应不是有效 JSON");
        "远程数据格式异常，请稍后重试".to_owned()
    })?;
    write_static_json(&app, &endpoint, &data)?;
    log_api!(&format!(
        "update_static_data 响应成功：HTTP {status}，{} 字节，已写入本地缓存",
        response_text.len()
    ));
    Ok(data)
}

#[tauri::command]
fn save_static_data(app: tauri::AppHandle, endpoint: String, data: Value) -> Result<Value, String> {
    if !data.is_object() && !data.is_array() {
        return Err("JSON 根节点必须是对象或数组".to_owned());
    }
    write_static_json(&app, &endpoint, &data)?;
    Ok(data)
}

#[tauri::command]
async fn update_static_assets(
    app: tauri::AppHandle,
    request: StaticAssetUpdateRequest,
) -> Result<StaticAssetUpdateResult, String> {
    let client = Client::builder()
        .timeout(STATIC_ASSET_TIMEOUT)
        .build()
        .map_err(|_| "图标请求客户端初始化失败".to_owned())?;
    let (hero_icons, hero_failed) =
        update_static_asset_group(&app, &client, "heroes", unique_asset_ids(request.hero_ids))
            .await;
    let (suit_icons, suit_failed) =
        update_static_asset_group(&app, &client, "suits", unique_asset_ids(request.suit_ids)).await;
    Ok(StaticAssetUpdateResult {
        hero_icons,
        suit_icons,
        failed: hero_failed + suit_failed,
    })
}

#[tauri::command]
fn open_downloads_folder(app: tauri::AppHandle) -> Result<(), String> {
    let downloads = app
        .path()
        .download_dir()
        .map_err(|error| format!("无法获取下载目录：{error}"))?;
    app.opener()
        .open_path(downloads.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|error| format!("打开下载目录失败：{error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .register_uri_scheme_protocol("yys-cbg-assets", |context, request| {
            serve_asset(context.app_handle(), request)
        })
        .setup(|_app| {
            #[cfg(debug_assertions)]
            if let Some(window) = _app.get_webview_window("main") {
                // 开发模式默认打开控制台，方便排查本地资源、接口和页面运行时问题；生产包不主动打开。
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            get_compute_capacity,
            load_product,
            read_static_data,
            update_static_data,
            save_static_data,
            update_static_assets,
            open_downloads_folder,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 应用启动失败");
}
