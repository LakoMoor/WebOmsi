//! The datagram socket of a session: UDP on a computer, a WebSocket in the browser.
//!
//! A page cannot open a UDP socket. It talks to a server's WebSocket gateway (`ws::WsGateway`)
//! instead, which carries each binary message to the session as one datagram and back - the
//! session code above does not change. The server is the only peer a page ever has, so the
//! address that goes with a datagram is only a name for it: [`WEB_PEER`].

use std::io;
use std::net::{SocketAddr, UdpSocket};

/// What a page's datagrams are addressed to and come from: the gateway it is connected to.
pub const WEB_PEER: SocketAddr = SocketAddr::new(std::net::IpAddr::V4(std::net::Ipv4Addr::new(10, 255, 0, 1)), 7755);

pub enum Socket {
    Udp(UdpSocket),
    #[cfg(target_arch = "wasm32")]
    Web(web::WebDatagram),
    /// Peer-to-peer in the browser: WebRTC data channels (one for a client, one per player
    /// for a host that lives in a page).
    #[cfg(target_arch = "wasm32")]
    Rtc(rtc::RtcHub),
}

impl From<UdpSocket> for Socket {
    fn from(s: UdpSocket) -> Socket {
        Socket::Udp(s)
    }
}

impl Socket {
    pub fn send_to(&self, data: &[u8], to: SocketAddr) -> io::Result<usize> {
        match self {
            Socket::Udp(s) => s.send_to(data, to),
            #[cfg(target_arch = "wasm32")]
            Socket::Web(w) => w.send(data),
            #[cfg(target_arch = "wasm32")]
            Socket::Rtc(h) => h.send(data, to),
        }
    }

    pub fn recv_from(&self, buf: &mut [u8]) -> io::Result<(usize, SocketAddr)> {
        match self {
            Socket::Udp(s) => s.recv_from(buf),
            #[cfg(target_arch = "wasm32")]
            Socket::Web(w) => w.recv(buf).map(|n| (n, WEB_PEER)),
            #[cfg(target_arch = "wasm32")]
            Socket::Rtc(h) => h.recv(buf),
        }
    }

    pub fn local_addr(&self) -> io::Result<SocketAddr> {
        match self {
            Socket::Udp(s) => s.local_addr(),
            #[cfg(target_arch = "wasm32")]
            Socket::Web(_) | Socket::Rtc(_) => Ok(SocketAddr::from(([10, 255, 0, 2], 7756))),
        }
    }

    /// The UDP socket underneath, for what only a computer does (the internet bridge).
    pub fn as_udp(&self) -> Option<&UdpSocket> {
        match self {
            Socket::Udp(s) => Some(s),
            #[cfg(target_arch = "wasm32")]
            Socket::Web(_) | Socket::Rtc(_) => None,
        }
    }

    /// Whether the way to the server is open (a WebSocket takes a moment to connect; UDP
    /// has no such thing).
    pub fn is_open(&self) -> bool {
        match self {
            Socket::Udp(_) => true,
            #[cfg(target_arch = "wasm32")]
            Socket::Web(w) => w.is_open(),
            #[cfg(target_arch = "wasm32")]
            Socket::Rtc(h) => h.peer_count() > 0,
        }
    }
}

#[cfg(target_arch = "wasm32")]
pub mod web {
    use std::cell::RefCell;
    use std::collections::VecDeque;
    use std::io;
    use std::rc::Rc;
    use wasm_bindgen::prelude::*;
    use web_sys::{BinaryType, MessageEvent, WebSocket};

    /// Datagrams that came and were not read yet are kept up to this many (a page that did
    /// not run for a while - a hidden tab - must not pile them up for ever).
    const INBOX_MAX: usize = 512;

    /// A WebSocket in the browser as a datagram socket.
    pub struct WebDatagram {
        ws: WebSocket,
        inbox: Rc<RefCell<VecDeque<Vec<u8>>>>,
        closed: Rc<RefCell<Option<String>>>,
        _keep: Vec<Closure<dyn FnMut(JsValue)>>,
    }

    // The page runs on one thread (no wasm threads): nothing here is ever shared across threads.
    unsafe impl Send for WebDatagram {}
    unsafe impl Sync for WebDatagram {}

