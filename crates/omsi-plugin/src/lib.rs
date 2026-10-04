//! OMSI plugins (see `native` for how they are driven). The browser build has none: a page
//! cannot load a DLL or run Lua, so `stub` keeps the interface and loads nothing.

#[cfg(not(target_arch = "wasm32"))]
mod native;
#[cfg(not(target_arch = "wasm32"))]
pub use native::*;

#[cfg(target_arch = "wasm32")]
mod stub;
#[cfg(target_arch = "wasm32")]
pub use stub::*;
