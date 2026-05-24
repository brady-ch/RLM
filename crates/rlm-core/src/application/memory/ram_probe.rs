pub fn is_wsl() -> bool {
    #[cfg(target_os = "linux")]
    {
        std::fs::read_to_string("/proc/version")
            .map(|version| version.to_lowercase().contains("microsoft"))
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "linux"))]
    {
        false
    }
}

pub fn current_free_ram_mb() -> Option<u32> {
    #[cfg(target_os = "linux")]
    {
        let meminfo = std::fs::read_to_string("/proc/meminfo").ok()?;
        for key in ["MemAvailable:", "MemFree:"] {
            if let Some(kb) = meminfo.lines().find_map(|line| {
                let mut parts = line.split_whitespace();
                (parts.next() == Some(key)).then(|| parts.next())?
            }) {
                let kb = kb.parse::<u64>().ok()?;
                return u32::try_from(kb / 1024).ok();
            }
        }
        None
    }
    #[cfg(not(target_os = "linux"))]
    {
        None
    }
}
