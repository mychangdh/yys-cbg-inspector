use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use http::{header::CONTENT_TYPE, Request, Response, StatusCode};
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sysinfo::System;
use tauri::{
    Emitter, LogicalPosition, LogicalSize, Manager, Position, Size, WebviewBuilder, WebviewUrl,
    WebviewWindowBuilder,
};
use tauri_plugin_opener::OpenerExt;

const REMOTE_API_BASE_URL: &str = "https://mxtsl8.cn:12377/yys-cbg-inspector";
const API_TIMEOUT: Duration = Duration::from_secs(20);
const STATIC_ASSET_TIMEOUT: Duration = Duration::from_secs(10);
const CBG_PAGE_TIMEOUT: Duration = Duration::from_secs(30);
const CBG_EQUIP_DESC_BASE_URL: &str =
    "https://cbg-other-desc.res.netease.com/yys/static/equipdesc/";
const MAX_CBG_EQUIP_DESC_BYTES: usize = 32 * 1024 * 1024;
const CBG_SHELL_LABEL: &str = "cbg-shell";
const CBG_BROWSER_LABEL: &str = "cbg-browser";
static CBG_WINDOW_CREATION_LOCK: Mutex<()> = Mutex::new(());
const CBG_CAPTURE_SCRIPT: &str = r#"(() => {
  const allowedHosts = new Set([
    "yys.cbg.163.com", "cbg.163.com", "yys-huawei.cbg.163.com",
    "yys-oppo.cbg.163.com", "yys-vivo.cbg.163.com", "yys-xiaomi.cbg.163.com"
  ]);
  const capture = (url, status, body) => {
    try {
      const requestUrl = new URL(url, location.href);
      if (allowedHosts.has(requestUrl.hostname) &&
          requestUrl.pathname === "/cgi/api/get_equip_detail" &&
          typeof body === "string") {
        window.__yysCbgEquipCapture = { status, body, pageUrl: location.href };
      }
    } catch {}
  };
  const rememberSafeCode = headers => {
    try {
      const value = new Headers(headers).get("cbg-safe-code");
      if (value) window.__yysCbgSafeCode = value;
    } catch {}
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    this.__yysCbgRequestUrl = String(url);
    return originalOpen.apply(this, arguments);
  };
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (String(name).toLowerCase() === "cbg-safe-code") {
      window.__yysCbgSafeCode = String(value);
    }
    return originalSetRequestHeader.apply(this, arguments);
  };
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    this.addEventListener("loadend", () => {
      try {
        let body;
        try { body = this.responseText; }
        catch { body = JSON.stringify(this.response); }
        capture(this.__yysCbgRequestUrl, this.status, body);
      } catch {}
    }, { once: true });
    return originalSend.apply(this, arguments);
  };

  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    const url = input instanceof Request ? input.url : String(input);
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    if (init && init.headers) {
      new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    }
    rememberSafeCode(headers);
    return originalFetch.apply(this, arguments).then(response => {
      response.clone().text().then(body => capture(url, response.status, body)).catch(() => {});
      return response;
    });
  };
})()"#;

fn cbg_product_ordersn(page_url: &str) -> Result<String, String> {
    let url = Url::parse(page_url).map_err(|_| "藏宝阁商品链接格式无效".to_owned())?;
    let host = url.host_str().unwrap_or_default().to_ascii_lowercase();
    let supported_host = matches!(
        host.as_str(),
        "yys.cbg.163.com"
            | "cbg.163.com"
            | "yys-huawei.cbg.163.com"
            | "yys-oppo.cbg.163.com"
            | "yys-vivo.cbg.163.com"
            | "yys-xiaomi.cbg.163.com"
    );
    if url.scheme() != "https" || !supported_host {
        return Err("仅接受 HTTPS 阴阳师藏宝阁商品页".to_owned());
    }
    let segments = url
        .path_segments()
        .ok_or_else(|| "藏宝阁商品链接无效".to_owned())?
        .collect::<Vec<_>>();
    if segments.len() != 5
        || segments[0] != "cgi"
        || segments[1] != "mweb"
        || segments[2] != "equip"
        || segments[3].parse::<u32>().is_err()
    {
        return Err("链接中没有找到商品编号".to_owned());
    }
    cbg_equip_desc_url(segments[4])?;
    Ok(segments[4].to_owned())
}

#[cfg(test)]
mod cbg_page_tests {
    use super::{cbg_product_ordersn, CbgPanelBounds};

    #[test]
    fn accepts_only_supported_https_product_pages() {
        assert_eq!(
            cbg_product_ordersn(
                "https://yys.cbg.163.com/cgi/mweb/equip/20/202610231401616-20-BR7HJ8KCSGFQQ?view_loc=home"
            )
            .unwrap(),
            "202610231401616-20-BR7HJ8KCSGFQQ"
        );
        assert!(cbg_product_ordersn("http://yys.cbg.163.com/cgi/mweb/equip/20/abc").is_err());
        assert!(cbg_product_ordersn("https://example.com/cgi/mweb/equip/20/abc").is_err());
        assert!(cbg_product_ordersn("https://yys.cbg.163.com/cgi/mweb/equip/20/../abc").is_err());
    }

    #[test]
    fn accepts_only_finite_positive_panel_bounds() {
        assert!(CbgPanelBounds {
            x: 10.0,
            y: 20.0,
            width: 800.0,
            height: 600.0,
        }
        .is_valid());
        assert!(!CbgPanelBounds {
            x: 0.0,
            y: 0.0,
            width: f64::NAN,
            height: 600.0,
        }
        .is_valid());
    }
}

#[cfg(windows)]
mod windows_dpapi {
    use std::{ffi::c_void, ptr, slice};

    #[repr(C)]
    struct DataBlob {
        size: u32,
        data: *mut u8,
    }

    #[link(name = "Crypt32")]
    extern "system" {
        fn CryptProtectData(
            input: *const DataBlob,
            description: *const u16,
            entropy: *const DataBlob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            output: *mut DataBlob,
        ) -> i32;
        fn CryptUnprotectData(
            input: *const DataBlob,
            description: *mut *mut u16,
            entropy: *const DataBlob,
            reserved: *mut c_void,
            prompt: *mut c_void,
            flags: u32,
            output: *mut DataBlob,
        ) -> i32;
    }

    #[link(name = "Kernel32")]
    extern "system" {
        fn LocalFree(memory: *mut c_void) -> *mut c_void;
    }

