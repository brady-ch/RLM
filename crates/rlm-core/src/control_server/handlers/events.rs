use std::sync::Arc;

use axum::extract::State;
use axum::response::sse::{Event, KeepAlive, Sse};
use futures::stream::{self, StreamExt};
use tokio_stream::wrappers::BroadcastStream;

use crate::control_server::RouterState;

pub(crate) async fn events(
    State(state): State<Arc<RouterState>>,
) -> Sse<impl StreamExt<Item = Result<Event, std::convert::Infallible>>> {
    let snapshot = state.session.snapshot();
    let initial = Event::default()
        .event("snapshot")
        .data(serde_json::to_string(&snapshot).unwrap_or_else(|_| "{}".into()));

    let rx = state.session.subscribe();
    let execution_stream = BroadcastStream::new(rx).filter_map(|result| {
        futures::future::ready(result.ok().map(|event| {
            Ok(Event::default()
                .event("execution")
                .data(serde_json::to_string(&event).unwrap_or_else(|_| "{}".into())))
        }))
    });

    let stream = stream::once(async move { Ok(initial) }).chain(execution_stream);
    Sse::new(stream).keep_alive(KeepAlive::default())
}