    impl WebDatagram {
        /// Open `url` (`wss://host/ws`). The connection completes in the background.
        pub fn connect(url: &str) -> Result<WebDatagram, String> {
            let ws = WebSocket::new(url).map_err(|e| format!("cannot open {url}: {e:?}"))?;
            ws.set_binary_type(BinaryType::Arraybuffer);
            let inbox: Rc<RefCell<VecDeque<Vec<u8>>>> = Rc::default();
            let closed: Rc<RefCell<Option<String>>> = Rc::default();
            let mut keep = Vec::new();
            {
                let inbox = inbox.clone();
                let on_message = Closure::<dyn FnMut(JsValue)>::new(move |ev: JsValue| {
                    let Ok(ev) = ev.dyn_into::<MessageEvent>() else { return };
                    if let Ok(buf) = ev.data().dyn_into::<js_sys::ArrayBuffer>() {
                        let mut q = inbox.borrow_mut();
                        if q.len() >= INBOX_MAX {
                            q.pop_front();
                        }
                        q.push_back(js_sys::Uint8Array::new(&buf).to_vec());
                    }
                });
                ws.set_onmessage(Some(on_message.as_ref().unchecked_ref()));
                keep.push(on_message);
            }
            {
                let closed = closed.clone();
                let on_close = Closure::<dyn FnMut(JsValue)>::new(move |_| {
                    *closed.borrow_mut() = Some("the connection to the server closed".to_string());
                });
                ws.set_onclose(Some(on_close.as_ref().unchecked_ref()));
                keep.push(on_close);
            }
            {
                let closed = closed.clone();
                let on_error = Closure::<dyn FnMut(JsValue)>::new(move |_| {
                    *closed.borrow_mut() = Some("the server did not answer".to_string());
                });
                ws.set_onerror(Some(on_error.as_ref().unchecked_ref()));
                keep.push(on_error);
            }
            Ok(WebDatagram { ws, inbox, closed, _keep: keep })
        }

        pub fn is_open(&self) -> bool {
            self.ws.ready_state() == WebSocket::OPEN
        }

        /// Why the connection ended, once it has.
        pub fn closed(&self) -> Option<String> {
            self.closed.borrow().clone()
        }

        pub fn send(&self, data: &[u8]) -> io::Result<usize> {
            if let Some(why) = self.closed() {
                return Err(io::Error::new(io::ErrorKind::ConnectionAborted, why));
            }
            if !self.is_open() {
                // still connecting: like a full buffer, the caller says it again next tick
                return Err(io::Error::from(io::ErrorKind::WouldBlock));
            }
            self.ws.send_with_u8_array(data).map_err(|e| io::Error::other(format!("{e:?}")))?;
            Ok(data.len())
        }

        pub fn recv(&self, buf: &mut [u8]) -> io::Result<usize> {
            match self.inbox.borrow_mut().pop_front() {
                Some(d) => {
                    let n = d.len().min(buf.len());
                    buf[..n].copy_from_slice(&d[..n]);
                    Ok(n)
                }
                None => Err(io::Error::from(io::ErrorKind::WouldBlock)),
            }
        }
    }

    impl Drop for WebDatagram {
        fn drop(&mut self) {
            self.ws.set_onmessage(None);
            self.ws.set_onclose(None);
            self.ws.set_onerror(None);
            let _ = self.ws.close();
        }
    }
}

/// Peer-to-peer sessions in the browser. A page cannot open a UDP socket or listen for
/// connections, but two pages can talk over WebRTC data channels. Opening the channels
/// (the offer and the answer, ICE) is the page's job - it needs a way to pass a few
/// hundred bytes between the two players once; the game's datagrams then go over the
/// channels, one datagram per message, as they would over UDP: unordered, and lost ones
/// are not sent again (the session protocol is made for that).
///
/// The hub gives every channel an address of its own (10.255.1.N), so that the session code,
/// which tells players by the address a datagram came from, is unchanged.
#[cfg(target_arch = "wasm32")]
pub mod rtc {
    use std::cell::{Cell, RefCell};
    use std::collections::{HashMap, VecDeque};
    use std::io;
    use std::net::SocketAddr;
    use std::rc::Rc;
    use wasm_bindgen::prelude::*;
    use web_sys::{MessageEvent, RtcDataChannel, RtcDataChannelState, RtcDataChannelType};

