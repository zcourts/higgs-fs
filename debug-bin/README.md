# Higgs WebSocket Client

This is the browser client side implementation of Higgs' WebSockets.
It provides an API that mirrors the native browser WebSocket but in fact falls back to Flash
if a native WebSocket implementation isn't available, or if Flash is forced...

On the TODO list is to add support for long polling so that in cases where neither Flash nor WebSocket
is available, it'll still work...as best it can anyway.

# Usage

