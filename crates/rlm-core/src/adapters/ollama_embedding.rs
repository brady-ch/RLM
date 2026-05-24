use std::time::Duration;

use reqwest::Client;
use serde::Deserialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EmbeddingError {
    #[error("Ollama embeddings failed: HTTP {status}")]
    Http { status: u16 },
    #[error("Ollama embeddings response did not include an embedding")]
    MissingEmbedding,
    #[error("Ollama embedding host unavailable: {message}")]
    Unavailable { message: String },
    #[error("request failed: {0}")]
    Request(#[from] reqwest::Error),
}

#[derive(Clone)]
pub struct OllamaEmbeddingModel {
    client: Client,
    base_url: String,
    model: String,
}

impl Default for OllamaEmbeddingModel {
    fn default() -> Self {
        Self::new(None, None)
    }
}

impl OllamaEmbeddingModel {
    pub fn new(base_url: Option<&str>, model: Option<&str>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            client,
            base_url: base_url
                .unwrap_or("http://127.0.0.1:11434")
                .trim_end_matches('/')
                .to_string(),
            model: model.unwrap_or("nomic-embed-text").to_string(),
        }
    }

    pub fn provider_label(&self) -> String {
        format!("ollama:{}", self.model)
    }

    pub async fn health_check(&self) -> Result<(), EmbeddingError> {
        let url = format!("{}/api/tags", self.base_url);
        self.client
            .get(url)
            .send()
            .await?
            .error_for_status()
            .map_err(|err| {
                if let Some(status) = err.status() {
                    EmbeddingError::Http {
                        status: status.as_u16(),
                    }
                } else {
                    EmbeddingError::Unavailable {
                        message: err.to_string(),
                    }
                }
            })?;
        Ok(())
    }

    pub async fn embed(&self, input: &str) -> Result<Vec<f32>, EmbeddingError> {
        let url = format!("{}/api/embeddings", self.base_url);
        let response = self
            .client
            .post(url)
            .header("content-type", "application/json")
            .json(&serde_json::json!({
                "model": self.model,
                "prompt": input,
            }))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(EmbeddingError::Http {
                status: response.status().as_u16(),
            });
        }

        #[derive(Deserialize)]
        struct Payload {
            embedding: Option<Vec<f32>>,
        }

        let payload: Payload = response.json().await?;
        payload.embedding.ok_or(EmbeddingError::MissingEmbedding)
    }
}

#[cfg(test)]
#[path = "../../tests/adapters/ollama_embedding.rs"]
mod ollama_embedding_tests;
