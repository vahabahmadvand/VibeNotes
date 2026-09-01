// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(windows)]
extern "system" {
    fn CreateMutexW(
        lp_mutex_attributes: *const std::ffi::c_void,
        b_initial_owner: i32,
        lp_name: *const u16,
    ) -> *mut std::ffi::c_void;
    fn GetLastError() -> u32;
}

#[cfg(windows)]
fn is_single_instance() -> bool {
    const ERROR_ALREADY_EXISTS: u32 = 183;
    let name: Vec<u16> = "Global\\VibeNotes_SingleInstance_Mutex\0".encode_utf16().collect();
    unsafe {
        let _ = CreateMutexW(std::ptr::null(), 1, name.as_ptr());
        if GetLastError() == ERROR_ALREADY_EXISTS {
            return false;
        }
    }
    true
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|arg| arg == "--mcp") {
        vibenotes_lib::mcp::run_mcp_server();
        return;
    }

    #[cfg(windows)]
    if !is_single_instance() {
        // Another instance is already running, exit immediately
        std::process::exit(0);
    }

    vibenotes_lib::run();
}
