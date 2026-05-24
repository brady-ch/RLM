use async_trait::async_trait;

use crate::domain::types::{ComposerContextPolicy, MemoryPacketMetadata};

#[derive(Debug, Clone)]
pub struct MemoryContextPacket {
    pub text: String,
    pub metadata: MemoryPacketMetadata,
}

#[async_trait]
pub trait MemoryContextPort: Send + Sync {
    async fn build_packet(
        &self,
        node_id: &str,
        prompt: &str,
        policy: &ComposerContextPolicy,
    ) -> Result<Option<MemoryContextPacket>, String>;

    fn append_node_summary(
        &self,
        node_id: &str,
        summary: &str,
        scope_ids: &[String],
    ) -> Result<(), String>;
}
