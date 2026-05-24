use super::*;

#[test]
fn rejects_zip_slip_paths() {
    let root = tempfile::tempdir().expect("tempdir");
    assert!(is_unsafe_archive_entry_path("../escape.txt", root.path()));
    assert!(is_unsafe_archive_entry_path("/etc/passwd", root.path()));
}

#[test]
fn classifies_remote_sources() {
    assert_eq!(
        classify_remote_install_source("https://example.com/plugin.tar.gz"),
        Some("https-archive")
    );
    assert_eq!(
        classify_remote_install_source("git:https://github.com/org/repo.git"),
        Some("git")
    );
    assert!(classify_remote_install_source("./local").is_none());
}
