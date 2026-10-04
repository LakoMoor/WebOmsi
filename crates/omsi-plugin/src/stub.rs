//! The plugin interface without plugins, for the browser build.

use std::path::{Path, PathBuf};

/// Where to look for the out-of-process host (never used here).
#[derive(Debug, Clone, Default)]
pub struct HostConfig;

impl HostConfig {
    pub fn detect() -> HostConfig {
        HostConfig
    }
}

/// A value of [`PluginIo::info`].
#[derive(Debug, Clone, PartialEq)]
pub enum InfoValue {
    Num(f64),
    Text(String),
    Bool(bool),
}

/// The game's side of a plugin frame.
pub trait PluginIo {
    fn system(&mut self, name: &str) -> Option<f32>;
    fn set_system(&mut self, name: &str, v: f32);
    fn has_vehicle(&self) -> bool;
    fn var(&mut self, name: &str) -> Option<f32>;
    fn set_var(&mut self, name: &str, v: f32);
    fn string(&mut self, name: &str) -> Option<String>;
    fn set_string(&mut self, name: &str, s: &str);
    fn fire(&mut self, trigger: &str, down: bool);
    fn dt(&self) -> f32 {
        0.0
    }
    fn vehicle_name(&self) -> Option<String> {
        None
    }
    fn position(&self) -> Option<[f64; 4]> {
        None
    }
    fn message(&mut self, _text: &str, _seconds: f32) {}
    fn info(&self) -> Vec<(&'static str, InfoValue)> {
        Vec::new()
    }
    fn command(&mut self, _what: &str) -> bool {
        false
    }
    fn var_names(&self) -> (Vec<String>, Vec<String>) {
        (Vec::new(), Vec::new())
    }
    fn keys(&self) -> Vec<(String, bool)> {
        Vec::new()
    }
}

/// No plugin is ever loaded.
#[derive(Default)]
pub struct Plugins;

impl Plugins {
    pub fn load(_dirs: &[PathBuf], _hosts: &HostConfig) -> Plugins {
        Plugins
    }
    pub fn is_empty(&self) -> bool {
        true
    }
    pub fn frame(&mut self, _io: &mut dyn PluginIo) {}
    pub fn finalize(&mut self) {}
}

/// `rel` under `base`, as a path of the game's content (case as it is on disk).
pub fn resolve_path(base: &Path, rel: &str) -> Option<PathBuf> {
    omsi_cfg_resolve(base, rel)
}

fn omsi_cfg_resolve(base: &Path, rel: &str) -> Option<PathBuf> {
    let p = base.join(rel);
    p.exists().then_some(p)
}