    fn transform(input: &[u8], protect: bool) -> Result<Vec<u8>, String> {
        let size = u32::try_from(input.len()).map_err(|_| "登录信息过大".to_owned())?;
        let input = DataBlob {
            size,
            data: input.as_ptr().cast_mut(),
        };
        let mut entropy_bytes = b"com.yys.cbg.inspector.tauri/cbg-session/v1".to_vec();
        let entropy = DataBlob {
            size: entropy_bytes.len() as u32,
            data: entropy_bytes.as_mut_ptr(),
        };
        let mut output = DataBlob {
            size: 0,
            data: ptr::null_mut(),
        };
        let success = unsafe {
            if protect {
                CryptProtectData(
                    &input,
                    ptr::null(),
                    &entropy,
                    ptr::null_mut(),
                    ptr::null_mut(),
                    1,
                    &mut output,
                )
            } else {
                CryptUnprotectData(
                    &input,
                    ptr::null_mut(),
                    &entropy,
                    ptr::null_mut(),
                    ptr::null_mut(),
                    1,
                    &mut output,
                )
            }
        };
        entropy_bytes.fill(0);
        if success == 0 || output.data.is_null() {
            if !output.data.is_null() {
                unsafe {
                    LocalFree(output.data.cast());
                }
            }
            return Err("无法安全读取或保存藏宝阁登录状态".to_owned());
        }

        let result = unsafe { slice::from_raw_parts(output.data, output.size as usize).to_vec() };
        unsafe {
            LocalFree(output.data.cast());
        }
        Ok(result)
    }

    pub fn protect(input: &[u8]) -> Result<Vec<u8>, String> {
        transform(input, true)
    }

    pub fn unprotect(input: &[u8]) -> Result<Vec<u8>, String> {
        transform(input, false)
    }
}

#[cfg(not(windows))]
mod windows_dpapi {
    pub fn protect(_: &[u8]) -> Result<Vec<u8>, String> {
        Err("当前平台不支持加密保存藏宝阁登录状态".to_owned())
    }

    pub fn unprotect(_: &[u8]) -> Result<Vec<u8>, String> {
        Err("当前平台不支持加密读取藏宝阁登录状态".to_owned())
    }
}

#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
enum CbgChannel {
    Official,
    Huawei,
    Oppo,
    Vivo,
    Xiaomi,
}

impl Default for CbgChannel {
    fn default() -> Self {
        Self::Official
    }
}

impl CbgChannel {
    fn label(self) -> &'static str {
        match self {
            Self::Official => "official",
            Self::Huawei => "huawei",
            Self::Oppo => "oppo",
            Self::Vivo => "vivo",
            Self::Xiaomi => "xiaomi",
        }
    }

    fn host(self) -> &'static str {
        match self {
            Self::Official => "yys.cbg.163.com",
            Self::Huawei => "yys-huawei.cbg.163.com",
            Self::Oppo => "yys-oppo.cbg.163.com",
            Self::Vivo => "yys-vivo.cbg.163.com",
            Self::Xiaomi => "yys-xiaomi.cbg.163.com",
        }
    }

    fn login_window_label(self) -> String {
        format!("cbg-login-{}", self.label())
    }

    fn accepts_source_host(self, host: &str) -> bool {
        match self {
            Self::Official => matches!(host, "yys.cbg.163.com" | "cbg.163.com"),
            _ => host == self.host(),
        }
    }
}

fn cbg_cookie_path<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    channel: CbgChannel,
) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|_| "无法获取应用数据目录".to_owned())?
        .join("secrets")
        .join(format!("cbg-{}.bin", channel.label())))
}

fn is_cbg_auth_cookie(name: &str, value: &str) -> bool {
    matches!(
        name,
        "NTES_SESS"
            | "sid"
            | "NTES_PASSPORT"
            | "urs_share_login_token"
            | "urs_share_login_token_h5"
    ) && !value.is_empty()
}

fn has_cbg_login_cookie(cookies: &[tauri::webview::Cookie<'_>]) -> bool {
    cookies
        .iter()
        .any(|cookie| is_cbg_auth_cookie(cookie.name(), cookie.value()))
}

fn has_saved_cbg_login_cookie(cookies: &[String]) -> bool {
    cookies.iter().any(|value| {
        value
            .parse::<tauri::webview::Cookie<'static>>()
            .is_ok_and(|cookie| is_cbg_auth_cookie(cookie.name(), cookie.value()))
    })
}

#[cfg(test)]
mod cbg_login_tests {
    use super::is_cbg_auth_cookie;

    #[test]
    fn recognizes_cbg_login_session_cookies_only_when_nonempty() {
        assert!(is_cbg_auth_cookie("NTES_SESS", "session"));
        assert!(is_cbg_auth_cookie("urs_share_login_token_h5", "token"));
        assert!(!is_cbg_auth_cookie("NTES_SESS", ""));
        assert!(!is_cbg_auth_cookie("NTES_P_UTID", "visitor"));
    }
}

fn load_cbg_cookies<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    channel: CbgChannel,
) -> Result<Option<Vec<String>>, String> {
    let path = cbg_cookie_path(app, channel)?;
    let encrypted = match fs::read(path) {
        Ok(value) => value,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("无法读取加密的藏宝阁登录状态".to_owned()),
    };
    let mut plaintext = windows_dpapi::unprotect(&encrypted)?;
    let cookies =
        serde_json::from_slice(&plaintext).map_err(|_| "加密的藏宝阁登录状态格式无效".to_owned());
    plaintext.fill(0);
    cookies.map(Some)
}

fn save_cbg_cookies<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    channel: CbgChannel,
    cookies: &[tauri::webview::Cookie<'_>],
) -> Result<(), String> {
    let values = cookies.iter().map(ToString::to_string).collect::<Vec<_>>();
    if !has_saved_cbg_login_cookie(&values) {
        return Err("未检测到藏宝阁登录凭据".to_owned());
    }
    if load_cbg_cookies(app, channel).ok().flatten().as_ref() == Some(&values) {
        return Ok(());
    }

    let path = cbg_cookie_path(app, channel)?;
    let parent = path
        .parent()
        .ok_or_else(|| "无法获取登录状态保存目录".to_owned())?;
    fs::create_dir_all(parent).map_err(|_| "无法创建加密登录状态目录".to_owned())?;
    let mut plaintext =
        serde_json::to_vec(&values).map_err(|_| "无法序列化藏宝阁登录状态".to_owned())?;
    let encrypted = windows_dpapi::protect(&plaintext);
    plaintext.fill(0);
    fs::write(path, encrypted?).map_err(|_| "无法保存加密的藏宝阁登录状态".to_owned())
}

fn clear_cbg_cookies<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    channel: CbgChannel,
) -> Result<(), String> {
    match fs::remove_file(cbg_cookie_path(app, channel)?) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("无法清除已失效的藏宝阁登录状态".to_owned()),
    }
}

