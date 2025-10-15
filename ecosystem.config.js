/**
 * PM2 Configuration for VPS Deployment
 * Keeps the system running 24/7 with auto-restart
 */

module.exports = {
  apps: [{
    name: 'twitter-automation',
    script: 'backend/server.js',
    
    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      MONGODB_URI: 'mongodb://localhost:27017/twitter-automation',
      ADSPOWER_API_URL: 'http://local.adspower.net:50325'
    },
    
    // Auto-restart settings
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    
    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Restart behavior
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};

