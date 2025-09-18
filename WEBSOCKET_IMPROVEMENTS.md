# WebSocket Connection Improvements

## Problem
The Chainlit application frontend was getting stuck and requiring manual refresh (F5) when using `cl.message.stream_token()` method extensively. This was likely caused by:
- Browser being overwhelmed with too many rapid WebSocket updates
- WebSocket connection drops due to excessive message traffic
- No automatic reconnection when connections fail

## Solutions Implemented

### 1. Backend Socket.IO Server Configuration (backend/chainlit/server.py)

**Optimized server settings:**
```python
sio = socketio.AsyncServer(
    cors_allowed_origins=[],
    async_mode="asgi",
    
    # Connection settings
    ping_timeout=60,        # Increase from default 20s to 60s
    ping_interval=25,       # Keep at 25s (heartbeat every 25s)
    max_http_buffer_size=1e8,  # 100MB (increase from default 1MB)
    
    # Performance settings
    compression_threshold=1024,  # Compress messages > 1KB
    
    # Allow reconnections
    allow_upgrades=True,
    
    # Logger for debugging
    logger=True if config.run.debug else False,
    engineio_logger=True if config.run.debug else False,
)
```

**Benefits:**
- **Increased ping timeout (60s)**: Gives slow/busy clients more time to respond
- **Larger buffer size (100MB)**: Handles extensive streaming content without dropping
- **Message compression**: Reduces bandwidth usage for large messages
- **Debug logging**: Better troubleshooting when enabled

### 2. Frontend Auto-Reconnection (libs/react-client/src/useChatSession.ts)

**Client reconnection settings:**
```javascript
const socket = io(uri, {
  // ... existing config
  
  // Reconnection settings
  reconnection: true,              // Enable auto-reconnection
  reconnectionAttempts: Infinity,  // Keep trying forever
  reconnectionDelay: 1000,         // Start with 1 second
  reconnectionDelayMax: 5000,      // Max 5 seconds between attempts
  randomizationFactor: 0.5,        // Randomize delay by ±50%
  timeout: 20000,                  // Connection timeout (20s)
});
```

**Event handlers added:**
```javascript
socket.on('reconnect', (attemptNumber) => {
  console.log(`Reconnected after ${attemptNumber} attempts`);
  setSession((s) => ({ ...s!, error: false }));
  toast.success('Connection restored!');
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`Reconnection attempt ${attemptNumber}`);
  if (attemptNumber === 1) {
    toast.info('Connection lost, attempting to reconnect...');
  }
});

socket.on('reconnect_error', (error) => {
  console.error('Reconnection error:', error);
});

socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect after all attempts');
  setSession((s) => ({ ...s!, error: true }));
  toast.error('Unable to reconnect. Please refresh the page.');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason === 'io server disconnect') {
    socket.connect(); // Server-initiated disconnect, try to reconnect
  }
  setSession((s) => ({ ...s!, error: true }));
});
```

**Benefits:**
- **Automatic reconnection**: No more manual refresh needed
- **User feedback**: Toast notifications inform users of connection status
- **Intelligent retry**: Exponential backoff with randomization prevents server overload
- **Persistent attempts**: Will keep trying to reconnect indefinitely
- **Graceful degradation**: Clear error messages when reconnection fails

## Expected Results

### Before Implementation:
- Frontend gets stuck during heavy streaming
- Users need to manually refresh (F5) to restore functionality
- No indication when WebSocket connection is lost
- Poor user experience during network interruptions

### After Implementation:
- Automatic recovery from connection drops
- Better handling of high-volume streaming scenarios
- User notifications about connection status
- Improved resilience to network issues
- Reduced need for manual page refreshes

### 3. Debug Logging System

**Integrated with Chainlit's existing debug flag:**

When you run Chainlit with the `--debug` flag, comprehensive debug logging is automatically enabled in the browser console:

```bash
chainlit run app.py --debug
```

**To see the logs:**
1. Run Chainlit with `--debug` flag
2. Open your browser's Developer Tools (F12)
3. Go to the Console tab
4. Trigger streaming in your application
5. Watch for `[Chainlit Debug]` messages

**Debug logs include:**
- WebSocket connection events and transport information
- Stream start/end events with timestamps
- Token streaming metrics (frequency, timing, buffer status)
- Performance warnings for slow updates (>16ms)
- Socket buffer health monitoring
- Automatic warnings for concerning patterns (tokens <5ms apart)

**Sample debug output:**
```javascript
[Chainlit Debug] WebSocket connected {
  transport: 'websocket',
  sessionId: 'abc123',
  timestamp: '2024-01-01T12:00:00.000Z'
}

[Chainlit Debug] Stream started {
  messageId: 'msg-456',
  messageType: 'assistant_message',
  timestamp: '2024-01-01T12:00:01.000Z'
}

[Chainlit Debug] Streaming metrics update {
  messageId: 'msg-456',
  tokensReceived: 50,
  timeSinceLastToken: 15,
  fastTokens: 5,
  slowTokens: 2,
  socketBufferLength: 0,
  transport: 'websocket'
}

[Chainlit Debug] Very fast token streaming detected {
  messageId: 'msg-456',
  tokensInLast5ms: 10,
  timeSinceLastToken: 3,
  bufferLength: 0
}

[Chainlit Debug] Slow token update detected {
  messageId: 'msg-456',
  updateTime: '23.45ms',
  tokenLength: 156,
  isSequence: false
}
```

**What to look for:**
- **High `fastTokens` count**: Indicates tokens arriving very rapidly (may overwhelm browser)
- **Large `socketBufferLength`**: Shows WebSocket buffer backup (connection issue)
- **Slow update warnings**: DOM updates taking >16ms (performance issue)
- **Connection status changes**: Helps identify network interruptions

## Testing Scenarios

To test the improvements:

1. **Heavy Streaming Test**: Use `cl.message.stream_token()` extensively with debug mode enabled to monitor performance
2. **Network Interruption**: Temporarily disconnect network and verify automatic reconnection
3. **Server Restart**: Restart the Chainlit server and verify client reconnects automatically
4. **Browser Tab Background**: Put tab in background during streaming and verify it continues working when brought back to foreground
5. **Debug Mode Testing**: Run with `--debug` flag and monitor console for performance warnings during heavy streaming

## Configuration Notes

- The reconnection settings can be adjusted based on your specific needs
- For production environments, you may want to limit `reconnectionAttempts` to a finite number
- The `ping_timeout` and `ping_interval` can be tuned based on your network conditions
- Debug logging should be disabled in production for performance

## Monitoring

The implementation includes comprehensive logging:
- Console logs for connection events
- Toast notifications for user feedback
- Session state management for UI updates
- Error tracking for debugging purposes

This should significantly improve the stability and user experience of your Chainlit application when using streaming functionality.