fn restore_cbg_cookies(
    webview: &tauri::Webview,
    channel: CbgChannel,
    values: &[String],
) -> Result<(), String> {
    for value in values {
        let mut cookie = value
            .parse::<tauri::webview::Cookie<'static>>()
            .map_err(|_| "加密的藏宝阁登录状态格式无效".to_owned())?;
        if cookie.domain().is_none() {
            cookie.set_domain(channel.host());
        }
        let domain = cookie.domain().unwrap_or_default();
        let host = channel.host();
        if domain != host && !host.ends_with(&format!(".{domain}")) {
            continue;
        }
        webview
            .set_cookie(cookie)
            .map_err(|_| "无法恢复藏宝阁登录状态".to_owned())?;
    }
    Ok(())
}

async fn cbg_cookies_for_window(
    window: &tauri::WebviewWindow,
    channel: CbgChannel,
) -> Result<Vec<tauri::webview::Cookie<'static>>, String> {
    let window = window.clone();
    let url = Url::parse(&format!("https://{}/", channel.host()))
        .map_err(|_| "藏宝阁登录地址无效".to_owned())?;
    tauri::async_runtime::spawn_blocking(move || window.cookies_for_url(url))
        .await
        .map_err(|_| "读取藏宝阁登录状态失败".to_owned())?
        .map_err(|_| "读取藏宝阁登录状态失败".to_owned())
}

