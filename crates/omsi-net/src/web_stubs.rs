//! The browser build's stand-ins for what needs a computer's own network stack. A page
//! reaches a server through its WebSocket gateway; there is no router to ask, no relay to
//! post to and no official server to look up.

pub mod bridge {
    use std::net::SocketAddr;

    pub const PUNCH: &[u8] = b"\xFFPUNCH";

    pub struct Bridge;

    impl Bridge {
        pub fn start(_host: bool, _session: u64, _local: Vec<SocketAddr>, _port: u16) -> Option<Bridge> {
            None
        }
        pub fn tick(&mut self, _dt: f32, _socket: &std::net::UdpSocket) {}
        pub fn receive(&mut self, _data: &[u8]) {}
        pub fn public(&self) -> Option<SocketAddr> {
            None
        }
        pub fn host_addrs(&self) -> Vec<SocketAddr> {
            Vec::new()
        }
    }

    pub fn is_bridge_packet(data: &[u8]) -> bool {
        data.starts_with(PUNCH)
    }
    pub fn post_tunnel(_session: u64, _url: &str) {}
    pub fn lookup_tunnel(_session: u64) -> Option<String> {
        None
    }
}

pub mod tunnel {
    pub fn ensure_cloudflared() -> Option<std::path::PathBuf> {
        None
    }
}

pub mod official {
    pub const ALIAS: &str = "openomsi";
    pub const NAME: &str = "openOMSI | Official Server";

    pub fn is_alias(target: &str) -> bool {
        target.trim().eq_ignore_ascii_case(ALIAS)
    }
    pub fn resolve() -> Result<String, String> {
        Err("the official server is not looked up from a page: give its address".into())
    }
    pub fn announce(_url: &str, _pkcs8: &[u8]) -> Result<(), String> {
        Err("not from a page".into())
    }
    pub fn resolve_target(target: &str) -> Result<String, String> {
        if is_alias(target) { resolve() } else { Ok(target.to_string()) }
    }
}
