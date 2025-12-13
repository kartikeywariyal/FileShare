# ClamAV Virus Scanning Setup

## Installation

### macOS
```bash
brew install clamav
```

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install clamav clamav-daemon
```

### Start ClamAV Daemon (Recommended)
```bash
# macOS
brew services start clamav

# Ubuntu/Debian
sudo systemctl start clamav-daemon
sudo systemctl enable clamav-daemon
```

### Update Virus Definitions
```bash
# macOS
freshclam

# Ubuntu/Debian
sudo freshclam
```

## Configuration

Add to your `.env` file:

```env
# Enable/disable virus scanning (default: true)
ENABLE_VIRUS_SCAN=true

# ClamAV daemon host (default: localhost)
CLAMAV_HOST=localhost

# ClamAV daemon port (default: 3310)
CLAMAV_PORT=3310

# Optional: Custom paths
CLAMSCAN_PATH=clamscan
CLAMDSCAN_PATH=clamdscan
```

## How It Works

1. **File Upload**: When a file is uploaded, it's scanned before being saved
2. **Virus Detection**: If a virus is detected, the upload is blocked
3. **Clean Files**: Only clean files are stored in the database
4. **Error Messages**: Users see clear error messages if a virus is detected

## Testing

To test virus scanning, you can use the EICAR test file:
```bash
echo 'X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' > test.txt
```

**Note**: This is a harmless test file that all antivirus software detects as a virus for testing purposes.

## Troubleshooting

### ClamAV not found
- Make sure ClamAV is installed: `which clamscan` or `which clamdscan`
- Check if ClamAV daemon is running: `ps aux | grep clamd`

### Scan timeout
- Increase timeout in code if needed
- Check ClamAV daemon is running for faster scans

### Disable scanning
Set `ENABLE_VIRUS_SCAN=false` in `.env` to disable virus scanning (not recommended for production).

