// 发布版 Windows 应用不额外打开控制台窗口，请勿删除。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    yys_cbg_inspector_tauri_lib::run()
}
