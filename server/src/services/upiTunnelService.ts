import { spawn, ChildProcess } from "child_process";
import fs from "fs";

class UpiTunnelService {
  private cfProcess: ChildProcess | null = null;
  private tunnelUrl: string | null = null;
  private isConnecting: boolean = false;
  private activePort: number = 5000;

  private getCloudflaredPath(): string {
    const defaultPath = "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe";
    if (fs.existsSync(defaultPath)) return defaultPath;
    const fallbackPath = "C:\\Program Files\\cloudflared\\cloudflared.exe";
    if (fs.existsSync(fallbackPath)) return fallbackPath;
    return "cloudflared";
  }

  public async startTunnel(port: number = 5000): Promise<string | null> {
    this.activePort = port;
    if (this.tunnelUrl) return this.tunnelUrl;
    if (this.isConnecting) {
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (this.tunnelUrl) return this.tunnelUrl;
        if (!this.isConnecting) break;
      }
    }

    this.isConnecting = true;
    const binary = this.getCloudflaredPath();

    return new Promise<string | null>((resolve) => {
      try {
        console.log(`[Cloudflare Tunnel] Starting Cloudflare Quick Tunnel for port ${port}...`);
        const proc = spawn(binary, ["tunnel", "--url", `http://127.0.0.1:${port}`]);
        this.cfProcess = proc;

        let hasResolved = false;
        const timeout = setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            this.isConnecting = false;
            console.warn("[Cloudflare Tunnel] Timeout waiting for tunnel URL.");
            resolve(this.tunnelUrl);
          }
        }, 15000);

        proc.stderr?.on("data", (data: Buffer) => {
          const text = data.toString();
          const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
          if (match && !this.tunnelUrl) {
            this.tunnelUrl = match[0];
            console.log(`[Cloudflare Tunnel] ✅ Enterprise HTTPS Tunnel Active: ${this.tunnelUrl}`);
            if (!hasResolved) {
              hasResolved = true;
              clearTimeout(timeout);
              this.isConnecting = false;
              resolve(this.tunnelUrl);
            }
          }
        });

        proc.on("close", (code) => {
          console.warn(`[Cloudflare Tunnel] Process exited with code ${code}.`);
          this.tunnelUrl = null;
          this.cfProcess = null;
          this.isConnecting = false;
        });

        proc.on("error", (err) => {
          console.error("[Cloudflare Tunnel] Process error:", err);
          this.tunnelUrl = null;
          this.cfProcess = null;
          this.isConnecting = false;
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            resolve(null);
          }
        });
      } catch (err: any) {
        console.error("[Cloudflare Tunnel] Failed to launch:", err?.message || err);
        this.isConnecting = false;
        resolve(null);
      }
    });
  }

  public getTunnelUrl(): string | null {
    return this.tunnelUrl;
  }

  public isTunnelActive(): boolean {
    return !!this.tunnelUrl;
  }

  public async restartTunnel(port?: number): Promise<string | null> {
    await this.closeTunnel();
    return this.startTunnel(port || this.activePort);
  }

  public async closeTunnel(): Promise<void> {
    if (this.cfProcess) {
      try {
        this.cfProcess.kill("SIGKILL");
      } catch {}
      this.cfProcess = null;
      this.tunnelUrl = null;
    }
  }
}

export const upiTunnelService = new UpiTunnelService();