async fn cbg_cookies_for_webview(
    webview: &tauri::Webview,
    channel: CbgChannel,
) -> Result<Vec<tauri::webview::Cookie<'static>>, String> {
    let webview = webview.clone();
    let url = Url::parse(&format!("https://{}/", channel.host()))
        .map_err(|_| "藏宝阁登录地址无效".to_owned())?;
    tauri::async_runtime::spawn_blocking(move || webview.cookies_for_url(url))
        .await
        .map_err(|_| "读取藏宝阁登录状态失败".to_owned())?
        .map_err(|_| "读取藏宝阁登录状态失败".to_owned())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductRequest {
    serverid: Option<String>,
    ordersn: Option<String>,
    #[serde(default)]
    channel: CbgChannel,
    source_url: Option<String>,
    view_loc: Option<String>,
    tfid: Option<String>,
    tcid: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StaticAssetUpdateRequest {
    #[serde(default, rename = "heroIds")]
    hero_ids: Vec<u64>,
    #[serde(default, rename = "suitIds")]
    suit_ids: Vec<u64>,
}

#[derive(Debug, Deserialize)]
struct CbgPanelBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl CbgPanelBounds {
    fn is_valid(&self) -> bool {
        self.x.is_finite()
            && self.y.is_finite()
            && self.width.is_finite()
            && self.height.is_finite()
            && self.x >= 0.0
            && self.y >= 0.0
            && self.width >= 1.0
            && self.height >= 1.0
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveAccountSummaryRequest {
    product_url: String,
    summary: String,
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

async fn ensure_cbg_login_window(app: tauri::AppHandle, channel: CbgChannel) -> Result<(), String> {
    let label = channel.login_window_label();
    let url = Url::parse(&format!("https://{}/", channel.host()))
        .map_err(|_| "藏宝阁登录地址无效".to_owned())?;
    if let Some(window) = app.get_webview_window(&label) {
        let cookies = cbg_cookies_for_window(&window, channel).await?;
        if has_cbg_login_cookie(&cookies) {
            save_cbg_cookies(&app, channel, &cookies)?;
        } else if let Some(cookies) = load_cbg_cookies(&app, channel).ok().flatten() {
            if has_saved_cbg_login_cookie(&cookies) {
                restore_cbg_cookies(window.as_ref(), channel, &cookies)?;
                window
                    .navigate(url)
                    .map_err(|_| "无法恢复藏宝阁登录页面".to_owned())?;
            }
        }
        return Ok(());
    }

    let saved_cookies = load_cbg_cookies(&app, channel)
        .ok()
        .flatten()
        .filter(|cookies| has_saved_cbg_login_cookie(cookies));
    let initial_url = if saved_cookies.is_some() {
        Url::parse("about:blank").map_err(|_| "藏宝阁登录地址无效".to_owned())?
    } else {
        url.clone()
    };
    let window = WebviewWindowBuilder::new(&app, label, WebviewUrl::External(initial_url))
        .title("藏宝阁登录")
        .inner_size(1050.0, 780.0)
        .initialization_script(CBG_CAPTURE_SCRIPT)
        .visible(false)
        .center()
        .build()
        .map_err(|error| format!("无法打开藏宝阁登录窗口：{error}"))?;
    if let Some(cookies) = saved_cookies {
        restore_cbg_cookies(window.as_ref(), channel, &cookies)?;
        window
            .navigate(url)
            .map_err(|_| "无法恢复藏宝阁登录页面".to_owned())?;
    }
    Ok(())
}

fn cbg_window_position(app: &tauri::AppHandle) -> Option<(f64, f64)> {
    let main = app.get_webview_window("main")?;
    let monitor = main.current_monitor().ok().flatten()?;
    let main_position = main.outer_position().ok()?;
    let main_size = main.outer_size().ok()?;
    let scale = main.scale_factor().ok()?;
    let monitor_position = monitor.position();
    let monitor_size = monitor.size();
    let width = (960.0 * scale).round() as i32;
    let height = (800.0 * scale).round() as i32;
    let right_edge = monitor_position.x + monitor_size.width as i32;
    let bottom_edge = monitor_position.y + monitor_size.height as i32;
    let x = (main_position.x + main_size.width as i32).clamp(
        monitor_position.x,
        (right_edge - width).max(monitor_position.x),
    );
    let y = main_position.y.clamp(
        monitor_position.y,
        (bottom_edge - height).max(monitor_position.y),
    );
    Some((x as f64 / scale, y as f64 / scale))
}

#[tauri::command]
async fn toggle_cbg_window(app: tauri::AppHandle, channel: CbgChannel) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window(CBG_SHELL_LABEL) {
        if window
            .is_visible()
            .map_err(|error| format!("无法读取藏宝阁窗口状态：{error}"))?
        {
            let fullscreen = window
                .is_fullscreen()
                .map_err(|error| format!("无法读取藏宝阁全屏状态：{error}"))?;
            window
                .hide()
                .map_err(|error| format!("无法收起藏宝阁窗口：{error}"))?;
            return Ok(fullscreen);
        }
        window
            .emit("cbg-window:channel", channel.label())
            .map_err(|error| format!("无法切换藏宝阁区服：{error}"))?;
        window
            .show()
            .and_then(|()| window.set_focus())
            .map_err(|error| format!("无法显示藏宝阁窗口：{error}"))?;
        return window
            .is_fullscreen()
            .map_err(|error| format!("无法读取藏宝阁全屏状态：{error}"));
    }

    create_cbg_window(&app, channel).map(|_| false)
}

fn create_cbg_window(
    app: &tauri::AppHandle,
    channel: CbgChannel,
) -> Result<tauri::WebviewWindow, String> {
    let _creation_guard = CBG_WINDOW_CREATION_LOCK
        .lock()
        .map_err(|_| "藏宝阁窗口状态异常".to_owned())?;
    if let Some(window) = app.get_webview_window(CBG_SHELL_LABEL) {
        window
            .emit("cbg-window:channel", channel.label())
            .and_then(|()| window.show())
            .and_then(|()| window.set_focus())
            .map_err(|error| format!("无法显示独立藏宝阁窗口：{error}"))?;
        return Ok(window);
    }

    let url = WebviewUrl::App(std::path::PathBuf::from(format!(
        "index.html#/cbg-window?channel={}",
        channel.label()
    )));
    let builder = WebviewWindowBuilder::new(app, CBG_SHELL_LABEL, url)
        .title("藏宝阁")
        .inner_size(960.0, 800.0)
        .min_inner_size(720.0, 560.0)
        .resizable(true);
    let builder = if let Some((x, y)) = cbg_window_position(&app) {
        builder.position(x, y)
    } else {
        builder.center()
    };
    let window = builder
        .build()
        .map_err(|error| format!("无法打开独立藏宝阁窗口：{error}"))?;
    window
        .show()
        .and_then(|()| window.set_focus())
        .map_err(|error| format!("无法显示独立藏宝阁窗口：{error}"))?;
    Ok(window)
}

#[tauri::command]
async fn set_cbg_webview(
    app: tauri::AppHandle,
    channel: CbgChannel,
    bounds: CbgPanelBounds,
) -> Result<(), String> {
    if !bounds.is_valid() {
        return Err("藏宝阁页面尺寸无效".to_owned());
    }
    let position = Position::Logical(LogicalPosition::new(bounds.x, bounds.y));
    let size = Size::Logical(LogicalSize::new(bounds.width, bounds.height));
    let url = Url::parse(&format!("https://{}/", channel.host()))
        .map_err(|_| "藏宝阁地址无效".to_owned())?;

    let webview = if let Some(webview) = app.get_webview(CBG_BROWSER_LABEL) {
        let current_host = webview
            .url()
            .ok()
            .and_then(|current| current.host_str().map(str::to_owned))
            .unwrap_or_default();
        if !channel.accepts_source_host(&current_host) {
            if let Some(cookies) = load_cbg_cookies(&app, channel).ok().flatten() {
                if has_saved_cbg_login_cookie(&cookies) {
                    restore_cbg_cookies(&webview, channel, &cookies)?;
                }
            }
            webview
                .navigate(url)
                .map_err(|error| format!("无法切换藏宝阁区服：{error}"))?;
        }
        webview
    } else {
        let window = app
            .get_window(CBG_SHELL_LABEL)
            .ok_or_else(|| "找不到藏宝阁独立窗口".to_owned())?;
        let saved_cookies = load_cbg_cookies(&app, channel)
            .ok()
            .flatten()
            .filter(|cookies| has_saved_cbg_login_cookie(cookies));
        let initial_url = if saved_cookies.is_some() {
            Url::parse("about:blank").map_err(|_| "藏宝阁地址无效".to_owned())?
        } else {
            url.clone()
        };
        let webview = window
            .add_child(
                WebviewBuilder::new(CBG_BROWSER_LABEL, WebviewUrl::External(initial_url))
                    .initialization_script(CBG_CAPTURE_SCRIPT),
                position,
                size,
            )
            .map_err(|error| format!("无法创建藏宝阁页面：{error}"))?;
        if let Some(cookies) = saved_cookies {
            restore_cbg_cookies(&webview, channel, &cookies)?;
            webview
                .navigate(url)
                .map_err(|error| format!("无法恢复藏宝阁页面：{error}"))?;
        }
        webview
    };

    webview
        .set_bounds(tauri::Rect { position, size })
        .and_then(|()| webview.show())
        .map_err(|error| format!("无法显示藏宝阁页面：{error}"))
}

#[tauri::command]
async fn set_cbg_window_fullscreen(
    app: tauri::AppHandle,
    channel: CbgChannel,
    fullscreen: bool,
) -> Result<(), String> {
    let window = match app.get_webview_window(CBG_SHELL_LABEL) {
        Some(window) => window,
        None if fullscreen => create_cbg_window(&app, channel)?,
        None => return Ok(()),
    };
    if fullscreen {
        window
            .emit("cbg-window:channel", channel.label())
            .map_err(|error| format!("无法切换藏宝阁区服：{error}"))?;
        window
            .show()
            .and_then(|()| window.set_focus())
            .map_err(|error| format!("无法显示独立藏宝阁窗口：{error}"))?;
    }
    window
        .set_fullscreen(fullscreen)
        .map_err(|error| format!("无法切换藏宝阁全屏状态：{error}"))
}

#[tauri::command]
async fn take_cbg_page_capture(app: tauri::AppHandle) -> Result<Option<Value>, String> {
    let channels = [
        CbgChannel::Official,
        CbgChannel::Huawei,
        CbgChannel::Oppo,
        CbgChannel::Vivo,
        CbgChannel::Xiaomi,
    ];
    let mut webviews = Vec::new();
    if let Some(webview) = app.get_webview(CBG_BROWSER_LABEL) {
        webviews.push(webview);
    }
    for channel in channels {
        if let Some(window) = app.get_webview_window(&channel.login_window_label()) {
            webviews.push(window.as_ref().clone());
        }
    }
    for webview in webviews {
        let capture = evaluate_cbg_webview(
            &webview,
            r#"(() => {
              const capture = window.__yysCbgEquipCapture;
              if (!capture || !capture.pageUrl) return null;
              try {
                const path = new URL(capture.pageUrl).pathname;
                if (!/^\/cgi\/mweb\/equip\/\d+\/[^/]+$/.test(path)) return null;
              } catch { return null; }
              window.__yysCbgEquipCapture = null;
              return capture;
            })()"#,
        )
        .await;
        let Ok(capture) = capture else {
            continue;
        };
        if capture.is_null() {
            continue;
        }
        let page_url = capture
            .get("pageUrl")
            .and_then(Value::as_str)
            .ok_or_else(|| "藏宝阁商品链接格式无效".to_owned())?;
        let ordersn = cbg_product_ordersn(page_url)?;
        let status = capture
            .get("status")
            .and_then(Value::as_u64)
            .and_then(|status| u16::try_from(status).ok())
            .ok_or_else(|| "藏宝阁商品响应状态无效".to_owned())?;
        if !(200..300).contains(&status) {
            return Err("藏宝阁页面没有返回商品数据".to_owned());
        }
        let body = capture
            .get("body")
            .and_then(Value::as_str)
            .filter(|body| body.len() <= MAX_CBG_EQUIP_DESC_BYTES)
            .ok_or_else(|| "藏宝阁商品响应内容无效".to_owned())?;
        let mut payload = serde_json::from_str::<Value>(body)
            .map_err(|_| "藏宝阁商品响应不是有效 JSON".to_owned())?;
        attach_cbg_equip_desc(&mut payload, &ordersn).await?;
        return Ok(Some(serde_json::json!({
            "pageUrl": page_url,
            "payload": payload,
        })));
    }
    Ok(None)
}

#[tauri::command]
async fn get_cbg_login_status(app: tauri::AppHandle, channel: CbgChannel) -> Result<bool, String> {
    let mut checked_live_view = false;
    if let Some(webview) = app.get_webview(CBG_BROWSER_LABEL) {
        let is_channel_page = webview
            .url()
            .ok()
            .and_then(|url| url.host_str().map(str::to_owned))
            .is_some_and(|host| channel.accepts_source_host(&host));
        if is_channel_page {
            checked_live_view = true;
            let cookies = cbg_cookies_for_webview(&webview, channel).await?;
            if has_cbg_login_cookie(&cookies) {
                save_cbg_cookies(&app, channel, &cookies)?;
                return Ok(true);
            }
        }
    }

    if let Some(window) = app.get_webview_window(&channel.login_window_label()) {
        checked_live_view = true;
        let cookies = cbg_cookies_for_window(&window, channel).await?;
        if has_cbg_login_cookie(&cookies) {
            save_cbg_cookies(&app, channel, &cookies)?;
            return Ok(true);
        }
    }

    if checked_live_view {
        clear_cbg_cookies(&app, channel)?;
        return Ok(false);
    }

    Ok(
        load_cbg_cookies(&app, channel)?
            .is_some_and(|cookies| has_saved_cbg_login_cookie(&cookies)),
    )
}

#[tauri::command]
async fn apply_cbg_role_search(app: tauri::AppHandle, criteria: Value) -> Result<Value, String> {
    if app.get_webview_window(CBG_SHELL_LABEL).is_none()
        && app.get_window(CBG_SHELL_LABEL).is_none()
    {
        if let Err(error) = create_cbg_window(&app, CbgChannel::Official) {
            if app.get_window(CBG_SHELL_LABEL).is_none() {
                return Err(error);
            }
        }
    }
    if let Some(window) = app.get_webview_window(CBG_SHELL_LABEL) {
        window
            .unminimize()
            .and_then(|()| window.show())
            .and_then(|()| window.set_focus())
            .map_err(|error| format!("无法显示藏宝阁窗口：{error}"))?;
    } else if let Some(window) = app.get_window(CBG_SHELL_LABEL) {
        window
            .unminimize()
            .and_then(|()| window.show())
            .and_then(|()| window.set_focus())
            .map_err(|error| format!("无法显示藏宝阁窗口：{error}"))?;
    } else {
        return Err("藏宝阁窗口创建后仍不可用".to_owned());
    }

    let deadline = Instant::now() + Duration::from_secs(8);
    let webview = loop {
        if let Some(webview) = app.get_webview(CBG_BROWSER_LABEL) {
            break webview;
        }
        if Instant::now() >= deadline {
            return Err("藏宝阁窗口已打开，但页面尚未就绪；请稍后重试".to_owned());
        }
        tauri::async_runtime::spawn_blocking(|| {
            std::thread::sleep(Duration::from_millis(150));
        })
        .await
        .map_err(|_| "等待藏宝阁页面时发生错误".to_owned())?;
    };
    let host_deadline = Instant::now() + Duration::from_secs(8);
    let host = loop {
        let host = webview
            .url()
            .ok()
            .and_then(|url| url.host_str().map(str::to_owned))
            .filter(|host| !host.is_empty());
        if let Some(host) = host {
            break host;
        }
        if Instant::now() >= host_deadline {
            return Err("藏宝阁页面尚未就绪，请稍后重试".to_owned());
        }
        tauri::async_runtime::spawn_blocking(|| {
            std::thread::sleep(Duration::from_millis(150));
        })
        .await
        .map_err(|_| "等待藏宝阁页面时发生错误".to_owned())?;
    };
    let allowed_channels = [
        CbgChannel::Official,
        CbgChannel::Huawei,
        CbgChannel::Oppo,
        CbgChannel::Vivo,
        CbgChannel::Xiaomi,
    ];
    if !allowed_channels
        .iter()
        .any(|channel| channel.accepts_source_host(&host))
    {
        return Err("当前页面不是受支持的藏宝阁页面".to_owned());
    }

    let criteria_json =
        serde_json::to_string(&criteria).map_err(|_| "筛选条件格式无效".to_owned())?;
    if criteria_json.len() > 64 * 1024 {
        return Err("筛选条件过多，请删减后重试".to_owned());
    }
    let criteria_literal =
        serde_json::to_string(&criteria_json).map_err(|_| "筛选条件格式无效".to_owned())?;
    let script = include_str!("cbg_role_search.js").replace("__CRITERIA_JSON__", &criteria_literal);

    let mut result = evaluate_cbg_webview(&webview, &script).await;
    let mut retried_page_error = false;
    let retry_limit = criteria
        .get("selectedServers")
        .and_then(Value::as_array)
        .map_or(16, |servers| 16 + servers.len() * 2);
    for _ in 0..retry_limit {
        let option_pending = result
            .as_ref()
            .ok()
            .and_then(|value| value.get("status"))
            .and_then(Value::as_str)
            == Some("option_pending");
        let retry = match &result {
            Ok(value) => value
                .get("status")
                .and_then(Value::as_str)
                .is_some_and(|status| {
                    matches!(status, "navigating" | "expanding" | "option_pending")
                }),
            Err(_) if !retried_page_error => {
                retried_page_error = true;
                true
            }
            Err(_) => false,
        };
        if !retry {
            break;
        }
        let _ = tauri::async_runtime::spawn_blocking(move || {
            std::thread::sleep(Duration::from_millis(if option_pending {
                300
            } else {
                500
            }));
        })
        .await;
        result = evaluate_cbg_webview(&webview, &script).await;
    }
    let result = result?;
    match result.get("status").and_then(Value::as_str) {
        Some("submitted") => Ok(result),
        Some("ready_to_submit") => {
            #[cfg(windows)]
            {
                let click = result
                    .get("click")
                    .ok_or_else(|| "没有取得藏宝阁筛选确认按钮位置".to_owned())?;
                let x = click
                    .get("x")
                    .and_then(Value::as_f64)
                    .ok_or_else(|| "藏宝阁筛选确认按钮位置无效".to_owned())?;
                let y = click
                    .get("y")
                    .and_then(Value::as_f64)
                    .ok_or_else(|| "藏宝阁筛选确认按钮位置无效".to_owned())?;
                let scale = click
                    .get("scale")
                    .and_then(Value::as_f64)
                    .ok_or_else(|| "藏宝阁页面缩放比例无效".to_owned())?;
                click_cbg_search_button(&webview, x, y, scale).await?;
                let mut result = result;
                result["status"] = Value::String("submitted".to_owned());
                Ok(result)
            }
            #[cfg(not(windows))]
            {
                Err("藏宝阁筛选确认的鼠标消息目前只支持 Windows".to_owned())
            }
        }
        Some("login_required") => Err("藏宝阁要求先登录；请在藏宝阁窗口手动登录后重试".to_owned()),
        Some("security_check") => {
            Err("藏宝阁出现安全验证或风险提示；请在窗口中手动处理后重试".to_owned())
        }
        Some("role_filter_not_open") => {
            Err("没有找到可见的“角色筛选”入口，请先在藏宝阁窗口打开角色筛选页".to_owned())
        }
        Some("unsupported") => {
            let fields = result
                .get("unsupported")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_str)
                        .collect::<Vec<_>>()
                        .join("、")
                })
                .unwrap_or_default();
            Err(format!("藏宝阁页面暂未匹配这些条件，未提交：{fields}"))
        }
        Some("no_conditions") => Err("请先设置至少一个藏宝阁筛选条件".to_owned()),
        Some("submit_not_found") => Err("没有找到筛选页的“完成”按钮，条件未提交".to_owned()),
        Some("expanding") => Err("藏宝阁筛选条件或区服展开超时，请稍后重试".to_owned()),
        Some("navigating") => Err("藏宝阁筛选页仍在加载，请稍后重试".to_owned()),
        _ => Err("没有识别到藏宝阁角色筛选页，请在窗口中打开“角色筛选”后重试".to_owned()),
    }
}

