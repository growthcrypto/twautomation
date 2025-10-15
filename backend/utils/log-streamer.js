/**
 * Log Streamer - Broadcasts logs to connected clients via SSE
 */

class LogStreamer {
  constructor() {
    this.clients = new Set();
    this.logBuffer = []; // Keep last 100 logs
    this.maxBufferSize = 100;
  }

  /**
   * Add a client (SSE connection)
   */
  addClient(client) {
    this.clients.add(client);
    console.log(`📡 Log client connected (${this.clients.size} total)`);
    
    // Send buffered logs immediately
    this.logBuffer.forEach(log => {
      this.sendToClient(client, log);
    });
  }

  /**
   * Remove a client
   */
  removeClient(client) {
    this.clients.delete(client);
    console.log(`📡 Log client disconnected (${this.clients.size} remaining)`);
  }

  /**
   * Broadcast a log to all connected clients
   */
  broadcast(level, message, data = {}) {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };

    // Add to buffer
    this.logBuffer.push(log);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Send to all clients
    this.clients.forEach(client => {
      this.sendToClient(client, log);
    });
  }

  /**
   * Send log to specific client
   */
  sendToClient(client, log) {
    try {
      client.write(`data: ${JSON.stringify(log)}\n\n`);
    } catch (error) {
      // Client disconnected, remove it
      this.clients.delete(client);
    }
  }

  /**
   * Convenience methods
   */
  info(message, data) {
    this.broadcast('info', message, data);
  }

  success(message, data) {
    this.broadcast('success', message, data);
  }

  warning(message, data) {
    this.broadcast('warning', message, data);
  }

  error(message, data) {
    this.broadcast('error', message, data);
  }

  /**
   * Get current client count
   */
  getClientCount() {
    return this.clients.size;
  }
}

module.exports = new LogStreamer();

