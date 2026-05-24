use std::fs;
use std::io;

use super::{
    CorruptSection, FileSessionStore, SavedSessionManifest, SavedSessionSectionStatus,
    SavedSessionVerification, SectionEnvelope, MANIFEST_VERSION, SECTION_FILES,
};

pub(super) fn restore_status(missing_count: usize, corrupt_count: usize) -> &'static str {
    if corrupt_count > 0 {
        "failed"
    } else if missing_count > 0 {
        "degraded"
    } else {
        "complete"
    }
}

impl FileSessionStore {
    pub(super) fn verify_manifest(
        &self,
        manifest: &SavedSessionManifest,
    ) -> io::Result<SavedSessionVerification> {
        let mut sections = Vec::new();
        let mut missing = Vec::new();
        let mut corrupt = Vec::new();

        if manifest.version != MANIFEST_VERSION {
            corrupt.push(CorruptSection {
                section: "manifest".to_string(),
                reason: format!("unsupported manifest version {}", manifest.version),
            });
        }

        for (name, file) in SECTION_FILES {
            let section = manifest.sections.get(name);
            let Some(section) = section else {
                missing.push(name.to_string());
                sections.push(SavedSessionSectionStatus {
                    name: name.to_string(),
                    status: "failed".to_string(),
                    path: String::new(),
                    version: None,
                    reason: Some("missing manifest section".to_string()),
                });
                continue;
            };

            let path = self.session_dir(&manifest.id).join(&section.file);
            match fs::read_to_string(&path) {
                Ok(raw) => match serde_json::from_str::<SectionEnvelope>(&raw) {
                    Ok(parsed) if parsed.version != section.version => {
                        corrupt.push(CorruptSection {
                            section: name.to_string(),
                            reason: format!("unsupported section version {}", parsed.version),
                        });
                        sections.push(SavedSessionSectionStatus {
                            name: name.to_string(),
                            status: "failed".to_string(),
                            path: path.to_string_lossy().to_string(),
                            version: Some(parsed.version),
                            reason: Some("unsupported section version".to_string()),
                        });
                    }
                    Ok(parsed) => {
                        sections.push(SavedSessionSectionStatus {
                            name: name.to_string(),
                            status: "complete".to_string(),
                            path: path.to_string_lossy().to_string(),
                            version: Some(parsed.version),
                            reason: None,
                        });
                    }
                    Err(err) => {
                        let reason = err.to_string();
                        corrupt.push(CorruptSection {
                            section: name.to_string(),
                            reason: reason.clone(),
                        });
                        sections.push(SavedSessionSectionStatus {
                            name: name.to_string(),
                            status: "failed".to_string(),
                            path: path.to_string_lossy().to_string(),
                            version: None,
                            reason: Some(reason),
                        });
                    }
                },
                Err(err) if err.kind() == io::ErrorKind::NotFound => {
                    missing.push(name.to_string());
                    sections.push(SavedSessionSectionStatus {
                        name: name.to_string(),
                        status: "failed".to_string(),
                        path: path.to_string_lossy().to_string(),
                        version: None,
                        reason: Some("missing section file".to_string()),
                    });
                }
                Err(err) => {
                    let reason = err.to_string();
                    corrupt.push(CorruptSection {
                        section: name.to_string(),
                        reason: reason.clone(),
                    });
                    sections.push(SavedSessionSectionStatus {
                        name: name.to_string(),
                        status: "failed".to_string(),
                        path: path.to_string_lossy().to_string(),
                        version: None,
                        reason: Some(reason),
                    });
                }
            }
            let _ = file;
        }

        let status = restore_status(missing.len(), corrupt.len());
        let sections = sections
            .into_iter()
            .map(|section| {
                if section.status == "failed" && status == "degraded" {
                    SavedSessionSectionStatus {
                        status: "degraded".to_string(),
                        ..section
                    }
                } else {
                    section
                }
            })
            .collect();

        Ok(SavedSessionVerification {
            status: status.to_string(),
            sections,
            missing,
            corrupt,
            unsafe_to_continue: status != "complete",
        })
    }
}
