"""Deploy server.mjs to the iAutoApply automation VPS and restart the service."""
import sys
import paramiko

HOST = "216.230.234.67"
USER = "root"
PASSWORD = "D%8Y!903wcpp"
LOCAL = r"C:/Users/workpc/Desktop/iautoaply/vps-automation/server.mjs"
REMOTE = "/opt/iautoaply-automation/server.mjs"


def main() -> int:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    print(f"Connected to {HOST}", flush=True)

    sftp = client.open_sftp()
    sftp.put(LOCAL, REMOTE)
    print(f"Uploaded {LOCAL} -> {REMOTE}", flush=True)
    sftp.close()

    # Restart and check status.
    cmd = (
        "systemctl restart iautoaply-automation && "
        "sleep 2 && "
        "systemctl is-active iautoaply-automation && "
        "echo '---recent-logs---' && "
        "journalctl -u iautoaply-automation -n 20 --no-pager"
    )
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    print("STDOUT:", out, flush=True)
    if err:
        print("STDERR:", err, flush=True)

    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
