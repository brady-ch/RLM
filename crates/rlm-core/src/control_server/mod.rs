pub mod routes;
pub mod state;

use std::path::PathBuf;

use axum::Router;

#[derive(Clone)]
pub struct RouterState {
    pub ui_dist_dir: Option<PathBuf>,
    pub project_root: PathBuf,
}

pub fn build_router(state: RouterState) -> Router {
    routes::build_router(state)
}