    /// Unread datagrams are kept up to this many (a hidden tab does not run for a while).
    const INBOX_MAX: usize = 1024;

    struct Peer {
        channel: RtcDataChannel,
        _keep: Vec<Closure<dyn FnMut(JsValue)>>,
    }

    #[derive(Default)]
    struct Inner {
        inbox: RefCell<VecDeque<(Vec<u8>, SocketAddr)>>,
        peers: RefCell<HashMap<SocketAddr, Peer>>,
        next: Cell<u16>,
    }

    /// All the data channels of a page's session. Clones share the channels.
    #[derive(Clone, Default)]
    pub struct RtcHub {
        inner: Rc<Inner>,
    }

    // The page runs on one thread (no wasm threads): nothing here is ever shared across threads.
    unsafe impl Send for RtcHub {}
    unsafe impl Sync for RtcHub {}

    impl RtcHub {
        pub fn new() -> RtcHub {
            RtcHub::default()
        }

        /// Take an open data channel of a player who joined (a host). Returns the address
        /// the session sees that player at.
        pub fn add_peer(&self, channel: RtcDataChannel) -> SocketAddr {
            let n = self.inner.next.get().wrapping_add(1).max(1);
            self.inner.next.set(n);
            let addr = SocketAddr::from(([10, 255, 1, (n % 250 + 1) as u8], 7000 + n));
            self.attach(channel, addr);
            addr
        }

        /// Take the open data channel to the host (a client): the host's address is
        /// `super::WEB_PEER`.
        pub fn set_server(&self, channel: RtcDataChannel) {
            self.attach(channel, super::WEB_PEER);
        }

        fn attach(&self, channel: RtcDataChannel, addr: SocketAddr) {
            channel.set_binary_type(RtcDataChannelType::Arraybuffer);
            let mut keep = Vec::new();
            {
                let inner = self.inner.clone();
                let on_message = Closure::<dyn FnMut(JsValue)>::new(move |ev: JsValue| {
                    let Ok(ev) = ev.dyn_into::<MessageEvent>() else { return };
                    if let Ok(buf) = ev.data().dyn_into::<js_sys::ArrayBuffer>() {
                        let mut q = inner.inbox.borrow_mut();
                        if q.len() >= INBOX_MAX {
                            q.pop_front();
                        }
                        q.push_back((js_sys::Uint8Array::new(&buf).to_vec(), addr));
                    }
                });
                channel.set_onmessage(Some(on_message.as_ref().unchecked_ref()));
                keep.push(on_message);
            }
            {
                // a channel that closes is a player that left: the session notices the silence
                let inner = self.inner.clone();
                let on_close = Closure::<dyn FnMut(JsValue)>::new(move |_| {
                    inner.peers.borrow_mut().remove(&addr);
                });
                channel.set_onclose(Some(on_close.as_ref().unchecked_ref()));
                keep.push(on_close);
            }
            self.inner.peers.borrow_mut().insert(addr, Peer { channel, _keep: keep });
        }

        /// Players (or the host) connected now.
        pub fn peer_count(&self) -> usize {
            self.inner.peers.borrow().len()
        }

        pub fn send(&self, data: &[u8], to: SocketAddr) -> io::Result<usize> {
            let peers = self.inner.peers.borrow();
            match peers.get(&to) {
                Some(p) if p.channel.ready_state() == RtcDataChannelState::Open => {
                    p.channel.send_with_u8_array(data).map_err(|e| io::Error::other(format!("{e:?}")))?;
                    Ok(data.len())
                }
                Some(_) => Err(io::Error::from(io::ErrorKind::WouldBlock)),
                // an address nobody has (a broadcast, a player who left): dropped, as UDP would
                None => Ok(data.len()),
            }
        }

        pub fn recv(&self, buf: &mut [u8]) -> io::Result<(usize, SocketAddr)> {
            match self.inner.inbox.borrow_mut().pop_front() {
                Some((d, from)) => {
                    let n = d.len().min(buf.len());
                    buf[..n].copy_from_slice(&d[..n]);
                    Ok((n, from))
                }
                None => Err(io::Error::from(io::ErrorKind::WouldBlock)),
            }
        }
    }
}