async fn evaluate_cbg_webview(webview: &tauri::Webview, script: &str) -> Result<Value, String> {
    let (sender, receiver) = std::sync::mpsc::channel();
    webview
        .eval_with_callback(script, move |result| {
            let _ = sender.send(result);
        })
        .map_err(|_| "无法读取藏宝阁页面数据".to_owned())?;
    let result =
        tauri::async_runtime::spawn_blocking(move || receiver.recv_timeout(Duration::from_secs(3)))
            .await
            .map_err(|_| "读取藏宝阁页面数据失败".to_owned())?
            .map_err(|_| "读取藏宝阁页面数据超时".to_owned())?;
    serde_json::from_str(&result).map_err(|_| "藏宝阁页面返回的数据格式异常".to_owned())
}

#[cfg(windows)]
async fn click_cbg_search_button(
    webview: &tauri::Webview,
    x: f64,
    y: f64,
    scale: f64,
) -> Result<(), String> {
    const MOUSEEVENTF_LEFTDOWN: u32 = 0x0002;
    const MOUSEEVENTF_LEFTUP: u32 = 0x0004;

    if !x.is_finite()
        || !y.is_finite()
        || !scale.is_finite()
        || x < 0.0
        || y < 0.0
        || !(0.25..=8.0).contains(&scale)
        || x * scale > i16::MAX as f64
        || y * scale > i16::MAX as f64
    {
        return Err("藏宝阁筛选确认按钮位置无效".to_owned());
    }
    let x = (x * scale).round() as i32;
    let y = (y * scale).round() as i32;
    let (sender, receiver) = std::sync::mpsc::channel();

    webview
        .with_webview(move |platform_webview| {
            let result = unsafe {
                let controller = platform_webview.controller();
                let mut parent = std::mem::MaybeUninit::uninit();
                controller
                    .ParentWindow(parent.as_mut_ptr())
                    .map_err(|_| "无法取得藏宝阁网页窗口".to_owned())
                    .and_then(|()| {
                        let parent = parent.assume_init().0;
                        if parent.is_null() {
                            return Err("藏宝阁网页窗口不可用".to_owned());
                        }
                        let mut bounds = Win32Rect::default();
                        if GetWindowRect(parent, &mut bounds) == 0 {
                            return Err("无法读取藏宝阁网页位置".to_owned());
                        }
                        let target = Win32Point {
                            x: bounds.left + x,
                            y: bounds.top + y,
                        };
                        if target.x >= bounds.right || target.y >= bounds.bottom {
                            return Err("藏宝阁筛选确认按钮已移出可见区域".to_owned());
                        }
                        let mut cursor = Win32Point::default();
                        if GetCursorPos(&mut cursor) == 0 {
                            return Err("无法读取当前鼠标位置".to_owned());
                        }
                        if SetCursorPos(target.x, target.y) == 0 {
                            return Err("无法移动鼠标到藏宝阁筛选确认按钮".to_owned());
                        }
                        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                        if SetCursorPos(cursor.x, cursor.y) == 0 {
                            return Err("筛选已点击，但无法恢复鼠标位置".to_owned());
                        }
                        Ok(())
                    })
            };
            let _ = sender.send(result);
        })
        .map_err(|_| "无法触发藏宝阁筛选鼠标点击".to_owned())?;

    tauri::async_runtime::spawn_blocking(move || receiver.recv_timeout(Duration::from_secs(3)))
        .await
        .map_err(|_| "等待藏宝阁筛选鼠标点击失败".to_owned())?
        .map_err(|_| "等待藏宝阁筛选鼠标点击超时".to_owned())?
}

