/**
 * Basics:
 * If WebSocket is defined, re-assign it to a local variable.
 * If it is not defined, define a Function with the same API, this function instead calls the flash API.
 * Furthermore, the synthetic function will also need to create initialize flash using SWF object.
 *
 * In either case, window.WebSocket is re-defined by a 3rd function. This 3rd function also provides the same
 * WebSocket API, in addition, it provides a few other things, e.g. the option to auto re-connect on failure.
 * The third function also provides the ability for users to configure the client, allowings things such as
 * forcing flash to be used even if WebSocket is available.
 *
 * A global higgs_fs object is defined with the 4 WebSocket callbacks (onopen,onclose,onerror,onmessage).
 * The flash implementation invokes these methods when the event occurrs in flash.
 *
 * Currently only a single instance is supported. To allow multiple instances the flash API would need to be
 * a bit more clever to identify an instance (per ID or something similar). Until the need arises...KISS
 */
(function () {
    //needs to be global
    window.higgs_fs = {}
    higgs_fs.flash_loaded = false;
    //by the brilliant Dustin Diaz - http://dustindiaz.com/smallest-domready-ever
    higgs_fs.ready = function (f) {
        /in/.test(document.readyState) ? setTimeout('higgs_fs.ready(' + f + ')', 9) : f()
    }
    higgs_fs.require = function (file, callback) {
        var head = document.getElementsByTagName("head")[0];
        var script = document.createElement('script');
        script.src = file;
        script.type = 'text/javascript';
        //real browsers
        script.onload = callback;
        //Internet explorer
        script.onreadystatechange = function () {
            if (this.readyState == 'complete') {
                callback();
            }
        }
        head.appendChild(script);
    }
    higgs_fs.ready(function () {
        //Set of states the higgs_fs.can be in
        higgs_fs.states = {
            UNINITIALIZED:1,
            CONNECTING:2,
            CONNECTED:3,
            CLOSING:4,
            CLOSED:5,
            FLASH_FAILED:6,
            ERROR:7
        }
        higgs_fs.api = function (host) {
            /*  default NOOP API function*/
        }
        higgs_fs.instance = {}
        //default no op callbacks invoked on events
        higgs_fs.onopen = function (e) {
            console.log("opened", e)
        }
        higgs_fs.onclose = function (e) {
            console.log("closed", e)
        }
        higgs_fs.onerror = function (e) {
            console.log("error", e)
        }
        higgs_fs.onmessage = function (e) {
            console.log("message", e)
        }
        higgs_fs.send = higgs_fs.instance.send = function (data) {
            console.error("send:no usable instance configured", data)
        }
        higgs_fs.close = higgs_fs.instance.close = function () {
            console.error("close:no usable instance configured")
        }
        /**
         * called by the flash or web socket socket opens
         */
        higgs_fs.onopen_fs = function (open) {
            higgs_fs.state = higgs_fs.states.CONNECTED;
            higgs_fs.onopen(open);
        }
        /**
         * called by the flash or web socket  closes
         */
        higgs_fs.onclose_fs = function (close) {
            higgs_fs.state = higgs_fs.states.CLOSED;
            higgs_fs.onclose(close)
        }
        /**
         * called by the flash or web socket when an error has occurred
         */
        higgs_fs.onerror_fs = function (error) {
            higgs_fs.state = higgs_fs.states.ERROR;
            higgs_fs.onerror(error)
        }
        /**
         * called by the flash or web socket when a message is received
         */
        higgs_fs.onmessage_fs = function (data) {
            higgs_fs.onmessage(data)
        }

        // initializes a synthetic API that mimics the native WebSocket API.
        higgs_fs.loadFlashAPI = function () {
            higgs_fs.api = function (host) {
                var url = document.createElement('a');
                url.href = host;
                var self = this;
                self.host = url.hostname;
                self.port = url.port;
                //no way to make this synchronous. (maybe should always pre-load flash?)
                self.flash = null;
                //define the synthetic API which proxies requests to flash
                self.send = function (msg) {
                    //send method defined in flash
                    return  self.flash.send(msg)
                }
                self.close = function () {
                    //close method defined in flash
                    self.flash.close()
                }
                var onLoad = function () {
                    //when SWF is loaded, connect
                    try {
                        //only reason we're here is self.flash and self.flash.connect is available
                        self.flash.connect(self.host, parseInt(self.port))
                    } catch (e) {
                        higgs_fs.onerror_fs(e)
                    }
                }
                //until flash is in the DOM keep trying...you might think just calling onLoad in the if else
                //block below might work but it won't...async + the else block only says swf object is loaded
                // not that flash is in the DOM and ready to go, until its reachable by ID we got nothing!
                var checker = function () {
                    self.flash && self.flash.connect ? onLoad() : setTimeout(function () {
                        //even if flash is in the dom the external interface isn't available straight away.
                        if (!self.flash) {
                            self.flash = document.getElementById(higgs_fs.flash_id)
                        }
                        //don't believe me? uncomment this...
                        //console.log("callback", self.flash, self.flash ? self.flash.connect : 'flash there but no connect')
                        if (self.flash && self.flash.connect) {
                            higgs_fs.flash_obj = self.flash;
                            higgs_fs.checker = undefined;//yeah we got them both, now connect!
                        }
                        checker()
                    }, 9)
                }
                checker()
                //swf only needs to be initialized once
                if (higgs_fs.flash_loaded && higgs_fs.flash_obj) {
                    self.flash = higgs_fs.flash_obj;
                } else {
                    higgs_fs.loadSWFObject(function (status) {
                        if (status.success) {
                            higgs_fs.isFlash = true
                            higgs_fs.flash_loaded = true
                            higgs_fs.flash_id = status.id;
                        } else {
                            //swfobject failed to init flash
                            higgs_fs.state = higgs_fs.states.FLASH_FAILED;
                            //if web socket is available then use it
                            if (higgs_fs._websocket) {
                                higgs_fs.api = higgs_fs._websocket;
                            } else {
                                //we're in trouble, no flash and no WebSocket - blow up
                                //todo add long polling
                                throw new Error("Failed to initialize flash and WebSocket is not available")
                            }
                        }
                    });
                }
            }
        }
        higgs_fs.loadWebSocketAPI = function () {
            higgs_fs.isFlash = false;
            //if we haven't taken WebSocket yet then do it...
            if (!higgs_fs._websocket) {
                //for keep sake :) ... just to make sure we don't lose it
                higgs_fs._websocket = WebSocket;
            }
            //not set the API to WebSocket (we either just copied it to _websocket or it was done before)
            higgs_fs.api = higgs_fs._websocket;
        }
        /**
         * loads the swf object file and sets up flash
         * @param callback  invoked when the swfobject file is loaded and flash is initialized...or not
         */
        higgs_fs.loadSWFObject = function (callback) {
            higgs_fs.require('./swfobject.js', function () {
                var id = "higgs_fs_container";
                //create element to include SWFObject
                var container = document.createElement('div')
                container.setAttribute('id', id)
                //absolutely positioned 1 pixel...can you see it? :P
                container.setAttribute('style', 'width:1px;height:1px;position:absolute;z-index:0;');
                document.getElementsByTagName('body')[0].appendChild(container);
                //configure SWFObject & add it to the page.
                // For version detection, set to min. required Flash Player version, or 0 (or 0.0.0), for no version detection.
                var swfVersionStr = "0.0.0";
                // To use express install, set to playerProductInstall.swf, otherwise the empty string.
                //http://help.adobe.com/en_US/flex/using/WS2db454920e96a9e51e63e3d11c0bf663fe-7fff.html#WSDF4E56EF-2198-4843-ACF0-D78D52422046
                var xiSwfUrlStr = "playerProductInstall.swf";
                //the vars configure a few things about what flash does
                var flashvars = {
                    //this encoding is used when converting JSON to and from bytes
                    encoding:'utf-8',
                    //if true then flash uses JavaScript's console.log and console.error for logging
                    logToConsole:higgs_fs.logToConsole,
                    //for debugging purposes you can also make the 1x1 div bigger and the flash player
                    //will have a text area with debug messages  (only certain events are logged)
                    useDebugTextarea:higgs_fs.useDebugTextarea
                };
                //see swf object's API here http://code.google.com/p/swfobject/wiki/api
                var params = {};
                params.quality = "high";
                params.bgcolor = "#ffffff";
                params.allowscriptaccess = "sameDomain";
                params.allowfullscreen = "true";
                var attributes = {};
                attributes.id = id;
                attributes.name = id;
                attributes.align = "middle";
                swfobject.embedSWF(
                    "higgs_fs.swf", id,
                    "1px", "1px",
                    swfVersionStr, xiSwfUrlStr,
                    flashvars, params, attributes, callback);
                swfobject.createCSS(id, "display:hidden;position:absolute;");
            });
        }
        /**
         * Opens a new connection to the given Host.
         * Note that currently, only a single connection is supported so each connection
         * closes the previously opened connection
         * Note, even if flash is being used the URL format must still be for WebSockets i.e. in the form
         * ws://host:port/path
         * If flash is used as the API the host and port will automatically be extracted
         * @param host the host to connect to
         * @param forceFlash if true use flash sockets even if WebSocket is available
         */
        higgs_fs.connect = function (host, forceFlash) {
            if (higgs_fs.state === higgs_fs.states.CONNECTED || higgs_fs.state === higgs_fs.states.CONNECTING) {
                higgs_fs.close()
            }
            higgs_fs.state = higgs_fs.states.CONNECTING;
            //if WebSocket is defined then use it as the API unless forcing flash as the API
            if (window.WebSocket && !forceFlash) {
                higgs_fs.loadWebSocketAPI();
            } else {
                higgs_fs.loadFlashAPI();
            }
            //initialize the underlying API (WebSocket, Flash or whatever)
            higgs_fs.instance = new higgs_fs.api(host)
            //hijack the underlying API's on* callbacks (these are intercepted and proxied to higgs_fs.on*
            higgs_fs.instance.onopen = higgs_fs.onopen_fs
            higgs_fs.instance.onclose = higgs_fs.onclose_fs
            higgs_fs.instance.onmessage = higgs_fs.onmessage_fs
            higgs_fs.instance.onerror = higgs_fs.onerror_fs
            //proxy send and close method to instance
            higgs_fs.send = function (data) {
                return higgs_fs.instance.send(data);
            }
            higgs_fs.close = function () {
                higgs_fs.state = higgs_fs.states.CLOSING;
                return higgs_fs.instance.close();
            }
        }
        higgs_fs.invoke = function (method, data) {
            var json = JSON.stringify({
                topic:method,
                message:data ? data : {}
            })
            console.log(json)
            higgs_fs.send(json)
        }
    })
})();
//higgs_fs.connect('ws://' + window.location.host);
