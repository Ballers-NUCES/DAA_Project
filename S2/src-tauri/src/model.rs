use serde::Serialize;
use specta::Type;

const MAX_TRACE_STEPS: usize = 2_000;

#[derive(Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AlgorithmStep {
    pub title: String,
    pub description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub depth: Option<usize>,
}

pub struct TraceRecorder {
    enabled: bool,
    steps: Vec<AlgorithmStep>,
}

impl TraceRecorder {
    pub fn disabled() -> Self {
        Self {
            enabled: false,
            steps: Vec::new(),
        }
    }

    pub fn enabled() -> Self {
        Self {
            enabled: true,
            steps: Vec::new(),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn is_active(&self) -> bool {
        self.enabled && self.steps.len() < MAX_TRACE_STEPS
    }

    pub fn push(&mut self, depth: usize, title: &str, description: String) {
        if self.is_active() {
            self.steps.push(AlgorithmStep {
                title: title.to_owned(),
                description,
                depth: Some(depth),
            });
        }
    }

    pub fn into_steps(self) -> Vec<AlgorithmStep> {
        self.steps
    }
}
