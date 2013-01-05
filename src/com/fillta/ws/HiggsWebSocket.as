package com.fillta.ws
{
	import flash.events.Event;
	import flash.events.IOErrorEvent;
	import flash.events.ProgressEvent;
	import flash.events.SecurityErrorEvent;
	import flash.external.ExternalInterface;
	import flash.net.Socket;
	import flash.utils.ByteArray;
	
	public class HiggsWebSocket
	{
		private var socket:Socket;
		private var connectListener:Function;
		private var errorListener:Function;
		private var messageListener:Function;
		private var closeListener:Function;
		
		public function HiggsWebSocket()
		{
		}
		public function log(... args):void
		{
			ExternalInterface.call("console.log",args);
		}
		public function connect(host:String,port:int):void
		{
			if(socket!=null && socket.connected){
				socket.close();
			}
			socket=new Socket();
			socket.addEventListener(Event.CONNECT,onOpen);
			socket.addEventListener(IOErrorEvent.IO_ERROR,onError);
			socket.addEventListener(SecurityErrorEvent.SECURITY_ERROR, securityErrorHandler);
			socket.addEventListener(Event.CLOSE,onClose);
			socket.addEventListener(ProgressEvent.SOCKET_DATA,onMessage);
			try{
				log("connecting to ",host,":",port);
				socket.connect(host,port);
				log("connect returned");
			}catch(e:Error){
				log("unable to connect",e.name,e.errorID,e.message);
			}
		}
		
		protected function securityErrorHandler(event:SecurityErrorEvent):void
		{
			ExternalInterface.call("console.error",event.type,event.errorID,event.text);
		}
		
		public function onOpen(arg:*):void
		{
			if(arg!=null )
			{
				if(arg is Function)
				{
					connectListener=arg;
				}
				else if(arg is Event && connectListener!=null)
				{
					log("onopen");
					connectListener.apply();	
				}
			}
		}
		
		public function send(data:String):Boolean
		{
			if(socket==null )
			{
				return false;
			}
			if(!socket.connected)
			{
				return false;
			}
			
			var bytes:ByteArray=new ByteArray();
			//send protocol header, basically the characters HFS - ('H'=72,'F'=83,'S'=70)
			socket.writeByte(72);
			socket.writeByte(83);
			socket.writeByte(70);
			bytes.writeMultiByte(data, "UTF-8");
			//bytes.writeUTFBytes(data);
			//send message size
			socket.writeInt(bytes.length);
			//we've now sent the 7 byte header
			//write the content
			socket.writeBytes(bytes);
			socket.flush();
			return true;
		}
		
		public function onMessage(arg:*):void
		{
			if(arg!=null)
			{
				if(arg is Function)
				{
					messageListener=arg;		
				}else if(arg is ProgressEvent && messageListener!=null){
					while(socket.bytesAvailable>0){
						//do we have the 7 byte header?
						if(socket.bytesAvailable<7){
							break;
						}
						//first 3 bytes are the characters HFS 
						//(we don't care on the client side, they're used to detect the protocol on the server)
						socket.readByte();
						socket.readByte();
						socket.readByte();
						//next 4 bytes tells us the message size
						var size:int=socket.readInt();
						//we don't have the entire message yet
						if(socket.bytesAvailable<size){
							break;
						}
						var message:String=socket.readUTFBytes(size);
						messageListener.call(this,message);
						//loop round and continue reading messages until the socket is empty
					}
				}
			}
		}
		
		public function onClose(arg:*):void
		{
			if(arg!=null)
			{
				if(arg is Function)
				{
					closeListener=arg;		
				}else if(arg is Event && closeListener!=null){
					closeListener.apply();
				}
			}
		}	
		
		public function onError(arg:*):void
		{
			if(arg!=null)
			{
				if(arg is Function)
				{
					errorListener=arg;		
				}else if(arg is IOErrorEvent && errorListener!=null){
					var error:IOErrorEvent=arg;
					log("error",error.errorID,error.text);
					errorListener.apply();
				}
			}
		}		
	}
}