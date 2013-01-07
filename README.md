# Higgs WebSocket Client

This is the browser client side implementation of Higgs' WebSockets.
It provides an API that mirrors the native browser WebSocket but in fact falls back to Flash
if a native WebSocket implementation isn't available, or if Flash is forced...

On the TODO list:

1. Add support for long polling so that in cases where neither Flash nor WebSocket
is available, it'll still work...as best it can anyway.
2. Support multiple simultaneous WebSocket connections. Currently only a single connection is supported.
Session support will be implemented in Flash in order to allow multiple connections.

# Usage

Check out the pre-built SWF in bin-release. Look at the sample HTML page to see how it is included.

```javascript

higgs_fs.onopen=function(){
	console.log('open')
}
higgs_fs.onclose=function(){
	console.log('close')
}
higgs_fs.onerror=function(){
	console.log('error')
}
higgs_fs.onmessage=function(msg){
    console.log(msg)
    //this
    higgs_fs.send('{"topic":"test","message":{}}');
    //and this are the same - but invoke takes JavaScript objects and does JSON.stringify()...
    higgs_fs.invoke('test',{});
}
//doing connect automatically choses WebSocket or Flash unless the second parameter is true
//if the second param is true then it tells higgs_fs to force the use of Flash
higgs_fs.connect('ws://' + window.location.host,true);

```

That's it...for now.