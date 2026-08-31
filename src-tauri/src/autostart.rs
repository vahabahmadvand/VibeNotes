use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
use winreg::RegKey;
use std::env;

const APP_NAME: &str = "VibeNotes";
const REG_RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";

pub fn is_autostart_enabled() -> Result<bool, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let run_key = match hkcu.open_subkey_with_flags(REG_RUN_KEY, KEY_READ) {
        Ok(key) => key,
        Err(e) => return Err(e.to_string()),
    };
    
    let val: Result<String, _> = run_key.get_value(APP_NAME);
    Ok(val.is_ok())
}

pub fn set_autostart(enable: bool) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (run_key, _) = hkcu.create_subkey_with_flags(REG_RUN_KEY, KEY_WRITE)
        .map_err(|e| e.to_string())?;

    if enable {
        let current_exe = env::current_exe().map_err(|e| e.to_string())?;
        let exe_path_str = format!("\"{}\" --minimized", current_exe.to_str().unwrap_or_default());
        run_key.set_value(APP_NAME, &exe_path_str).map_err(|e| e.to_string())?;
    } else {
        let _ = run_key.delete_value(APP_NAME);
    }
    Ok(())
}
