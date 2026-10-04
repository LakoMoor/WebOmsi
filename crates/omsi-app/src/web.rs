//! The browser build: a page calls `start` with its canvas, the game's pack (one zip) and
//! the command line the game would get; this mounts the pack as the game's files, opens the
//! graphics device (asynchronous in a browser, so it happens here, before the event loop,
//! and the window's renderer is taken from what was made) and runs the game on the canvas.

use std::cell::RefCell;
use std::path::PathBuf;

use clap::Parser;
use wasm_bindgen::prelude::*;
use winit::event_loop::EventLoop;
use winit::platform::web::EventLoopExtWebSys;

use crate::cli::Args;

/// Where the pack is mounted: the game's `--root`.
const PACK_ROOT: &str = "/omsi";

static LOW_QUALITY: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// The player chose the light graphics (no multisampling, SSAO or shadows, a smaller picture).
pub(crate) fn low_quality() -> bool {
    LOW_QUALITY.load(std::sync::atomic::Ordering::Relaxed)
}

thread_local! {
    static GPU: RefCell<Option<(wgpu::Instance, omsi_render::Renderer)>> = const { RefCell::new(None) };
    /// The canvas the game draws on (the window takes it).
    static CANVAS: RefCell<Option<web_sys::HtmlCanvasElement>> = const { RefCell::new(None) };
}

/// The graphics interface made by `start`.
pub(crate) fn instance() -> wgpu::Instance {
    GPU.with(|g| g.borrow().as_ref().map(|(i, _)| i.clone())).unwrap_or_else(browser_instance)
}

/// The renderer `start` made, for the window that opens now.
pub(crate) fn take_renderer() -> Option<omsi_render::Renderer> {
    GPU.with(|g| g.borrow_mut().take().map(|(_, r)| r))
}

/// Whether the screen is driven by fingers: a device with a touch screen as its main
/// pointer (a phone, a tablet), or `?touch=1` in the address (to try the controls anywhere).
pub(crate) fn touch_device() -> bool {
    let Some(w) = web_sys::window() else { return false };
    if w.location().search().is_ok_and(|q| q.contains("touch=1")) {
        return true;
    }
    let coarse = w.match_media("(pointer: coarse)").ok().flatten().is_some_and(|m| m.matches());
    coarse && w.navigator().max_touch_points() > 0
}

/// A short buzz (phones that allow it).
pub(crate) fn vibrate(ms: u32) {
    if let Some(w) = web_sys::window() {
        let _ = w.navigator().vibrate_with_duration(ms);
    }
}

/// The page's size in CSS pixels.
pub(crate) fn viewport() -> (f64, f64) {
    let w = web_sys::window();
    let get = |v: Option<JsValue>, d: f64| v.and_then(|v| v.as_f64()).unwrap_or(d);
    (
        get(w.as_ref().and_then(|w| w.inner_width().ok()), 1280.0),
        get(w.as_ref().and_then(|w| w.inner_height().ok()), 720.0),
    )
}

pub(crate) fn canvas() -> Option<web_sys::HtmlCanvasElement> {
    CANVAS.with(|c| c.borrow().clone())
}

fn browser_instance() -> wgpu::Instance {
    let mut d = wgpu::InstanceDescriptor::new_without_display_handle();
    d.backends = wgpu::Backends::BROWSER_WEBGPU | wgpu::Backends::GL;
    wgpu::Instance::new(d)
}

fn err(e: impl std::fmt::Display) -> JsValue {
    JsValue::from_str(&e.to_string())
}

/// Called once by the page: `args` is the game's command line without the program name
/// (`--map maps/Grundorf/global.cfg --bus Vehicles/MB_O305/O305_E2H_84.bus --lan-join wss://…`).
#[wasm_bindgen]
pub async fn start(canvas_id: String, pack: js_sys::Uint8Array, args: Vec<String>, quality: Option<String>, extras: Option<js_sys::Array>) -> Result<(), JsValue> {
    console_error_panic_hook::set_once();
    LOW_QUALITY.store(quality.as_deref() == Some("low"), std::sync::atomic::Ordering::Relaxed);
    let _ = console_log::init_with_level(log::Level::Info);
    log::info!("openOMSI {} (browser), build {}", crate::VERSION, crate::BUILD);

    let document = web_sys::window().and_then(|w| w.document()).ok_or_else(|| err("no document"))?;
    let canvas: web_sys::HtmlCanvasElement = document
        .get_element_by_id(&canvas_id)
        .ok_or_else(|| err(format!("no canvas '{canvas_id}'")))?
        .dyn_into()
        .map_err(|_| err("the element is not a canvas"))?;
    CANVAS.with(|c| *c.borrow_mut() = Some(canvas.clone()));

    // the game's files
    let bytes = pack.to_vec();
    log::info!("pack: {:.1} MB", bytes.len() as f64 / 1e6);
    let root = PathBuf::from(PACK_ROOT);
    omsi_cfg::vfs::mount_zip_memory(&root, bytes).map_err(err)?;
    // the player's own zips, laid over the pack like mods: each is mounted as a folder of its
    // own and named to the game as `--content-zip` (it takes the wrapper folder of a download
    // - `OMSI 2/Vehicles/...` - as the root by itself)
    let mut extra_args: Vec<String> = Vec::new();
    if let Some(list) = extras {
        for (i, item) in list.iter().enumerate() {
            let Ok(zip) = item.dyn_into::<js_sys::Uint8Array>() else { continue };
            let at = format!("/mods/extra{i}.zip");
            log::info!("your files #{i}: {:.1} MB", zip.length() as f64 / 1e6);
            omsi_cfg::vfs::mount_zip_memory(std::path::Path::new(&at), zip.to_vec())
                .map_err(|e| err(format!("your zip #{}: {e}", i + 1)))?;
            extra_args.push("--content-zip".into());
            extra_args.push(at);
        }
    }

    // the graphics device
    let instance = browser_instance();
    let surface = instance.create_surface(wgpu::SurfaceTarget::Canvas(canvas.clone())).map_err(err)?;
    let options = crate::settings::Settings::load().render_options();
    let renderer = omsi_render::Renderer::new_with(&instance, Some(&surface), None, options).await.map_err(err)?;
    drop(surface);
    GPU.with(|g| *g.borrow_mut() = Some((instance, renderer)));

    // the command line
    let mut argv = vec!["openomsi".to_string(), "--root".into(), PACK_ROOT.into()];
    argv.extend(extra_args);
    argv.extend(args);
    let args = Args::try_parse_from(argv).map_err(err)?;
    let Some((args, server_cfg)) = crate::prepare(args, false).map_err(err)? else { return Ok(()) };
    let Some(app) = crate::make_app(args, server_cfg).map_err(err)? else { return Ok(()) };

    let event_loop = EventLoop::new().map_err(err)?;
    event_loop.spawn_app(app);
    Ok(())
}