#[cfg(windows)]
#[link(name = "user32")]
extern "system" {
    fn GetWindowRect(hwnd: *mut std::ffi::c_void, rect: *mut Win32Rect) -> i32;
    fn GetCursorPos(point: *mut Win32Point) -> i32;
    fn SetCursorPos(x: i32, y: i32) -> i32;
    fn mouse_event(flags: u32, dx: u32, dy: u32, data: u32, extra_info: usize);
}

#[cfg(windows)]
#[derive(Default)]
#[repr(C)]
struct Win32Point {
    x: i32,
    y: i32,
}

#[cfg(windows)]
#[derive(Default)]
#[repr(C)]
struct Win32Rect {
    left: i32,
    top: i32,
    right: i32,
    bottom: i32,
}

fn cbg_equip_desc_url(ordersn: &str) -> Result<String, String> {
    if ordersn.is_empty()
        || ordersn.len() > 128
        || !ordersn
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err("藏宝阁返回的御魂数据编号无效".to_owned());
    }
    Ok(format!("{CBG_EQUIP_DESC_BASE_URL}{ordersn}.json"))
}

fn parse_cbg_equip_desc(body: &str) -> Result<Value, String> {
    let file =
        serde_json::from_str::<Value>(body).map_err(|_| "藏宝阁御魂详情格式异常".to_owned())?;
    let detail = file
        .get("equip_desc")
        .cloned()
        .ok_or_else(|| "藏宝阁御魂详情缺少数据".to_owned())?;
    if !detail.is_object() && !detail.is_string() {
        return Err("藏宝阁御魂详情格式无效".to_owned());
    }
    Ok(detail)
}

#[cfg(test)]
mod cbg_equip_desc_tests {
    use super::{cbg_equip_desc_url, parse_cbg_equip_desc};
    use serde_json::Value;

