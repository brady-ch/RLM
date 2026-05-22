pub(crate) fn mutation_err(code: &str, message: &str, node_ids: &[&str]) -> String {
    format!("MUTATION:{code}|{message}|{}||", node_ids.join(","))
}
