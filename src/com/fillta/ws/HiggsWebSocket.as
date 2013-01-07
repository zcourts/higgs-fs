package com.fillta.ws
{
	import flash.events.Event;
	import flash.events.IOErrorEvent;
	import flash.events.ProgressEvent;
	import flash.events.SecurityErrorEvent;
	import flash.net.Socket;
	import flash.utils.ByteArray;
	
	public class HiggsWebSocket
	{
		private var socket:Socket;
		private var connectListener:Function;
		private var errorListener:Function;
		private var messageListener:Function;
		private var closeListener:Function;
		private var encoding:String="utf-8";
		private var error:Function;
		private var info:Function;
		private var buf:ByteArray=new ByteArray();

		public function HiggsWebSocket( info:Function,error:Function, encoding:String)
		{
			this.info=info;
			this.error=error;
			this.encoding=encoding;
		}
		
		public function close():void
		{
			if(socket!=null && socket.connected){
				socket.close();
			}
		}
		
		public function connect(host:String,port:int):void
		{
			close();
			socket=new Socket();
			socket.addEventListener(Event.CONNECT,onOpen);
			socket.addEventListener(IOErrorEvent.IO_ERROR,onError);
			socket.addEventListener(SecurityErrorEvent.SECURITY_ERROR, securityErrorHandler);
			socket.addEventListener(Event.CLOSE,onClose);
			socket.addEventListener(ProgressEvent.SOCKET_DATA,onMessage);
			try{
				info("connecting to ",host,":",port);
				socket.connect(host,port);
			}catch(e:Error){
				error("unable to connect",e.name,e.errorID,e.message);
			}
		}
		
		protected function securityErrorHandler(event:SecurityErrorEvent):void
		{
			error("console.error",event.type,event.errorID,event.text);
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
					info("onopen");
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
					socket.readBytes(buf,buf.bytesAvailable,socket.bytesAvailable);
					//as long as we have some data try to read it
					while(buf.bytesAvailable>0)
					{
						//must have at least 4 bytes to know the size of the message
						if(buf.bytesAvailable<4){
							return;
						}
						//capture the current position in case there isn't enough data for a whole message
						var index:int=buf.position;
						//get the message size (first  4 bytes of the data)
						var size:int=buf.readInt();
						if(buf.bytesAvailable<size)
						{
							//reset position if we don't have enough
							buf.position=index;
							return;
						}
						//we have enough so read the data out
						var msg:String=buf.readUTFBytes(size);
						//copy what's left in the buffer to a temp byte array, clear the byte array we just read from (to free memory)
						//otherwise the buf will just keep growing. then re-assign old buf to what was copied
						var tmp:ByteArray=new ByteArray();
						buf.readBytes(tmp);
						buf.clear();
						buf=tmp;
						//finally, emit the message we got
						messageListener.call(this,msg);
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
					info("onclose");
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
					info("onerror",error.errorID,error.text);
					errorListener.apply();
				}
			}
		}		
	}
}