    #[test]
    fn builds_detail_url_from_product_order_id() {
        assert_eq!(
            cbg_equip_desc_url("202610231401616-20-BR7HJ8KCSGFQQ").unwrap(),
            "https://cbg-other-desc.res.netease.com/yys/static/equipdesc/202610231401616-20-BR7HJ8KCSGFQQ.json"
        );
        assert!(cbg_equip_desc_url("../../other-host/file").is_err());
    }

    #[test]
    fn extracts_the_wrapped_equip_description() {
        assert_eq!(
            parse_cbg_equip_desc(r#"{"version":"sample","equip_desc":"{\"hero_history\":{}}"}"#)
                .unwrap(),
            Value::String(r#"{"hero_history":{}}"#.to_owned())
        );
    }
}

async fn attach_cbg_equip_desc(payload: &mut Value, ordersn: &str) -> Result<(), String> {
    let equip_key = if payload.get("equip").is_some() {
        "equip"
    } else {
        "equip_data"
    };
    let equip = payload
        .get(equip_key)
        .and_then(Value::as_object)
        .ok_or_else(|| "藏宝阁没有返回商品数据".to_owned())?;
    if equip.get("equip_desc").is_some_and(|value| {
        value.is_object() || value.as_str().is_some_and(|text| !text.is_empty())
    }) {
        return Ok(());
    }
    let url = cbg_equip_desc_url(ordersn)?;
    let client = Client::builder()
        .timeout(API_TIMEOUT)
        .build()
        .map_err(|_| "无法初始化御魂数据请求".to_owned())?;
    let mut response = client
        .get(url)
        .header("accept", "application/json")
        .header("referer", "https://yys.cbg.163.com/")
        .header("user-agent", "Mozilla/5.0")
        .send()
        .await
        .map_err(|_| "藏宝阁御魂详情暂时无法连接，请稍后重试".to_owned())?;
    let status = response.status();
    if !status.is_success() {
        log_api!(&format!("御魂详情文件请求失败：HTTP {}", status.as_u16()));
        return Err("藏宝阁御魂详情暂时无法获取，请稍后重试".to_owned());
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_CBG_EQUIP_DESC_BYTES as u64)
    {
        return Err("藏宝阁御魂详情文件过大".to_owned());
    }
    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "读取藏宝阁御魂详情失败".to_owned())?
    {
        if body.len() + chunk.len() > MAX_CBG_EQUIP_DESC_BYTES {
            return Err("藏宝阁御魂详情文件过大".to_owned());
        }
        body.extend_from_slice(&chunk);
    }
    let body = std::str::from_utf8(&body).map_err(|_| "藏宝阁御魂详情格式异常".to_owned())?;
    let detail = parse_cbg_equip_desc(body)?;
    let equip = payload
        .get_mut(equip_key)
        .and_then(Value::as_object_mut)
        .ok_or_else(|| "藏宝阁商品数据格式异常".to_owned())?;
    equip.insert("equip_desc".to_owned(), detail);
    Ok(())
}

#[tauri::command]
async fn load_product(app: tauri::AppHandle, request: ProductRequest) -> Result<Value, String> {
    let ProductRequest {
        serverid,
        ordersn,
        channel,
        source_url,
        view_loc,
        tfid,
        tcid,
    } = request;
    let serverid = serverid.unwrap_or_default();
    let ordersn = ordersn.unwrap_or_default();
    if serverid.is_empty()
        || !serverid.chars().all(|character| character.is_ascii_digit())
        || !ordersn
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
        || ordersn.is_empty()
    {
        return Err("商品链接参数无效".to_owned());
    }

    if source_url.as_ref().is_some_and(|value| value.len() > 4096)
        || view_loc.as_ref().is_some_and(|value| value.len() > 2048)
        || tfid.as_ref().is_some_and(|value| value.len() > 128)
        || tcid.as_ref().is_some_and(|value| value.len() > 128)
    {
        return Err("商品链接参数过长".to_owned());
    }

    let source_url = source_url
        .as_deref()
        .and_then(|value| Url::parse(value).ok())
        .filter(|url| {
            url.scheme() == "https"
                && url.username().is_empty()
                && url.password().is_none()
                && url
                    .host_str()
                    .is_some_and(|host| channel.accepts_source_host(host))
                && url.path_segments().is_some_and(|segments| {
                    let segments = segments.collect::<Vec<_>>();
                    segments.len() == 5
                        && segments[0..3] == ["cgi", "mweb", "equip"]
                        && segments[3] == serverid
                        && segments[4] == ordersn
                })
        })
        .ok_or_else(|| "商品链接参数无效，请重新粘贴藏宝阁链接".to_owned())?;
    let login_window_label = channel.login_window_label();
    if app.get_webview_window(&login_window_label).is_none() {
        ensure_cbg_login_window(app.clone(), channel).await?;
    }
    let login_window = app
        .get_webview_window(&login_window_label)
        .ok_or_else(|| "无法恢复藏宝阁登录窗口".to_owned())?;
    let cookie_url = Url::parse(&format!("https://{}/", channel.host()))
        .map_err(|_| "藏宝阁登录地址无效".to_owned())?;
    let cookie_window = login_window.clone();
    let cookies =
        tauri::async_runtime::spawn_blocking(move || cookie_window.cookies_for_url(cookie_url))
            .await
            .map_err(|_| "读取藏宝阁登录状态失败".to_owned())?
            .map_err(|_| "读取藏宝阁登录状态失败".to_owned())?;
    if !has_cbg_login_cookie(&cookies) {
        return Err("没有找到藏宝阁登录状态，请在登录窗口完成登录后重试".to_owned());
    }
    save_cbg_cookies(&app, channel, &cookies)?;

    log_api!(&format!(
        "load_product 请求藏宝阁商品数据（channel={}）",
        channel.label()
    ));
    let ready_script = format!(
        "location.hostname === '{}' && document.readyState === 'complete'",
        channel.host()
    );
    let ready_deadline = Instant::now() + CBG_PAGE_TIMEOUT;
    loop {
        if evaluate_cbg_webview(login_window.as_ref(), &ready_script)
            .await?
            .as_bool()
            == Some(true)
        {
            break;
        }
        if Instant::now() >= ready_deadline {
            return Err("藏宝阁登录页面尚未就绪，请稍后重试".to_owned());
        }
        tauri::async_runtime::spawn_blocking(|| {
            std::thread::sleep(Duration::from_millis(200));
        })
        .await
        .map_err(|_| "等待藏宝阁登录页面失败".to_owned())?;
    }

    let request_data = serde_json::json!({
        "apiUrl": format!("https://{}/cgi/api/get_equip_detail?client_type=h5", channel.host()),
        "serverid": serverid,
        "ordersn": ordersn,
        "sourceUrl": source_url.as_str(),
        "viewLoc": view_loc.unwrap_or_default(),
        "tfid": tfid.unwrap_or_else(|| "f_equip_list".to_owned()),
        "tcid": tcid.unwrap_or_else(|| "c_equip_detail".to_owned()),
    });
    let request_data =
        serde_json::to_string(&request_data).map_err(|_| "无法准备藏宝阁商品请求".to_owned())?;
    let request_script = format!(
        r#"window.__yysCbgEquipCapture = null;
        (async () => {{
          try {{
            const p = {request_data};
            const form = new URLSearchParams({{
              client_type: "h5",
              serverid: p.serverid,
              ordersn: p.ordersn,
              h5_device: "other",
              app_client: "other",
              exclude_equip_desc: "1",
              view_loc: p.viewLoc,
              exter: "direct",
              page_session_id: crypto.randomUUID().toUpperCase(),
              traffic_trace: JSON.stringify({{ field_id: p.tfid, content_id: p.tcid }}),
            }});
            const headers = {{
              accept: "application/json, text/javascript, */*; q=0.01",
              "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
              "x-requested-with": "XMLHttpRequest",
              "cbg-request-id": crypto.randomUUID().toUpperCase(),
            }};
            if (window.__yysCbgSafeCode) headers["cbg-safe-code"] = window.__yysCbgSafeCode;
            const response = await fetch(p.apiUrl, {{
              method: "POST",
              credentials: "include",
              referrer: p.sourceUrl,
              headers,
              body: form,
            }});
            window.__yysCbgEquipCapture = {{ status: response.status, body: await response.text() }};
          }} catch (error) {{
            window.__yysCbgEquipCapture = {{ status: 0, body: JSON.stringify({{ message: String(error) }}) }};
          }}
        }})();"#
    );
    login_window
        .eval(&request_script)
        .map_err(|_| "无法发送藏宝阁商品请求".to_owned())?;

    let deadline = Instant::now() + CBG_PAGE_TIMEOUT;
    let capture = loop {
        let capture =
            evaluate_cbg_webview(login_window.as_ref(), "window.__yysCbgEquipCapture || null")
                .await?;
        if capture.is_object() {
            break capture;
        }
        if Instant::now() >= deadline {
            return Err("藏宝阁页面未返回商品数据，请确认登录窗口能正常打开该商品".to_owned());
        }
        let _ = tauri::async_runtime::spawn_blocking(|| {
            std::thread::sleep(Duration::from_millis(200));
        })
        .await;
    };

    let status = capture
        .get("status")
        .and_then(Value::as_u64)
        .unwrap_or_default();
    let response_text = capture
        .get("body")
        .and_then(Value::as_str)
        .ok_or_else(|| "藏宝阁商品响应内容为空".to_owned())?;
    let mut payload = serde_json::from_str::<Value>(response_text).map_err(|_| {
        log_api!("load_product 响应不是有效 JSON");
        "商品数据格式异常，请稍后重试".to_owned()
    })?;
    if !(200..300).contains(&status) {
        log_api!(&format!("load_product 页面响应异常：HTTP {status}"));
        return Err(payload
            .get("msg")
            .or_else(|| payload.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("商品数据暂时无法获取，请稍后重试")
            .to_owned());
    }
    if !payload
        .get("equip")
        .or_else(|| payload.get("equip_data"))
        .is_some_and(Value::is_object)
    {
        return Err(payload
            .get("msg")
            .or_else(|| payload.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("藏宝阁没有返回商品数据，请确认登录状态后重试")
            .to_owned());
    }
    attach_cbg_equip_desc(&mut payload, &ordersn).await?;
    log_api!(&format!(
        "load_product 页面响应成功：HTTP {status}，{} 字节",
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
    if !status.is_success() {
        log_api!(&format!("update_static_data 响应异常：HTTP {status}"));
        let message = serde_json::from_str::<Value>(&response_text)
            .ok()
            .and_then(|payload| {
                payload
                    .get("msg")
                    .and_then(Value::as_str)
                    .map(str::to_owned)
            });
        return Err(message.unwrap_or_else(|| "远程数据暂时无法获取，请稍后重试".to_owned()));
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
async fn save_account_summary(request: SaveAccountSummaryRequest) -> Result<(), String> {
    let product_url =
        Url::parse(&request.product_url).map_err(|_| "藏宝阁商品链接格式无效".to_owned())?;
    let allowed_hosts = [
        "yys.cbg.163.com",
        "cbg.163.com",
        "yys-huawei.cbg.163.com",
        "yys-oppo.cbg.163.com",
        "yys-vivo.cbg.163.com",
        "yys-xiaomi.cbg.163.com",
    ];
    if product_url.scheme() != "https"
        || product_url.username() != ""
        || product_url.password().is_some()
        || !product_url
            .host_str()
            .is_some_and(|host| allowed_hosts.contains(&host))
    {
        return Err("仅接受 HTTPS 藏宝阁商品链接".to_owned());
    }
    if request.summary.trim().is_empty() || request.summary.len() > 50_000 {
        return Err("账号摘要为空或超出长度限制".to_owned());
    }

    let client = Client::builder()
        .timeout(API_TIMEOUT)
        .build()
        .map_err(|_| "远程请求客户端初始化失败".to_owned())?;
    let response = client
        .post(format!("{REMOTE_API_BASE_URL}/account-summaries"))
        .header("accept", "application/json")
        .header("user-agent", "YYS-CBG-Inspector/1.0")
        .json(&serde_json::json!({
            "productUrl": request.product_url,
            "summary": request.summary,
        }))
        .send()
        .await
        .map_err(|_| "账号摘要暂时无法写入知识库".to_owned())?;
    if !response.status().is_success() {
        log_api!(&format!(
            "save_account_summary 请求失败：HTTP {}",
            response.status()
        ));
        return Err("账号摘要暂时无法写入知识库".to_owned());
    }
    log_api!("save_account_summary 写入成功");
    Ok(())
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
        .setup(|app| {
            #[cfg(windows)]
            {
                app.handle().plugin(tauri_plugin_process::init())?;
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }

            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                // 开发模式默认打开控制台，方便排查本地资源、接口和页面运行时问题；生产包不主动打开。
                window.open_devtools();
            }
            if let Err(error) = create_cbg_window(app.handle(), CbgChannel::Official) {
                eprintln!("启动时无法打开独立藏宝阁窗口：{error}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            get_compute_capacity,
            toggle_cbg_window,
            set_cbg_webview,
            set_cbg_window_fullscreen,
            take_cbg_page_capture,
            get_cbg_login_status,
            apply_cbg_role_search,
            load_product,
            save_account_summary,
            read_static_data,
            update_static_data,
            save_static_data,
            update_static_assets,
            open_downloads_folder,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 应用启动失败");
}
