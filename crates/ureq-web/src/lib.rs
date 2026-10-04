//! Same names and shapes as the `ureq` calls the game makes; no request ever leaves.

use std::fmt;
use std::io::Read;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorKind {
    Io,
}

impl fmt::Display for ErrorKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("network not available in the browser")
    }
}

#[derive(Debug)]
pub struct Transport {
    kind: ErrorKind,
}

impl Transport {
    pub fn kind(&self) -> ErrorKind {
        self.kind
    }
}

impl fmt::Display for Transport {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.kind)
    }
}

#[derive(Debug)]
pub enum Error {
    Status(u16, Response),
    Transport(Transport),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Status(code, _) => write!(f, "status {code}"),
            Error::Transport(t) => write!(f, "{t}"),
        }
    }
}

impl std::error::Error for Error {}

#[derive(Debug)]
pub struct Response;

impl Response {
    pub fn header(&self, _name: &str) -> Option<&str> {
        None
    }
    pub fn into_string(self) -> std::io::Result<String> {
        Ok(String::new())
    }
    pub fn into_reader(self) -> impl Read + Send + Sync + 'static {
        std::io::empty()
    }
}

pub struct Request;

impl Request {
    pub fn timeout(self, _t: Duration) -> Request {
        self
    }
    pub fn set(self, _k: &str, _v: &str) -> Request {
        self
    }
    pub fn call(self) -> Result<Response, Error> {
        Err(Error::Transport(Transport { kind: ErrorKind::Io }))
    }
}

pub fn get(_url: &str) -> Request {
    Request
}

#[derive(Clone)]
pub struct Agent;

impl Agent {
    pub fn get(&self, _url: &str) -> Request {
        Request
    }
}

pub struct AgentBuilder;

impl AgentBuilder {
    pub fn new() -> AgentBuilder {
        AgentBuilder
    }
    pub fn timeout(self, _t: Duration) -> AgentBuilder {
        self
    }
    pub fn timeout_connect(self, _t: Duration) -> AgentBuilder {
        self
    }
    pub fn timeout_read(self, _t: Duration) -> AgentBuilder {
        self
    }
    pub fn user_agent(self, _s: &str) -> AgentBuilder {
        self
    }
    pub fn build(self) -> Agent {
        Agent
    }
}
